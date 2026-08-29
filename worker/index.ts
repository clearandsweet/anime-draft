import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  setCloudflareDb,
  setCloudflareR2,
  setRuntimeGoogleApiKey,
  setRuntimeLobbyDeletePassword,
} from "../app/api/runtimeStorage";

interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  R2?: R2Bucket;
  GOOGLE_API_KEY?: string;
  LOBBY_DELETE_PASSWORD?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(
    request: Request,
    env: Env | undefined,
    ctx: ExecutionContext | undefined
  ): Promise<Response> {
    const runtimeEnv = env ?? {};
    setCloudflareDb(runtimeEnv.DB);
    setCloudflareR2(runtimeEnv.R2);
    setRuntimeGoogleApiKey(runtimeEnv.GOOGLE_API_KEY);
    setRuntimeLobbyDeletePassword(runtimeEnv.LOBBY_DELETE_PASSWORD);
    const url = new URL(request.url);

    if (
      url.pathname === "/_vinext/image" &&
      runtimeEnv.ASSETS &&
      runtimeEnv.IMAGES
    ) {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            runtimeEnv.ASSETS!.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await runtimeEnv.IMAGES!.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths
      );
    }

    return handler.fetch(request, runtimeEnv, ctx);
  },
};

export default worker;

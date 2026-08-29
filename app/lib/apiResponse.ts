export async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("This game is not publicly available yet. Reload in a moment and try again.");
    }
    if (response.status >= 500) {
      throw new Error("The game service is temporarily unavailable. Please try again in a moment.");
    }
    throw new Error("The game service returned an unexpected response. Please reload and try again.");
  }
  return (await response.json()) as T;
}

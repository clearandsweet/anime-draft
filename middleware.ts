import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const pathname = request.nextUrl.pathname;

  if (host === "animedraft.godisaloli.com" && (pathname === "/" || pathname === "/anime-draft")) {
    const url = request.nextUrl.clone();
    url.pathname = "/draft";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

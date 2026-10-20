import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/login"];
const AUTH_OFF = process.env.SITE_AUTH_OFF === "1";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Local preview: skip middleware wall (studio page keeps its own gate)
  if (AUTH_OFF) {
    return NextResponse.next();
  }

  const session = request.cookies.get("site_session")?.value;
  const isPublic = PUBLIC.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthApi = pathname.startsWith("/api/auth/");

  if (isAuthApi) {
    return NextResponse.next();
  }

  const authed = Boolean(session && session.length > 0);

  if (!authed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (authed && pathname === "/login") {
    const url = request.nextUrl.clone();
    const from = request.nextUrl.searchParams.get("from") || "/studio";
    url.pathname = from.startsWith("/") ? from : "/studio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

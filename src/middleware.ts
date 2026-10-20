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
  // Skills push has its own bearer-token auth (fails closed with 503
  // when unconfigured), so it must not be bounced to the login page.
  const isSkillsApi = pathname.startsWith("/api/skills/");

  if (isAuthApi || isSkillsApi) {
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
    // Preview mode: let the owner view the login gate design without
    // logging out or opening an incognito window. No content is exposed —
    // /login renders only the credential form, auth still goes through
    // /api/auth/login.
    if (request.nextUrl.searchParams.get("preview") === "1") {
      return NextResponse.next();
    }
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

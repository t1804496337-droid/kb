import { NextResponse } from "next/server";

/**
 * S2 stub: any non-empty password sets `site_session` cookie.
 * Later: compare against bcrypt hash from env SITE_PASSWORD_HASH.
 * Lockout (5 fails / 15 min) also deferred.
 */
export async function POST(request: Request) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!password.trim()) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  // TODO(S2→prod): bcrypt.compare(password, process.env.SITE_PASSWORD_HASH)
  const res = NextResponse.json({ ok: true });
  res.cookies.set("site_session", "local-demo", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // secure: true in production
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

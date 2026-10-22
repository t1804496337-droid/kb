import { NextResponse } from "next/server";

/**
 * Studio / site gate.
 * Credentials come only from the environment:
 *   SITE_AUTH_USER / SITE_AUTH_PASS
 *   or, when those are unset, NEXT_PUBLIC_STUDIO_USER / NEXT_PUBLIC_STUDIO_PASS
 * If neither pair is set, login fails closed. There is no default password.
 * The password lives in the Vercel project env, not in this repo.
 */
function readCredentials(): { user: string; pass: string } | null {
  // Dynamic lookup so Next does not inline these at build time.
  // Vercel injects SITE_AUTH_* at runtime; a missing pair must fail closed.
  const env = process.env;
  const user = (env.SITE_AUTH_USER || env.NEXT_PUBLIC_STUDIO_USER || "").trim();
  const pass = env.SITE_AUTH_PASS || env.NEXT_PUBLIC_STUDIO_PASS || "";
  if (!user || pass.length === 0) return null;
  return { user, pass };
}

export async function POST(request: Request) {
  const creds = readCredentials();
  if (!creds) {
    return NextResponse.json({ error: "登录未配置" }, { status: 503 });
  }

  let username = "";
  let password = "";
  let remember = false;
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      remember?: unknown;
    };
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
    remember = body.remember === true;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!username || !password.trim()) {
    return NextResponse.json(
      { error: "请输入用户名和密码" },
      { status: 400 },
    );
  }

  if (username !== creds.user || password !== creds.pass) {
    return NextResponse.json(
      { error: "用户名或密码不正确" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, user: creds.user });
  // Same token, same flags — only the lifetime differs: "remember me"
  // gets a 30-day persistent cookie; otherwise a session cookie (no
  // Max-Age/Expires) that dies with the browser.
  res.cookies.set("site_session", `ok:${creds.user}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  return res;
}

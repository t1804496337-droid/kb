import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  const session = jar.get("site_session")?.value;
  const ok = Boolean(session && session.length > 0);
  return NextResponse.json({
    ok,
    user: ok && session?.startsWith("ok:") ? session.slice(3) : ok ? "tang" : null,
  });
}

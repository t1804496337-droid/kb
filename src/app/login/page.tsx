"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  // Warm the studio route while the user types, so the success
  // transition hands over to a ready page (data first, show after).
  React.useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from") || "/studio";
    router.prefetch(from.startsWith("/") ? from : "/studio");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "登录失败");
        return;
      }
      try {
        window.localStorage.setItem("studio_session", "1");
      } catch {
        /* ignore */
      }
      const from = new URLSearchParams(window.location.search).get("from") || "/studio";
      // Success transition (0.8s): silk radiates from the card,
      // then the landing catches it. Auth already completed
      // above — the show never gates the data. Reduced motion skips
      // straight through.
      setLeaving(true);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise((r) => setTimeout(r, reduced ? 0 : 800));
      router.replace(from.startsWith("/") ? from : "/studio");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setPending(false);
    }
  }

  // Placeholder reset hook: there is no self-service password change —
  // the key lives in the server env (SITE_AUTH_PASS). The link only
  // unfolds the real instructions for rotating it.
  const onResetPassword = () => setResetOpen((v) => !v);

  // Radiating silk endpoints for the success transition (12 rays).
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    return { x: 400 + Math.cos(a) * 390, y: 400 + Math.sin(a) * 390, d: `${(i % 4) * 0.03}s` };
  });

  return (
    <div
      className="studio-login-page tac-login"
      data-testid="site-login"
      data-leaving={leaving ? "1" : undefined}
    >
      {/* Tactical darkroom backdrop (hud-login-tactical): radial cold
          halo behind the card + corner anchors. Pure CSS — no
          external imagery, no glowing geometry. */}
      <div className="tac-halo" aria-hidden />
      <div className="tac-anchor tac-tl" aria-hidden>
        <span className="tac-cross" />
        <span className="tac-tag">[ 0x01_GATEWAY ]</span>
      </div>
      <div className="tac-anchor tac-tr" aria-hidden>
        <span className="tac-tag">SYS.VER: 2.0</span>
        <span className="tac-cross" />
      </div>
      <div className="tac-anchor tac-bl" aria-hidden>
        <span className="tac-cross" />
        <span className="tac-tag">GRID 28 · CYAN 0.03</span>
      </div>
      <div className="tac-anchor tac-br" aria-hidden>
        <span className="tac-tag">AUTH · SECURE</span>
        <span className="tac-cross" />
      </div>
      <div className="tac-card-wrap">
        <span className="tac-cross tac-k-tl" aria-hidden />
        <span className="tac-cross tac-k-tr" aria-hidden />
        <span className="tac-cross tac-k-bl" aria-hidden />
        <span className="tac-cross tac-k-br" aria-hidden />
      <form className="studio-login-card" onSubmit={onSubmit}>
        <h1 className="studio-login-brand">
          <span className="tac-sq" aria-hidden />
          KB <span className="tac-dot">·</span> STUDIO
        </h1>
        <p className="studio-login-sub">
          <b>[ SYSTEM: GATEWAY_SECURE ]</b> 请输入神经凭证
        </p>
        <label className="studio-login-field">
          <span>ACCOUNT · 账号</span>
          <input
            data-testid="login-user"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="operator id"
          />
        </label>
        <label className="studio-login-field">
          <span>PASSWORD · 密钥</span>
          <input
            data-testid="login-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </label>
        <div className="studio-login-tools">
          <label className="studio-login-remember">
            <input
              type="checkbox"
              data-testid="login-remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              记住凭证 <em>REMEMBER</em>
            </span>
          </label>
          <button
            type="button"
            className="studio-login-reset"
            data-testid="login-reset"
            aria-expanded={resetOpen}
            onClick={onResetPassword}
          >
            [ 修改密钥 / RESET ]
          </button>
        </div>
        {resetOpen ? (
          <p className="studio-login-reset-note" data-testid="login-reset-note">
            密钥保存在服务器环境变量 SITE_AUTH_PASS
            中，无法在此自助修改。如需更换，请前往 Vercel
            项目设置更新该变量，并重新部署后生效。
          </p>
        ) : null}
        {error ? (
          <p className="studio-login-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="studio-login-submit"
          data-testid="login-submit"
          disabled={pending}
        >
          {pending ? "登录中…" : "进入"}
        </button>
        <p className="studio-login-foot" data-testid="login-foot">
          ENCRYPTION: AES-256 | TERMINAL: ACTIVE
        </p>
      </form>
      </div>
      {leaving && (
        <div className="login-transition" data-testid="login-transition" aria-hidden>
          <svg className="login-transition-silk" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
            {rays.map((r, i) => (
              <line key={i} x1={400} y1={400} x2={r.x} y2={r.y} style={{ animationDelay: r.d }} />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

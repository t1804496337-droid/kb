"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NeuralOrb } from "@/components/studio/neural-orb";

/**
 * Login gate backdrop variants (preview switch, Tang picks the winner):
 * - plate (default): the neural landing's orb 1:1 — plate image + core loop.
 * - a: NeuralOrb dimmed + blurred, quiet ambience behind the card.
 * - c: NeuralOrb video only — satellite node + cage layers hidden.
 * Switch with ?variant=a|c|plate on /login.
 */
function useVariant() {
  const [variant, setVariant] = React.useState("plate");
  React.useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("variant");
    if (v === "a" || v === "c" || v === "plate") setVariant(v);
  }, []);
  return variant;
}

export default function LoginPage() {
  const router = useRouter();
  const variant = useVariant();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Landing-plate loop: callback ref keeps it muted + playing
  // (React's muted prop alone is not reliable).
  const orbVideoRef = React.useCallback((el: HTMLVideoElement | null) => {
    if (el) {
      el.muted = true;
      void el.play().catch(() => {});
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
      router.replace(from.startsWith("/") ? from : "/studio");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="studio-login-page" data-testid="site-login">
      {variant === "plate" ? (
        <div className="studio-login-bgwrap" aria-hidden>
          <div className="studio-login-orb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="lp-orb-plate"
              src="/studio/landing/orb-plate.webp"
              alt=""
              draggable={false}
            />
            <video
              ref={orbVideoRef}
              className="lp-orb-loop"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            >
              <source src="/studio/neural-orb.webm" type="video/webm" />
              <source src="/studio/neural-orb.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      ) : (
        <div className={`studio-login-variant-${variant}`} aria-hidden>
          <NeuralOrb className="studio-orb-bg" theme="silver" />
        </div>
      )}
      <div className="studio-login-glow" aria-hidden />
      <form className="studio-login-card" onSubmit={onSubmit}>
        <p className="studio-login-brand">
          TANG <span>NEURAL</span>
        </p>
        <h1>登录工作台</h1>
        <p className="studio-login-sub">银黑门禁 · 进入后进入神经登录页</p>
        <label className="studio-login-field">
          <span>用户名</span>
          <input
            data-testid="login-user"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tang"
          />
        </label>
        <label className="studio-login-field">
          <span>密码</span>
          <input
            data-testid="login-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
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
          <span>ENTER</span>
        </button>
      </form>
    </div>
  );
}

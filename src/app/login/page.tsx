"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

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

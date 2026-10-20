"use client";

import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Odometer } from "@/components/ui/odometer";
import { Reveal } from "@/components/ui/reveal";

const STEPS = [
  { n: "01", title: "收集参考", desc: "真实界面 / 笔记素材", pct: 100, done: true },
  { n: "02", title: "决策落地", desc: "材质 · 动效 · 组件", pct: 80, done: true },
  { n: "03", title: "本地渲染", desc: "预览验收", pct: 60, active: true },
  { n: "04", title: "同步仓库", desc: "Git → 部署（未开）", pct: 20 },
];

export default function WorkflowsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto px-1 pb-1">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <Reveal delayMs={i * 70}>
              <Card
                className={`w-[200px] shrink-0 ${s.active ? "wf-pulse border-accent/40" : ""}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-[11px] text-accent">
                    {s.n}
                    {s.active ? (
                      <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                        进行中
                      </span>
                    ) : null}
                    {s.done && !s.active ? (
                      <span className="ml-2 text-[10px] text-muted">✓</span>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="mt-1 text-xs text-muted">{s.desc}</p>
                  <div className="bar-track mt-3">
                    <div className="bar-fill" style={{ width: `${s.pct}%` }} />
                  </div>
                </CardContent>
              </Card>
            </Reveal>
            {i < STEPS.length - 1 ? (
              <ArrowRight className="h-4 w-4 shrink-0 text-accent/50" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4">
        <Reveal className="md:col-span-8" delayMs={120}>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">流程说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              读取{" "}
              <code className="font-mono text-accent">_site/workflows/*.md</code>
              。工作流 Markdown 卡片将在 S6 接入；当前为本地 stub 预览。
              时间轴上「本地渲染」带轻量脉冲，标示当前阶段。
            </CardContent>
          </Card>
        </Reveal>
        <Reveal className="md:col-span-4" delayMs={180}>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">健康度</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                <Odometer value={73} />{" "}
                <span className="text-sm font-normal text-accent">Healthy</span>
              </p>
              <div className="score-blocks mt-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className={`score-block ${i < 7 ? "on" : ""}`} />
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

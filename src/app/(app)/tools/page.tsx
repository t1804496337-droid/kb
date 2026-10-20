"use client";

import { ExternalLink, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";

const TOOLS = [
  { name: "GitHub", desc: "私有 kb 仓库", href: "#" },
  { name: "Vercel", desc: "部署面板（未开）", href: "#" },
  { name: "Obsidian", desc: "本机知识库", href: "#" },
  { name: "Linear 气质", desc: "参考 · 安静侧栏", href: "https://linear.app" },
  { name: "shadcn/ui", desc: "组件源", href: "https://ui.shadcn.com" },
  { name: "UI Radar", desc: "本预览气质来源", href: "#" },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 md:items-start">
        {TOOLS.map((t, i) => (
          <Reveal key={t.name} delayMs={i * 55}>
            <a
              href={t.href}
              target={t.href.startsWith("http") ? "_blank" : undefined}
              rel={t.href.startsWith("http") ? "noreferrer" : undefined}
              className="block"
            >
              <Card className="tool-magnet h-full">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Wrench className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  {t.href.startsWith("http") ? (
                    <ExternalLink className="h-3.5 w-3.5 text-muted" />
                  ) : null}
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base font-medium text-foreground">
                    {t.name}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted">{t.desc}</p>
                </CardContent>
              </Card>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

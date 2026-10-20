"use client";

import * as React from "react";
import { Folder, Tag, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SharedExpand } from "@/components/ui/shared-expand";
import { FluidCapsule } from "@/components/ui/fluid-capsule";
import { Reveal } from "@/components/ui/reveal";
import { openCommandPalette } from "@/components/layout/command-palette";

const FOLDERS = [
  { name: "AI视频情报库", hint: "情报与周报", pct: 70, detail: "周报模板、竞品切片、提示词草稿。" },
  { name: "skills", hint: "技能与提示词", pct: 50, detail: "可复用 skill 片段与 Agent 约定。" },
  { name: "_site", hint: "站点配置 / 工作流 / 工单", pct: 35, detail: "workflows · tickets · 决策记录。" },
  { name: "inbox", hint: "未整理", pct: 20, detail: "待归档剪贴与临时笔记。" },
];

const TAGS = ["#模板", "#流程", "#决策", "#工具", "#周报"];

export default function KnowledgeBasePage() {
  const [activeTag, setActiveTag] = React.useState<string | null>(TAGS[0]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="glass-pill flex min-w-[220px] flex-1 items-center gap-2 rounded-full px-3 py-2 text-left"
        >
          <Search className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-sm text-muted">搜索笔记标题与正文…</span>
          <kbd className="ml-auto rounded border border-white/10 px-1.5 font-mono text-[11px] text-muted">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4 md:items-start">
        <section className="md:col-span-8">
          <p className="mb-3 flex items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <Folder className="h-3.5 w-3.5 text-accent" /> 文件夹
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FOLDERS.map((f, i) => (
              <Reveal key={f.name} delayMs={i * 60}>
                <SharedExpand
                  title={f.name}
                  subtitle={`${f.hint} · ${f.pct}%`}
                >
                  <div className="bar-track mb-2">
                    <div className="bar-fill" style={{ width: `${f.pct}%` }} />
                  </div>
                  <p className="text-xs text-muted">{f.detail}</p>
                </SharedExpand>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="md:col-span-4">
          <p className="mb-3 flex items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <Tag className="h-3.5 w-3.5 text-accent" /> 标签
          </p>
          <Reveal delayMs={80}>
            <Card>
              <CardContent className="flex flex-wrap gap-2 pt-5">
                {TAGS.map((t) => (
                  <FluidCapsule
                    key={t}
                    role="button"
                    tabIndex={0}
                    active={activeTag === t}
                    onClick={() => setActiveTag(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveTag(t);
                      }
                    }}
                    className="cursor-pointer text-foreground/90"
                  >
                    {t}
                  </FluidCapsule>
                ))}
              </CardContent>
            </Card>
          </Reveal>
          <Reveal delayMs={140}>
            <Card className="mt-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground">
                  {activeTag ?? "标签"} · 预览
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted">
                笔记列表与 Markdown 渲染将在 S3 接入 Obsidian 库后出现。
                当前选中 <span className="text-accent">{activeTag}</span>。
              </CardContent>
            </Card>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Status = "待办" | "进行中" | "完成";

type Ticket = {
  id: string;
  title: string;
  pri: string;
  status: Status;
};

const INITIAL: Ticket[] = [
  { id: "T-01", title: "接入 Obsidian 仓库", pri: "高", status: "待办" },
  { id: "T-02", title: "FlexSearch 中文索引", pri: "中", status: "待办" },
  { id: "T-03", title: "UI Radar 本地预览", pri: "高", status: "进行中" },
  { id: "T-00", title: "S2 站点骨架 + 登录", pri: "—", status: "完成" },
];

const STATUSES: Status[] = ["待办", "进行中", "完成"];

const COL_META: Record<Status, { color: string }> = {
  待办: { color: "text-warning" },
  进行中: { color: "text-accent" },
  完成: { color: "text-success" },
};

function cycleStatus(s: Status): Status {
  const i = STATUSES.indexOf(s);
  return STATUSES[(i + 1) % STATUSES.length]!;
}

export default function TicketsPage() {
  const [tickets, setTickets] = React.useState(INITIAL);

  const byCol = (status: Status) => tickets.filter((t) => t.status === status);

  const bump = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: cycleStatus(t.status) } : t))
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="mb-3 px-1 text-xs text-muted">
        点击状态芯片可循环切换 · 本地 stub（无拖拽，避免卡顿）
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 md:items-start">
        {STATUSES.map((col, colIdx) => (
          <div key={col} className="space-y-3">
            <p
              className={`px-1 font-mono text-[11px] uppercase tracking-[0.16em] ${COL_META[col].color}`}
            >
              {col} · {byCol(col).length}
            </p>
            {byCol(col).map((item, i) => (
              <Reveal key={item.id} delayMs={colIdx * 40 + i * 50}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-mono text-[11px] text-accent">
                      {item.id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="pill bg-white/5 text-muted">
                        优先级 {item.pri}
                      </span>
                      <button
                        type="button"
                        onClick={() => bump(item.id)}
                        className={cn(
                          "status-chip pill border border-white/10 bg-white/5",
                          COL_META[item.status].color
                        )}
                        title="点击切换状态"
                      >
                        {item.status} ›
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

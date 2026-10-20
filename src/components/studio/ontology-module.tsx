import * as React from "react";
import { Network } from "lucide-react";

/**
 * 本体知识库 · 模块空壳
 *
 * 今晚（2026-10-20）只搭壳：模块经 page.tsx 的种子机制注册（同健康/财务），
 * 落地页枢纽与工作台地图自动获得节点，计数走通用口径（暂无数据 = 0）。
 * 内容细节明天与 Tang 定了再往里填——这里不预置任何数据结构或条目，
 * 只渲染与站内空状态同款的「建设中」占位。
 */
export function OntologyModuleView() {
  return (
    <div data-testid="ontology-module-view">
      <div className="studio-glass flex min-h-[220px] flex-col items-center justify-center gap-2 border border-dashed border-[color:var(--studio-border)] px-4 py-8 text-center">
        <Network className="h-5 w-5 text-[color:var(--studio-muted)]" />
        <p className="text-[12px] font-medium">建设中</p>
        <p className="text-[10px] text-[color:var(--studio-muted)]">
          本体知识库 · 内容细节待定
        </p>
      </div>
    </div>
  );
}

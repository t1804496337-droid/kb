/**
 * /studio/ring/<module> —— 第二主题子模块暗色工作台（独立路由）。
 * 9 子模块 + 3 个非模块环位详情页（snapshot / exec-log / health-sync），
 * 共用 ring-module-shell 三段式骨架；全部只读呈现同源数据，录入回
 * 第一主题（壳内有入口）。名单与元数据见 ring/modules/meta.ts，
 * 未登记 id 一律 404。门禁沿用全站 middleware，AppShell 对 /studio/
 * 前缀透传使本页天然全屏。
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MODULE_VIEWS } from "@/components/ring/modules/registry";
import { ALL_PAGES, metaOf } from "@/components/ring/modules/meta";

/* 内容全部来自客户端只读数据（localStorage / 公共 JSON）；路由段以
 * generateStaticParams 具体化全部登记 id，未登记 id 运行时 404。 */
export function generateStaticParams() {
  return ALL_PAGES.map((m) => ({ module: m.id }));
}

type Props = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  const meta = metaOf(module);
  return {
    title: meta ? `${meta.cn} · ${meta.en} — 神经星环` : "神经星环 · NEURAL RING",
  };
}

export default async function RingModulePage({ params }: Props) {
  const { module } = await params;
  const View = MODULE_VIEWS[module];
  if (!View) notFound();
  return <View />;
}

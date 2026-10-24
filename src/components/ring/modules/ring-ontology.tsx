"use client";

/** 第二主题 · 本体知识库（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadOntology } from "./data";

export default function RingOntology() {
  return <ModPage id="ontology" load={loadOntology} />;
}

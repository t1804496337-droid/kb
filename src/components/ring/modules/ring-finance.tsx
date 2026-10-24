"use client";

/** 第二主题 · 财务管理（只读呈现）：账目列表 + 收支合计（自条目实算）。 */

import { useEffect, useState } from "react";
import RingModuleShell from "./ring-module-shell";
import { DetailView, GroupList, findRow, firstRowId } from "./list-ui";
import { metaOf } from "./meta";
import { loadFinance } from "./data";
import type { ModData } from "./data";

export default function RingFinance() {
  const meta = metaOf("finance");
  const [data, setData] = useState<(ModData & { income: number; expense: number }) | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    Promise.resolve()
      .then(() => loadFinance())
      .then((d) => {
        if (!on) return;
        setData(d);
        setLoaded(true);
        setSelectedId(firstRowId(d));
      });
    return () => {
      on = false;
    };
  }, []);

  if (!meta) return null;
  const row = findRow(data, selectedId);
  const note = data
    ? `收入合计 ¥${data.income} · 支出合计 ¥${data.expense} · 结余 ¥${data.income - data.expense}（自条目实算）`
    : undefined;
  return (
    <RingModuleShell
      active={meta.id}
      cn={meta.cn}
      en={meta.en}
      src={meta.src}
      count={loaded ? (data?.total ?? 0) : null}
      note={note}
      detail={<DetailView row={row} />}
    >
      <GroupList
        data={data}
        loaded={loaded}
        selectedId={selectedId}
        onSelect={(r) => setSelectedId(r.id)}
      />
    </RingModuleShell>
  );
}

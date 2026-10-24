"use client";

/**
 * 第二主题子模块通用页：装配共用壳 + 列表 + 详情联动。
 * 数据经 data.ts 只读加载（挂载后读一次），选中态只在内存。
 */

import { useEffect, useRef, useState } from "react";
import RingModuleShell from "./ring-module-shell";
import { DetailView, GroupList, findRow, firstRowId } from "./list-ui";
import { metaOf } from "./meta";
import type { ModData } from "./data";

export default function ModPage({
  id,
  load,
}: {
  id: string;
  load: () => ModData | Promise<ModData>;
}) {
  const meta = metaOf(id);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [data, setData] = useState<ModData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    Promise.resolve()
      .then(() => loadRef.current())
      .then((d) => {
        if (!on) return;
        setData(d);
        setLoaded(true);
        setSelectedId(firstRowId(d));
      })
      .catch(() => {
        if (!on) return;
        setData({ groups: [], total: 0, note: "读取失败 · 离线呈现" });
        setLoaded(true);
      });
    return () => {
      on = false;
    };
  }, []);

  if (!meta) return null;
  const row = findRow(data, selectedId);
  return (
    <RingModuleShell
      active={meta.id}
      cn={meta.cn}
      en={meta.en}
      src={meta.src}
      count={loaded ? (data?.total ?? 0) : null}
      note={data?.note}
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

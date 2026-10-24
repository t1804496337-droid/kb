"use client";

/** 第二主题子模块共用列表 / 详情呈现（纯展示，无数据写入）。 */

import styles from "./styles/modules.module.css";
import type { ModData, ModRow } from "./data";

export function GroupList({
  data,
  loaded,
  selectedId,
  onSelect,
}: {
  data: ModData | null;
  loaded: boolean;
  selectedId: string | null;
  onSelect: (row: ModRow) => void;
}) {
  if (!loaded) return <div className={styles.empty}>读取中…</div>;
  const rowCount = data
    ? data.groups.reduce((n, g) => n + g.rows.length, 0)
    : 0;
  if (!data || rowCount === 0) {
    return <div className={styles.empty}>— 暂无数据 · 待填装</div>;
  }
  return (
    <>
      {data.groups.map((g) => (
        <section key={g.id} className={styles.group}>
          <div className={styles.groupHead}>
            {g.label} · <b>{g.rows.length}</b>
          </div>
          {g.rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`${styles.row} ${row.id === selectedId ? styles.rowSel : ""}`}
              onClick={() => onSelect(row)}
            >
              {row.chip ? <span className={styles.rowChip}>{row.chip}</span> : null}
              <span className={styles.rowTitle}>{row.title}</span>
              {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
            </button>
          ))}
        </section>
      ))}
    </>
  );
}

export function DetailView({ row }: { row: ModRow | null }) {
  if (!row) {
    return (
      <>
        <div className={styles.detailHead}>DETAIL · 详情</div>
        <div className={styles.detailEmpty}>— 在中间列表选择一条查看详情</div>
      </>
    );
  }
  return (
    <>
      <div className={styles.detailHead}>DETAIL · 详情</div>
      <div className={styles.detailTitle}>{row.title}</div>
      {row.fields.length > 0 && (
        <dl className={styles.fields}>
          {row.fields.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>
                {/^https?:\/\//.test(v) ? (
                  <a href={v} target="_blank" rel="noreferrer">
                    {v}
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {row.body ? (
        <div
          className={`${styles.detailBody} ${row.mono ? styles.detailBodyMono : ""}`}
        >
          {row.body}
        </div>
      ) : null}
    </>
  );
}

/** 在 ModData 里按 id 找行（供默认选中与详情联动）。 */
export function findRow(data: ModData | null, id: string | null): ModRow | null {
  if (!data || !id) return null;
  for (const g of data.groups) {
    const r = g.rows.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}

export function firstRowId(data: ModData | null): string | null {
  if (!data) return null;
  for (const g of data.groups) {
    if (g.rows.length) return g.rows[0].id;
  }
  return null;
}

/**
 * 突触网格（方案 §2.2）：12 环位行 × 12 个 5 分钟桶的真实事件计数
 * （derive.synapseBuckets）。格值即计数，0 不点亮；近一小时无事件
 * 的环位整行留空——不许装饰点阵充数。
 */
import { Fragment } from "react";
import styles from "../styles/board.module.css";
import { SLOT_DEFS } from "../data/surfaces";

const levelOf = (v: number): string =>
  v <= 0 ? "" : v === 1 ? styles.l1 : v === 2 ? styles.l2 : v === 3 ? styles.l3 : styles.l4;

export function SynapseGrid({
  buckets,
  focus,
}: {
  buckets: number[][];
  focus: number | null;
}) {
  return (
    <section className={`${styles.panel} ${styles.syn}`}>
      <div className={styles.pHead}>
        <span>SYNAPSE GRID · 突触网格</span>
        <span className={styles.dim}>5 MIN / CELL</span>
      </div>
      <div className={styles.synGrid}>
        <span className={styles.synHead} />
        {Array.from({ length: 12 }, (_, c) => (
          <span key={c} className={styles.synHead}>
            {c === 11 ? "NOW" : (c - 11) * 5}
          </span>
        ))}
        {SLOT_DEFS.map((def, r) => (
          <Fragment key={def.id}>
            <span
              className={`${styles.synLab} ${focus === r ? styles.focus : ""}`}
            >
              {def.short}
            </span>
            {Array.from({ length: 12 }, (_, c) => {
              const v = buckets[r]?.[c] ?? 0;
              return (
                <span
                  key={`${def.id}-${c}`}
                  className={`${styles.cell} ${levelOf(v)} ${
                    c === 11 && v > 0 ? styles.hot : ""
                  }`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className={styles.synCap}>
        行 = 环位 · 列 = 近 60 分钟 5 分钟桶 · 格值 = 该环位真实事件计数（exec
        日志派生）
        <br />
        空格 = 该桶无事件 · 不点亮
      </div>
    </section>
  );
}

/**
 * 左列 12 槽（方案 §2.2）：序号 / 中文名 / 英文代号 / 真实计数 /
 * 相对进度轨 / 数据源行。状态色由 SlotData.state 判定——有数绿、
 * 零灰、健康同步异常琥珀、无源灰显「—」。槽位恒定 12（裁定③）。
 */
import styles from "../styles/board.module.css";
import { SLOT_DEFS } from "../data/surfaces";
import type { SlotData } from "../data/types";

const STATE_CLASS: Record<SlotData["state"], string> = {
  ok: styles.stOk,
  zero: styles.stZero,
  stale: styles.stStale,
  unknown: styles.stUnknown,
};

export function SlotRail({
  slots,
  focus,
  onFocus,
}: {
  slots: SlotData[];
  focus: number | null;
  onFocus: (slotIdx: number | null) => void;
}) {
  return (
    <section className={`${styles.panel} ${styles.slots}`}>
      <div className={styles.pHead}>
        <span>RING SLOTS · 环位状态</span>
        <span className={styles.dim}>12 SLOTS</span>
      </div>
      <div className={styles.slotGrid}>
        {SLOT_DEFS.map((def, i) => {
          const sd = slots[i];
          const cntClass =
            sd?.state === "stale"
              ? styles.stale
              : sd?.countText === "OK"
                ? styles.ok
                : sd?.count === null || sd?.count === undefined
                  ? styles.mut
                  : "";
          return (
            <div
              key={def.id}
              className={`${styles.slot} ${sd ? STATE_CLASS[sd.state] : ""} ${
                focus === i ? styles.focus : ""
              }`}
              onClick={() => onFocus(focus === i ? null : i)}
            >
              <div className={styles.sRow1}>
                <span className={styles.sNo}>
                  {String(def.idx).padStart(2, "0")}
                </span>
                <span className={styles.sName}>{def.cn}</span>
                <span className={styles.sEn}>{def.en}</span>
                <span className={`${styles.sCnt} ${cntClass}`}>
                  {sd
                    ? (sd.countText ?? (sd.count === null ? "—" : sd.count))
                    : "—"}
                  {sd?.unit ? <small>{sd.unit}</small> : null}
                </span>
              </div>
              <div className={styles.sBar}>
                <i style={{ width: `${Math.round((sd?.ratio ?? 0) * 100)}%` }} />
              </div>
              <div className={styles.sSrc}>{sd ? sd.src : def.srcLabel}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 顶栏：标题块 + LAST EVENT 槽（方案 §2.2）。
 * LAST EVENT = 执行日志末条的 execLineText 原文；无日志显示明确空态，
 * 不许拿占位文案充数。时钟为本机真实时间（1s 刷新，由 surface 传入）。
 */
import styles from "../styles/board.module.css";

export function TitleBlock({ now }: { now: Date }) {
  const p = (n: number) => String(n).padStart(2, "0");
  const clock = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  return (
    <div className={styles.titleBlock}>
      <div className={styles.kicker}>SURFACE · RING · NEURAL ORBIT</div>
      <div className={styles.hTitle}>
        NEURAL RING <span className={styles.thin}>神经星环</span>
      </div>
      <div className={styles.subRow}>
        <span>
          13 团 = <b>创作空间 HUB</b> + <b>12 真实数据面</b>
        </span>
        <span>本地数据 · 只读消费</span>
        <span className={styles.clock}>LOCAL {clock}</span>
      </div>
    </div>
  );
}

export function LastEvent({ line }: { line: string | null }) {
  return (
    <div className={`${styles.panel} ${styles.lastEvent}`}>
      <div className={styles.lab}>
        <span>◉ LAST EVENT</span>
        <span className={styles.dim}>studio_exec_log_v1 · 末条</span>
      </div>
      {line ? (
        <div className={styles.txt}>{line}</div>
      ) : (
        <div className={`${styles.txt} ${styles.dim}`}>
          暂无执行日志 · NO EVENTS LOGGED
        </div>
      )}
    </div>
  );
}

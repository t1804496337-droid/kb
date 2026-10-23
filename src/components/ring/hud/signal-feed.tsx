/**
 * 信号流（方案 §2.2）：执行日志 studio_exec_log_v1 逐条真实播报，
 * 新条在前，上限 20 条（与 EXEC_LOG_MAX 同口径）；条数 = 日志实际
 * 条数，少于 20 就只显示实际条数，空日志显示明确空态。
 * 正文复用 execLineText 口径（去掉与行首时间列重复的前缀）。
 */
import styles from "../styles/board.module.css";
import { execLineText, execTag, fmtHM } from "../data/derive";
import type { ExecLogItem } from "../data/types";

const stripPrefix = (line: string): string =>
  line
    .replace(/^\[\d{2}:\d{2}:\d{2}\] /, "")
    .replace(/^\[[^\]]+\] /, "");

export function SignalFeed({ log }: { log: ExecLogItem[] }) {
  const rows = [...log].reverse();
  return (
    <section className={`${styles.panel} ${styles.feed}`}>
      <div className={styles.pHead}>
        <span>SIGNAL FEED · 信号流</span>
        <span className={styles.dim}>
          EXEC LOG · {log.length} / 20
        </span>
      </div>
      <div className={styles.feedList}>
        {rows.length === 0 ? (
          <div className={styles.feedEmpty}>
            暂无信号 · 执行日志为空（任何模块动作后在此播报）
          </div>
        ) : (
          rows.map((item, i) => (
            <div key={`${item.ts}-${i}`} className={styles.frow}>
              <span className={styles.ftime}>{fmtHM(item.ts)}</span>
              <span className={styles.ftag}>{execTag(item)}</span>
              <span
                className={`${styles.ftext} ${i === 0 ? styles.hot : ""}`}
              >
                {stripPrefix(execLineText(item))}
              </span>
            </div>
          ))
        )}
      </div>
      <div className={styles.fnote}>
        中文播报复用 execLineText 口径 · 与落地页日志同源同文
        <br />
        条数 = 日志实际条数（≤20）· 空槽 = 无事件，不补位
      </div>
    </section>
  );
}

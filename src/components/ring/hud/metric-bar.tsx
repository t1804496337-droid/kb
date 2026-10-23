/**
 * 底栏六格（方案 §2.3，逐格去假存真）：
 *  1 MODULES · ENTRIES —— 落地页同口径（MIRROR_OF：数据库为技能镜像，
 *    计行不计实体）；任一源缺失 → 实体数「—」。
 *  2 TOKEN 吞吐 —— 严格「—」+ NO SOURCE 黄标：本站无任何 Token
 *    计量源，永久占位为无源态，绝不填数字（用户裁定④）。
 *  3 EVENT 吞吐 —— 近 ≤20 条日志首末跨度推算，角标注明样本受限；
 *    样本不足 → 「—」。
 *  4 今日日历事项 —— date = 今日（Asia/Shanghai）的真实事项数
 *    （裁定④：原「今日交付」改此名）。
 *  5 SESSION —— 本页挂载起真实计时（HH:MM:SS 递增），非占位。
 *  6 SYSTEM LOAD —— 引擎 rAF 实测 FPS + 设备像素比 + Bloom 状态。
 */
import styles from "../styles/board.module.css";
import type { RingData } from "../data/types";

export type FpsInfo = { fps: number; dpr: number; bloom: boolean } | null;

const FLEX = [1.05, 1.5, 1.45, 1, 1.15, 1];

export function MetricBar({
  data,
  sessionText,
  fpsInfo,
}: {
  data: RingData | null;
  sessionText: string;
  fpsInfo: FpsInfo;
}) {
  return (
    <section
      className={`${styles.panel} ${styles.metrics}`}
      aria-label="底栏指标"
    >
      <div className={styles.metric} style={{ flex: FLEX[0] }}>
        <div className={styles.mLab}>MODULES · ENTRIES</div>
        <div className={styles.mVal}>
          {data?.modulesCount ?? "—"}
          <span className={styles.sep}>·</span>
          {data?.entitiesCount ?? "—"}
          {data?.rowsCount != null ? <small> / {data.rowsCount} 行</small> : null}
        </div>
        <div className={styles.mSub}>模块数 · 实体数（与落地页同口径）</div>
      </div>

      <div className={styles.metric} style={{ flex: FLEX[1] }}>
        <div className={styles.mLab}>
          TOKEN 吞吐 <span className={styles.nosrc}>NO SOURCE</span>
        </div>
        <div className={styles.mVal}>—</div>
        <div className={styles.mSub}>无计量源 · 不编造（方案 §0.2）</div>
      </div>

      <div className={styles.metric} style={{ flex: FLEX[2] }}>
        <div className={styles.mLab}>EVENT 吞吐 · 次/分</div>
        <div className={styles.mVal}>
          {data?.eventRate ?? "—"}
          {data?.eventRate != null ? <small> /min</small> : null}
        </div>
        <div className={styles.mSub}>
          {data
            ? `近 ${data.execLog.length} 条日志跨度推算 · 样本受限`
            : "执行日志推算"}
        </div>
      </div>

      <div className={styles.metric} style={{ flex: FLEX[3] }}>
        <div className={styles.mLab}>今日日历事项</div>
        <div className={styles.mVal}>{data?.todayCalendar ?? "—"}</div>
        <div className={styles.mSub}>studio_calendar_items_v1 · 今日</div>
      </div>

      <div className={styles.metric} style={{ flex: FLEX[4] }}>
        <div className={styles.mLab}>SESSION · 本页驻留</div>
        <div className={styles.mVal}>{sessionText}</div>
        <div className={styles.mSub}>挂载起真实计时</div>
      </div>

      <div className={styles.metric} style={{ flex: FLEX[5] }}>
        <div className={styles.mLab}>SYSTEM LOAD</div>
        <div className={styles.mVal}>
          {fpsInfo ? (
            <>
              {fpsInfo.fps}
              <small> FPS</small>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className={styles.mSub}>
          {fpsInfo
            ? `DPR ${fpsInfo.dpr.toFixed(2)} · BLOOM ${fpsInfo.bloom ? "ON" : "OFF"}`
            : "引擎采样中"}
        </div>
      </div>
    </section>
  );
}

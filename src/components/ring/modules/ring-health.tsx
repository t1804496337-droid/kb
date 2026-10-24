"use client";

/** 第二主题 · 身体健康：训练打卡 + 同步指标 + 手动同步 + 古法格子 + 训练清单。
 * 只写 3 个既有键（打卡 / 手动 / 古法）；写盘成功后发既有 HEALTH_SYNC
 * （moduleId=health），不新增事件类型。手动优先规则与挂载侧 health-effective 一致。 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import RingModuleShell from "./ring-module-shell";
import { emit } from "@/components/studio/bus";

const TRAIN_KEY = "studio_health_checkins_v1";
const MANUAL_KEY = "studio_health_manual_v1";
const ANCIENT_KEY = "studio_ancient_checkins_v1";

type SyncSleep = { date?: string; start?: string; end?: string; hours?: number };
type SyncFile = {
  updated_at?: string;
  sleep?: { last?: SyncSleep; last7?: { date?: string; hours?: number }[] };
  steps?: { today?: number | null; last7_avg?: number; avg7?: number };
  weight_kg?: number;
  diet?: { protein_target?: string; advice?: string; principles?: string };
};
type ManualHealth = {
  date: string;
  sleepHours?: number;
  steps?: number;
  sleepStart?: string;
  sleepEnd?: string;
};
type AncientChecks = Record<string, boolean>;
type MediaItem = { title: string; embed?: string; link: string; source: string };

/* 以下两组常量与挂载侧硬编码逐字一致，只读呈现，不自创动作与次数。 */
const TRAINING_MOVES: { id: string; name: string; reps: string; cue: string }[] = [
  { id: "main-band-squat", name: "弹力带深蹲", reps: "15–20 次", cue: "膝盖顺着脚尖方向" },
  { id: "main-bottle-press", name: "水瓶推举", reps: "12–15 次", cue: "水瓶代哑铃 · 核心收紧抓牢瓶身" },
  { id: "main-band-row", name: "弹力带划船", reps: "12–15 次", cue: "拉到胸前时肩胛骨夹紧" },
  { id: "main-glute-bridge", name: "臀桥", reps: "15–20 次", cue: "环形带套膝盖上方 · 顶到最高夹紧 1 秒" },
  { id: "main-bottle-curl", name: "水瓶弯举", reps: "12–15 次", cue: "大臂贴紧身体别动" },
  { id: "main-ab-wheel", name: "跪姿腹肌轮推出", reps: "8–10 次", cue: "推到快贴地就拉回 · 全程别塌腰" },
];
const TRAINING_EQUIP = ["弹力带套装（已有）", "腹肌轮（已有）", "水瓶代哑铃 1.5–2L 灌满", "瑜伽垫（可选）"];
const ANCIENT_MOVES: {
  id: string;
  name: string;
  en: string;
  tags: string[];
  dose: string;
  bv: string;
}[] = [
  { id: "shaer-wd20", name: "工作日默认 · 20 分钟跟练", en: "WEEKDAY DEFAULT", tags: ["站立跟练", "无器械", "零基础可跟"], dose: "每日 1 套 · 约 20 分钟", bv: "BV1mb7z6qEcC" },
  { id: "shaer-wd10", name: "工作日 10 分钟短版", en: "WEEKDAY QUICK", tags: ["赶时间降档", "保住不断档"], dose: "降档选项 · 约 10 分钟", bv: "BV1cr421N7DX" },
  { id: "shaer-wk35", name: "周末 35 分钟旗舰版", en: "WEEKEND FLAGSHIP", tags: ["长版", "最完整一版"], dose: "周末 1 套 · 约 35 分钟", bv: "BV1ynSBY2EeM" },
  { id: "shaer-wk30", name: "周末 30 分钟版", en: "WEEKEND ALT", tags: ["长版备选", "想短点用它"], dose: "周末备选 · 约 30 分钟", bv: "BV1KYwVe1EYd" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayLocalStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const hhmmNow = (): string => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const isDateStr = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};
const shiftISO = (iso: string, delta: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

/* 连续天数口径与挂载侧古法统计一致：从今天（未打则从昨天）逐日回溯，遇缺即停。 */
const streakOf = (days: Set<string>, today: string): number => {
  let cursor = days.has(today) ? today : shiftISO(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftISO(cursor, -1);
  }
  return streak;
};

function readTrainCheckins(): string[] {
  try {
    const raw = window.localStorage.getItem(TRAIN_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const days = v.filter(
      (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );
    return [...new Set(days)].sort();
  } catch {
    return [];
  }
}

function readManual(): ManualHealth | null {
  try {
    const raw = window.localStorage.getItem(MANUAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.date !== "string" || !isDateStr(o.date)) return null;
    const m: ManualHealth = { date: o.date };
    if (typeof o.sleepHours === "number" && Number.isFinite(o.sleepHours)) {
      m.sleepHours = o.sleepHours;
    }
    if (typeof o.steps === "number" && Number.isFinite(o.steps) && o.steps >= 0) {
      m.steps = o.steps;
    }
    if (typeof o.sleepStart === "string") m.sleepStart = o.sleepStart;
    if (typeof o.sleepEnd === "string") m.sleepEnd = o.sleepEnd;
    if (m.sleepHours === undefined && m.steps === undefined) return null;
    return m;
  } catch {
    return null;
  }
}

function readAncient(): AncientChecks {
  try {
    const raw = window.localStorage.getItem(ANCIENT_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: AncientChecks = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (isDateStr(k) && val === true) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export default function RingHealth() {
  const [checkins, setCheckins] = useState<string[]>([]);
  const [manual, setManual] = useState<ManualHealth | null>(null);
  const [ancient, setAncient] = useState<AncientChecks>({});
  const [sync, setSync] = useState<SyncFile | null>(null);
  const [syncOk, setSyncOk] = useState(false);
  const [media, setMedia] = useState<Record<string, MediaItem>>({});
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mDate, setMDate] = useState("");
  const [mSleep, setMSleep] = useState("");
  const [mSteps, setMSteps] = useState("");
  const [mErr, setMErr] = useState("");
  const [clearArm, setClearArm] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  /* 预渲染拦截 new Date()：今日字符串只在挂载 effect 内赋值，渲染侧用空串兜底。 */
  const [today, setToday] = useState("");

  useEffect(() => {
    setCheckins(readTrainCheckins());
    setManual(readManual());
    setAncient(readAncient());
    setMDate(todayLocalStr());
    setToday(todayLocalStr());
    setStatus({ text: `HEALTH · 已同步 ${hhmmNow()}`, ok: false });
    setLoaded(true);
    fetch("/health-sync.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j === "object") {
          setSync(j as SyncFile);
          setSyncOk(typeof (j as SyncFile).updated_at === "string");
        }
      })
      .catch(() => undefined);
    fetch("/health-media.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j === "object") setMedia(j as Record<string, MediaItem>);
      })
      .catch(() => undefined);
  }, []);

  const write = (key: string, value: unknown, detail: string): boolean => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
    emit("HEALTH_SYNC", "health", detail);
    setStatus({ text: "已保存", ok: true });
    return true;
  };

  const trainSet = new Set(checkins);
  const doneToday = trainSet.has(today);
  const trainStreak = streakOf(trainSet, today);
  const lastTrain = checkins.length ? checkins[checkins.length - 1] : null;
  const curPrefix = today ? today.slice(0, 7) : "∅";
  const monthCount = checkins.filter((d) => d.startsWith(curPrefix)).length;

  /* 手动优先：手动日期 ≥ 文件最新日期时手动胜出（文件无日期时手动亦胜）。 */
  const fileLastDate = sync?.sleep?.last?.date ?? null;
  const mWins = manual !== null && (fileLastDate === null || manual.date >= fileLastDate);
  const effLastSleep: SyncSleep | null =
    mWins && manual?.sleepHours !== undefined
      ? { date: manual.date, start: manual.sleepStart, end: manual.sleepEnd, hours: manual.sleepHours }
      : (sync?.sleep?.last ?? null);
  const effLast7: { date?: string; hours?: number }[] =
    mWins && manual?.sleepHours !== undefined
      ? [
          ...(sync?.sleep?.last7 ?? []).filter((s) => s.date !== manual.date),
          { date: manual.date, hours: manual.sleepHours },
        ]
          .sort((a, b) => (a.date ?? "") < (b.date ?? "") ? -1 : 1)
          .slice(-7)
      : (sync?.sleep?.last7 ?? []);
  const avg7 = effLast7.length
    ? effLast7.reduce((a, s) => a + (s.hours ?? 0), 0) / effLast7.length
    : null;
  const effStepsToday =
    mWins && manual?.steps !== undefined && manual.date === today
      ? manual.steps
      : (sync?.steps?.today ?? null);

  const ancientSet = new Set(Object.keys(ancient).filter((d) => ancient[d]));
  const ancientStreak = streakOf(ancientSet, today);
  const ancientTotal = ancientSet.size;
  const ancientDays = today
    ? Array.from({ length: 14 }, (_, i) => shiftISO(today, i - 13))
    : [];

  const toggleTrain = () => {
    const next = doneToday
      ? checkins.filter((d) => d !== today)
      : [...checkins, today].sort();
    if (write(TRAIN_KEY, next, doneToday ? `撤销打卡 · ${today}` : `训练打卡 · ${today}`)) {
      setCheckins(next);
    }
  };

  const saveManual = (e: FormEvent) => {
    e.preventDefault();
    if (!isDateStr(mDate)) {
      setMErr("日期格式不对");
      return;
    }
    const sleepStr = mSleep.trim();
    const stepsStr = mSteps.trim();
    let sleepHours: number | undefined;
    let steps: number | undefined;
    if (sleepStr) {
      const n = Number(sleepStr);
      if (!Number.isFinite(n) || n <= 0) {
        setMErr("睡眠时长填正数");
        return;
      }
      sleepHours = n;
    }
    if (stepsStr) {
      const n = Number(stepsStr);
      if (!Number.isInteger(n) || n < 0) {
        setMErr("步数填非负整数");
        return;
      }
      steps = n;
    }
    if (sleepHours === undefined && steps === undefined) {
      setMErr("至少填一项（睡眠或步数）");
      return;
    }
    const m: ManualHealth = { date: mDate };
    if (sleepHours !== undefined) m.sleepHours = sleepHours;
    if (steps !== undefined) m.steps = steps;
    if (write(MANUAL_KEY, m, `手动同步 · ${mDate}`)) {
      setManual(m);
      setMSleep("");
      setMSteps("");
      setMErr("");
      setFormOpen(false);
    }
  };

  const clearManual = () => {
    try {
      window.localStorage.removeItem(MANUAL_KEY);
    } catch {
      return;
    }
    setManual(null);
    setClearArm(false);
    emit("HEALTH_SYNC", "health", "清除手动同步");
    setStatus({ text: "已保存", ok: true });
  };

  const toggleAncient = (date: string) => {
    const next = { ...ancient };
    if (next[date]) delete next[date];
    else next[date] = true;
    if (write(ANCIENT_KEY, next, next[date] ? `古法打卡 · ${date}` : `撤销古法打卡 · ${date}`)) {
      setAncient(next);
    }
  };

  const sleepLine = (s: SyncSleep | null): string => {
    if (!s) return "—";
    const parts: string[] = [];
    if (s.date) parts.push(s.date);
    if (s.hours !== undefined) parts.push(`${s.hours} 小时`);
    if (s.start && s.end) parts.push(`${s.start} → ${s.end}`);
    return parts.join(" · ") || "—";
  };

  return (
    <RingModuleShell
      active="health"
      cn="身体健康"
      en="HEALTH"
      src="studio_health_checkins_v1 + /health-sync.json"
      count={loaded ? checkins.length : null}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">打卡统计 · STATS</div>
          <div className="rm-statLine" style={{ marginBottom: 18 }}>
            <span>
              累计 <b>{checkins.length} 天</b>
            </span>
            <span>
              连续 <b>{trainStreak} 天</b>
            </span>
            <span>
              本月 <b>{monthCount} / 30</b>
            </span>
          </div>
          <div className="rm-sec">
            <div className="rm-secHead">
              <span className="rm-secCn">最近记录</span>
              <span className="rm-secEn">RECENT</span>
            </div>
            <div className="rm-row">
              <div className="rm-rowMain">
                <div className="rm-rowSub">最近睡眠（有效值）</div>
                <div className="rm-rowT">{sleepLine(effLastSleep)}</div>
              </div>
            </div>
            <div className="rm-row">
              <div className="rm-rowMain">
                <div className="rm-rowSub">今日步数（有效值）</div>
                <div className="rm-rowT">
                  {effStepsToday !== null ? `${effStepsToday} 步` : "—"}
                </div>
              </div>
            </div>
            <div className="rm-row">
              <div className="rm-rowMain">
                <div className="rm-rowSub">古法打卡</div>
                <div className="rm-rowT">
                  累计 {ancientTotal} 天 · 连续 {ancientStreak} 天
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">今日训练打卡</span>
          <span className="rm-secEn">TRAIN CHECK-IN</span>
        </div>
        <div className="rm-hlBig">
          <div>
            <div className="rm-hlBigState">{doneToday ? "今日已打卡" : "今日待打卡"}</div>
            <div className="rm-hlBigSub">
              最近完成 {lastTrain ?? "—"} · 累计 {checkins.length} 天（只按本机打卡记录实算）
              · 连续 {trainStreak} 天
            </div>
          </div>
          <button
            type="button"
            className={`rm-hlBigBtn${doneToday ? " rm-hlBigBtnDone" : ""}`}
            onClick={toggleTrain}
          >
            {doneToday ? "已完成 ✓ · 点按撤销" : "打卡完成"}
          </button>
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">健康同步</span>
          <span className="rm-secEn">HEALTH SYNC</span>
          <span className="rm-secNote">{syncOk ? "OK" : "STALE"}</span>
        </div>
        {!sync ? (
          <div className="rm-empty">暂无同步数据</div>
        ) : (
          <div>
            <div className="rm-hlKv" style={{ marginBottom: 12 }}>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">更新时间</div>
                <div className="rm-hlKvV" style={{ fontSize: 13 }}>
                  {sync.updated_at ?? "—"}
                </div>
              </div>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">最近睡眠</div>
                <div className="rm-hlKvV" style={{ fontSize: 13 }}>{sleepLine(effLastSleep)}</div>
              </div>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">今日步数</div>
                <div className="rm-hlKvV">
                  {effStepsToday !== null ? effStepsToday : "—"}
                </div>
                <div className="rm-hlKvS">
                  7 日均 {sync.steps?.avg7 ?? sync.steps?.last7_avg ?? "—"} 步
                </div>
              </div>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">睡眠 7 日均</div>
                <div className="rm-hlKvV">
                  {avg7 !== null ? `${avg7.toFixed(1)} h` : "—"}
                </div>
              </div>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">体重</div>
                <div className="rm-hlKvV">
                  {sync.weight_kg != null ? `${sync.weight_kg} kg` : "—"}
                </div>
              </div>
              <div className="rm-hlKvCard">
                <div className="rm-hlKvK">蛋白质目标</div>
                <div className="rm-hlKvV" style={{ fontSize: 13 }}>
                  {sync.diet?.protein_target ?? "—"}
                </div>
              </div>
            </div>
            {sync.diet?.advice ? (
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">饮食建议</div>
                  <div className="rm-rowT">{sync.diet.advice}</div>
                </div>
              </div>
            ) : null}
            {sync.diet?.principles ? (
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">饮食原则</div>
                  <div className="rm-rowT">{sync.diet.principles}</div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">手动同步</span>
          <span className="rm-secEn">MANUAL SYNC</span>
        </div>
        {manual ? (
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowT">
                手动记录 {manual.date}
                {manual.sleepHours !== undefined ? ` · 睡眠 ${manual.sleepHours} 小时` : ""}
                {manual.steps !== undefined ? ` · 步数 ${manual.steps}` : ""}
              </div>
              <div className="rm-rowSub">
                {mWins ? "已生效" : "早于文件最新记录，未生效"}
              </div>
            </div>
            <button
              type="button"
              className={`rm-miniBtn${clearArm ? " rm-miniBtnDanger" : ""}`}
              onClick={() => {
                if (clearArm) clearManual();
                else setClearArm(true);
              }}
            >
              {clearArm ? "确认清除？" : "清除"}
            </button>
          </div>
        ) : (
          <div className="rm-empty">暂无手动记录</div>
        )}
        {!formOpen ? (
          <button
            type="button"
            className="rm-formBtn rm-formToggle"
            style={{ marginTop: 12 }}
            onClick={() => setFormOpen(true)}
          >
            + 手动同步 · MANUAL SYNC
          </button>
        ) : (
          <form className="rm-form" onSubmit={saveManual} style={{ marginTop: 12 }}>
            <div className="rm-b2FormGrid">
              <div className="rm-field">
                <label>日期 *</label>
                <input
                  className="rm-input"
                  type="date"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                />
              </div>
              <div className="rm-field">
                <label>睡眠时长（小时）</label>
                <input
                  className="rm-input"
                  type="text"
                  inputMode="decimal"
                  value={mSleep}
                  onChange={(e) => setMSleep(e.target.value)}
                  placeholder="如 7.5，可空"
                />
              </div>
              <div className="rm-field">
                <label>步数</label>
                <input
                  className="rm-input"
                  type="text"
                  inputMode="numeric"
                  value={mSteps}
                  onChange={(e) => setMSteps(e.target.value)}
                  placeholder="如 8200，可空"
                />
              </div>
            </div>
            {mErr ? <div className="rm-err" style={{ marginTop: 8 }}>{mErr}</div> : null}
            <div className="rm-formFoot">
              <span className="rm-formHint">至少填一项 · 手动日期 ≥ 文件日期时手动胜出</span>
              <div className="rm-formBtns">
                <button type="submit" className="rm-formBtn rm-formBtnPrimary">
                  保存手动记录
                </button>
                <button type="button" className="rm-formBtn" onClick={() => setFormOpen(false)}>
                  收起
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">晨间古法打卡</span>
          <span className="rm-secEn">ANCIENT FITNESS</span>
          <span className="rm-secNote">
            累计 {ancientTotal} 天 · 连续 {ancientStreak} 天
          </span>
        </div>
        <div className="rm-rowSub" style={{ marginBottom: 10 }}>
          博主「爱运动的莎儿」· 抖音 88287815120 ·{" "}
          <a
            href="https://v.douyin.com/6h1_YtZQUrU/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--cyan)" }}
          >
            原站跟练 ↗
          </a>
        </div>
        <div className="rm-hlGrid14">
          {ancientDays.map((d) => {
            const on = !!ancient[d];
            return (
              <button
                key={d}
                type="button"
                className={`rm-hlCell${on ? " rm-hlCellOn" : ""}`}
                onClick={() => toggleAncient(d)}
                aria-pressed={on}
              >
                <div className="rm-hlCellDate">{d.slice(5)}</div>
                <div className={`rm-hlCellMark${on ? "" : " rm-hlCellMarkOff"}`}>
                  {on ? "✓ 已打" : "·"}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          {ANCIENT_MOVES.map((m) => (
            <div key={m.id} className="rm-row">
              <div className="rm-rowMain">
                <div className="rm-rowT">
                  {m.name} <span className="rm-rowSub">{m.en}</span>
                </div>
                <div className="rm-rowSub">{m.tags.join(" · ")}</div>
              </div>
              <span className="rm-rowChip">{m.dose}</span>
              <a
                className="rm-miniBtn"
                href={`https://www.bilibili.com/video/${m.bv}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", alignSelf: "center" }}
              >
                观看教程 ↗
              </a>
            </div>
          ))}
        </div>
        <div className="rm-rowSub" style={{ marginTop: 10 }}>
          教程走 B 站外链新标签打开，站内不嵌播放器（保持轻量）；链接逐条按 B 站真实搜索结果核实（BV 号与标题对应）。
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">训练清单</span>
          <span className="rm-secEn">TRAINING PLAN · 只读</span>
        </div>
        <div className="rm-row">
          <div className="rm-rowMain">
            <div className="rm-rowT">在家塑形 · 轻器械 × 高次数（第 1–2 周）</div>
            <div className="rm-rowSub">周一 / 周三 / 周五 · 每次约 30 分钟 · 2026-10-19 起</div>
            <div className="rm-rowSub">热身 5 分钟 → 主训练 6 动作 × 2 组 → 拉伸 5 分钟</div>
            <div className="rm-rowSub">器械：{TRAINING_EQUIP.join(" / ")}</div>
            <div className="rm-rowSub">每日 5 分钟体态修复：下巴后缩 / 靠墙站 / 髋屈肌拉伸 / 猫牛式</div>
          </div>
        </div>
        {TRAINING_MOVES.map((m) => {
          const md = media[m.id];
          return (
            <div key={m.id} className="rm-row">
              <div className="rm-rowMain">
                <div className="rm-rowT">{m.name}</div>
                <div className="rm-rowSub">{m.cue}</div>
                {md ? (
                  <div className="rm-rowSub">
                    <a href={md.link} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                      {md.title} ↗
                    </a>
                  </div>
                ) : null}
              </div>
              <span className="rm-rowChip">{m.reps}</span>
            </div>
          );
        })}
      </div>
    </RingModuleShell>
  );
}

import * as React from "react";
import {
  Play,
  X,
  Check,
  ExternalLink,
  Flame,
  Moon,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 身体健康 · 模块内里
 *
 * 四区：今日安排（按星期派生）/ 每日打卡 / 健康数据（health-sync）/ 饮食。
 * 计划数据是结构化常量，来源 = 塑形计划文件
 * （~/workspace/goals/goal/files/塑形计划-轻器械高次数.md，第 1–2 周版）；
 * 计划调整时改这里的常量 + public/health-media.json 的媒体映射即可。
 * 教学媒体在 public/health-media.json（键 = 动作 id），链接上线前逐个核验。
 * 打卡状态由页面层持有并 localStorage 持久化（studio_health_checkins_v1），
 * 因为全站计数口径（累计打卡天数）要读它 —— 同财务模块的模式。
 * 健康数据走 /health-sync.json 同步文件（见 docs/health-sync.md），
 * 拿不到文件时整区优雅空态，绝不编数据。
 */

export type ExerciseItem = {
  id: string;
  name: string;
  dose: string;
  tip: string;
};

/** 热身（5 分钟）—— 计划文件「每次流程 · 热身」。 */
export const WARMUP_ITEMS: ExerciseItem[] = [
  { id: "warmup-jumping-jacks", name: "开合跳", dose: "1 分钟", tip: "先把身体热起来，落地轻、膝盖微屈" },
  { id: "warmup-arm-circles", name: "手臂绕环", dose: "30 秒", tip: "肩膀活动开，正反方向都绕" },
  { id: "warmup-band-squat", name: "弹力带浅蹲", dose: "10 次", tip: "浅蹲找发力感，膝盖顺着脚尖方向" },
];

/** 主训练（6 个动作 × 2 组，组间休息 30–45 秒）—— 计划文件「主训练」。 */
export const MAIN_ITEMS: ExerciseItem[] = [
  { id: "main-band-squat", name: "弹力带深蹲", dose: "15–20 次 × 2 组", tip: "膝盖顺着脚尖方向" },
  { id: "main-bottle-press", name: "水瓶推举", dose: "12–15 次 × 2 组", tip: "1.5–2L 水瓶灌满；核心收紧，抓牢瓶身别晃" },
  { id: "main-band-row", name: "弹力带划船", dose: "12–15 次 × 2 组", tip: "带子固定门后或脚踩；拉到胸前时肩胛骨夹紧" },
  { id: "main-glute-bridge", name: "臀桥", dose: "15–20 次 × 2 组", tip: "环形带套膝盖上方，顶到最高夹紧 1 秒" },
  { id: "main-bottle-curl", name: "水瓶弯举", dose: "12–15 次 × 2 组", tip: "大臂贴紧身体别动，只动小臂" },
  { id: "main-ab-wheel", name: "跪姿腹肌轮推出", dose: "8–10 次 × 2 组", tip: "推到身体快贴地就拉回，全程别塌腰；腰一塌就缩小幅度" },
];

/** 每日 5 分钟体态修复 —— 计划文件「每日 5 分钟体态修复」，每天都做。 */
export const POSTURE_ITEMS: ExerciseItem[] = [
  { id: "posture-chin-tuck", name: "下巴后缩", dose: "10 次", tip: "想象后脑勺往后顶一面墙，治脖子前倾" },
  { id: "posture-wall-stand", name: "靠墙站", dose: "1 分钟", tip: "后脑勺、上背、屁股贴墙，找「正」的位置感" },
  { id: "posture-hip-flexor", name: "跪姿髋屈肌拉伸", dose: "左右各 30 秒", tip: "治骨盆前倾的关键，久坐的人髋屈肌都短" },
  { id: "posture-cat-cow", name: "猫牛式", dose: "8 次", tip: "活动整条脊柱，动作跟着呼吸走" },
  { id: "posture-habit", name: "改习惯", dose: "全天", tip: "翘二郎腿→双脚平放；每小时起来走 1 分钟" },
];

export type HealthMediaItem = {
  title: string;
  embed?: string;
  link: string;
  source: string;
  type?: "video" | "article";
};
export type HealthMediaMap = Record<string, HealthMediaItem>;

export type HealthSyncData = {
  updated_at?: string;
  sleep?: {
    last?: { date: string; start: string; end: string; hours: number } | null;
    last7?: { date: string; hours: number }[];
  } | null;
  steps?: { today?: number | null; avg7?: number | null } | null;
  weight_kg?: number | null;
  diet?: {
    protein_target?: string;
    advice?: string;
    last_analysis?: { date: string; summary: string } | null;
  } | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
/** 训练日：周一 / 周三 / 周五（计划文件口径）。 */
export const isTrainingDay = (d: Date): boolean =>
  d.getDay() === 1 || d.getDay() === 3 || d.getDay() === 5;

/** 连续打卡天数：今天没打卡时从昨天往前数，不把 streak 清零误伤。 */
export function computeStreak(checkins: string[], now = new Date()): number {
  const set = new Set(checkins);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(dateKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** 5.08 → 「5 小时 05 分」 */
const fmtHours = (h: number): string => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh} 小时 ${pad2(mm)} 分`;
};
const fmtStamp = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

function HealthSection({
  title,
  en,
  testid,
  action,
  children,
}: {
  title: string;
  en: string;
  testid: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={testid} className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] font-semibold">
          {title}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-[color:var(--studio-muted)]">
            {en}
          </span>
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function ExerciseRow({
  item,
  media,
  open,
  onToggleMedia,
}: {
  item: ExerciseItem;
  media?: HealthMediaItem;
  open: boolean;
  onToggleMedia: (id: string) => void;
}) {
  return (
    <li
      data-testid="health-exercise-row"
      data-exercise={item.id}
      className="studio-glass rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {item.name}
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] tabular-nums studio-pill-active">
              {item.dose}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[color:var(--studio-muted)]">
            {item.tip}
          </p>
        </div>
        {media?.embed ? (
          <>
            <button
              type="button"
              data-testid={`health-media-btn-${item.id}`}
              className="xuan-btn shrink-0"
              onClick={() => onToggleMedia(item.id)}
            >
              {open ? (
                <X className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              {open ? "收起" : "看示范"}
            </button>
            <a
              data-testid={`health-media-link-${item.id}`}
              className="xuan-btn shrink-0"
              href={media.link}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              {media.source}
            </a>
          </>
        ) : media ? (
          <a
            data-testid={`health-media-link-${item.id}`}
            className="xuan-btn shrink-0"
            href={media.link}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            看示范
          </a>
        ) : null}
      </div>
      {open && media?.embed && (
        <div className="mt-3" data-testid={`health-embed-${item.id}`}>
          <div className="relative w-full overflow-hidden rounded-xl bg-black/40 pt-[56.25%]">
            <iframe
              data-testid={`health-iframe-${item.id}`}
              src={media.embed}
              title={media.title}
              loading="lazy"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[color:var(--studio-muted)]">
            {media.title} · 来源 {media.source}
          </p>
        </div>
      )}
    </li>
  );
}

export type HealthModuleProps = {
  checkins: string[];
  onToggleCheckin: (date: string) => void;
  showToast: (msg: string) => void;
};

export function HealthModuleView({
  checkins,
  onToggleCheckin,
  showToast,
}: HealthModuleProps) {
  const [media, setMedia] = React.useState<HealthMediaMap>({});
  const [sync, setSync] = React.useState<HealthSyncData | null>(null);
  const [syncLoaded, setSyncLoaded] = React.useState(false);
  const [openMediaId, setOpenMediaId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/health-media.json", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as HealthMediaMap;
          if (!cancelled && data && typeof data === "object")
            setMedia(data);
        }
      } catch {
        /* 媒体文件缺失时动作行只少一个按钮，不报错 */
      }
      try {
        const res = await fetch("/health-sync.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`health-sync ${res.status}`);
        const data = (await res.json()) as HealthSyncData;
        if (!cancelled) setSync(data);
      } catch {
        if (!cancelled) setSync(null);
      } finally {
        if (!cancelled) setSyncLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const tKey = todayKey();
  const training = isTrainingDay(now);
  const checkedToday = checkins.includes(tKey);
  const streak = computeStreak(checkins, now);
  const monthPrefix = tKey.slice(0, 7);
  const monthChecked = checkins.filter((c) => c.startsWith(monthPrefix));
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const firstDow = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7; // 周一起始的空白数
  const checkedSet = new Set(checkins);

  const toggleMedia = (id: string) =>
    setOpenMediaId((prev) => (prev === id ? null : id));
  const renderList = (items: ExerciseItem[], testid: string) => (
    <ul className="space-y-2" data-testid={testid}>
      {items.map((item) => (
        <ExerciseRow
          key={item.id}
          item={item}
          media={media[item.id]}
          open={openMediaId === item.id}
          onToggleMedia={toggleMedia}
        />
      ))}
    </ul>
  );

  const sleep = sync?.sleep ?? null;
  const lastSleep = sleep?.last ?? null;
  const last7 = sleep?.last7 ?? [];
  const maxHours = Math.max(8, ...last7.map((d) => d.hours));
  const diet = sync?.diet ?? null;

  return (
    <div data-testid="health-view" className="space-y-6">
      {/* ---------- 今日安排 ---------- */}
      <HealthSection title="今日安排" en="Today" testid="health-today-section">
        <div
          data-testid="health-today"
          data-dow={now.getDay()}
          data-training={training ? "1" : "0"}
          className="studio-glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3"
        >
          <p className="text-[13px]">
            今天 {WEEKDAY_LABELS[now.getDay()]} ·{" "}
            {training ? (
              <>
                <b>训练日</b>
                <span className="ml-2 text-[11px] text-[color:var(--studio-muted)]">
                  热身 5 分钟 → 主训练 6 个动作 × 2 组 → 拉伸 5 分钟，约 30 分钟
                </span>
              </>
            ) : (
              <>
                <b>休息日</b>
                <span className="ml-2 text-[11px] text-[color:var(--studio-muted)]">
                  今天不做主训练，做下面的每日体态修复就好（主训练在周一 / 三 / 五）
                </span>
              </>
            )}
          </p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
            计划第 1–2 周 · 轻器械高次数
          </span>
        </div>
        {training && (
          <>
            <p className="px-1 text-[11px] font-medium text-[color:var(--studio-muted)]">
              热身 · 5 分钟
            </p>
            {renderList(WARMUP_ITEMS, "health-warmup-list")}
            <p className="px-1 text-[11px] font-medium text-[color:var(--studio-muted)]">
              主训练 · 6 个动作 × 2 组（组间休息 30–45 秒，每组留 2–3 次余力）
            </p>
            {renderList(MAIN_ITEMS, "health-main-list")}
            <p className="px-1 text-[11px] text-[color:var(--studio-muted)]">
              收尾拉伸 5 分钟：大腿前侧、臀、胸、肩各 30 秒。
            </p>
          </>
        )}
        <p className="px-1 text-[11px] font-medium text-[color:var(--studio-muted)]">
          每日体态修复 · 5 分钟（每天都做）
        </p>
        {renderList(POSTURE_ITEMS, "health-posture-list")}
      </HealthSection>

      {/* ---------- 每日打卡 ---------- */}
      <HealthSection title="每日打卡" en="Check-in" testid="health-checkin-section">
        <div className="studio-glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-testid="health-checkin-btn"
              data-checked={checkedToday ? "1" : "0"}
              className={cn(
                "xuan-btn shrink-0",
                checkedToday && "xuan-btn-primary",
              )}
              onClick={() => {
                onToggleCheckin(tKey);
                showToast(
                  checkedToday ? "已取消今日打卡" : "打卡完成，今天记上了",
                );
              }}
            >
              {checkedToday ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  今日已打卡（点取消）
                </>
              ) : (
                "今日打卡"
              )}
            </button>
            <p className="flex items-center gap-1.5 text-[13px]">
              <Flame className="h-4 w-4 text-orange-400" />
              连续打卡{" "}
              <b data-testid="health-streak" data-value={streak} className="tabular-nums">
                {streak}
              </b>{" "}
              天
            </p>
            <p className="text-[12px] tabular-nums text-[color:var(--studio-muted)]">
              累计 {checkins.length} 天 · 本月 {monthChecked.length} 天
            </p>
          </div>
          <div
            data-testid="health-month-grid"
            data-checked-days={monthChecked.length}
            className="mt-4 grid max-w-[420px] grid-cols-7 gap-1.5"
          >
            {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
              <span
                key={w}
                className="text-center text-[9px] text-[color:var(--studio-muted)]"
              >
                {w}
              </span>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const key = `${monthPrefix}-${pad2(day)}`;
              const on = checkedSet.has(key);
              const isToday = key === tKey;
              return (
                <span
                  key={key}
                  data-day={key}
                  data-checked={on ? "1" : "0"}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-[10px] tabular-nums",
                    on
                      ? "bg-emerald-500/80 font-semibold text-white"
                      : "bg-white/5 text-[color:var(--studio-muted)]",
                    isToday && "ring-1 ring-[color:var(--studio-accent)]",
                  )}
                >
                  {day}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-[color:var(--studio-muted)]">
            打卡以网站这里为准（和聊天里跟 Luna 说的记录暂各走各的）。
          </p>
        </div>
      </HealthSection>

      {/* ---------- 健康数据 ---------- */}
      <HealthSection title="健康数据" en="Health Sync" testid="health-sync-section">
        {!syncLoaded ? (
          <p className="px-1 text-[12px] text-[color:var(--studio-muted)]">
            正在读取同步数据…
          </p>
        ) : !sync ? (
          <div
            data-testid="health-sync-empty"
            className="studio-glass rounded-2xl px-4 py-6 text-center"
          >
            <Moon className="mx-auto h-5 w-5 text-[color:var(--studio-muted)]" />
            <p className="mt-2 text-[13px] font-medium">数据待同步</p>
            <p className="mt-1 text-[11px] text-[color:var(--studio-muted)]">
              睡眠 / 步数 / 体重由 Luna 晨间从手机健康数据生成 health-sync.json 下发；新鲜度取决于手机同步情况，这里不装实时。
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div
                data-testid="health-sleep-card"
                data-hours={lastSleep ? lastSleep.hours : "none"}
                className="studio-glass rounded-2xl p-4"
              >
                <p className="text-[11px] text-[color:var(--studio-muted)]">
                  最近一晚睡眠
                </p>
                {lastSleep ? (
                  <>
                    <p className="mt-1.5 text-xl font-semibold tabular-nums">
                      {fmtHours(lastSleep.hours)}
                    </p>
                    <p className="mt-1 text-[11px] tabular-nums text-[color:var(--studio-muted)]">
                      {lastSleep.date} 晚 {lastSleep.start} 入睡 → 次日{" "}
                      {lastSleep.end} 起
                    </p>
                    {last7.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-[color:var(--studio-muted)]">
                          近 {last7.length} 条睡眠记录（小时）
                        </p>
                        <div className="mt-1.5 flex h-14 items-end gap-1.5">
                          {last7.map((d) => (
                            <div
                              key={d.date}
                              className="flex flex-1 flex-col items-center gap-1"
                            >
                              <div
                                className="w-full rounded-sm bg-indigo-400/70"
                                style={{
                                  height: `${Math.max(8, (d.hours / maxHours) * 100)}%`,
                                }}
                              />
                              <span className="text-[9px] tabular-nums text-[color:var(--studio-muted)]">
                                {d.hours}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-1.5 text-[13px]">暂无睡眠记录</p>
                )}
              </div>
              <div data-testid="health-body-card" className="studio-glass rounded-2xl p-4">
                <p className="text-[11px] text-[color:var(--studio-muted)]">
                  步数 · 体重
                </p>
                <p className="mt-1.5 text-[13px] tabular-nums">
                  今日步数{" "}
                  <b>{sync.steps?.today != null ? sync.steps.today : "暂无数据"}</b>
                  {sync.steps?.avg7 != null && (
                    <span className="ml-2 text-[11px] text-[color:var(--studio-muted)]">
                      近 7 天均值 {sync.steps.avg7}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] tabular-nums">
                  最近体重{" "}
                  <b>
                    {sync.weight_kg != null
                      ? `${sync.weight_kg} kg`
                      : "暂无数据"}
                  </b>
                </p>
                <p className="mt-3 text-[10px] text-[color:var(--studio-muted)]">
                  数据截至 {fmtStamp(sync.updated_at)}（health-sync.json
                  下发时间，取决于手机向健康 App 的同步）
                </p>
              </div>
            </div>
          </>
        )}
      </HealthSection>

      {/* ---------- 饮食 ---------- */}
      <HealthSection title="饮食" en="Diet" testid="health-diet-section">
        <div className="grid gap-3 md:grid-cols-2">
          <div data-testid="health-diet-card" className="studio-glass rounded-2xl p-4">
            <p className="text-[11px] text-[color:var(--studio-muted)]">
              每日建议
            </p>
            <p className="mt-1.5 text-[13px]">
              蛋白目标{" "}
              <b className="tabular-nums">
                {diet?.protein_target ?? "1.2–1.6 g/kg"}
              </b>
              <span className="ml-2 text-[11px] text-[color:var(--studio-muted)]">
                （60kg 约每天 70–95g）
              </span>
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--studio-muted)]">
              {diet?.advice ??
                "先把蛋白吃够，别狠节食：轻微热量缺口或维持都行，掉肌肉比掉秤可怕。"}
            </p>
          </div>
          <div
            data-testid="health-diet-analysis"
            className="studio-glass rounded-2xl p-4"
          >
            <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--studio-muted)]">
              <Camera className="h-3.5 w-3.5" />
              拍照分析 · 最近一次
            </p>
            {diet?.last_analysis ? (
              <>
                <p className="mt-1.5 text-[13px] font-medium">
                  {diet.last_analysis.date}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--studio-muted)]">
                  {diet.last_analysis.summary}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--studio-muted)]">
                在聊天里发食物照片给 Luna 分析，结果会回填到这里。（网站内直接上传自动分析在接入阶段单独立项。）
              </p>
            )}
          </div>
        </div>
      </HealthSection>
    </div>
  );
}

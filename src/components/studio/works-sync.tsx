import * as React from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Play,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 作品库 · 多平台同步（框架 v1）
 *
 * 数据通道：抓取侧（云机 MediaCrawler / YouTube 官方 API）产出统一格式的
 * works-sync.json 投递到可公开读取的 URL；前端从 WORKS_SYNC_URL 拉取并按
 * 平台分区渲染。拉取成功写入 localStorage 缓存（studio_works_sync_v1）；
 * 拉取失败/无数据时读缓存并标「离线缓存」；未配置（404）时各区保持
 * 「未接入」空状态，不弹错误。
 */

export const WORKS_SYNC_URL = "/works-sync.json";
const WORKS_SYNC_CACHE_KEY = "studio_works_sync_v1";

export type SyncedWork = {
  platform: string;
  id: string;
  title: string;
  cover: string;
  url: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  updated_at: string;
};

type WorksSyncPayload = {
  updated_at: string;
  platforms: Partial<Record<SyncPlatformKey, SyncedWork[]>>;
};

type SyncPlatformKey =
  | "bilibili"
  | "douyin"
  | "channels"
  | "youtube"
  | "x"
  | "tiktok";

const SYNC_PLATFORMS: { key: SyncPlatformKey; label: string; en: string }[] = [
  { key: "bilibili", label: "B站", en: "BILIBILI" },
  { key: "douyin", label: "抖音", en: "DOUYIN" },
  { key: "channels", label: "视频号", en: "CHANNELS" },
  { key: "youtube", label: "YouTube", en: "YOUTUBE" },
  { key: "x", label: "X", en: "X" },
  { key: "tiktok", label: "TikTok", en: "TIKTOK" },
];

/** 官方 iframe 播放器地址（点击才挂载，懒加载）；无可靠内嵌的平台返回 null。 */
function embedUrlFor(work: SyncedWork): string | null {
  const id = encodeURIComponent(work.id);
  switch (work.platform) {
    case "bilibili":
      return `https://player.bilibili.com/player.html?bvid=${id}&page=1`;
    case "youtube":
      return `https://www.youtube.com/embed/${id}`;
    case "douyin":
      return `https://open.douyin.com/player/video?vid=${id}&autoplay=0`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${id}`;
    default:
      // 视频号 / X：暂无可靠网页内嵌，保持封面卡，不造假链接。
      return null;
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}

function StatItem({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      <span className="tabular-nums">{fmtCount(value)}</span>
    </span>
  );
}

function WorkCard({ work }: { work: SyncedWork }) {
  const [playing, setPlaying] = React.useState(false);
  const embedUrl = embedUrlFor(work);
  return (
    <article
      className="studio-glass overflow-hidden"
      data-synced-work={`${work.platform}:${work.id}`}
    >
      <div className="relative aspect-video w-full bg-black/40">
        {playing && embedUrl ? (
          <iframe
            src={embedUrl}
            title={work.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            data-testid="work-player"
          />
        ) : (
          <>
            {work.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={work.cover}
                alt={work.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[color:var(--studio-muted)]">
                无封面
              </div>
            )}
            {embedUrl ? (
              <button
                type="button"
                aria-label={`播放 · ${work.title}`}
                data-testid="work-play"
                className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/40"
                onClick={() => setPlaying(true)}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white transition-transform group-hover:scale-110">
                  <Play className="ml-0.5 h-5 w-5" />
                </span>
              </button>
            ) : null}
          </>
        )}
      </div>
      <div className="space-y-1.5 p-2.5">
        <p className="line-clamp-2 min-h-[2.4em] text-[12px] font-medium leading-snug">
          {work.title}
        </p>
        <p className="text-[10px] text-[color:var(--studio-muted)]">
          {fmtTime(work.published_at)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[color:var(--studio-muted)]">
          <StatItem icon={<Eye className="h-3 w-3" />} value={work.views} />
          <StatItem icon={<Heart className="h-3 w-3" />} value={work.likes} />
          <StatItem
            icon={<MessageCircle className="h-3 w-3" />}
            value={work.comments}
          />
          <StatItem icon={<Share2 className="h-3 w-3" />} value={work.shares} />
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {embedUrl ? (
            playing ? (
              <button
                type="button"
                className="text-[10px] font-medium text-[color:var(--studio-accent)] hover:underline"
                onClick={() => setPlaying(false)}
              >
                收起播放器
              </button>
            ) : (
              <span className="text-[10px] text-[color:var(--studio-muted)]">
                点击封面站内播放
              </span>
            )
          ) : (
            <span className="text-[10px] text-[color:var(--studio-muted)]">
              暂不支持站内播放
            </span>
          )}
          {work.url ? (
            <a
              href={work.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[color:var(--studio-accent)] hover:underline"
            >
              平台打开
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function WorksSyncSection() {
  const [payload, setPayload] = React.useState<WorksSyncPayload | null>(null);
  const [fromCache, setFromCache] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const readCache = React.useCallback((): WorksSyncPayload | null => {
    try {
      const raw = window.localStorage.getItem(WORKS_SYNC_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as WorksSyncPayload;
      if (!data || typeof data !== "object" || typeof data.platforms !== "object")
        return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(WORKS_SYNC_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WorksSyncPayload;
      if (!data || typeof data !== "object" || typeof data.platforms !== "object")
        throw new Error("bad payload");
      setPayload(data);
      setFromCache(false);
      try {
        window.localStorage.setItem(WORKS_SYNC_CACHE_KEY, JSON.stringify(data));
      } catch {
        /* storage full/blocked: remote data still renders */
      }
    } catch {
      // 拉取失败/未配置：回落本地缓存并标「离线缓存」；无缓存则保持未接入空状态。
      const cached = readCache();
      if (cached) {
        setPayload(cached);
        setFromCache(true);
      }
    } finally {
      setLoading(false);
    }
  }, [readCache]);

  React.useEffect(() => {
    // 先用缓存秒出内容，再拉远程刷新。
    const cached = readCache();
    if (cached) {
      setPayload(cached);
      setFromCache(true);
    }
    void refresh();
  }, [readCache, refresh]);

  const updatedAt = payload?.updated_at;

  return (
    <section data-testid="works-sync" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="studio-slogan text-2xl font-semibold tracking-tight md:text-[1.75rem]">
            平台作品 · 多平台同步。
          </h1>
          <p className="mt-1 text-[12px] text-[color:var(--studio-muted)] md:text-[13px]">
            {payload
              ? `最近同步 ${fmtTime(updatedAt)}${fromCache ? " · 离线缓存" : ""}`
              : loading
                ? "同步中…"
                : "尚未同步 · 等待首次接入"}
          </p>
        </div>
        <button
          type="button"
          data-testid="works-sync-refresh"
          className="xuan-btn"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-1 inline h-3 w-3", loading && "animate-spin")} />
          刷新
        </button>
      </header>

      {SYNC_PLATFORMS.map((platform) => {
        const works = payload?.platforms?.[platform.key];
        const connected = Array.isArray(works);
        return (
          <div
            key={platform.key}
            className="space-y-2"
            data-testid={`works-platform-${platform.key}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">
                {platform.label}
                <span className="ml-1.5 text-[10px] font-normal tracking-wider text-[color:var(--studio-muted)]">
                  {platform.en}
                </span>
              </h2>
              {connected ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] studio-pill-active">
                  已接入 · 上次同步 {fmtTime(updatedAt)}
                  {fromCache ? " · 离线缓存" : ""}
                </span>
              ) : loading ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[color:var(--studio-muted)]">
                  同步中…
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[color:var(--studio-muted)]">
                  未接入
                </span>
              )}
              <button
                type="button"
                className="ml-auto text-[11px] text-[color:var(--studio-muted)] hover:text-[color:var(--studio-text)]"
                onClick={() => void refresh()}
                disabled={loading}
              >
                刷新本区
              </button>
            </div>
            {connected && works.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {works.map((work) => (
                  <WorkCard key={`${work.platform}:${work.id}`} work={work} />
                ))}
              </div>
            ) : (
              <div className="studio-glass flex min-h-[72px] items-center justify-center px-4 py-4 text-center text-[12px] text-[color:var(--studio-muted)]">
                暂无作品 · 等待首次同步
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

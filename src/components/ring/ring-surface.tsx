/**
 * 神经星环 Surface 总装（第二主题，与 ThemeId 彻底隔离——裁定①）。
 *
 * 生命周期纪律：
 *  - Three.js 舞台只在客户端构造（外层 ring-client 以 ssr:false 载入
 *    本组件），卸载时 stage.dispose() 全量释放（rAF/监听/GL 资源）。
 *  - 数据只读：loadRingData 读 JSON + 既有 studio_* 键；storage 事件
 *    与 30s 轮询刷新；bus 只 on() 订阅真实事件触发信号脉冲与重读，
 *    星环永不 emit、永不写键（方案 §0.2 / 本期禁令）。
 *  - WebGL 不可用 → .glfail 降级文案，HUD 数据面板照常呈现。
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles/board.module.css";
import { loadRingData, SLOT_DEFS } from "./data/surfaces";
import { slotIndexOfLogItem, synapseBuckets } from "./data/derive";
import type { RingData } from "./data/types";
import { RingStage, type ViewMode } from "./engine/stage";
import { on as busOn, type BusEvent } from "@/components/studio/bus";
import { TitleBlock, LastEvent } from "./hud/title-block";
import { Toolbar } from "./hud/toolbar";
import { SlotRail } from "./hud/slot-rail";
import { SynapseGrid } from "./hud/synapse-grid";
import { SignalFeed } from "./hud/signal-feed";
import { MetricBar, type FpsInfo } from "./hud/metric-bar";

type Hover = { slot: number; x: number; y: number } | null;

const fmtSession = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

export default function RingSurface() {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<RingStage | null>(null);
  /* 挂载时刻入 state（SESSION 真实计时的零点；懒初始化只跑一次） */
  const [mountTs] = useState(() => Date.now());

  const [data, setData] = useState<RingData | null>(null);
  /* WebGL 可用性在首渲染探一次（本组件 ssr:false，document 可用） */
  const [glFailed, setGlFailed] = useState<boolean>(() => {
    const probe = document.createElement("canvas");
    return !(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  });
  const [narrow, setNarrow] = useState(
    () =>
      window.innerWidth < 760 ||
      window.innerWidth / window.innerHeight < 1.05,
  );
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
  );
  const [mode, setMode] = useState<ViewMode>("orbit");
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [fpsInfo, setFpsInfo] = useState<FpsInfo>(null);

  /* ── 舞台构造 + 数据读取 + 刷新通道 ── */
  useEffect(() => {
    let alive = true;

    const applyScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScale(Math.min(w / 1920, h / 1080));
      setNarrow(w < 760 || w / h < 1.05);
    };
    window.addEventListener("resize", applyScale);

    let stage: RingStage | null = null;
    const canvas = canvasRef.current;
    if (canvas && !glFailed) {
      try {
          stage = new RingStage(canvas, {
            onFps: (fps, dpr, bloom) => {
              if (alive) setFpsInfo({ fps, dpr, bloom });
            },
            onHover: (slot, clientX, clientY) => {
              if (!alive) return;
              if (slot === null) {
                setHover(null);
                return;
              }
              const rect = scalerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const s = rect.width / 1920 || 1;
              setHover({
                slot,
                x: (clientX - rect.left) / s,
                y: (clientY - rect.top) / s,
              });
            },
            onPick: (slot) => {
              if (!alive) return;
              setFocus((prev) => {
                const next = slot === null || slot < 0 ? null : slot;
                return prev === next ? null : next;
              });
            },
          });
          stageRef.current = stage;
        } catch {
          /* 构造失败 → 下一微任务再亮降级态（避免 effect 内同步 setState） */
          queueMicrotask(() => {
            if (alive) setGlFailed(true);
          });
        }
    }

    const reload = () => {
      void loadRingData()
        .then((d) => {
          if (!alive) return;
          setData(d);
          stageRef.current?.setData(d);
        })
        .catch(() => {
          /* 读取失败保持上一帧数据；槽位口径本身已对缺失做 — 处理 */
        });
    };
    reload();

    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("studio_")) reload();
    };
    window.addEventListener("storage", onStorage);
    const poll = window.setInterval(reload, 30_000);

    const offBus = busOn((ev: BusEvent) => {
      const slot = slotIndexOfLogItem({
        ts: Date.now(),
        type: ev.type,
        module: ev.moduleId,
        detail: ev.detail,
      });
      if (slot !== null) stageRef.current?.spawnSignal(slot);
      reload();
    });

    const clock = window.setInterval(() => {
      if (alive) setNow(new Date());
    }, 1000);

    return () => {
      alive = false;
      window.removeEventListener("resize", applyScale);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
      window.clearInterval(clock);
      offBus();
      stage?.dispose();
      stageRef.current = null;
    };
    // glFailed 为首渲染探针结果，只决定是否构造舞台；构造失败置位后
    // 不重跑本 effect（舞台已不存在，无需重建），故不入依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 聚焦联动（左栏点击 / 画布拾取共用同一状态） */
  useEffect(() => {
    stageRef.current?.setFocus(focus);
  }, [focus]);

  useEffect(() => {
    stageRef.current?.setViewMode(mode);
  }, [mode]);

  /* 突触桶以数据加载时刻为锚（loadedAt），30s 轮询自动滚动 */
  const buckets = useMemo(
    () => (data ? synapseBuckets(data.execLog, data.loadedAt) : []),
    [data],
  );

  const onFullscreen = () => {
    const el = boardRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const hoverDef =
    hover && hover.slot >= 0 ? SLOT_DEFS[hover.slot] : null;
  const hoverSlot = hover && hover.slot >= 0 ? data?.slots[hover.slot] : null;

  return (
    <div className={styles.board} ref={boardRef}>
      <canvas ref={canvasRef} className={styles.gl} />
      <div className={styles.vignette} />
      {glFailed ? (
        <div className={styles.glfail}>
          WEBGL UNAVAILABLE · 三维舞台不可用
          <div className={styles.dim}>
            HUD 数据面板照常呈现（全部真实数据）· 请换支持 WebGL 的浏览器
          </div>
        </div>
      ) : null}

      <div
        className={styles.scaler}
        ref={scalerRef}
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <TitleBlock now={now} />
        <LastEvent line={data?.lastEventLine ?? null} />
        <Toolbar
          mode={mode}
          onMode={setMode}
          onFullscreen={onFullscreen}
        />
        <SlotRail slots={data?.slots ?? []} focus={focus} onFocus={setFocus} />
        <SynapseGrid buckets={buckets} focus={focus} />
        <SignalFeed log={data?.execLog ?? []} />
        <MetricBar
          data={data}
          sessionText={fmtSession(now.getTime() - mountTs)}
          fpsInfo={fpsInfo}
        />
        {hover ? (
          <div
            className={styles.tooltip}
            style={{
              left: Math.min(hover.x + 18, 1600),
              top: Math.min(hover.y + 14, 900),
            }}
          >
            {hover.slot === -1 ? (
              <>
                <div className={styles.ttName}>创作空间 · HUB</div>
                13 团拓扑中心 · 模块动作经 bus 在此汇聚
                <br />
                执行日志 <b>{data?.execLog.length ?? "—"} 条</b> · 只读消费
              </>
            ) : hoverDef ? (
              <>
                <div className={styles.ttName}>
                  {hoverDef.cn} · {hoverDef.en}
                </div>
                当前计数{" "}
                <b>
                  {hoverSlot
                    ? (hoverSlot.countText ??
                      (hoverSlot.count === null ? "—" : hoverSlot.count))
                    : "—"}
                  {hoverSlot?.unit ?? ""}
                </b>
                <br />
                {hoverSlot?.src ?? hoverDef.srcLabel}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {narrow ? (
        <div className={styles.rotateHint}>
          <div>
            <b>NEURAL RING · 神经星环</b>
            <br />
            请用横屏 ≥1280×720 打开
            <br />
            本屏为宽幅作战布局，不提供窄屏降级版
          </div>
        </div>
      ) : null}
    </div>
  );
}

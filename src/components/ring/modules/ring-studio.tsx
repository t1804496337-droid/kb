"use client";

/** 第二主题 · 创作空间：三泳道看板（按 status 分组）+ 指针拖拽换道
 * + 箭头换道兜底 + 创作组入口 + 右栏。
 * 与灵感池读写同一键 studio_workflow_steps_v2（两个视角）；写前必
 * 须重读最新数组，绝不拿挂载旧快照覆盖。每次写盘成功后复用既有
 * STUDIO_STAGE_MOVE（moduleId=studio），不新增事件类型。
 * 换道机制与挂载侧 StudioBoard 一致：pointer 拖起 + elementFromPoint
 * 命中 [data-board-lane] + 落空/落回原道不改状态；不是 HTML5 draggable。 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import RingModuleShell from "./ring-module-shell";
import { emit } from "@/components/studio/bus";
import skillsSyncJson from "../../../../public/skills-sync.json";

const STEPS_KEY = "studio_workflow_steps_v2";
const WORKS_KEY = "studio_works_items_v1";
const CAL_KEY = "studio_calendar_items_v1";

type FlowZone = "me" | "ai" | "agent";
type FlowStage = "incubate" | "produce" | "ready";
type FlowStep = {
  id?: string;
  title: string;
  zone: FlowZone;
  note?: string;
  status?: string;
  platform?: string;
};

const FLOW_ZONES: { id: FlowZone; label: string; en: string }[] = [
  { id: "me", label: "我", en: "ME" },
  { id: "ai", label: "AI", en: "AI" },
  { id: "agent", label: "Agent", en: "AGENT" },
];
const FLOW_STAGES: { id: FlowStage; label: string; en: string }[] = [
  { id: "incubate", label: "孵化", en: "INCUBATE" },
  { id: "produce", label: "制作", en: "PRODUCE" },
  { id: "ready", label: "待发", en: "READY" },
];
const FLOW_PLATFORMS: { id: string; tag: string; label: string }[] = [
  { id: "xhs", tag: "XHS", label: "小红书" },
  { id: "yt", tag: "YT", label: "YouTube" },
  { id: "bili", tag: "BILI", label: "B站" },
  { id: "sph", tag: "SPH", label: "视频号" },
  { id: "x", tag: "X", label: "X" },
];
const platformOf = (p?: string) => FLOW_PLATFORMS.find((x) => x.id === p);
const stageOf = (s: FlowStep): FlowStage =>
  s.status === "produce" || s.status === "ready" ? s.status : "incubate";
const stageLabel = (st: FlowStage) =>
  FLOW_STAGES.find((x) => x.id === st)?.label ?? "孵化";
const zoneLabel = (z: FlowZone) =>
  FLOW_ZONES.find((x) => x.id === z)?.label ?? z;

const okStep = (s: unknown): s is FlowStep => {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    (o.zone === "me" || o.zone === "ai" || o.zone === "agent")
  );
};

/* 每次写前重读最新数组（同键纪律：灵感池与创作空间共享此键）。 */
function readStepsFresh(): FlowStep[] {
  try {
    const raw = window.localStorage.getItem(STEPS_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(okStep);
  } catch {
    return [];
  }
}
function writeSteps(steps: FlowStep[]): boolean {
  try {
    window.localStorage.setItem(STEPS_KEY, JSON.stringify(steps));
    return true;
  } catch {
    return false;
  }
}

const SKILLS_N = (
  skillsSyncJson as unknown as { agents: { skills: unknown[] }[] }
).agents.flatMap((a) => a.skills).length;

function readWorksCount(): number {
  try {
    const raw = window.localStorage.getItem(WORKS_KEY);
    if (raw === null) return 2;
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return 0;
    return v.filter(
      (w) =>
        w && typeof (w as { title?: unknown }).title === "string",
    ).length;
  } catch {
    return 0;
  }
}
function readTicketsCount(): number {
  try {
    const rawW = window.localStorage.getItem(WORKS_KEY);
    let works: { status?: unknown }[] | null = null;
    if (rawW !== null) {
      const v = JSON.parse(rawW) as unknown;
      works = Array.isArray(v) ? v : [];
    }
    const wEff = works ?? [
      { status: "待公开" },
      { status: "待发布" },
    ];
    const fromWorks = wEff.filter(
      (w) => w.status === "待发布" || w.status === "待公开",
    ).length;
    const rawC = window.localStorage.getItem(CAL_KEY);
    let fromCal = 0;
    if (rawC) {
      const v = JSON.parse(rawC) as unknown;
      if (Array.isArray(v)) {
        fromCal = v.filter(
          (i) =>
            i &&
            typeof (i as { title?: unknown }).title === "string" &&
            !(i as { done?: unknown }).done,
        ).length;
      }
    }
    return fromWorks + fromCal;
  } catch {
    return 0;
  }
}

export default function RingStudio() {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loaded, setLoaded] = useState(false);
  /* 作品库/待办票计数只在挂载 effect 内读（渲染期读 localStorage 会导致
   * 服务端 0/0 与客户端真实值水合不一致，React #418）。 */
  const [hub, setHub] = useState({ works: 0, tickets: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    dx: number;
    dy: number;
    active: boolean;
  } | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    stage: FlowStage;
  } | null>(null);

  useEffect(() => {
    setSteps(readStepsFresh());
    setHub({ works: readWorksCount(), tickets: readTicketsCount() });
    setLoaded(true);
  }, []);

  /* Esc 取消进行中的拖拽。 */
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragRef.current = null;
        setDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag]);

  const moveStep = useCallback((id: string, target: FlowStage) => {
    const fresh = readStepsFresh();
    const cur = fresh.find((s) => s.id === id);
    if (!cur || stageOf(cur) === target) return;
    const next = fresh.map((s) =>
      s.id === id ? { ...s, status: target } : s,
    );
    if (!writeSteps(next)) return;
    setSteps(next);
    emit("STUDIO_STAGE_MOVE", "studio", `${cur.title} → ${stageLabel(target)}`);
    setStatus({ text: `已流转 → ${stageLabel(target)}`, ok: true });
  }, []);

  const setStepPlatform = useCallback((id: string, p: string) => {
    const fresh = readStepsFresh();
    const cur = fresh.find((s) => s.id === id);
    if (!cur || (cur.platform ?? "") === p) return;
    const next = fresh.map((s) => {
      if (s.id !== id) return s;
      const copy = { ...s };
      if (p) copy.platform = p;
      else delete copy.platform;
      return copy;
    });
    if (!writeSteps(next)) return;
    setSteps(next);
  }, []);

  const onChipPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    s: FlowStep,
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!s.id) return;
    dragRef.current = {
      id: s.id,
      startX: e.clientX,
      startY: e.clientY,
      stage: stageOf(s),
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture 不可用 → 仍可走箭头换道 */
    }
    setDrag({ id: s.id, dx: 0, dy: 0, active: false });
  };
  const onChipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const active = Math.hypot(dx, dy) > 6;
    setDrag({ id: d.id, dx, dy, active });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    const wasActive = drag?.active ?? false;
    setDrag(null);
    if (!d || !commit || !wasActive) return;
    /* 拖起时芯片 pointer-events 已关，elementFromPoint 命中其下泳道 */
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-board-lane]");
    const lane = el?.dataset.boardLane as FlowStage | undefined;
    if (
      lane &&
      (lane === "incubate" || lane === "produce" || lane === "ready") &&
      lane !== d.stage
    ) {
      moveStep(d.id, lane);
    }
    /* 落空/落回原道：不改状态（drag 已清，芯片自动回位） */
  };

  const stageCounts: Record<FlowStage, number> = {
    incubate: 0,
    produce: 0,
    ready: 0,
  };
  for (const s of steps) stageCounts[stageOf(s)] += 1;

  const selected =
    steps.find((s) => s.id === selectedId) ?? steps[0] ?? null;

  const worksN = hub.works;
  const ticketsN = hub.tickets;

  return (
    <RingModuleShell
      active="studio"
      cn="创作空间"
      en="STUDIO"
      src="studio_workflow_steps_v2 · StudioBoard 同源"
      count={loaded ? steps.length : null}
      note="与灵感池同源 · 改一处两处同步"
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">选中芯片 · DETAIL</div>
          {selected ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">分区</div>
                  <div className="rm-rowT">
                    {zoneLabel(selected.zone)} · {selected.zone.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">阶段</div>
                  <div className="rm-rowT">{stageLabel(stageOf(selected))}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">平台</div>
                  <div className="rm-rowT">
                    {selected.platform
                      ? (platformOf(selected.platform)?.label ?? selected.platform)
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">备注</div>
                  <div className="rm-rowT">{selected.note ?? "—"}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">ID</div>
                  <div className="rm-rowT">{selected.id ?? "—"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rm-empty">暂无选中芯片</div>
          )}
          <div className="rm-sec" style={{ marginTop: 26 }}>
            <div className="rm-secHead">
              <span className="rm-secCn">阶段统计</span>
              <span className="rm-secEn">STAGES</span>
            </div>
            <div className="rm-statLine">
              <span>
                孵化 <b>{stageCounts.incubate}</b>
              </span>
              <span>
                制作 <b>{stageCounts.produce}</b>
              </span>
              <span>
                待发 <b>{stageCounts.ready}</b>
              </span>
            </div>
          </div>
        </div>
      }
    >
      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">创作流水线</span>
          <span className="rm-secEn">PIPELINE · 拖拽或点箭头换道</span>
          <span className="rm-secNote">共 {steps.length} 步 · 与灵感池同源</span>
        </div>
        <div className="rm-studioBoard" data-testid="rm-studio-board">
          {FLOW_STAGES.map((stage) => {
            const laneSteps = steps.filter((s) => stageOf(s) === stage.id);
            return (
              <div
                key={stage.id}
                className="rm-studioLane"
                data-board-lane={stage.id}
                data-testid={`rm-studio-lane-${stage.id}`}
              >
                <div className="rm-studioLaneHead">
                  <span className="rm-studioLaneTitle">{stage.label}</span>
                  <span className="rm-secEn">{stage.en}</span>
                  <span className="rm-studioLaneCount">{laneSteps.length}</span>
                </div>
                {laneSteps.length > 0 ? (
                  laneSteps.map((s) => {
                    const dragState = drag && drag.id === s.id ? drag : null;
                    const stageIdx = FLOW_STAGES.findIndex((x) => x.id === stage.id);
                    return (
                      <div
                        key={s.id ?? s.title}
                        className={`rm-studioChip${dragState && dragState.active ? " rm-studioChipDrag" : ""}${selected?.id === s.id ? " rm-studioChipActive" : ""}`}
                        data-testid={`rm-studio-chip-${s.id ?? s.title}`}
                        style={
                          dragState
                            ? {
                                transform: `translate(${dragState.dx}px, ${dragState.dy}px)`,
                                pointerEvents: dragState.active
                                  ? ("none" as const)
                                  : undefined,
                              }
                            : undefined
                        }
                        onPointerDown={(e) => onChipPointerDown(e, s)}
                        onPointerMove={onChipPointerMove}
                        onPointerUp={(e) => endDrag(e, true)}
                        onPointerCancel={(e) => endDrag(e, false)}
                        onClick={() => {
                          if (s.id) setSelectedId(s.id);
                        }}
                      >
                        <button
                          type="button"
                          className="rm-studioArrow"
                          data-testid={`rm-studio-prev-${s.id ?? s.title}`}
                          aria-label="移到上一道"
                          disabled={stageIdx === 0}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (s.id) moveStep(s.id, FLOW_STAGES[stageIdx - 1].id);
                          }}
                        >
                          ‹
                        </button>
                        <div className="rm-studioChipMain">
                          <div className="rm-studioChipTitle">
                            <span className="rm-studioHandle">⠿</span> {s.title}
                          </div>
                          {s.note ? (
                            <div className="rm-rowSub">{s.note}</div>
                          ) : null}
                        </div>
                        <span className="rm-chip rm-chipPur">
                          {zoneLabel(s.zone)}区
                        </span>
                        {platformOf(s.platform) ? (
                          <span
                            className="rm-chip rm-chipCyan"
                            data-testid={`rm-studio-plat-tag-${s.id ?? s.title}`}
                          >
                            [{platformOf(s.platform)?.tag}]
                          </span>
                        ) : null}
                        <select
                          className="rm-studioPlat"
                          data-testid={`rm-studio-plat-${s.id ?? s.title}`}
                          aria-label={`平台 · ${s.title}`}
                          value={s.platform ?? ""}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (s.id) setStepPlatform(s.id, e.target.value);
                          }}
                        >
                          <option value="">—</option>
                          {FLOW_PLATFORMS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.tag}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rm-studioArrow"
                          data-testid={`rm-studio-next-${s.id ?? s.title}`}
                          aria-label="移到下一道"
                          disabled={stageIdx === FLOW_STAGES.length - 1}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (s.id) moveStep(s.id, FLOW_STAGES[stageIdx + 1].id);
                          }}
                        >
                          ›
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="rm-empty">本道为空</div>
                )}
              </div>
            );
          })}
        </div>
        {steps.length === 0 ? (
          <div className="rm-empty">
            流水线 0 步（无 status 的旧步骤一律先归孵化道）· 在灵感池新增步骤后回到这里流转。
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <Link
            href="/studio/ring/inspiration"
            className="rm-formBtn rm-formToggle"
            data-testid="rm-studio-goto-inspiration"
          >
            去灵感池新增 →
          </Link>
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">创作组入口</span>
          <span className="rm-secEn">CREATE GROUP · 次级</span>
        </div>
        <div className="rm-studioHub">
          <button type="button" className="rm-studioHubCard" disabled>
            <div className="rm-studioHubTitle">
              创作空间 <span className="rm-secEn">STUDIO</span>
            </div>
            <div className="rm-rowSub">创作组中枢 · 本页即入口聚合</div>
            <div className="rm-studioHubMeta">HUB</div>
          </button>
          <Link href="/studio/ring/works" className="rm-studioHubCard">
            <div className="rm-studioHubTitle">
              作品库 <span className="rm-secEn">WORKS</span>
            </div>
            <div className="rm-rowSub">YouTube EP001 待公开 · 视频号 ep01 配音定稿待发布</div>
            <div className="rm-studioHubMeta">{worksN} 件作品 → 进入</div>
          </Link>
          <Link href="/studio/ring/skills" className="rm-studioHubCard">
            <div className="rm-studioHubTitle">
              技能库 <span className="rm-secEn">SKILLS</span>
            </div>
            <div className="rm-rowSub">grokbot / Luna 已装技能</div>
            <div className="rm-studioHubMeta">{SKILLS_N} 个 → 进入</div>
          </Link>
        </div>
        <div className="rm-rowSub" style={{ marginTop: 10 }}>
          作品库 {worksN} 件作品 · 另有待办票 {ticketsN} 张
        </div>
      </div>
    </RingModuleShell>
  );
}

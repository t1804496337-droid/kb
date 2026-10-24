"use client";

/** 第二主题 · 灵感池：三泳道看板 + 步骤原生 CRUD + 阶段流转。
 * 只写既有键 studio_workflow_steps_v2；写盘成功后复用既有 STUDIO_STAGE_MOVE
 * （moduleId=inspiration），不新增事件类型。编辑按全量数组下标定位，与挂载侧一致。 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import RingModuleShell from "./ring-module-shell";
import { emit } from "@/components/studio/bus";

const STEPS_KEY = "studio_workflow_steps_v2";

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
const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  yt: "YouTube",
  bili: "B站",
  sph: "视频号",
  x: "X",
};
const PLATFORMS = ["", "xhs", "yt", "bili", "sph", "x"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const hhmmNow = (): string => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/* 读取过滤与挂载侧一致：标题必备字符串，分区必备三值之一。 */
const okStep = (s: unknown): s is FlowStep => {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    (o.zone === "me" || o.zone === "ai" || o.zone === "agent")
  );
};

const stageOf = (s: FlowStep): FlowStage =>
  s.status === "produce" || s.status === "ready" ? s.status : "incubate";
const stageLabel = (st: FlowStage) =>
  FLOW_STAGES.find((x) => x.id === st)?.label ?? "孵化";

function readSteps(): FlowStep[] {
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

export default function RingInspiration() {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fNote, setFNote] = useState("");
  const [fZone, setFZone] = useState<FlowZone>("me");
  const [fStatus, setFStatus] = useState<FlowStage>("incubate");
  const [fPlatform, setFPlatform] = useState("");
  const [fErr, setFErr] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eNote, setENote] = useState("");
  const [eZone, setEZone] = useState<FlowZone>("me");
  const [eStatus, setEStatus] = useState<FlowStage>("incubate");
  const [ePlatform, setEPlatform] = useState("");
  const [eErr, setEErr] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [delArm, setDelArm] = useState<number | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dNote, setDNote] = useState("");
  const [dZone, setDZone] = useState<FlowZone>("me");
  const [dStatus, setDStatus] = useState<FlowStage>("incubate");
  const [dPlatform, setDPlatform] = useState("");
  const [dErr, setDErr] = useState("");
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setSteps(readSteps());
    setStatus({ text: `INSPIRATION · 已同步 ${hhmmNow()}`, ok: false });
    setLoaded(true);
  }, []);

  /* 落盘纪律：写盘成功才更新状态并发总线。 */
  const commit = (next: FlowStep[], detail: string): boolean => {
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    setSteps(next);
    emit("STUDIO_STAGE_MOVE", "inspiration", detail);
    setStatus({ text: "已保存", ok: true });
    return true;
  };

  const validate = (title: string, note: string): string => {
    const t = title.trim();
    if (!t) return "先填步骤标题";
    if (t.length > 80) return "标题最多 80 字";
    if (note.trim().length > 200) return "备注最多 200 字";
    return "";
  };

  const addStep = (e: FormEvent) => {
    e.preventDefault();
    const err = validate(fTitle, fNote);
    if (err) {
      setFErr(err);
      return;
    }
    const t = fTitle.trim();
    const step: FlowStep = { id: `step-${Date.now()}`, title: t, zone: fZone, status: fStatus };
    const note = fNote.trim();
    if (note) step.note = note;
    if (fPlatform) step.platform = fPlatform;
    if (commit([...steps, step], `新增步骤 · ${t}`)) {
      setFTitle("");
      setFNote("");
      setFZone("me");
      setFStatus("incubate");
      setFPlatform("");
      setFErr("");
      setFormOpen(false);
      setSelectedIdx(steps.length);
    }
  };

  const startEdit = (gi: number) => {
    const s = steps[gi];
    if (!s) return;
    setEditIdx(gi);
    setETitle(s.title);
    setENote(s.note ?? "");
    setEZone(s.zone);
    setEStatus(stageOf(s));
    setEPlatform(s.platform ?? "");
    setEErr("");
  };

  const saveEdit = (
    gi: number,
    title: string,
    note: string,
    zone: FlowZone,
    st: FlowStage,
    platform: string,
  ): boolean => {
    const err = validate(title, note);
    if (err) {
      setEErr(err);
      setDErr(err);
      return false;
    }
    const t = title.trim();
    const next = steps.map((s, i) => {
      if (i !== gi) return s;
      const copy: FlowStep = {
        ...s,
        id: s.id ?? `step-${Date.now()}`,
        title: t,
        zone,
        status: st,
      };
      const n = note.trim();
      if (n) copy.note = n;
      else delete copy.note;
      if (platform) copy.platform = platform;
      else delete copy.platform;
      return copy;
    });
    if (commit(next, `编辑步骤 · ${t}`)) {
      setEditIdx(null);
      setDetailEditing(false);
      setEErr("");
      setDErr("");
      return true;
    }
    return false;
  };

  const delStep = (gi: number) => {
    const s = steps[gi];
    if (!s) return;
    if (editIdx === gi) setEditIdx(null);
    if (selectedIdx === gi) setSelectedIdx(null);
    setDelArm(null);
    setDetailEditing(false);
    commit(
      steps.filter((_, i) => i !== gi),
      `删除步骤 · ${s.title}`,
    );
  };

  const moveStage = (gi: number, st: FlowStage) => {
    const s = steps[gi];
    if (!s || stageOf(s) === st) return;
    const next = steps.map((x, i) => (i === gi ? { ...x, status: st } : x));
    commit(next, `阶段流转 · ${s.title} → ${stageLabel(st)}`);
  };

  const stageCounts: Record<FlowStage, number> = { incubate: 0, produce: 0, ready: 0 };
  for (const s of steps) stageCounts[stageOf(s)] += 1;

  const selected =
    selectedIdx !== null && selectedIdx < steps.length ? steps[selectedIdx] : (steps[0] ?? null);
  const selectedGi = selected ? steps.indexOf(selected) : -1;

  const startDetailEdit = () => {
    if (!selected || selectedGi < 0) return;
    setDTitle(selected.title);
    setDNote(selected.note ?? "");
    setDZone(selected.zone);
    setDStatus(stageOf(selected));
    setDPlatform(selected.platform ?? "");
    setDErr("");
    setDetailEditing(true);
  };

  const zoneLabel = (z: FlowZone) => FLOW_ZONES.find((x) => x.id === z)?.label ?? z;

  const editForm = (
    gi: number,
    title: string,
    setTitle: (v: string) => void,
    note: string,
    setNote: (v: string) => void,
    zone: FlowZone,
    setZone: (v: FlowZone) => void,
    st: FlowStage,
    setSt: (v: FlowStage) => void,
    platform: string,
    setPlatform: (v: string) => void,
    err: string,
    onSave: () => void,
    onCancel: () => void,
  ) => (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="rm-field" style={{ marginBottom: 6 }}>
        <label>标题</label>
        <input
          className="rm-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
          }}
        />
      </div>
      <div className="rm-field" style={{ marginBottom: 6 }}>
        <label>备注</label>
        <input
          className="rm-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="≤200 字"
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>分区</label>
          <select
            className="rm-input"
            value={zone}
            onChange={(e) => setZone(e.target.value as FlowZone)}
          >
            {FLOW_ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>阶段</label>
          <select
            className="rm-input"
            value={st}
            onChange={(e) => setSt(e.target.value as FlowStage)}
          >
            {FLOW_STAGES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>平台</label>
          <select
            className="rm-input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">不限</option>
            {PLATFORMS.filter(Boolean).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {err ? <div className="rm-err" style={{ marginBottom: 6 }}>{err}</div> : null}
      <div className="rm-formBtns">
        <button type="button" className="rm-formBtn rm-formBtnPrimary" onClick={onSave}>
          保存
        </button>
        <button type="button" className="rm-formBtn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );

  const cardBody = (s: FlowStep, gi: number) => {
    const st = stageOf(s);
    const editing = editIdx === gi;
    return (
      <div
        className={`rm-flowCard${selectedGi === gi ? " rm-flowCardActive" : ""}`}
        onClick={() => setSelectedIdx(gi)}
      >
        {editing ? (
          editForm(
            gi,
            eTitle,
            setETitle,
            eNote,
            setENote,
            eZone,
            setEZone,
            eStatus,
            setEStatus,
            ePlatform,
            setEPlatform,
            eErr,
            () => saveEdit(gi, eTitle, eNote, eZone, eStatus, ePlatform),
            () => setEditIdx(null),
          )
        ) : (
          <div>
            <div className="rm-flowCardTitle">{s.title}</div>
            {s.note ? <div className="rm-flowCardNote">{s.note}</div> : null}
            {s.platform ? (
              <div className="rm-flowCardNote">平台 · {PLATFORM_LABEL[s.platform] ?? s.platform}</div>
            ) : null}
            <div className="rm-flowChips" onClick={(e) => e.stopPropagation()}>
              {FLOW_STAGES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`rm-stageChip${st === x.id ? " rm-stageChipOn" : ""}`}
                  onClick={() => moveStage(gi, x.id)}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" className="rm-miniBtn" onClick={() => startEdit(gi)}>
                编辑
              </button>
              <button
                type="button"
                className={`rm-miniBtn${delArm === gi ? " rm-miniBtnDanger" : ""}`}
                onClick={() => {
                  if (delArm === gi) delStep(gi);
                  else setDelArm(gi);
                }}
              >
                {delArm === gi ? "确认删除？" : "删除"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <RingModuleShell
      active="inspiration"
      cn="灵感池"
      en="INSPIRATION"
      src="studio_workflow_steps_v2 · 流水线步数"
      count={loaded ? steps.length : null}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">选中步骤 · DETAIL</div>
          {selected && selectedGi >= 0 ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              {detailEditing ? (
                editForm(
                  selectedGi,
                  dTitle,
                  setDTitle,
                  dNote,
                  setDNote,
                  dZone,
                  setDZone,
                  dStatus,
                  setDStatus,
                  dPlatform,
                  setDPlatform,
                  dErr,
                  () => saveEdit(selectedGi, dTitle, dNote, dZone, dStatus, dPlatform),
                  () => setDetailEditing(false),
                )
              ) : (
                <div>
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
                          ? (PLATFORM_LABEL[selected.platform] ?? selected.platform)
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
                  <div className="rm-formBtns" style={{ marginTop: 12 }}>
                    <button type="button" className="rm-formBtn" onClick={startDetailEdit}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className={`rm-formBtn${delArm === selectedGi ? " rm-miniBtnDanger" : ""}`}
                      onClick={() => {
                        if (delArm === selectedGi) delStep(selectedGi);
                        else setDelArm(selectedGi);
                      }}
                    >
                      {delArm === selectedGi ? "确认删除？" : "删除"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rm-empty">暂无选中步骤</div>
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
      {!formOpen ? (
        <button
          type="button"
          className="rm-formBtn rm-formToggle"
          onClick={() => setFormOpen(true)}
        >
          + 新增步骤 · NEW STEP
        </button>
      ) : (
        <form className="rm-form" onSubmit={addStep}>
          <div className="rm-b2FormGrid">
            <div className="rm-field">
              <label>标题 *</label>
              <input
                className={`rm-input${fErr ? " err" : ""}`}
                type="text"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addStep(e as unknown as FormEvent);
                }}
                placeholder="新步骤标题"
              />
            </div>
            <div className="rm-field">
              <label>备注</label>
              <input
                className="rm-input"
                type="text"
                value={fNote}
                onChange={(e) => setFNote(e.target.value)}
                placeholder="≤200 字，可空"
              />
            </div>
            <div className="rm-field">
              <label>分区 *</label>
              <select
                className="rm-input"
                value={fZone}
                onChange={(e) => setFZone(e.target.value as FlowZone)}
              >
                {FLOW_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rm-field">
              <label>阶段 *</label>
              <select
                className="rm-input"
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as FlowStage)}
              >
                {FLOW_STAGES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rm-field">
              <label>平台</label>
              <select
                className="rm-input"
                value={fPlatform}
                onChange={(e) => setFPlatform(e.target.value)}
              >
                <option value="">不限</option>
                {PLATFORMS.filter(Boolean).map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {fErr ? <div className="rm-err" style={{ marginTop: 8 }}>{fErr}</div> : null}
          <div className="rm-formFoot">
            <span className="rm-formHint">标题 1–80 字 · 备注 ≤200 字 · 回车直接提交</span>
            <div className="rm-formBtns">
              <button type="submit" className="rm-formBtn rm-formBtnPrimary">
                加步骤
              </button>
              <button type="button" className="rm-formBtn" onClick={() => setFormOpen(false)}>
                收起
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">执行分区</span>
          <span className="rm-secEn">ZONES · ME / AI / AGENT</span>
          <span className="rm-secNote">共 {steps.length} 步</span>
        </div>
        <div className="rm-flowLanes">
          {FLOW_ZONES.map((z) => {
            const lane = steps
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => s.zone === z.id);
            return (
              <div key={z.id} className="rm-flowLane">
                <div className="rm-flowLaneHead">
                  <span className="rm-flowLaneTitle">
                    {z.label} · {z.en}
                  </span>
                  <span className="rm-flowLaneCount">{lane.length} 步</span>
                </div>
                {lane.length === 0 ? (
                  <div className="rm-empty">暂无步骤</div>
                ) : (
                  lane.map(({ s, i }) => <div key={s.id ?? `${z.id}:${i}`}>{cardBody(s, i)}</div>)
                )}
              </div>
            );
          })}
        </div>
      </div>
    </RingModuleShell>
  );
}

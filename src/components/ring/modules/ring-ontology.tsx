"use client";

/** 第二主题 · 本体知识库：库名条 + 站内笔记 CRUD + 库内文件 +
 * 元信息卡 + 右栏。笔记写 studio_ontology_notes_v1，库名写 raw 键
 * studio_obsidian_vault_v1；库内文件只读；不发总线。
 * openInObsidian 与挂载侧逐字一致：空库名只聚焦 + 提示、不发链接；
 * needVault 在库名输入变非空时清除。 */

import { useEffect, useRef, useState } from "react";
import RingModuleShell from "./ring-module-shell";

const NOTES_KEY = "studio_ontology_notes_v1";
const VAULT_KEY = "studio_obsidian_vault_v1";

type OntoNote = {
  id: string;
  title: string;
  tag: string;
  body?: string;
  createdAt: string;
};

const ONTO_TAGS = ["灵感", "干货", "待办线索", "人脉", "消费决策", "其他"];
/* 与挂载侧 ONTOLOGY_FILES 逐字同源（只读）。 */
const ONTOLOGY_FILES: { file: string; title: string; tag: string }[] = [
  { file: "README.md", title: "第二大脑 · 框架说明", tag: "框架" },
];

const okNote = (n: unknown): n is OntoNote => {
  if (!n || typeof n !== "object") return false;
  const o = n as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.tag === "string" &&
    typeof o.createdAt === "string"
  );
};
function readNotes(): OntoNote[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(okNote);
  } catch {
    return [];
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export default function RingOntology() {
  const [vault, setVault] = useState("");
  const [needVault, setNeedVault] = useState(false);
  const vaultInputRef = useRef<HTMLInputElement | null>(null);
  const [notes, setNotes] = useState<OntoNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fTag, setFTag] = useState(ONTO_TAGS[0]);
  const [fBody, setFBody] = useState("");
  const [fErr, setFErr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eTag, setETag] = useState(ONTO_TAGS[0]);
  const [eBody, setEBody] = useState("");
  const [eErr, setEErr] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [delArm, setDelArm] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VAULT_KEY);
      if (typeof v === "string") setVault(v);
    } catch {
      /* storage unavailable → 本次会话内填写 */
    }
    setNotes(readNotes());
    setLoaded(true);
  }, []);

  const commitNotes = (next: OntoNote[]): boolean => {
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    setNotes(next);
    setStatus({ text: "已保存", ok: true });
    return true;
  };

  const saveVault = (v: string) => {
    setVault(v);
    if (v.trim()) setNeedVault(false);
    try {
      if (v) window.localStorage.setItem(VAULT_KEY, v);
      else window.localStorage.removeItem(VAULT_KEY);
    } catch {
      /* storage unavailable → 仅本次会话内生效 */
    }
  };

  const openInObsidian = (file: string) => {
    const v = vault.trim();
    if (!v) {
      setNeedVault(true);
      vaultInputRef.current?.focus();
      return;
    }
    window.open(
      `obsidian://open?vault=${encodeURIComponent(v)}&file=${encodeURIComponent(file)}`,
      "_blank",
    );
  };

  const validate = (title: string, body: string): string => {
    const t = title.trim();
    if (!t) return "先填笔记标题";
    if (t.length > 80) return "标题最多 80 字";
    if (body.trim().length > 2000) return "正文最多 2000 字";
    return "";
  };

  const addNote = () => {
    const err = validate(fTitle, fBody);
    if (err) {
      setFErr(err);
      return;
    }
    const note: OntoNote = {
      id: `onto-${Date.now()}`,
      title: fTitle.trim(),
      tag: fTag,
      createdAt: todayStr(),
    };
    const b = fBody.trim();
    if (b) note.body = b;
    if (commitNotes([...notes, note])) {
      setFTitle("");
      setFBody("");
      setFTag(ONTO_TAGS[0]);
      setFErr("");
      setFormOpen(false);
      setSelectedId(note.id);
    }
  };
  const startEdit = (n: OntoNote) => {
    setEditId(n.id);
    setETitle(n.title);
    setETag(n.tag);
    setEBody(n.body ?? "");
    setEErr("");
  };
  const saveEdit = () => {
    if (!editId) return;
    const err = validate(eTitle, eBody);
    if (err) {
      setEErr(err);
      return;
    }
    const next = notes.map((n) => {
      if (n.id !== editId) return n;
      const copy: OntoNote = { ...n, title: eTitle.trim(), tag: eTag };
      const b = eBody.trim();
      if (b) copy.body = b;
      else delete copy.body;
      return copy;
    });
    if (commitNotes(next)) setEditId(null);
  };
  const delNote = (n: OntoNote) => {
    if (editId === n.id) setEditId(null);
    if (selectedId === n.id) setSelectedId(null);
    setDelArm(null);
    commitNotes(notes.filter((x) => x.id !== n.id));
  };

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  const editForm = (
    title: string,
    setTitle: (v: string) => void,
    tag: string,
    setTag: (v: string) => void,
    body: string,
    setBody: (v: string) => void,
    err: string,
    onSave: () => void,
    onCancel: () => void,
    testPrefix: string,
  ) => (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div className="rm-field" style={{ flex: 2 }}>
          <label>标题 *</label>
          <input
            className={`rm-input${err ? " err" : ""}`}
            data-testid={`${testPrefix}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="笔记标题（必填）"
          />
        </div>
        <div className="rm-field" style={{ flex: 1 }}>
          <label>标签 *</label>
          <select
            className="rm-input"
            data-testid={`${testPrefix}-tag`}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            {ONTO_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rm-field" style={{ marginBottom: 6 }}>
        <label>正文</label>
        <input
          className="rm-input"
          data-testid={`${testPrefix}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="正文（选填，≤2000 字）"
        />
      </div>
      {err ? (
        <div className="rm-err" style={{ marginBottom: 6 }}>
          {err}
        </div>
      ) : null}
      <div className="rm-formBtns">
        <button
          type="button"
          className="rm-formBtn rm-formBtnPrimary"
          data-testid={`${testPrefix}-save`}
          onClick={onSave}
        >
          保存
        </button>
        <button type="button" className="rm-formBtn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );

  const noteBody = (n: OntoNote) => (
    <div>
      <div className="rm-ontoNoteTitle">{n.title}</div>
      {n.body ? <div className="rm-ontoNoteBody">{n.body}</div> : null}
      <div className="rm-rowSub">站内笔记 · {n.createdAt}</div>
      <div
        style={{ display: "flex", gap: 6, marginTop: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="rm-chip rm-chipPur">{n.tag}</span>
        <button type="button" className="rm-miniBtn" onClick={() => startEdit(n)}>
          编辑
        </button>
        <button
          type="button"
          className={`rm-miniBtn${delArm === n.id ? " rm-miniBtnDanger" : ""}`}
          onClick={() => {
            if (delArm === n.id) delNote(n);
            else setDelArm(n.id);
          }}
        >
          {delArm === n.id ? "确认删除？" : "删除"}
        </button>
      </div>
    </div>
  );

  return (
    <RingModuleShell
      active="ontology"
      cn="本体知识库"
      en="ONTOLOGY"
      src="studio_ontology_notes_v1 · 条目数"
      count={loaded ? notes.length : null}
      status={status?.text}
      statusOk={status?.ok}
      detail={
        <div>
          <div className="rm-detailHead">选中笔记 · DETAIL</div>
          {selected ? (
            <div>
              <div className="rm-detailTitle">{selected.title}</div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">标签</div>
                  <div className="rm-rowT">{selected.tag}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">创建时间</div>
                  <div className="rm-rowT">{selected.createdAt}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">正文</div>
                  <div className="rm-rowT">{selected.body ?? "—"}</div>
                </div>
              </div>
              <div className="rm-row">
                <div className="rm-rowMain">
                  <div className="rm-rowSub">ID</div>
                  <div className="rm-rowT">{selected.id}</div>
                </div>
              </div>
              <div className="rm-formBtns" style={{ marginTop: 12 }}>
                <button type="button" className="rm-formBtn" onClick={() => startEdit(selected)}>
                  编辑
                </button>
                <button
                  type="button"
                  className={`rm-formBtn${delArm === selected.id ? " rm-miniBtnDanger" : ""}`}
                  onClick={() => {
                    if (delArm === selected.id) delNote(selected);
                    else setDelArm(selected.id);
                  }}
                >
                  {delArm === selected.id ? "确认删除？" : "删除"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rm-empty">暂无选中笔记</div>
          )}
          <div className="rm-sec" style={{ marginTop: 26 }}>
            <div className="rm-secHead">
              <span className="rm-secCn">统计</span>
              <span className="rm-secEn">STATS</span>
            </div>
            <div className="rm-statLine">
              <span>
                站内笔记 <b>{notes.length}</b>
              </span>
              <span>
                库内文件 <b>{ONTOLOGY_FILES.length}</b>
              </span>
            </div>
          </div>
        </div>
      }
    >
      <div className="rm-ontoVault">
        <label className="rm-ontoVaultLabel" htmlFor="rm-onto-vault">
          OBSIDIAN 库名
        </label>
        <input
          ref={vaultInputRef}
          id="rm-onto-vault"
          className="rm-input"
          data-testid="rm-onto-vault"
          type="text"
          value={vault}
          onChange={(e) => saveVault(e.target.value)}
          placeholder="Obsidian 库名"
          aria-label="Obsidian 库名"
        />
        {needVault ? (
          <span className="rm-ontoVaultHint" data-testid="rm-onto-need">
            先填库名
          </span>
        ) : null}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">站内笔记</span>
          <span className="rm-secEn">LOCAL NOTES</span>
          <span className="rm-secNote">存本机 · 增删改即时落盘</span>
        </div>
        {!formOpen ? (
          <button
            type="button"
            className="rm-formBtn rm-formToggle"
            data-testid="rm-onto-note-add"
            onClick={() => setFormOpen(true)}
          >
            + 新增笔记 · NEW NOTE
          </button>
        ) : (
          <form
            className="rm-form"
            onSubmit={(e) => {
              e.preventDefault();
              addNote();
            }}
          >
            {editForm(
              fTitle,
              setFTitle,
              fTag,
              setFTag,
              fBody,
              setFBody,
              fErr,
              addNote,
              () => setFormOpen(false),
              "rm-onto-note-f",
            )}
          </form>
        )}
        {notes.length === 0 && !formOpen ? (
          <div className="rm-empty">
            暂无站内笔记 · 点「+ 新增笔记」记第一条 · 只存这台设备，可随快照导出
          </div>
        ) : null}
        {notes.map((n) => (
          <div
            key={n.id}
            className={`rm-ontoNote${selected?.id === n.id ? " rm-ontoNoteActive" : ""}`}
            data-testid={`rm-onto-note-${n.id}`}
            onClick={() => setSelectedId(n.id)}
          >
            {editId === n.id
              ? editForm(
                  eTitle,
                  setETitle,
                  eTag,
                  setETag,
                  eBody,
                  setEBody,
                  eErr,
                  saveEdit,
                  () => setEditId(null),
                  "rm-onto-note-e",
                )
              : noteBody(n)}
          </div>
        ))}
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">库内文件</span>
          <span className="rm-secEn">VAULT FILES · OBSIDIAN 直达</span>
          <span className="rm-secNote">点 [OBSIDIAN] 唤起本地 Obsidian 打开该文件</span>
        </div>
        {ONTOLOGY_FILES.map((f) => (
          <div key={f.file} className="rm-row" data-testid={`rm-onto-file-${f.file}`}>
            <div className="rm-rowMain">
              <div className="rm-rowT">
                {f.title}
                <span className="rm-rowSub"> · {f.file}</span>
              </div>
              <div className="rm-rowSub">goals/ai-2/hidden_files/notes/{f.file}</div>
            </div>
            <span className="rm-chip rm-chipPur">{f.tag}</span>
            <button
              type="button"
              className="rm-miniBtn"
              data-testid={`rm-obsidian-open-${f.file}`}
              onClick={(e) => {
                e.stopPropagation();
                openInObsidian(f.file);
              }}
            >
              [ OBSIDIAN ]
            </button>
          </div>
        ))}
        <div className="rm-rowSub" style={{ marginTop: 8 }}>
          归档笔记仍为 0 篇——上面是库内现有的框架文件；第一条笔记落盘后会按同样的行样式列进这里，[
          OBSIDIAN ] 直达随行就有。
        </div>
      </div>

      <div className="rm-sec">
        <div className="rm-secHead">
          <span className="rm-secCn">元信息</span>
          <span className="rm-secEn">META</span>
        </div>
        <div className="rm-ontoKv">
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">状态</div>
              <div className="rm-rowT">
                建设中 · 库内文件 {ONTOLOGY_FILES.length} 件 · 站内笔记 {notes.length} 条
              </div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">条目来源</div>
              <div className="rm-rowT">
                第二大脑笔记 · goals/ai-2/hidden_files/notes/（库内文件）＋ 站内笔记（本机）
              </div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">库存现状</div>
              <div className="rm-rowT">
                框架 README 已建 · 归档笔记 0 篇（用户平时不存东西，从增量起步）· 站内笔记{" "}
                {notes.length} 条
              </div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">归档规则</div>
              <div className="rm-rowT">一事一件 · 文件名 YYYY-MM-DD-主题.md · 头部带来源/日期/标签</div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">标签体系</div>
              <div className="rm-rowT">灵感 / 干货 / 待办线索 / 人脉 / 消费决策 / 其他</div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">捕获方式</div>
              <div className="rm-rowT">聊天里丢来的链接/截图/灵感由 Luna 归档；对话中的有价值信息同步沉淀</div>
            </div>
          </div>
          <div className="rm-row">
            <div className="rm-rowMain">
              <div className="rm-rowSub">回顾</div>
              <div className="rm-rowT">暂定按需 · 每周 digest 待确认后再设</div>
            </div>
          </div>
        </div>
      </div>
    </RingModuleShell>
  );
}

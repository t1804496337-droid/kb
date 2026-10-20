import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Skills library push endpoint — lets each agent replace ONLY its own
 * block in public/skills-sync.json, without going through a PR.
 *
 * Auth: `Authorization: Bearer <token>`. The token identifies the agent;
 * any agent id claimed in the request body is ignored.
 *
 * Config comes only from the environment (never commit real values):
 *   SKILLS_AGENT_TOKENS  JSON object mapping agent id -> bearer token
 *   GITHUB_PUSH_TOKEN    fine-grained PAT, Contents read/write on this
 *                        repo only; used to commit skills-sync.json
 *   GITHUB_API_BASE      optional, defaults to https://api.github.com
 *                        (tests point this at a local mock server)
 *   GITHUB_REPO          optional, defaults to t1804496337-droid/kb
 * If either required variable is missing the endpoint fails closed (503),
 * matching the site login gate.
 */

const SKILLS_PATH = "public/skills-sync.json";
const BRANCH = "main";
const MAX_SKILLS = 200;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_FIELD_CHARS = 500;
const MAX_DESC_CHARS = 500;
const MAX_DETAIL_CHARS = 20000;

type SkillInput = {
  id?: string;
  name: string;
  zh: string;
  tag: string;
  source: string;
  desc?: string;
  detail?: string;
};

type Config = {
  agentTokens: Record<string, string>;
  githubToken: string;
  apiBase: string;
  repo: string;
};

function readConfig(): Config | null {
  // Dynamic lookup so Next does not inline these at build time.
  const env = process.env;
  const githubToken = (env.GITHUB_PUSH_TOKEN || "").trim();
  const rawTokens = (env.SKILLS_AGENT_TOKENS || "").trim();
  if (!githubToken || !rawTokens) return null;
  let agentTokens: Record<string, string>;
  try {
    const parsed = JSON.parse(rawTokens) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    agentTokens = {};
    for (const [id, token] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof token !== "string" || token.length === 0) return null;
      agentTokens[id] = token;
    }
    if (Object.keys(agentTokens).length === 0) return null;
  } catch {
    return null;
  }
  return {
    agentTokens,
    githubToken,
    apiBase: (env.GITHUB_API_BASE || "https://api.github.com").replace(
      /\/+$/,
      "",
    ),
    repo: env.GITHUB_REPO || "t1804496337-droid/kb",
  };
}

function identifyAgent(
  request: Request,
  agentTokens: Record<string, string>,
): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const presented = Buffer.from(match[1].trim(), "utf8");
  if (presented.length === 0) return null;
  for (const [id, token] of Object.entries(agentTokens)) {
    const expected = Buffer.from(token, "utf8");
    if (
      expected.length === presented.length &&
      timingSafeEqual(expected, presented)
    ) {
      return id;
    }
  }
  return null;
}

function validateSkills(body: unknown): SkillInput[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const skills = (body as { skills?: unknown }).skills;
  if (!Array.isArray(skills) || skills.length > MAX_SKILLS) return null;
  const out: SkillInput[] = [];
  for (const raw of skills) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const s = raw as Record<string, unknown>;
    const { name, zh, tag, source, id, desc, detail } = s;
    if (typeof name !== "string" || name.trim().length === 0) return null;
    if (typeof zh !== "string" || typeof tag !== "string") return null;
    if (typeof source !== "string") return null;
    if (
      name.length > MAX_FIELD_CHARS ||
      zh.length > MAX_FIELD_CHARS ||
      tag.length > MAX_FIELD_CHARS ||
      source.length > MAX_FIELD_CHARS
    ) {
      return null;
    }
    const entry: SkillInput = { name, zh, tag, source };
    if (id !== undefined) {
      if (typeof id !== "string" || id.length > MAX_FIELD_CHARS) return null;
      if (id) entry.id = id;
    }
    if (desc !== undefined) {
      if (typeof desc !== "string" || desc.length > MAX_DESC_CHARS) {
        return null;
      }
      if (desc) entry.desc = desc;
    }
    if (detail !== undefined) {
      if (typeof detail !== "string" || detail.length > MAX_DETAIL_CHARS) {
        return null;
      }
      if (detail) entry.detail = detail;
    }
    out.push(entry);
  }
  return out;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kb-studio-skills-push",
  };
}

type SkillsFile = {
  agents: Array<Record<string, unknown>>;
  updated_at?: string;
  [key: string]: unknown;
};

async function fetchCurrentFile(
  cfg: Config,
): Promise<{ file: SkillsFile; sha: string } | null> {
  const url = `${cfg.apiBase}/repos/${cfg.repo}/contents/${SKILLS_PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: githubHeaders(cfg.githubToken),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; sha?: string };
  if (typeof data.content !== "string" || typeof data.sha !== "string") {
    return null;
  }
  try {
    const text = Buffer.from(data.content, "base64").toString("utf8");
    const parsed = JSON.parse(text) as SkillsFile;
    if (!parsed || !Array.isArray(parsed.agents)) return null;
    return { file: parsed, sha: data.sha };
  } catch {
    return null;
  }
}

async function commitFile(
  cfg: Config,
  file: SkillsFile,
  sha: string,
  agentId: string,
  count: number,
): Promise<boolean> {
  const url = `${cfg.apiBase}/repos/${cfg.repo}/contents/${SKILLS_PATH}`;
  const content = Buffer.from(JSON.stringify(file), "utf8").toString("base64");
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(cfg.githubToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `skills-sync: ${agentId} pushed ${count} skills`,
      content,
      sha,
      branch: BRANCH,
    }),
    cache: "no-store",
  });
  return res.ok;
}

export async function POST(request: Request) {
  const cfg = readConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "skills push is not configured" },
      { status: 503 },
    );
  }

  const agentId = identifyAgent(request, cfg.agentTokens);
  if (!agentId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body too large" }, { status: 400 });
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body too large" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const skills = validateSkills(body);
  if (!skills) {
    return NextResponse.json(
      { error: "invalid skills payload" },
      { status: 400 },
    );
  }

  // Read-modify-write against the GitHub Contents API. Retry once if the
  // sha went stale because another push landed in between.
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await fetchCurrentFile(cfg);
    if (!current) {
      return NextResponse.json(
        { error: "failed to read current skills file" },
        { status: 502 },
      );
    }
    const { file, sha } = current;
    const idx = file.agents.findIndex(
      (a) => a && typeof a === "object" && a.id === agentId,
    );
    const block: Record<string, unknown> =
      idx >= 0
        ? { ...file.agents[idx], skills }
        : { id: agentId, name: agentId, skills };
    if (idx >= 0) {
      file.agents[idx] = block;
    } else {
      file.agents.push(block);
    }
    file.updated_at = new Date().toISOString();

    if (await commitFile(cfg, file, sha, agentId, skills.length)) {
      return NextResponse.json({
        ok: true,
        agent: agentId,
        skills: skills.length,
        updated_at: file.updated_at,
      });
    }
  }
  return NextResponse.json(
    { error: "failed to commit skills file" },
    { status: 502 },
  );
}

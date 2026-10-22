/**
 * 业务事件总线（2026-10-22，hud-bus-pulse）——刻意做成极简 pub/sub，
 * 不引 zustand：全站只有 neural-landing 一个订阅者（终端 EXEC 日志 +
 * 图谱脉冲），发射点都是已存在的真实动作成功路径。
 *
 * 纪律：emit 只能挂在动作真正完成之后（状态已写入），绝不由定时器、
 * 演示代码或渲染副作用调用——总线上的每一条事件都对应一次用户
 * 真实完成的操作。订阅者抛错被吞掉：日志/脉冲是旁路反馈，永远不许
 * 反过来打断业务动作本身。
 */

export type BusEventType =
  | "FINANCE_ADD_ENTRY"
  | "FINANCE_DELETE_ENTRY"
  | "DECISION_ARCHIVE"
  | "DECISION_RESTORE"
  | "DECISION_PICK"
  | "SNAPSHOT_IMPORT"
  /* 拼图三（hud-health-sync）：剪贴板解析口校验通过、manual 落盘后发 */
  | "HEALTH_SYNC"
  /* 拼图二（hud-empower）：创作流水线芯片换道落盘后发 */
  | "STUDIO_STAGE_MOVE"
  /* UX 整改（hud-ux-dock）：灵感拓扑里建节点 / 连边成功后发 */
  | "MINDMAP_NODE"
  | "MINDMAP_EDGE";

export type BusEvent = {
  type: BusEventType;
  /** 动作所属模块 id（modules 表的 id）；无归属模块的系统级
   * 动作（快照导入、无模块的 note 类决策意向）用 "hub"，脉冲
   * 消费端把它解析为球心（创作空间）热点。 */
  moduleId: string;
  /** 业务对象名（UX 整改，hud-ux-dock）：终端中文播报的素材——
   * 财务条目的类别+金额、决策标题、芯片名+目标泳道、健康日期
   * 摘要、图谱节点文字等。由发射点在动作完成时带上，订阅端拼
   * 中文行时取用；缺省时播报模板自行降级（如快照导入无对象）。 */
  detail?: string;
};

type BusHandler = (ev: BusEvent) => void;

const handlers = new Set<BusHandler>();

/** 发射一个业务事件——同步分发给全部订阅者。 */
export function emit(type: BusEventType, moduleId: string, detail?: string): void {
  const ev: BusEvent = { type, moduleId, detail };
  handlers.forEach((h) => {
    try {
      h(ev);
    } catch {
      /* 订阅者故障不得污染发射方（与 drag 引擎 fireDrop 同纪律） */
    }
  });
}

/** 订阅总线，返回取消订阅函数。 */
export function on(handler: BusHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

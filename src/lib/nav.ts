import {
  LayoutDashboard,
  BookOpen,
  Workflow,
  Ticket,
  Wrench,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  /** Short subtitle shown in drawer-card rows */
  subtitle: string;
  icon: LucideIcon;
  panelTitle: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "概览",
    short: "概览",
    subtitle: "指标 · 最近动态",
    icon: LayoutDashboard,
    panelTitle: "Dashboard",
  },
  {
    href: "/kb",
    label: "知识库",
    short: "知识库",
    subtitle: "Folders · Tags",
    icon: BookOpen,
    panelTitle: "Folders & Tags",
  },
  {
    href: "/studio",
    label: "创作台",
    short: "创作台",
    subtitle: "银黑 · Neural studio",
    icon: Sparkles,
    panelTitle: "Creative Studio",
  },
  {
    href: "/workflows",
    label: "工作流",
    short: "工作流",
    subtitle: "流程卡片 · stub",
    icon: Workflow,
    panelTitle: "Workflow List",
  },
  {
    href: "/tickets",
    label: "工单",
    short: "工单",
    subtitle: "待办 / 进行 / 完成",
    icon: Ticket,
    panelTitle: "Board",
  },
  {
    href: "/tools",
    label: "入口",
    short: "入口",
    subtitle: "Shortcuts · 工具",
    icon: Wrench,
    panelTitle: "Shortcuts",
  },
];

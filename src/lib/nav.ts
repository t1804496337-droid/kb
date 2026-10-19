import {
  Home,
  BookOpen,
  Workflow,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  panelTitle: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: Home,
    panelTitle: "Overview",
  },
  {
    href: "/kb",
    label: "Knowledge Base",
    icon: BookOpen,
    panelTitle: "Folders & Tags",
  },
  {
    href: "/workflows",
    label: "Workflows",
    icon: Workflow,
    panelTitle: "Workflow List",
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: Ticket,
    panelTitle: "Board",
  },
  {
    href: "/tools",
    label: "Tools",
    icon: Wrench,
    panelTitle: "Shortcuts",
  },
];

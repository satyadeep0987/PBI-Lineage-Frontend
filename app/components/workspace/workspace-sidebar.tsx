import {
  Activity,
  Cable,
  Database,
  FileText,
  GitBranch,
  Home,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Network,
  Save,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { useAppStore } from "~/stores/app-store";

export type ApiGroupSummary = {
  tag: string;
  slug: string;
  count: number;
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  authentication: KeyRound,
  gateways: Cable,
  health: Activity,
  lineage: GitBranch,
  reports: FileText,
  workspaces: LayoutGrid,
};

export function WorkspaceSidebar({
  activeSection,
  groups,
  onNavigate,
}: {
  activeSection: string;
  groups: ApiGroupSummary[];
  onNavigate: (section: string) => void;
}) {
  const apiOrigin = useAppStore((state) => state.apiOrigin);
  const adminKey = useAppStore((state) => state.adminKey);
  const setApiOrigin = useAppStore((state) => state.setApiOrigin);
  const setAdminKey = useAppStore((state) => state.setAdminKey);
  const [originInput, setOriginInput] = useState(apiOrigin);

  useEffect(() => setOriginInput(apiOrigin), [apiOrigin]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafbfc]">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="mb-5 flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <Home className="size-4" />
          Overview
        </button>

        <SidebarLabel>Setup</SidebarLabel>
        <div className="space-y-1">
          <NavigationItem
            active={activeSection === "database"}
            icon={Database}
            label="Database"
            meta="Step 1"
            onClick={() => onNavigate("database")}
          />
          <NavigationItem
            active={activeSection === "power-bi"}
            icon={KeyRound}
            label="Power BI"
            meta="Step 2"
            onClick={() => onNavigate("power-bi")}
          />
        </div>

        <Separator className="my-5" />

        <SidebarLabel>API domains</SidebarLabel>
        <div className="space-y-1">
          {groups.map((group) => (
            <NavigationItem
              key={group.slug}
              active={activeSection === group.slug}
              icon={GROUP_ICONS[group.slug] ?? Network}
              label={group.tag}
              meta={String(group.count)}
              onClick={() => onNavigate(group.slug)}
            />
          ))}
          {groups.length === 0 && (
            <div className="px-3 py-3 text-xs leading-5 text-zinc-500">
              API domains appear when the OpenAPI document is available.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-200 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <LockKeyhole className="size-3.5" />
          Backend connection
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="api-origin" className="text-xs">API origin</Label>
            <Input
              id="api-origin"
              value={originInput}
              onChange={(event) => setOriginInput(event.target.value)}
              placeholder="Vite proxy (current)"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-key" className="text-xs">Admin key</Label>
            <Input
              id="admin-key"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Only when required"
              className="h-8 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setApiOrigin(originInput)}
          >
            <Save className="size-3.5" />
            Apply connection
          </Button>
        </div>
      </div>
    </div>
  );
}

function SidebarLabel({ children }: { children: string }) {
  return (
    <div className="mb-2 px-3 text-[11px] font-semibold uppercase text-zinc-400">
      {children}
    </div>
  );
}

function NavigationItem({
  active,
  icon: Icon,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left text-sm transition",
        active
          ? "bg-zinc-950 font-medium text-white"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn("shrink-0 text-[11px]", active ? "text-zinc-300" : "text-zinc-400")}>{meta}</span>
    </button>
  );
}

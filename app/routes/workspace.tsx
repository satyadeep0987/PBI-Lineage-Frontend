import { useQuery } from "@tanstack/react-query";
import { Database, KeyRound, Loader2, Menu, Network } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { Route } from "./+types/workspace";
import { AppFooter } from "~/components/app-footer";
import { AppHeader } from "~/components/app-header";
import { DatabaseSetup } from "~/components/workspace/database-setup";
import { PowerBiSetup } from "~/components/workspace/power-bi-setup";
import {
  type ApiGroupSummary,
  WorkspaceSidebar,
} from "~/components/workspace/workspace-sidebar";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { fetchOpenApi, flattenEndpoints, tagSlug } from "~/lib/api-catalog";
import { useApiExecutor } from "~/lib/use-api-executor";
import { useAppStore } from "~/stores/app-store";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Workspace | PBI Lineage Explorer" }];
}

export default function Workspace() {
  const { section } = useParams();
  const navigate = useNavigate();
  const apiOrigin = useAppStore((state) => state.apiOrigin);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const activeSection = section ?? "database";

  const openApiQuery = useQuery({
    queryKey: ["openapi", apiOrigin],
    queryFn: () => fetchOpenApi(apiOrigin),
  });
  const endpoints = useMemo(
    () => flattenEndpoints(openApiQuery.data),
    [openApiQuery.data],
  );
  const groups = useMemo<ApiGroupSummary[]>(() => {
    const counts = new Map<string, { tag: string; count: number }>();

    endpoints.forEach((endpoint) => {
      const slug = tagSlug(endpoint.tag);
      const current = counts.get(slug);
      counts.set(slug, {
        tag: endpoint.tag,
        count: (current?.count ?? 0) + 1,
      });
    });

    return Array.from(counts, ([slug, value]) => ({ slug, ...value }));
  }, [endpoints]);
  const apiExecutor = useApiExecutor(endpoints);

  function navigateTo(nextSection: string) {
    setMobileNavigationOpen(false);
    navigate(nextSection === "home" ? "/" : `/workspace/${nextSection}`);
  }

  const sidebar = (
    <WorkspaceSidebar
      activeSection={activeSection}
      groups={groups}
      onNavigate={navigateTo}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8] text-zinc-950">
      <AppHeader />

      <div className="border-b border-zinc-200 bg-white px-4 py-2 lg:hidden">
        <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <Menu className="size-4" />
            Workspace menu
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] gap-0 p-0">
            <SheetHeader className="border-b border-zinc-200">
              <SheetTitle>Workspace</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mx-auto grid w-full max-w-screen-2xl flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-zinc-200 lg:block">
          <div className="sticky top-0 h-[calc(100vh-4rem)]">{sidebar}</div>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          {openApiQuery.isLoading && (
            <div className="mb-4 flex items-center gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Loader2 className="size-4 animate-spin" />
              Loading backend API catalog
            </div>
          )}
          {openApiQuery.isError && (
            <div className="mb-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              The OpenAPI catalog could not be loaded. Confirm the FastAPI backend is running at http://127.0.0.1:8000.
            </div>
          )}

          {activeSection === "database" ? (
            <DatabaseSetup
              execute={apiExecutor.execute}
              result={apiExecutor.result}
              error={apiExecutor.error}
              isRunning={apiExecutor.isRunning}
              catalogReady={endpoints.length > 0}
              onNext={() => navigateTo("power-bi")}
            />
          ) : activeSection === "power-bi" ? (
            <PowerBiSetup
              execute={apiExecutor.execute}
              result={apiExecutor.result}
              error={apiExecutor.error}
              isRunning={apiExecutor.isRunning}
              catalogReady={endpoints.length > 0}
              onExplore={() => navigateTo("workspaces")}
            />
          ) : (
            <SectionPlaceholder section={activeSection} groups={groups} />
          )}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}

function SectionPlaceholder({ section, groups }: { section: string; groups: ApiGroupSummary[] }) {
  const group = groups.find((item) => item.slug === section);
  const isDatabase = section === "database";
  const isPowerBi = section === "power-bi";
  const Icon = isDatabase ? Database : isPowerBi ? KeyRound : Network;
  const title = isDatabase ? "Database setup" : isPowerBi ? "Power BI setup" : group?.tag ?? "API workspace";
  const description = isDatabase
    ? "Step 1 connects the Snowflake database before Microsoft authentication."
    : isPowerBi
      ? "Step 2 authenticates Power BI and Fabric with the Microsoft device flow."
      : group
        ? `${group.count} ${group.tag} operations will be available in this execution canvas.`
        : "Choose a setup step or API domain from the sidebar.";

  return (
    <section className="min-h-[620px] border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-zinc-950 text-white">
            <Icon className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-zinc-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <Icon className="mx-auto size-8 text-zinc-300" />
          <p className="mt-4 text-sm text-zinc-500">Execution controls are added in the next implementation phase.</p>
        </div>
      </div>
    </section>
  );
}

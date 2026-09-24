# CLAUDE.md

Working context for coding agents in this repository. Keep it short and current;
the long-form handbook is [README.md](README.md) (~1,300 lines) and the focused
contributor docs are indexed by [Docs/README.md](Docs/README.md).

## What this is

**PBI Lineage Explorer Frontend** — a browser app for exploring Power BI
workspaces, reports, semantic models, DAX dependencies, physical database
evidence, and downstream lineage/impact. It is a **static SPA** served by IIS on
a Windows Azure VM behind `https://lvpowerbilineage.com`.

It is a *client only*. All Microsoft/Fabric/database/AI work happens in the
separate FastAPI **PBI Lineage Backend** repository (sibling folder
`../PBI-Lineage-Backend`, independent Git repo). The two share no source,
dependencies, or secrets — only HTTP over `/api/v1/*` and `/openapi.json`.

## Stack

React 19 · React Router v8 Framework Mode with `ssr: false` · Vite 8 ·
TypeScript strict · Tailwind CSS 4 · shadcn/ui on Base UI (`style: base-nova`) ·
Lucide · TanStack Query v5 · Zustand · AG Grid Community · XYFlow (React Flow) +
Dagre · React Hook Form + Zod · Playwright.

Import alias: `~/*` → [app/](app/).

## Commands

```powershell
npm ci
npm run dev          # Vite dev server on :5173, proxies /api,/openapi.json,/docs -> 127.0.0.1:8000
npm run typecheck    # react-router typegen && tsc  <- the CI gate
npm run build        # -> build/client (static)
npx playwright test  # no npm script; reuses a running dev server
```

There is no lint script and no test script. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))
runs only `npm ci` → `npm run typecheck` → `npm run build` on Node 22. Playwright
is **not** in CI — run it locally before claiming a UI change works.

Vitest and React Testing Library are installed but have no config and no
committed suites; all real coverage is Playwright in [tests/](tests/).
Orval is installed but no generated client exists — the OpenAPI catalog is
parsed at runtime by [api-catalog.ts](app/lib/api-catalog.ts).

## Layout

```
app/routes.ts                        3 routes: / , /setup-guide , /workspace/:section?
app/root.tsx                         QueryProvider + global PowerAiWidget
app/routes/workspace.tsx             shell: sidebar, OpenAPI catalog, lazy section switch
app/components/workspace/            Explorer, Report Lineage, Table/Measure Impact, Scanner, API docs
app/components/workspace/lineage/    shared diagram engine (types, layout, node, diagram)
app/components/power-ai/             floating AI panel
app/lib/                             API clients, hooks, dependency graph, export helpers
app/stores/                          app-store, layout-store, power-ai-store
tests/                               8 Playwright specs
.azure/scripts/                      VM-side PowerShell deploy/rollback
public/web.config                    IIS: proxy /api + /openapi.json, SPA fallback to /index.html
```

Every workspace view is one `:section` value handled by a chain in
[workspace.tsx](app/routes/workspace.tsx); Explorer, Report Lineage, Table
Impact, Measure Impact and Scanner are `React.lazy`. An unknown section falls
through to API documentation filtered by that OpenAPI tag slug.

## Invariants — do not break these

- **Credentials.** Every backend call uses `credentials: "include"` so FastAPI's
  HTTP-only session cookie is sent. Go through
  [`requestJson`](app/lib/lineage-api.ts) / the AI fetch helper rather than bare
  `fetch`.
- **No secrets in the browser.** No access token, client secret, database
  password, session ID, or AI provider key is ever persisted, logged, or added
  to a `VITE_*` variable. Only `VITE_API_ORIGIN` exists (blank = same-origin).
- **`X-Lineage-Admin-Key`** lives only in ephemeral, non-persisted Zustand
  ([app-store.ts](app/stores/app-store.ts)). There is deliberately no UI field.
  Never add persistence to `app-store`; persisted UI state goes in
  [layout-store.ts](app/stores/layout-store.ts).
- **Never invent evidence.** Missing permissions or unavailable PBIR/TMDL/XMLA/
  scanner/physical-source data must render a truthful degraded state. Each
  evidence source degrades independently instead of blanking the page.
- **A report can bind to a semantic model in another workspace.** Never infer the
  model workspace from the report workspace without estate evidence.
- **Scans cost real Microsoft quota.** `POST /api/v1/scanner/workspaces/scan`
  only ever runs from an explicit operator action, 1–100 workspaces, and
  `get_artifact_users` is forced to `false`. No background or automatic scans.
- **The frontend has no AI feature flag.** It renders whatever
  `GET /api/v1/ai/status` returns; a 401/403 *is* the auth signal. The backend
  owns `AI_ENABLED`, the provider, credentials, and evidence grounding.
- **Footer attribution** (`Developed by Satyadeep Singh` + copyright) stays on
  every route.

## Gotchas

- **`vite.config.ts` `optimizeDeps.include` must list every runtime bare import
  used behind a lazy route.** React Router's virtual entry otherwise discovers
  them in later optimizer waves, which invalidates already-requested browser
  modules and leaves the first Table Impact navigation blank. Add new runtime
  packages to that list.
- **Impact fan-out is capped at 300 bound reports per model**, and Explorer
  evidence endpoints accept ≤50 reports per request — truncation is displayed,
  not silent.
- **Scanner results are immutable per `scan_id`**: poll status every 4s, stop on
  `Succeeded`/`Failed`, fetch the result once.
- **Scanner/impact progress is component/query memory** and resets on scope
  change or unmount. That is intentional.
- Home deliberately issues **no** backend health query.

## Deployment

`Frontend CI` on `main` → `Frontend CD` ([.github/workflows/cd.yml](.github/workflows/cd.yml))
when repo variable `DEPLOYMENT_ENABLED == 'true'`. CD builds `build/client`,
validates `index.html` + `web.config`, zips it, logs into Azure via **OIDC**,
and pushes the ZIP plus [deploy-frontend.ps1](.azure/scripts/deploy-frontend.ps1)
to **ACR as an ORAS artifact** tagged with the release SHA. It then runs
[deploy-frontend-from-acr.ps1](.azure/scripts/deploy-frontend-from-acr.ps1) on
the VM via Run Command, which stages `C:\pbi-lineage\frontend\releases\<sha>`,
atomically repoints the `PBI-Lineage` IIS site, rolls back on failure, and
prunes old releases, followed by an IIS smoke test.

Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
Variables: `DEPLOYMENT_ENABLED`, `AZURE_RESOURCE_GROUP`, `AZURE_VM_NAME`,
`ACR_NAME`, `ACR_REPOSITORY`, `PRODUCTION_URL`.

Note: older docs describe a **private Blob Storage** upload path. That was
replaced by ACR/ORAS. [Dockerfile](Dockerfile) and the `start` script
(`react-router-serve`) are leftovers from the React Router template — production
is static IIS, not a Node server.

## Known dead code (verified 2026-09-17)

Nothing imports these; do not treat them as live features or wire them up unless
asked:

- [app/welcome/](app/welcome/) — React Router template scaffold.
- [api-domain-canvas.tsx](app/components/workspace/api-domain-canvas.tsx) and
  [api-output-panel.tsx](app/components/workspace/api-output-panel.tsx) — only
  the former imports the latter; no route reaches either.

`sonner` / `next-themes` were removed on purpose (two commits titled "add
missing sonner dependencies" did *not* re-add them — the fix was deleting
`ui/sonner.tsx`). Do not reintroduce them.

## Other context files

- [README.md](README.md) — authoritative handbook: full route map, per-file
  responsibilities, data flows, IIS setup, troubleshooting, security rules.
- [Docs/](Docs/) — six focused contributor documents.
- `REF_DOC/PROJECT_CONTEXT.md` — Git-ignored local continuity note, last updated
  2026-09-14. It predates Power AI, the layout shell, and the ACR release path;
  prefer this file and the README where they disagree.
- [.agents/skills/react-router/](.agents/skills/react-router/) — React Router
  mode guidance for agents. This project is **Framework Mode**.

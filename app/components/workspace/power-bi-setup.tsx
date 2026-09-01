import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type ApiResult, SETUP_ENDPOINTS } from "~/lib/api-catalog";
import type { ExecuteEndpoint } from "~/lib/use-api-executor";

const powerBiSchema = z.object({
  tenantId: z.string().trim().min(1, "Tenant ID is required."),
  clientId: z.string().trim().min(1, "Client ID is required."),
});

type PowerBiFormValues = z.infer<typeof powerBiSchema>;

type DeviceDetails = {
  sessionId: string;
  verificationUri: string;
  userCode: string;
  expiresIn: number | null;
};

export function PowerBiSetup({
  execute,
  result,
  error,
  isRunning,
  catalogReady,
  onExplore,
}: {
  execute: ExecuteEndpoint;
  result: ApiResult | null;
  error: string | null;
  isRunning: boolean;
  catalogReady: boolean;
  onExplore: () => void;
}) {
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetails | null>(null);
  const form = useForm<PowerBiFormValues>({
    resolver: zodResolver(powerBiSchema),
    defaultValues: { tenantId: "", clientId: "" },
  });
  const isPowerBiResult = result?.endpoint.startsWith("GET /api/v1/auth/microsoft/device") ?? false;
  const responseStatus = isPowerBiResult ? getStringProperty(result?.body, "status") : null;
  const isAuthenticated = result?.ok && responseStatus === "authenticated";
  const isPending = result?.ok && responseStatus === "pending";
  const powerBi = getRecordProperty(result?.body, "powerbi");
  const fabric = getRecordProperty(result?.body, "fabric");

  async function startAuthentication(values: PowerBiFormValues) {
    const nextResult = await execute(SETUP_ENDPOINTS.powerBiStart, {
      body: {
        tenant_id: values.tenantId.trim(),
        client_id: values.clientId.trim(),
      },
    });
    const sessionId = getStringProperty(nextResult?.body, "session_id");
    const verificationUri = getStringProperty(nextResult?.body, "verification_uri");
    const userCode = getStringProperty(nextResult?.body, "user_code");
    const expiresIn = getNumberProperty(nextResult?.body, "expires_in");

    if (nextResult?.ok && sessionId && verificationUri && userCode) {
      setDeviceDetails({ sessionId, verificationUri, userCode, expiresIn });
    }
  }

  async function checkStatus() {
    if (deviceDetails?.sessionId) {
      await execute(SETUP_ENDPOINTS.powerBiSessionStatus, { parameters: { session_id: deviceDetails.sessionId } });
      return;
    }
    await execute(SETUP_ENDPOINTS.powerBiStatus);
  }

  async function logout() {
    await execute(SETUP_ENDPOINTS.powerBiLogout);
    setDeviceDetails(null);
  }

  return (
    <section className="overflow-hidden border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-sky-700 text-white"><KeyRound className="size-5" /></span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-sky-700">Step 1 of 2</span>
              {isAuthenticated && <ConnectedBadge label="Ready" />}
              {isPending && <Badge className="rounded-[8px] border border-amber-200 bg-amber-50 text-amber-800">Approval pending</Badge>}
            </div>
            <h1 className="text-lg font-semibold">Connect Power BI and Fabric</h1>
            <p className="mt-1 text-sm text-zinc-500">Enter the Microsoft application details, approve the device code, then check that both services are ready for discovery.</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <ol className="mb-6 grid border-y border-zinc-200 sm:grid-cols-3">
          <FlowStep number="1" title="Start sign-in" text="Enter the tenant and application IDs." />
          <FlowStep number="2" title="Approve access" text="Open Microsoft and enter the code." />
          <FlowStep number="3" title="Check readiness" text="Confirm Power BI and Fabric access." />
        </ol>

        <form onSubmit={form.handleSubmit(startAuthentication)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tenant-id">Microsoft tenant ID</Label>
              <Input id="tenant-id" placeholder="Directory (tenant) ID" aria-invalid={Boolean(form.formState.errors.tenantId)} {...form.register("tenantId")} />
              <FieldError message={form.formState.errors.tenantId?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-id">Application client ID</Label>
              <Input id="client-id" placeholder="Application (client) ID" aria-invalid={Boolean(form.formState.errors.clientId)} {...form.register("clientId")} />
              <FieldError message={form.formState.errors.clientId?.message} />
            </div>
          </div>
          <Button type="submit" className="mt-5" disabled={isRunning || !catalogReady}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Start Microsoft sign-in
          </Button>
        </form>

        {deviceDetails && (
          <div className="mt-6 border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-950"><BadgeCheck className="size-4" /> Device code is ready</div>
            <p className="mt-2 text-sm leading-6 text-sky-900">Open the Microsoft verification page and enter this code to continue.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="border border-sky-200 bg-white px-4 py-2 text-lg font-semibold tracking-normal text-sky-950">{deviceDetails.userCode}</code>
              <Button type="button" variant="outline" size="icon" aria-label="Copy device code" title="Copy device code" onClick={() => void navigator.clipboard.writeText(deviceDetails.userCode)}><Copy className="size-4" /></Button>
              <Button type="button" onClick={() => window.open(deviceDetails.verificationUri, "_blank", "noreferrer") }>
                Open Microsoft <ExternalLink className="size-4" />
              </Button>
            </div>
            {deviceDetails.expiresIn != null && <p className="mt-3 text-xs text-sky-800">The code expires in about {Math.max(1, Math.round(deviceDetails.expiresIn / 60))} minutes.</p>}
          </div>
        )}

        <ConnectionStatus
          error={isPowerBiResult ? error : null}
          status={responseStatus}
          powerBi={powerBi}
          fabric={fabric}
          isRunning={isRunning}
          catalogReady={catalogReady}
          onCheck={() => void checkStatus()}
          onLogout={() => void logout()}
        />
        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-5"><Button type="button" variant="outline" onClick={onExplore}>Continue to database <ArrowRight className="size-4" /></Button></div>
      </div>
    </section>
  );
}

function ConnectionStatus({ error, status, powerBi, fabric, isRunning, catalogReady, onCheck, onLogout }: {
  error: string | null;
  status: string | null;
  powerBi: Record<string, unknown> | null;
  fabric: Record<string, unknown> | null;
  isRunning: boolean;
  catalogReady: boolean;
  onCheck: () => void;
  onLogout: () => void;
}) {
  const connected = status === "authenticated";
  const pending = status === "pending";
  return (
    <div className="mt-6 border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {connected ? <CheckCircle2 className="size-4 text-emerald-700" /> : pending ? <Clock3 className="size-4 text-amber-600" /> : <ShieldCheck className="size-4 text-zinc-500" />}
            <h2 className="text-sm font-semibold">Connection status</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{connected ? "Microsoft access is ready. You can continue to database setup or open Explorer." : pending ? "Microsoft approval is still pending. Finish approval, then check status." : "No connection has been verified yet. Start sign-in, complete approval, then check status."}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isRunning || !catalogReady} onClick={onCheck}>{isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />} Check status</Button>
          <Button type="button" variant="outline" size="sm" disabled={isRunning || !catalogReady} onClick={onLogout}><LogOut className="size-3.5" /> Sign out</Button>
        </div>
      </div>
      {error && <ConnectionAlert text="The status check could not complete. Confirm the backend is running, then try again." />}
      {(powerBi || fabric) && <div className="mt-4 grid gap-3 sm:grid-cols-2"><ProviderStatus label="Power BI" details={powerBi} /><ProviderStatus label="Fabric" details={fabric} /></div>}
    </div>
  );
}

function ProviderStatus({ label, details }: { label: string; details: Record<string, unknown> | null }) {
  const isConnected = details?.connected === true;
  const message = getStringProperty(details, "message") ?? (isConnected ? "Connected" : "Needs attention");
  const missingScopes = getStringArrayProperty(details, "missing_scopes");
  return (
    <div className="border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span>{isConnected ? <ConnectedBadge label="Connected" /> : <Badge className="rounded-[8px] border border-amber-200 bg-amber-50 text-amber-800">Review access</Badge>}</div>
      <p className="mt-2 text-xs leading-5 text-zinc-600">{message}</p>
      {missingScopes.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-800">Missing access: {missingScopes.join(", ")}</p>}
    </div>
  );
}

function ConnectedBadge({ label }: { label: string }) {
  return <Badge className="rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mr-1 size-3" /> {label}</Badge>;
}

function ConnectionAlert({ text }: { text: string }) {
  return <div className="mt-4 flex gap-2 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><CircleAlert className="mt-0.5 size-4 shrink-0" />{text}</div>;
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <li className="flex gap-3 border-b border-zinc-200 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{number}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-zinc-500">{text}</span></span></li>;
}

function getRecordProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "object" && property !== null ? property as Record<string, unknown> : null;
}

function getStringProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function getStringArrayProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return [];
  const property = (value as Record<string, unknown>)[key];
  return Array.isArray(property) ? property.filter((item): item is string => typeof item === "string") : [];
}

function getNumberProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "number" ? property : null;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-rose-600">{message}</p> : null;
}

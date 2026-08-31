import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCcw,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiOutputPanel } from "~/components/workspace/api-output-panel";
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
  const responseStatus = getStringProperty(result?.body, "status");
  const authenticated = result?.ok && responseStatus === "authenticated";
  const pending = result?.ok && responseStatus === "pending";

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
      await execute(SETUP_ENDPOINTS.powerBiSessionStatus, {
        parameters: { session_id: deviceDetails.sessionId },
      });
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
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-sky-700 text-white">
            <KeyRound className="size-5" />
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-sky-700">Step 2 of 2</span>
              {authenticated && (
                <Badge className="rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="mr-1 size-3" /> Authenticated
                </Badge>
              )}
              {pending && (
                <Badge className="rounded-[8px] border border-amber-200 bg-amber-50 text-amber-800">Approval pending</Badge>
              )}
            </div>
            <h1 className="text-lg font-semibold">Authenticate Power BI and Fabric</h1>
            <p className="mt-1 text-sm text-zinc-500">Start the Microsoft device flow, approve the code, then verify access.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isRunning || !catalogReady} onClick={() => void checkStatus()}>
            <RefreshCcw className="size-4" /> Check status
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isRunning || !catalogReady} onClick={() => void logout()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <ol className="mb-6 grid border-y border-zinc-200 sm:grid-cols-3">
            <FlowStep number="1" title="Start" text="Enter Microsoft app IDs" />
            <FlowStep number="2" title="Approve" text="Open the link and enter code" />
            <FlowStep number="3" title="Verify" text="Check Power BI and Fabric" />
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
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-950">
                <BadgeCheck className="size-4" /> Device code is ready
              </div>
              <p className="mt-2 text-sm leading-6 text-sky-900">Open Microsoft verification and enter this code:</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="border border-sky-200 bg-white px-4 py-2 text-lg font-semibold tracking-normal text-sky-950">{deviceDetails.userCode}</code>
                <Button type="button" variant="outline" size="icon" aria-label="Copy device code" onClick={() => void navigator.clipboard.writeText(deviceDetails.userCode)}>
                  <Copy className="size-4" />
                </Button>
                <Button type="button" onClick={() => window.open(deviceDetails.verificationUri, "_blank", "noreferrer") }>
                  Open Microsoft <ExternalLink className="size-4" />
                </Button>
              </div>
              {deviceDetails.expiresIn != null && (
                <p className="mt-3 text-xs text-sky-800">Code expires in approximately {Math.max(1, Math.round(deviceDetails.expiresIn / 60))} minutes.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-zinc-200 pt-5">
            <Button type="button" variant="outline" onClick={onExplore}>
              Explore workspace APIs <ExternalLink className="size-4" />
            </Button>
          </div>
        </div>

        <ApiOutputPanel result={result} error={error} />
      </div>
    </section>
  );
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="flex gap-3 border-b border-zinc-200 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{number}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{text}</span>
      </span>
    </li>
  );
}

function getStringProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : null;
}

function getNumberProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "number" ? property : null;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-rose-600">{message}</p> : null;
}

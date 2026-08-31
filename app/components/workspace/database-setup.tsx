import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiOutputPanel } from "~/components/workspace/api-output-panel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { type ApiResult, SETUP_ENDPOINTS } from "~/lib/api-catalog";
import type { ExecuteEndpoint } from "~/lib/use-api-executor";

const authenticationMethods = [
  "password",
  "key_pair",
  "external_browser",
  "oauth",
] as const;

const databaseSchema = z
  .object({
    authenticationMethod: z.enum(authenticationMethods),
    accountIdentifier: z.string().trim().min(1, "Account identifier is required."),
    user: z.string().trim().min(1, "User is required."),
    credential: z.string(),
    warehouse: z.string(),
    database: z.string(),
    schemaName: z.string(),
    role: z.string(),
  })
  .superRefine((values, context) => {
    if (values.authenticationMethod !== "external_browser" && !values.credential.trim()) {
      context.addIssue({
        code: "custom",
        path: ["credential"],
        message: "A credential is required for this authentication method.",
      });
    }
  });

type DatabaseFormValues = z.infer<typeof databaseSchema>;

export function DatabaseSetup({
  execute,
  result,
  error,
  isRunning,
  catalogReady,
  onNext,
}: {
  execute: ExecuteEndpoint;
  result: ApiResult | null;
  error: string | null;
  isRunning: boolean;
  catalogReady: boolean;
  onNext: () => void;
}) {
  const form = useForm<DatabaseFormValues>({
    resolver: zodResolver(databaseSchema),
    defaultValues: {
      authenticationMethod: "password",
      accountIdentifier: "",
      user: "",
      credential: "",
      warehouse: "",
      database: "",
      schemaName: "",
      role: "",
    },
  });
  const authenticationMethod = form.watch("authenticationMethod");
  const connected = Boolean(
    result?.ok &&
      [SETUP_ENDPOINTS.databaseConnect, SETUP_ENDPOINTS.databaseStatus].includes(
        result.endpoint as typeof SETUP_ENDPOINTS.databaseConnect,
      ),
  );

  async function connect(values: DatabaseFormValues) {
    const body: Record<string, unknown> = {
      authentication_method: values.authenticationMethod,
      account_identifier: values.accountIdentifier.trim(),
      user: values.user.trim(),
    };

    addOptional(body, "warehouse", values.warehouse);
    addOptional(body, "database", values.database);
    addOptional(body, "schema_name", values.schemaName);
    addOptional(body, "role", values.role);

    if (values.authenticationMethod === "password") {
      body.password = values.credential;
      body.authenticator = "snowflake";
    } else if (values.authenticationMethod === "key_pair") {
      body.private_key_pem = values.credential;
    } else if (values.authenticationMethod === "oauth") {
      body.token = values.credential;
    }

    await execute(SETUP_ENDPOINTS.databaseConnect, { body });
  }

  const credentialLabel =
    authenticationMethod === "key_pair"
      ? "Private key PEM"
      : authenticationMethod === "oauth"
        ? "OAuth token"
        : "Password";

  return (
    <section className="overflow-hidden border border-zinc-200 bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-emerald-700 text-white">
            <Database className="size-5" />
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-emerald-700">Step 1 of 2</span>
              {connected && (
                <Badge className="rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="mr-1 size-3" /> Connected
                </Badge>
              )}
            </div>
            <h1 className="text-lg font-semibold">Connect the Snowflake database</h1>
            <p className="mt-1 text-sm text-zinc-500">The backend stores the authenticated session in a secure HTTP-only cookie.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRunning || !catalogReady}
            onClick={() => void execute(SETUP_ENDPOINTS.databaseStatus)}
          >
            <RefreshCcw className="size-4" /> Check status
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRunning || !catalogReady}
            onClick={() => void execute(SETUP_ENDPOINTS.databaseLogout)}
          >
            <LogOut className="size-4" /> Disconnect
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,0.9fr)]">
        <form onSubmit={form.handleSubmit(connect)} className="min-w-0 p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3 border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
            <ShieldCheck className="mt-1 size-4 shrink-0" />
            Credentials are sent directly to your FastAPI backend and are not stored in frontend browser storage.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="authentication-method">Authentication method</Label>
              <Select
                value={authenticationMethod}
                onValueChange={(value) => {
                  if (value && authenticationMethods.includes(value as DatabaseFormValues["authenticationMethod"])) {
                    form.setValue("authenticationMethod", value as DatabaseFormValues["authenticationMethod"]);
                    form.clearErrors("credential");
                  }
                }}
              >
                <SelectTrigger id="authentication-method" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="key_pair">Key pair</SelectItem>
                  <SelectItem value="external_browser">External browser</SelectItem>
                  <SelectItem value="oauth">OAuth token</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField label="Account identifier" error={form.formState.errors.accountIdentifier?.message}>
              <Input id="account-identifier" placeholder="organization-account" aria-invalid={Boolean(form.formState.errors.accountIdentifier)} {...form.register("accountIdentifier")} />
            </FormField>
            <FormField label="User" error={form.formState.errors.user?.message}>
              <Input id="database-user" placeholder="service.user" aria-invalid={Boolean(form.formState.errors.user)} {...form.register("user")} />
            </FormField>

            {authenticationMethod !== "external_browser" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="database-credential">{credentialLabel}</Label>
                {authenticationMethod === "key_pair" ? (
                  <Textarea id="database-credential" className="min-h-32 resize-y font-mono text-xs" placeholder="-----BEGIN PRIVATE KEY-----" aria-invalid={Boolean(form.formState.errors.credential)} {...form.register("credential")} />
                ) : (
                  <Input id="database-credential" type="password" placeholder={credentialLabel} aria-invalid={Boolean(form.formState.errors.credential)} {...form.register("credential")} />
                )}
                <FieldError message={form.formState.errors.credential?.message} />
              </div>
            )}

            <FormField label="Warehouse">
              <Input id="warehouse" placeholder="COMPUTE_WH" {...form.register("warehouse")} />
            </FormField>
            <FormField label="Database">
              <Input id="database" placeholder="ANALYTICS" {...form.register("database")} />
            </FormField>
            <FormField label="Schema">
              <Input id="schema-name" placeholder="PUBLIC" {...form.register("schemaName")} />
            </FormField>
            <FormField label="Role">
              <Input id="database-role" placeholder="LINEAGE_READER" {...form.register("role")} />
            </FormField>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center">
            <Button type="submit" disabled={isRunning || !catalogReady}>
              {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
              Connect database
            </Button>
            <Button type="button" variant="outline" onClick={onNext}>
              Continue to Power BI <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>

        <ApiOutputPanel result={result} error={error} />
      </div>
    </section>
  );
}

function addOptional(target: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) target[key] = trimmed;
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-rose-600">{message}</p> : null;
}

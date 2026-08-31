export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    default?: unknown;
    enum?: string[];
  };
};

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: unknown;
};

export type OpenApiDocument = {
  info?: {
    title?: string;
    version?: string;
  };
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
};

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  operationId: string;
  parameters: OpenApiParameter[];
  hasBody: boolean;
};

export type ApiResult = {
  endpoint: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  body: unknown;
  headers: Record<string, string>;
};

export const SETUP_ENDPOINTS = {
  databaseConnect: "POST /api/v1/auth/snowflake/session",
  databaseStatus: "GET /api/v1/auth/snowflake/session/status",
  databaseLogout: "DELETE /api/v1/auth/snowflake/session",
  powerBiStart: "POST /api/v1/auth/microsoft/device/start",
  powerBiSessionStatus: "GET /api/v1/auth/microsoft/device/{session_id}/status",
  powerBiStatus: "GET /api/v1/auth/microsoft/device/status",
  powerBiLogout: "POST /api/v1/auth/microsoft/device/logout",
};

export const DEFAULT_REQUEST_BODIES: Record<string, string> = {
  [SETUP_ENDPOINTS.databaseConnect]: JSON.stringify(
    {
      authentication_method: "password",
      account_identifier: "",
      user: "",
      password: "",
      warehouse: "",
      database: "",
      schema_name: "",
      role: "",
    },
    null,
    2,
  ),
  [SETUP_ENDPOINTS.powerBiStart]: JSON.stringify(
    { tenant_id: "", client_id: "" },
    null,
    2,
  ),
  "POST /api/v1/lineage/snowflake/trace": JSON.stringify(
    {
      object_name: "DATABASE.SCHEMA.TABLE_NAME",
      object_domain: "TABLE",
      direction: "UPSTREAM",
      max_depth: 5,
      include_processes: true,
      max_queries: 25,
      max_nodes: 1000,
      max_edges: 2000,
      max_concurrency: 4,
    },
    null,
    2,
  ),
  "POST /api/v1/lineage/live-graphs": JSON.stringify(
    {
      workspace_id: "",
      report_ids: [],
      semantic_model_ids: [],
      include_snowflake: false,
    },
    null,
    2,
  ),
  "POST /api/v1/lineage/scan-jobs/live": JSON.stringify(
    {
      workspace_id: "",
      report_ids: [],
      semantic_model_ids: [],
      include_snowflake: false,
    },
    null,
    2,
  ),
};

export async function fetchOpenApi(apiOrigin: string): Promise<OpenApiDocument> {
  const response = await fetch(`${apiOrigin}/openapi.json`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`OpenAPI request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<OpenApiDocument>;
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function flattenEndpoints(openApi: OpenApiDocument | undefined) {
  if (!openApi?.paths) {
    return [];
  }

  return Object.entries(openApi.paths)
    .flatMap(([path, operations]) =>
      HTTP_METHODS.flatMap((method) => {
        const operation = operations[method];

        if (!operation) {
          return [];
        }

        return [
          {
            id: `${method.toUpperCase()} ${path}`,
            method,
            path,
            tag: operation.tags?.[0] ?? "Other",
            summary: operation.summary ?? path,
            operationId: operation.operationId ?? `${method}_${path}`,
            parameters: operation.parameters ?? [],
            hasBody: Boolean(operation.requestBody),
          } satisfies ApiEndpoint,
        ];
      }),
    )
    .sort((first, second) => {
      const tagOrder = first.tag.localeCompare(second.tag);
      return tagOrder || first.path.localeCompare(second.path);
    });
}

export function getParameterDefault(parameter: OpenApiParameter) {
  if (parameter.schema?.default !== undefined) {
    return String(parameter.schema.default);
  }

  const defaults: Record<string, string> = {
    top: "100",
    skip: "0",
    offset: "0",
    limit: "50",
    direction: "both",
    depth: "1",
    max_depth: "10",
  };

  return defaults[parameter.name] ?? "";
}

export function buildEndpointUrl(
  apiOrigin: string,
  endpoint: ApiEndpoint,
  parameterValues: Record<string, string>,
) {
  const missingPathParameters: string[] = [];
  const path = endpoint.path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = parameterValues[name]?.trim();

    if (!value) {
      missingPathParameters.push(name);
      return `{${name}}`;
    }

    return encodeURIComponent(value);
  });

  if (missingPathParameters.length > 0) {
    throw new Error(`Set required path value: ${missingPathParameters.join(", ")}`);
  }

  const query = new URLSearchParams();
  endpoint.parameters
    .filter((parameter) => parameter.in === "query")
    .forEach((parameter) => {
      const value = parameterValues[parameter.name]?.trim();
      if (value) query.set(parameter.name, value);
    });

  const queryString = query.toString();
  return `${apiOrigin}${path}${queryString ? `?${queryString}` : ""}`;
}

export function tagSlug(tag: string) {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function methodTone(method: HttpMethod) {
  if (method === "get") return "border-sky-200 bg-sky-50 text-sky-800";
  if (method === "post") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (method === "delete") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function formatBody(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

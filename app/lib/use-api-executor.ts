import { useCallback, useState } from "react";

import {
  type ApiEndpoint,
  type ApiResult,
  buildEndpointUrl,
  readJsonResponse,
} from "~/lib/api-catalog";
import { useAppStore } from "~/stores/app-store";

export type ExecuteOptions = {
  parameters?: Record<string, string>;
  body?: unknown;
};

export type ExecuteEndpoint = (
  endpointId: string,
  options?: ExecuteOptions,
) => Promise<ApiResult | null>;

export function useApiExecutor(endpoints: ApiEndpoint[]) {
  const apiOrigin = useAppStore((state) => state.apiOrigin);
  const adminKey = useAppStore((state) => state.adminKey);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const execute = useCallback<ExecuteEndpoint>(
    async (endpointId, options = {}) => {
      const endpoint = endpoints.find((item) => item.id === endpointId);

      if (!endpoint) {
        setError("This API operation is not available in the loaded OpenAPI catalog.");
        return null;
      }

      setIsRunning(true);
      setError(null);
      const startedAt = performance.now();

      try {
        const parameterValues = options.parameters ?? {};
        const url = buildEndpointUrl(apiOrigin, endpoint, parameterValues);
        const headers = new Headers();

        endpoint.parameters
          .filter((parameter) => parameter.in === "header")
          .forEach((parameter) => {
            const value = parameterValues[parameter.name]?.trim();
            if (value) headers.set(parameter.name, value);
          });

        if (adminKey.trim()) {
          headers.set("X-Lineage-Admin-Key", adminKey.trim());
        }

        const shouldSendBody =
          endpoint.hasBody &&
          endpoint.method !== "get" &&
          endpoint.method !== "delete" &&
          options.body !== undefined;

        if (shouldSendBody) {
          headers.set("Content-Type", "application/json");
        }

        const response = await fetch(url, {
          method: endpoint.method.toUpperCase(),
          credentials: "include",
          headers,
          body: shouldSendBody
            ? typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body)
            : undefined,
        });
        const nextResult: ApiResult = {
          endpoint: endpoint.id,
          status: response.status,
          ok: response.ok,
          durationMs: Math.round(performance.now() - startedAt),
          body: await readJsonResponse(response),
          headers: Object.fromEntries(response.headers.entries()),
        };

        setResult(nextResult);
        return nextResult;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
        const failedResult: ApiResult = {
          endpoint: endpoint.id,
          status: null,
          ok: false,
          durationMs: Math.round(performance.now() - startedAt),
          body: {
            message,
            hint: "Confirm the backend is running and the frontend proxy or API origin is correct.",
          },
          headers: {},
        };

        setError(message);
        setResult(failedResult);
        return failedResult;
      } finally {
        setIsRunning(false);
      }
    },
    [adminKey, apiOrigin, endpoints],
  );

  return { execute, result, error, isRunning };
}

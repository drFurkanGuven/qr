export const DEFAULT_USER_AGENT =
  "denemeapp/2 CFNetwork/3860.600.12 Darwin/25.5.0";

export const DEFAULT_BODY = '{\n  "qr_token": "{{qr_token}}"\n}';

const KNOWN_HEADER_NAMES = [
  "accept",
  "content-type",
  "authorization",
  "x-device-uuid",
  "user-agent",
  "accept-language",
] as const;

export type RequestFieldValues = {
  method: string;
  host: string;
  path: string;
  accept: string;
  contentType: string;
  authorization: string;
  deviceUuid: string;
  userAgent: string;
  acceptLanguage: string;
  extraHeaders: Record<string, string>;
};

function headerValue(headers: Record<string, unknown> | undefined, name: string): string {
  if (!headers) return "";
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  if (!match) return "";
  const value = headers[match];
  return value == null ? "" : String(value);
}

export function parseStoredUrl(url?: string | null): { host: string; path: string } {
  if (!url) {
    return { host: "", path: "/api/attendance/verify" };
  }
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      path: `${parsed.pathname}${parsed.search}` || "/",
    };
  } catch {
    const trimmed = url.trim();
    const slash = trimmed.indexOf("/");
    if (slash === -1) {
      return { host: trimmed.replace(/^https?:\/\//i, ""), path: "/api/attendance/verify" };
    }
    return {
      host: trimmed.slice(0, slash).replace(/^https?:\/\//i, ""),
      path: trimmed.slice(slash),
    };
  }
}

export function buildRequestUrl(host: string, path: string): string {
  let normalizedHost = host.trim();
  if (!normalizedHost) {
    throw new Error("Host zorunludur.");
  }
  if (!/^https?:\/\//i.test(normalizedHost)) {
    normalizedHost = `https://${normalizedHost}`;
  }
  const normalizedPath = path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`;
  return `${normalizedHost.replace(/\/+$/, "")}${normalizedPath}`;
}

export function extractRequestFields(
  url?: string | null,
  headers?: Record<string, unknown>
): RequestFieldValues {
  const { host, path } = parseStoredUrl(url);
  const extraHeaders: Record<string, string> = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (KNOWN_HEADER_NAMES.includes(key.toLowerCase() as (typeof KNOWN_HEADER_NAMES)[number])) {
      return;
    }
    extraHeaders[key] = value == null ? "" : String(value);
  });

  return {
    method: "POST",
    host,
    path: path || "/api/attendance/verify",
    accept: headerValue(headers, "Accept") || "application/json",
    contentType: headerValue(headers, "Content-Type") || "application/json",
    authorization: headerValue(headers, "Authorization"),
    deviceUuid: headerValue(headers, "X-Device-Uuid"),
    userAgent: headerValue(headers, "User-Agent") || DEFAULT_USER_AGENT,
    acceptLanguage: headerValue(headers, "Accept-Language") || "tr-TR,tr;q=0.9",
    extraHeaders,
  };
}

export function composeRequestHeaders(fields: RequestFieldValues): Record<string, string> {
  const headers: Record<string, string> = {};
  const pairs: Array<[string, string]> = [
    ["Accept", fields.accept],
    ["Content-Type", fields.contentType],
    ["Authorization", normalizeAuthorization(fields.authorization)],
    ["X-Device-Uuid", fields.deviceUuid],
    ["User-Agent", fields.userAgent],
    ["Accept-Language", fields.acceptLanguage],
  ];

  pairs.forEach(([name, value]) => {
    if (value.trim()) {
      headers[name] = value.trim();
    }
  });

  Object.entries(fields.extraHeaders || {}).forEach(([key, value]) => {
    if (key.trim() && String(value).trim()) {
      headers[key.trim()] = String(value).trim();
    }
  });

  return headers;
}

export function normalizeAuthorization(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^bearer\s+/i.test(trimmed)) return trimmed;
  return `Bearer ${trimmed}`;
}

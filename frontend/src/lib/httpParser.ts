import { DEFAULT_BODY, DEFAULT_USER_AGENT } from "./requestFields";

export interface ParsedTemplateFields {
  name?: string;
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
  body: string;
}

const HOP_BY_HOP_HEADERS = new Set([
  "content-length",
  "accept-encoding",
  "connection",
  "keep-alive",
  "priority",
  "transfer-encoding",
  "host",
  "proxy-connection",
]);

export function parseRawHttpOrCurl(rawInput: string): ParsedTemplateFields {
  const trimmed = rawInput.trim();

  if (trimmed.startsWith("curl ") || trimmed.startsWith("curl\n") || trimmed.startsWith("curl\r\n")) {
    return parseCurlCommand(trimmed);
  }

  return parseRawHttpRequest(trimmed);
}

export function parseRawHttpRequest(raw: string): ParsedTemplateFields {
  const normalized = raw.replace(/\r\n/g, "\n");
  const firstEmptyLineIndex = normalized.indexOf("\n\n");

  let headerPart = "";
  let bodyPart = "";

  if (firstEmptyLineIndex !== -1) {
    headerPart = normalized.substring(0, firstEmptyLineIndex).trim();
    bodyPart = normalized.substring(firstEmptyLineIndex + 2).trim();
  } else {
    headerPart = normalized.trim();
  }

  const lines = headerPart.split("\n");
  const firstLine = lines[0] || "POST /api/attendance/verify HTTP/1.1";
  const requestLineMatch = firstLine.match(/^([A-Z]+)\s+([^\s]+)(?:\s+HTTP\/[0-9.]+)?/i);

  let method = "POST";
  let path = "/api/attendance/verify";

  if (requestLineMatch) {
    method = requestLineMatch[1].toUpperCase();
    path = requestLineMatch[2];
  }

  let host = "";
  let accept = "application/json";
  let contentType = "application/json";
  let authorization = "";
  let deviceUuid = "";
  let userAgent = DEFAULT_USER_AGENT;
  let acceptLanguage = "tr-TR,tr;q=0.9";
  const extraHeaders: Record<string, string> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    const lowerKey = key.toLowerCase();

    if (lowerKey === "host") {
      host = value;
    } else if (lowerKey === "accept") {
      accept = value;
    } else if (lowerKey === "content-type") {
      contentType = value;
    } else if (lowerKey === "authorization") {
      authorization = value;
    } else if (lowerKey === "x-device-uuid") {
      deviceUuid = value;
    } else if (lowerKey === "user-agent") {
      userAgent = value;
    } else if (lowerKey === "accept-language") {
      acceptLanguage = value;
    } else if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      extraHeaders[key] = value;
    }
  }

  // Handle URL path vs full URL in request line
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      host = u.host;
      path = `${u.pathname}${u.search}`;
    } catch {
      // ignore
    }
  }

  let processedBody = bodyPart;
  if (bodyPart) {
    try {
      const parsed = JSON.parse(bodyPart);
      if (typeof parsed === "object" && parsed !== null) {
        if ("qr_token" in parsed) {
          parsed.qr_token = "{{qr_token}}";
        } else if ("qr_data" in parsed) {
          parsed.qr_data = "{{qr_token}}";
        }
        processedBody = JSON.stringify(parsed, null, 2);
      }
    } catch {
      processedBody = bodyPart.replace(/"qr_token"\s*:\s*"[^"]*"/, '"qr_token": "{{qr_token}}"');
    }
  } else {
    processedBody = DEFAULT_BODY;
  }

  return {
    method,
    host,
    path: path || "/api/attendance/verify",
    accept,
    contentType,
    authorization,
    deviceUuid,
    userAgent,
    acceptLanguage,
    extraHeaders,
    body: processedBody,
  };
}

export function parseCurlCommand(curl: string): ParsedTemplateFields {
  let method = "POST";
  let host = "";
  let path = "/api/attendance/verify";
  let accept = "application/json";
  let contentType = "application/json";
  let authorization = "";
  let deviceUuid = "";
  let userAgent = DEFAULT_USER_AGENT;
  let acceptLanguage = "tr-TR,tr;q=0.9";
  const extraHeaders: Record<string, string> = {};
  let body = "";

  const urlMatch = curl.match(/(?:'|")(https?:\/\/[^'"]+)(?:'|")|https?:\/\/[^\s]+/);
  if (urlMatch) {
    try {
      const parsedUrl = new URL(urlMatch[1] || urlMatch[0]);
      host = parsedUrl.host;
      path = `${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      // ignore
    }
  }

  const methodMatch = curl.match(/-X\s+([A-Z]+)/i) || curl.match(/--request\s+([A-Z]+)/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  }

  const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = headerRegex.exec(curl)) !== null) {
    const line = match[1];
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      const lowerKey = key.toLowerCase();

      if (lowerKey === "accept") accept = value;
      else if (lowerKey === "content-type") contentType = value;
      else if (lowerKey === "authorization") authorization = value;
      else if (lowerKey === "x-device-uuid") deviceUuid = value;
      else if (lowerKey === "user-agent") userAgent = value;
      else if (lowerKey === "accept-language") acceptLanguage = value;
      else if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
        extraHeaders[key] = value;
      }
    }
  }

  const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+['"]([^'"]+)['"]/;
  const dataMatch = curl.match(dataRegex);
  if (dataMatch) {
    body = dataMatch[1];
    try {
      const parsed = JSON.parse(body);
      if ("qr_token" in parsed) parsed.qr_token = "{{qr_token}}";
      body = JSON.stringify(parsed, null, 2);
    } catch {
      body = body.replace(/"qr_token"\s*:\s*"[^"]*"/, '"qr_token": "{{qr_token}}"');
    }
  }

  return {
    method,
    host,
    path: path || "/api/attendance/verify",
    accept,
    contentType,
    authorization,
    deviceUuid,
    userAgent,
    acceptLanguage,
    extraHeaders,
    body: body || DEFAULT_BODY,
  };
}

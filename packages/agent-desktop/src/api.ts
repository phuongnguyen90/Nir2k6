// Thin REST client for the device-side endpoints, using the global fetch.
// Used for enrollment and as the fallback transport when the WS is down.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  API,
  DEVICE_TOKEN_HEADER,
  type EffectivePolicy,
  type ActivityEvent,
  type Platform,
} from "@hearth/shared";

export interface EnrollResult {
  device: { id: string; name?: string; platform?: Platform };
  token: string;
}

export type ActivityRecord = Omit<ActivityEvent, "id" | "deviceId">;

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

function deviceHeaders(token: string): Record<string, string> {
  return { [DEVICE_TOKEN_HEADER]: token, "content-type": "application/json" };
}

async function expectOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`${what} failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
}

export async function enrollDevice(
  serverUrl: string,
  input: { enrollCode: string; name: string; platform: Platform; agentVersion: string },
): Promise<EnrollResult> {
  const res = await fetch(joinUrl(serverUrl, API.enroll), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await expectOk(res, "enroll");
  const data = (await res.json()) as EnrollResult;
  if (!data?.device?.id || !data?.token) {
    throw new Error("enroll response missing device.id or token");
  }
  return data;
}

export async function fetchPolicy(
  serverUrl: string,
  deviceId: string,
  token: string,
): Promise<EffectivePolicy> {
  const res = await fetch(joinUrl(serverUrl, API.policyForDevice(deviceId)), {
    method: "GET",
    headers: { [DEVICE_TOKEN_HEADER]: token },
  });
  await expectOk(res, "fetchPolicy");
  return (await res.json()) as EffectivePolicy;
}

export async function postActivity(
  serverUrl: string,
  token: string,
  events: ActivityRecord[],
): Promise<void> {
  if (events.length === 0) return;
  const res = await fetch(joinUrl(serverUrl, API.activity), {
    method: "POST",
    headers: deviceHeaders(token),
    body: JSON.stringify({ events }),
  });
  await expectOk(res, "postActivity");
}

export async function postHeartbeat(
  serverUrl: string,
  token: string,
  ts: string,
  agentVersion: string,
): Promise<void> {
  const res = await fetch(joinUrl(serverUrl, API.heartbeat), {
    method: "POST",
    headers: deviceHeaders(token),
    body: JSON.stringify({ ts, agentVersion }),
  });
  await expectOk(res, "postHeartbeat");
}

/** Upload a capture PNG as multipart form-data. */
export async function postCapture(
  serverUrl: string,
  token: string,
  filePath: string,
  meta: { ts: string; width?: number; height?: number },
): Promise<void> {
  const bytes = await readFile(filePath);
  // Copy into a fresh Uint8Array so Blob gets a plain ArrayBuffer (not a Node pool slice).
  const buf = new Uint8Array(bytes.byteLength);
  buf.set(bytes);
  const blob = new Blob([buf], { type: "image/png" });
  const form = new FormData();
  form.append("ts", meta.ts);
  if (meta.width != null) form.append("width", String(meta.width));
  if (meta.height != null) form.append("height", String(meta.height));
  form.append("file", blob, basename(filePath));

  const res = await fetch(joinUrl(serverUrl, API.captures), {
    method: "POST",
    headers: { [DEVICE_TOKEN_HEADER]: token },
    body: form,
  });
  await expectOk(res, "postCapture");
}

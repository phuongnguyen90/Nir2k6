// Typed API client for the Hearth parent dashboard.
// Thin fetch wrapper that attaches the bearer token, speaks JSON in/out,
// and throws a typed ApiError on any non-2xx response.
//
// Routes always come from the shared `API` map — never hardcode a URL here.
import {
  API,
  type Parent,
  type Child,
  type Device,
  type Rule,
  type Schedule,
  type ActivityEvent,
  type Capture,
  type Alert,
  type EffectivePolicy,
  type SignupInput,
  type LoginInput,
  type CreateChildInput,
  type CreateRuleInput,
  type CreateScheduleInput,
  type CreateEnrollCodeInput,
  type Platform,
} from "@hearth/shared";

const TOKEN_KEY = "hearth_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Error thrown for any non-2xx response, carrying HTTP status + server message. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), init);
  } catch (err) {
    throw new ApiError(0, `Network error: ${(err as Error).message}`, null);
  }

  // No content.
  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  const payload: unknown = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : typeof payload === "string" && payload
          ? payload
          : res.statusText) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

export interface AuthResult {
  token: string;
  parent: Parent;
}

export interface EnrollCodeResult {
  enrollCode: string;
  expiresAt?: string;
  device?: Device;
}

export const api = {
  // ---- auth ----
  auth: {
    signup: (input: SignupInput) =>
      request<AuthResult>(API.auth.signup, { method: "POST", body: input }),
    login: (input: LoginInput) =>
      request<AuthResult>(API.auth.login, { method: "POST", body: input }),
    me: () => request<Parent>(API.auth.me),
  },

  // ---- children ----
  children: {
    list: () => request<Child[]>(API.children),
    create: (input: CreateChildInput) =>
      request<Child>(API.children, { method: "POST", body: input }),
    get: (id: string) => request<Child>(API.child(id)),
    update: (id: string, input: Partial<CreateChildInput>) =>
      request<Child>(API.child(id), { method: "PATCH", body: input }),
    delete: (id: string) => request<void>(API.child(id), { method: "DELETE" }),
  },

  // ---- devices ----
  devices: {
    list: (childId?: string) => request<Device[]>(API.devices, { query: { childId } }),
    get: (id: string) => request<Device>(API.device(id)),
    createEnrollCode: (input: CreateEnrollCodeInput) =>
      request<EnrollCodeResult>(API.enrollCode, { method: "POST", body: input }),
    policy: (deviceId: string) => request<EffectivePolicy>(API.policyForDevice(deviceId)),
  },

  // ---- rules ----
  rules: {
    listForChild: (childId: string) => request<Rule[]>(API.rulesForChild(childId)),
    create: (input: CreateRuleInput) =>
      request<Rule>(API.rules, { method: "POST", body: input }),
    update: (id: string, input: Partial<Omit<CreateRuleInput, "childId">>) =>
      request<Rule>(API.rule(id), { method: "PATCH", body: input }),
    delete: (id: string) => request<void>(API.rule(id), { method: "DELETE" }),
  },

  // ---- schedules ----
  schedules: {
    listForChild: (childId: string) => request<Schedule[]>(API.schedulesForChild(childId)),
    create: (input: CreateScheduleInput) =>
      request<Schedule>(API.schedules, { method: "POST", body: input }),
    update: (id: string, input: Partial<Omit<CreateScheduleInput, "childId">>) =>
      request<Schedule>(API.schedule(id), { method: "PATCH", body: input }),
    delete: (id: string) => request<void>(API.schedule(id), { method: "DELETE" }),
  },

  // ---- activity ----
  activity: {
    listForDevice: (deviceId: string) =>
      request<ActivityEvent[]>(API.activityForDevice(deviceId)),
  },

  // ---- captures ----
  captures: {
    listForDevice: (deviceId: string) =>
      request<Capture[]>(API.capturesForDevice(deviceId)),
    // The contract has no dedicated capture-image route; captures are listed with a
    // storage `ref`. We derive a URL under the device captures path to fetch bytes.
    // TODO(contract): add an explicit image-serving route to the shared API map.
    imageUrl: (deviceId: string, capture: Capture) =>
      `${API.capturesForDevice(deviceId)}/${capture.id}/image`,
  },

  // ---- alerts ----
  alerts: {
    list: (childId?: string) => request<Alert[]>(API.alerts, { query: { childId } }),
    ack: (id: string) =>
      request<Alert>(API.ackAlert(id), { method: "POST", body: { acknowledged: true } }),
  },
};

export type { Platform };

// TODO(ws): Live device status via a WebSocket connection to API.ws ('/ws') is OPTIONAL
// and intentionally NOT implemented yet. When added, open a WS (proxied to :8080, ws:true),
// subscribe to device status/policy updates, and reconcile into the device list in Overview
// and the status shown in DeviceDetail. Out of scope for this milestone.

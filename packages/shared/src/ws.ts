// WebSocket protocol between desktop agent and server.
import type { EffectivePolicy, Platform, ActivityEvent } from "./types.js";

export type AgentToServer =
  | { t: "hello"; token: string; agentVersion: string; platform: Platform }
  | { t: "heartbeat"; ts: string; metrics?: Record<string, unknown> }
  | { t: "activity"; events: Array<Omit<ActivityEvent, "id" | "deviceId">> }
  | { t: "ack"; commandId: string; ok: boolean; detail?: string };

export type CommandAction = "lock" | "unlock" | "refresh" | "screenshot";

export type ServerToAgent =
  | { t: "welcome"; deviceId: string; policy: EffectivePolicy }
  | { t: "policy"; policy: EffectivePolicy }
  | { t: "command"; id: string; action: CommandAction; args?: Record<string, unknown> }
  | { t: "error"; message: string };

export const WS_HELLO_TIMEOUT_MS = 10_000;
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

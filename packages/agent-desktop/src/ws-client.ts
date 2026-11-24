// Robust WebSocket client to the server.
//
// Lifecycle: connect → send `hello` → await `welcome` (with timeout) → loop
// heartbeats while dispatching `policy`/`command` messages. On any drop it
// reconnects with exponential backoff + jitter (capped ~30s). While
// disconnected it falls back to a REST policy fetch so enforcement stays current.

import WebSocket from "ws";
import {
  API,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_HELLO_TIMEOUT_MS,
  type AgentToServer,
  type ServerToAgent,
  type CommandAction,
  type EffectivePolicy,
  type Platform,
} from "@hearth/shared";
import type { ActivityRecord } from "./api.js";
import type { Logger } from "./logger.js";

export interface WsClientOptions {
  serverUrl: string;
  token: string;
  platform: Platform;
  agentVersion: string;
  log: Logger;
  onPolicy: (policy: EffectivePolicy) => void;
  onCommand: (
    action: CommandAction,
    args: Record<string, unknown> | undefined,
  ) => Promise<{ ok: boolean; detail?: string }>;
  /** Called once each time the WS becomes ready (initial connect + each reconnect). */
  onReady?: () => void;
  /** REST fallback to refresh policy while the WS is down. */
  fetchPolicyFallback?: () => Promise<void>;
}

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;

function wsUrl(serverUrl: string): string {
  const base = serverUrl.replace(/\/+$/, "");
  const swapped = base.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");
  return swapped + API.ws;
}

export class WsClient {
  private readonly opts: WsClientOptions;
  private readonly log: Logger;

  private ws: WebSocket | null = null;
  private ready = false; // welcome received
  private stopped = false;
  private attempt = 0;

  private helloTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(opts: WsClientOptions) {
    this.opts = opts;
    this.log = opts.log.child("ws");
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  isReady(): boolean {
    return this.ready && this.ws?.readyState === WebSocket.OPEN;
  }

  /** Send an activity batch over the WS. Returns false if not connected. */
  sendActivity(events: ActivityRecord[]): boolean {
    if (!this.isReady()) return false;
    return this.send({ t: "activity", events });
  }

  private connect(): void {
    if (this.stopped) return;
    const url = wsUrl(this.opts.serverUrl);
    this.log.info(`connecting to ${url} (attempt ${this.attempt + 1})`);

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      this.log.warn("failed to construct WebSocket:", e instanceof Error ? e.message : e);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.on("open", () => this.onOpen());
    socket.on("message", (data: WebSocket.RawData) => this.onMessage(data));
    socket.on("close", (code: number) => this.onClose(code));
    socket.on("error", (err: Error) => {
      this.log.debug("socket error:", err.message);
      // 'close' follows 'error'; reconnect is handled there.
    });
  }

  private onOpen(): void {
    this.log.debug("socket open; sending hello");
    this.send({
      t: "hello",
      token: this.opts.token,
      agentVersion: this.opts.agentVersion,
      platform: this.opts.platform,
    });
    this.helloTimer = setTimeout(() => {
      this.log.warn(`no welcome within ${WS_HELLO_TIMEOUT_MS}ms; dropping and retrying`);
      this.ws?.terminate();
    }, WS_HELLO_TIMEOUT_MS);
  }

  private onMessage(data: WebSocket.RawData): void {
    let msg: ServerToAgent;
    try {
      msg = JSON.parse(data.toString()) as ServerToAgent;
    } catch {
      this.log.warn("received non-JSON message; ignoring");
      return;
    }
    switch (msg.t) {
      case "welcome":
        this.onWelcome(msg.policy);
        break;
      case "policy":
        this.log.debug("policy update received");
        this.opts.onPolicy(msg.policy);
        break;
      case "command":
        void this.handleCommand(msg.id, msg.action, msg.args);
        break;
      case "error":
        this.log.warn("server error message:", msg.message);
        break;
      default:
        this.log.debug("unknown message type; ignoring");
        break;
    }
  }

  private onWelcome(policy: EffectivePolicy): void {
    if (this.helloTimer) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }
    this.ready = true;
    this.attempt = 0; // reset backoff on a successful handshake
    this.log.info("handshake complete (welcome received)");
    this.opts.onPolicy(policy);
    this.startHeartbeat();
    this.opts.onReady?.();
  }

  private async handleCommand(
    id: string,
    action: CommandAction,
    args: Record<string, unknown> | undefined,
  ): Promise<void> {
    this.log.info(`command received: ${action}`);
    let result: { ok: boolean; detail?: string };
    try {
      result = await this.opts.onCommand(action, args);
    } catch (e) {
      result = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
    this.send({ t: "ack", commandId: id, ok: result.ok, detail: result.detail });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ t: "heartbeat", ts: new Date().toISOString() });
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private onClose(code: number): void {
    this.ready = false;
    this.stopHeartbeat();
    if (this.helloTimer) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }
    this.ws = null;
    if (this.stopped) return;
    this.log.warn(`socket closed (code ${code}); will reconnect`);
    // REST fallback so policy stays fresh during the outage.
    if (this.opts.fetchPolicyFallback) {
      this.opts.fetchPolicyFallback().catch((e) => {
        this.log.debug("REST policy fallback failed:", e instanceof Error ? e.message : e);
      });
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const backoff = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.attempt);
    const jitter = backoff * (0.8 + Math.random() * 0.4); // ±20%
    const delay = Math.round(jitter);
    this.attempt += 1;
    this.log.info(`reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(msg: AgentToServer): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      this.log.warn("send failed:", e instanceof Error ? e.message : e);
      return false;
    }
  }

  stop(): void {
    this.stopped = true;
    this.ready = false;
    this.stopHeartbeat();
    if (this.helloTimer) clearTimeout(this.helloTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.helloTimer = null;
    this.reconnectTimer = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}

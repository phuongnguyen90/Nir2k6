// WebSocket hub: authenticates agents by device token, tracks live sockets,
// pushes effective policy, and drives schedule-based auto-lock on a timer.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { nanoid } from "nanoid";
import { API, WS_HELLO_TIMEOUT_MS } from "@hearth/shared";
import type { AgentToServer, ServerToAgent, CommandAction, EffectivePolicy, DeviceStatus } from "@hearth/shared";
import type { Config } from "../config.js";
import type { Repos } from "../db/repos.js";
import type { Pipeline } from "../analysis/pipeline.js";
import { computeEffectivePolicy } from "../policy/effective.js";

interface Conn {
  socket: WebSocket;
  deviceId?: string;
  childId?: string;
  lastPolicyJson?: string;
  helloTimer?: ReturnType<typeof setTimeout>;
}

export interface HubDeps {
  repos: Repos;
  config: Config;
  pipeline: Pipeline;
}

export function createHub({ repos, config, pipeline }: HubDeps) {
  // Keyed by deviceId; populated only after a successful hello.
  const connections = new Map<string, Conn>();
  let tickTimer: ReturnType<typeof setInterval> | undefined;

  function send(socket: WebSocket, msg: ServerToAgent): void {
    try {
      socket.send(JSON.stringify(msg));
    } catch {
      /* socket may be closing; ignore */
    }
  }

  function statusForPolicy(policy: EffectivePolicy): DeviceStatus {
    return policy.locked ? "locked" : "online";
  }

  function onHello(conn: Conn, msg: Extract<AgentToServer, { t: "hello" }>): void {
    const device = repos.getDeviceByToken(msg.token);
    if (!device) {
      send(conn.socket, { t: "error", message: "invalid device token" });
      try {
        conn.socket.close();
      } catch {
        /* ignore */
      }
      return;
    }
    if (conn.helloTimer) clearTimeout(conn.helloTimer);
    conn.helloTimer = undefined;
    conn.deviceId = device.id;
    conn.childId = device.childId;

    // Replace any stale connection for the same device.
    const prev = connections.get(device.id);
    if (prev && prev.socket !== conn.socket) {
      try {
        prev.socket.close();
      } catch {
        /* ignore */
      }
    }
    connections.set(device.id, conn);

    const policy = computeEffectivePolicy(repos, config, device.id) as EffectivePolicy;
    repos.updateDeviceSeen(device.id, new Date().toISOString(), statusForPolicy(policy), msg.agentVersion);
    conn.lastPolicyJson = JSON.stringify(policy);
    send(conn.socket, { t: "welcome", deviceId: device.id, policy });
  }

  function onHeartbeat(conn: Conn, msg: Extract<AgentToServer, { t: "heartbeat" }>): void {
    if (!conn.deviceId) return;
    const policy = computeEffectivePolicy(repos, config, conn.deviceId);
    const status: DeviceStatus = policy ? statusForPolicy(policy) : "online";
    repos.updateDeviceSeen(conn.deviceId, msg.ts || new Date().toISOString(), status);
  }

  function onActivity(conn: Conn, msg: Extract<AgentToServer, { t: "activity" }>): void {
    if (!conn.deviceId) return;
    const events = msg.events.map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title,
      url: e.url,
      app: e.app,
      meta: e.meta,
    }));
    repos.insertActivityEvents(conn.deviceId, events);
    pipeline.runAnalysis(conn.deviceId, events);
    repos.updateDeviceSeen(conn.deviceId, new Date().toISOString(), "online");
  }

  function onAck(conn: Conn, msg: Extract<AgentToServer, { t: "ack" }>): void {
    console.log(
      `[ws] ack from device ${conn.deviceId ?? "?"} command=${msg.commandId} ok=${msg.ok}` +
        (msg.detail ? ` detail=${msg.detail}` : ""),
    );
  }

  function handleMessage(conn: Conn, raw: unknown): void {
    let msg: AgentToServer;
    try {
      const text = typeof raw === "string" ? raw : String(raw);
      msg = JSON.parse(text) as AgentToServer;
    } catch {
      send(conn.socket, { t: "error", message: "invalid json" });
      return;
    }
    switch (msg.t) {
      case "hello":
        onHello(conn, msg);
        break;
      case "heartbeat":
        onHeartbeat(conn, msg);
        break;
      case "activity":
        onActivity(conn, msg);
        break;
      case "ack":
        onAck(conn, msg);
        break;
      default:
        send(conn.socket, { t: "error", message: "unknown message type" });
    }
  }

  function handleClose(conn: Conn): void {
    if (conn.helloTimer) clearTimeout(conn.helloTimer);
    if (conn.deviceId) {
      const current = connections.get(conn.deviceId);
      if (current && current.socket === conn.socket) {
        connections.delete(conn.deviceId);
        repos.setDeviceStatus(conn.deviceId, "offline");
      }
    }
  }

  function register(app: FastifyInstance): void {
    app.get(API.ws, { websocket: true }, (socket: WebSocket) => {
      const conn: Conn = { socket };
      conn.helloTimer = setTimeout(() => {
        send(socket, { t: "error", message: "hello timeout" });
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }, WS_HELLO_TIMEOUT_MS);

      socket.on("message", (data: unknown) => handleMessage(conn, (data as { toString(): string }).toString()));
      socket.on("close", () => handleClose(conn));
      socket.on("error", () => {
        /* 'close' handles cleanup */
      });
    });
  }

  // ---- outward-facing hub API ----

  function pushPolicy(deviceId: string): boolean {
    const conn = connections.get(deviceId);
    if (!conn) return false;
    const policy = computeEffectivePolicy(repos, config, deviceId);
    if (!policy) return false;
    conn.lastPolicyJson = JSON.stringify(policy);
    send(conn.socket, { t: "policy", policy });
    return true;
  }

  function sendCommand(deviceId: string, action: CommandAction, args?: Record<string, unknown>): string | undefined {
    const conn = connections.get(deviceId);
    if (!conn) return undefined;
    const id = nanoid();
    send(conn.socket, { t: "command", id, action, args });
    return id;
  }

  function refreshDevice(deviceId: string): void {
    pushPolicy(deviceId);
  }

  function refreshChildDevices(childId: string): void {
    for (const conn of connections.values()) {
      if (conn.childId === childId && conn.deviceId) pushPolicy(conn.deviceId);
    }
  }

  /** Recompute every connected device's policy and push when it changed. */
  function broadcastScheduleTick(): void {
    for (const conn of connections.values()) {
      if (!conn.deviceId) continue;
      const policy = computeEffectivePolicy(repos, config, conn.deviceId);
      if (!policy) continue;
      const json = JSON.stringify(policy);
      if (json !== conn.lastPolicyJson) {
        conn.lastPolicyJson = json;
        repos.setDeviceStatus(conn.deviceId, statusForPolicy(policy));
        send(conn.socket, { t: "policy", policy });
      }
    }
  }

  function startScheduleLoop(intervalMs = 60_000): void {
    if (tickTimer) return;
    tickTimer = setInterval(broadcastScheduleTick, intervalMs);
    if (typeof tickTimer.unref === "function") tickTimer.unref();
  }

  function stop(): void {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = undefined;
    }
  }

  function connectedDeviceIds(): string[] {
    return [...connections.keys()];
  }

  return {
    register,
    pushPolicy,
    sendCommand,
    refreshDevice,
    refreshChildDevices,
    broadcastScheduleTick,
    startScheduleLoop,
    stop,
    connectedDeviceIds,
  };
}

export type Hub = ReturnType<typeof createHub>;

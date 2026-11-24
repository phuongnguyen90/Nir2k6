// Register all REST routes onto the Fastify instance.
import type { FastifyInstance } from "fastify";
import { API } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { registerAuthRoutes } from "./auth.js";
import { registerChildrenRoutes } from "./children.js";
import { registerDeviceRoutes } from "./devices.js";
import { registerRuleRoutes } from "./rules.js";
import { registerScheduleRoutes } from "./schedules.js";
import { registerIngestRoutes } from "./ingest.js";
import { registerParentReadRoutes } from "./parentRead.js";

export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get(API.health, async () => ({ status: "ok", ts: new Date().toISOString() }));

  registerAuthRoutes(app, ctx);
  registerChildrenRoutes(app, ctx);
  registerDeviceRoutes(app, ctx);
  registerRuleRoutes(app, ctx);
  registerScheduleRoutes(app, ctx);
  registerIngestRoutes(app, ctx);
  registerParentReadRoutes(app, ctx);
}

// Parent read endpoints: activity, captures (+ image), alerts list & ack.
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { API, ackAlertSchema, severitySchema } from "@hearth/shared";
import type { AlertSeverity } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { validate, parsePagination } from "./util.js";

interface DeviceIdParams {
  deviceId: string;
}
interface IdParams {
  id: string;
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function registerParentReadRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth, config } = ctx;

  app.get<{ Params: DeviceIdParams }>(
    "/api/devices/:deviceId/activity",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      if (!repos.getDeviceOwned(req.params.deviceId, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      const { limit, offset } = parsePagination(req.query);
      const items = repos.listActivityByDevice(req.params.deviceId, limit, offset);
      const total = repos.countActivityByDevice(req.params.deviceId);
      return reply.send({ items, total, limit, offset });
    },
  );

  app.get<{ Params: DeviceIdParams }>(
    "/api/devices/:deviceId/captures",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      if (!repos.getDeviceOwned(req.params.deviceId, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      const { limit, offset } = parsePagination(req.query);
      const items = repos.listCapturesByDevice(req.params.deviceId, limit, offset);
      return reply.send({ items, limit, offset });
    },
  );

  // Serve a capture image file (ownership-checked).
  app.get<{ Params: IdParams }>(
    "/api/captures/:id/image",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      const capture = repos.getCaptureOwned(req.params.id, req.parent!.id);
      if (!capture) return reply.code(404).send({ error: "not_found" });
      const filePath = path.join(config.capturesDir, capture.ref);
      if (!fs.existsSync(filePath)) return reply.code(404).send({ error: "file_missing" });
      const ext = path.extname(capture.ref).replace(/^\./, "").toLowerCase();
      reply.type(MIME_BY_EXT[ext] ?? "application/octet-stream");
      return reply.send(fs.createReadStream(filePath));
    },
  );

  app.get(API.alerts, { preHandler: auth.requireParent }, async (req, reply) => {
    const q = (req.query ?? {}) as Record<string, unknown>;
    const filter: { childId?: string; severity?: AlertSeverity; acknowledged?: boolean } = {};
    if (typeof q.childId === "string" && q.childId) filter.childId = q.childId;
    if (typeof q.severity === "string") {
      const sev = severitySchema.safeParse(q.severity);
      if (sev.success) filter.severity = sev.data;
    }
    if (q.acknowledged === "true") filter.acknowledged = true;
    else if (q.acknowledged === "false") filter.acknowledged = false;
    const { limit, offset } = parsePagination(req.query);
    const alerts = repos.listAlertsByParent(req.parent!.id, filter, limit, offset);
    return reply.send({ alerts, limit, offset });
  });

  app.post<{ Params: IdParams }>(
    "/api/alerts/:id/ack",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      if (!repos.getAlertOwned(req.params.id, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      const body = validate(ackAlertSchema, req.body ?? {}, reply);
      if (!body) return;
      const alert = repos.ackAlert(req.params.id, body.acknowledged);
      return reply.send({ alert });
    },
  );
}

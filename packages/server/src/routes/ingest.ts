// Device ingest endpoints (device-token auth): activity, heartbeat, captures.
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import { API, activityBatchSchema, heartbeatSchema } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { validate } from "./util.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

interface MultipartFieldValue {
  value: unknown;
}

function fieldStr(fields: Record<string, unknown>, key: string): string | undefined {
  const f = fields[key];
  if (f && typeof f === "object" && "value" in f) {
    const v = (f as MultipartFieldValue).value;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function fieldInt(fields: Record<string, unknown>, key: string): number | undefined {
  const s = fieldStr(fields, key);
  if (s === undefined) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function registerIngestRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth, pipeline, config } = ctx;

  app.post(API.activity, { preHandler: auth.requireDevice }, async (req, reply) => {
    const body = validate(activityBatchSchema, req.body, reply);
    if (!body) return;
    const deviceId = req.device!.id;
    repos.insertActivityEvents(deviceId, body.events);
    const alerts = pipeline.runAnalysis(deviceId, body.events);
    repos.updateDeviceSeen(deviceId, new Date().toISOString(), "online");
    return reply.send({ accepted: body.events.length, alerts: alerts.length });
  });

  app.post(API.heartbeat, { preHandler: auth.requireDevice }, async (req, reply) => {
    const body = validate(heartbeatSchema, req.body, reply);
    if (!body) return;
    repos.updateDeviceSeen(req.device!.id, body.ts || new Date().toISOString(), "online", body.agentVersion);
    return reply.send({ ok: true });
  });

  // Multipart screenshot upload: file field "file", plus optional ts/width/height.
  app.post(API.captures, { preHandler: auth.requireDevice }, async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: "expected_multipart" });
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "missing_file" });

    const buf = await data.toBuffer();
    const fields = (data.fields ?? {}) as Record<string, unknown>;
    const ext = EXT_BY_MIME[data.mimetype] ?? (path.extname(data.filename || "").replace(/^\./, "") || "bin");
    const id = nanoid();
    const ref = `${id}.${ext}`;
    fs.mkdirSync(config.capturesDir, { recursive: true });
    fs.writeFileSync(path.join(config.capturesDir, ref), buf);

    const capture = repos.createCapture({
      id,
      deviceId: req.device!.id,
      ts: fieldStr(fields, "ts") || new Date().toISOString(),
      ref,
      width: fieldInt(fields, "width"),
      height: fieldInt(fields, "height"),
    });
    repos.updateDeviceSeen(req.device!.id, new Date().toISOString(), "online");
    return reply.code(201).send({ capture });
  });
}

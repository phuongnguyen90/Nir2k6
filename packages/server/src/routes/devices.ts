// Device registry: list/get, enroll-code creation, public enrollment, policy fetch.
import type { FastifyInstance } from "fastify";
import {
  API,
  DEVICE_TOKEN_HEADER,
  createEnrollCodeSchema,
  enrollDeviceSchema,
} from "@hearth/shared";
import type { AppContext } from "../context.js";
import { computeEffectivePolicy } from "../policy/effective.js";
import { validate } from "./util.js";

interface IdParams {
  id: string;
}
interface DeviceIdParams {
  deviceId: string;
}

export function registerDeviceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth, config } = ctx;

  // List devices for the parent, optionally filtered by child.
  app.get<{ Querystring: { childId?: string } }>(
    API.devices,
    { preHandler: auth.requireParent },
    async (req, reply) => {
      const childId = req.query.childId;
      if (childId && !repos.getChildOwned(childId, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.send({ devices: repos.listDevicesByParent(req.parent!.id, childId) });
    },
  );

  // Create a short enrollment code for a child (parent).
  app.post(API.enrollCode, { preHandler: auth.requireParent }, async (req, reply) => {
    const body = validate(createEnrollCodeSchema, req.body, reply);
    if (!body) return;
    if (!repos.getChildOwned(body.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const { code, createdAt } = repos.createEnrollCode({
      childId: body.childId,
      name: body.name,
      platform: body.platform,
    });
    return reply.code(201).send({ enrollCode: code, childId: body.childId, createdAt });
  });

  // PUBLIC: an agent redeems an enroll code to register itself + get a device token.
  app.post(API.enroll, async (req, reply) => {
    const body = validate(enrollDeviceSchema, req.body, reply);
    if (!body) return;
    const code = repos.getEnrollCode(body.enrollCode);
    if (!code) return reply.code(400).send({ error: "invalid_enroll_code" });
    if (code.used_at) return reply.code(400).send({ error: "enroll_code_used" });

    const device = repos.createDevice({
      childId: code.child_id,
      name: body.name,
      platform: body.platform,
      status: "offline",
      agentVersion: body.agentVersion,
    });
    const token = repos.createDeviceToken(device.id);
    repos.markEnrollCodeUsed(code.code);
    return reply.code(201).send({ device, token });
  });

  // Effective policy — accessible by the owning parent OR the device itself.
  app.get<{ Params: DeviceIdParams }>(API.policyForDevice(":deviceId"), async (req, reply) => {
    const deviceId = req.params.deviceId;

    // Device auth path.
    const raw = req.headers[DEVICE_TOKEN_HEADER];
    const deviceToken = Array.isArray(raw) ? raw[0] : raw;
    if (deviceToken) {
      const device = repos.getDeviceByToken(deviceToken);
      if (!device || device.id !== deviceId) return reply.code(401).send({ error: "unauthorized" });
      const policy = computeEffectivePolicy(repos, config, deviceId);
      if (!policy) return reply.code(404).send({ error: "not_found" });
      return reply.send({ policy });
    }

    // Parent auth path.
    const parsed = auth.verifyToken((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
    if (!parsed) return reply.code(401).send({ error: "unauthorized" });
    if (!repos.getDeviceOwned(deviceId, parsed.parentId)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const policy = computeEffectivePolicy(repos, config, deviceId);
    if (!policy) return reply.code(404).send({ error: "not_found" });
    return reply.send({ policy });
  });

  // Get a single device (parent).
  app.get<{ Params: IdParams }>("/api/devices/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const device = repos.getDeviceOwned(req.params.id, req.parent!.id);
    if (!device) return reply.code(404).send({ error: "not_found" });
    return reply.send({ device });
  });
}

// Schedule CRUD (parent-scoped) + list-for-child. Policy re-pushed on any change.
import type { FastifyInstance } from "fastify";
import { API, createScheduleSchema, updateScheduleSchema } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { validate } from "./util.js";

interface IdParams {
  id: string;
}
interface ChildIdParams {
  childId: string;
}

export function registerScheduleRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth, hub } = ctx;

  app.post(API.schedules, { preHandler: auth.requireParent }, async (req, reply) => {
    const body = validate(createScheduleSchema, req.body, reply);
    if (!body) return;
    if (!repos.getChildOwned(body.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const schedule = repos.createSchedule(body);
    hub.refreshChildDevices(schedule.childId);
    return reply.code(201).send({ schedule });
  });

  app.patch<{ Params: IdParams }>("/api/schedules/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const existing = repos.getSchedule(req.params.id);
    if (!existing || !repos.getChildOwned(existing.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const body = validate(updateScheduleSchema, req.body, reply);
    if (!body) return;
    const schedule = repos.updateSchedule(req.params.id, body);
    hub.refreshChildDevices(existing.childId);
    return reply.send({ schedule });
  });

  app.delete<{ Params: IdParams }>("/api/schedules/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const existing = repos.getSchedule(req.params.id);
    if (!existing || !repos.getChildOwned(existing.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    repos.deleteSchedule(req.params.id);
    hub.refreshChildDevices(existing.childId);
    return reply.code(204).send();
  });

  app.get<{ Params: ChildIdParams }>(
    "/api/children/:childId/schedules",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      if (!repos.getChildOwned(req.params.childId, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.send({ schedules: repos.listSchedulesByChild(req.params.childId) });
    },
  );
}

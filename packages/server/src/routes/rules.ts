// Rule CRUD (parent-scoped) + list-for-child. Policy is re-pushed on any change.
import type { FastifyInstance } from "fastify";
import { API, createRuleSchema, updateRuleSchema } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { validate } from "./util.js";

interface IdParams {
  id: string;
}
interface ChildIdParams {
  childId: string;
}

export function registerRuleRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth, hub } = ctx;

  app.post(API.rules, { preHandler: auth.requireParent }, async (req, reply) => {
    const body = validate(createRuleSchema, req.body, reply);
    if (!body) return;
    if (!repos.getChildOwned(body.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const rule = repos.createRule(body);
    hub.refreshChildDevices(rule.childId);
    return reply.code(201).send({ rule });
  });

  app.patch<{ Params: IdParams }>("/api/rules/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const existing = repos.getRule(req.params.id);
    if (!existing || !repos.getChildOwned(existing.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const body = validate(updateRuleSchema, req.body, reply);
    if (!body) return;
    const rule = repos.updateRule(req.params.id, body);
    hub.refreshChildDevices(existing.childId);
    return reply.send({ rule });
  });

  app.delete<{ Params: IdParams }>("/api/rules/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const existing = repos.getRule(req.params.id);
    if (!existing || !repos.getChildOwned(existing.childId, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    repos.deleteRule(req.params.id);
    hub.refreshChildDevices(existing.childId);
    return reply.code(204).send();
  });

  app.get<{ Params: ChildIdParams }>(
    "/api/children/:childId/rules",
    { preHandler: auth.requireParent },
    async (req, reply) => {
      if (!repos.getChildOwned(req.params.childId, req.parent!.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.send({ rules: repos.listRulesByChild(req.params.childId) });
    },
  );
}

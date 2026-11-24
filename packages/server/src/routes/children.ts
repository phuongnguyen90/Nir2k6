// Children CRUD, parent-scoped.
import type { FastifyInstance } from "fastify";
import { API, createChildSchema, updateChildSchema } from "@hearth/shared";
import type { AppContext } from "../context.js";
import { validate } from "./util.js";

interface IdParams {
  id: string;
}

export function registerChildrenRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth } = ctx;

  app.get(API.children, { preHandler: auth.requireParent }, async (req, reply) => {
    return reply.send({ children: repos.listChildrenByParent(req.parent!.id) });
  });

  app.post(API.children, { preHandler: auth.requireParent }, async (req, reply) => {
    const body = validate(createChildSchema, req.body, reply);
    if (!body) return;
    const child = repos.createChild({ parentId: req.parent!.id, ...body });
    return reply.code(201).send({ child });
  });

  app.get<{ Params: IdParams }>("/api/children/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    const child = repos.getChildOwned(req.params.id, req.parent!.id);
    if (!child) return reply.code(404).send({ error: "not_found" });
    return reply.send({ child });
  });

  app.patch<{ Params: IdParams }>("/api/children/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    if (!repos.getChildOwned(req.params.id, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const body = validate(updateChildSchema, req.body, reply);
    if (!body) return;
    const child = repos.updateChild(req.params.id, body);
    return reply.send({ child });
  });

  app.delete<{ Params: IdParams }>("/api/children/:id", { preHandler: auth.requireParent }, async (req, reply) => {
    if (!repos.getChildOwned(req.params.id, req.parent!.id)) {
      return reply.code(404).send({ error: "not_found" });
    }
    repos.deleteChild(req.params.id);
    return reply.code(204).send();
  });
}

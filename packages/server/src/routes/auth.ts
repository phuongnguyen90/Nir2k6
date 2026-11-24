// Auth routes: signup, login, me.
import type { FastifyInstance } from "fastify";
import { API, signupSchema, loginSchema } from "@hearth/shared";
import { hashPassword, verifyPassword } from "../auth.js";
import type { AppContext } from "../context.js";
import { validate } from "./util.js";

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { repos, auth } = ctx;

  app.post(API.auth.signup, async (req, reply) => {
    const body = validate(signupSchema, req.body, reply);
    if (!body) return;
    if (repos.getParentByEmailWithHash(body.email)) {
      return reply.code(409).send({ error: "email_taken" });
    }
    const parent = repos.createParent({
      email: body.email,
      displayName: body.displayName,
      passwordHash: hashPassword(body.password),
    });
    const token = auth.signToken(parent.id);
    return reply.code(201).send({ token, parent });
  });

  app.post(API.auth.login, async (req, reply) => {
    const body = validate(loginSchema, req.body, reply);
    if (!body) return;
    const found = repos.getParentByEmailWithHash(body.email);
    if (!found || !verifyPassword(body.password, found.passwordHash)) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const { passwordHash: _ph, ...parent } = found;
    const token = auth.signToken(parent.id);
    return reply.send({ token, parent });
  });

  app.get(API.auth.me, { preHandler: auth.requireParent }, async (req, reply) => {
    const parent = repos.getParentById(req.parent!.id);
    if (!parent) return reply.code(401).send({ error: "unauthorized" });
    return reply.send({ parent });
  });
}

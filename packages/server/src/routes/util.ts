// Small route helpers: zod body validation and query parsing.
import type { FastifyReply } from "fastify";

// A minimal structural view of a zod schema's `safeParse`. We deliberately do
// NOT import zod's own types here: inferring the output `T` from zod's full
// recursive `ZodType<T>` is a severe tsc performance cliff, and the monorepo
// resolves two different zod copies (shared vs server) whose nominal types are
// not mutually assignable. Matching only `safeParse` is cheap and version-safe.
interface SafeParseSuccess<T> {
  success: true;
  data: T;
}
interface SafeParseFailure {
  success: false;
  error: { issues: readonly unknown[] };
}
interface SafeParser<T> {
  safeParse(data: unknown): SafeParseSuccess<T> | SafeParseFailure;
}

/**
 * Validate `data` against `schema`. On failure, sends a 400 with the zod issues
 * and returns undefined (callers should `return` immediately).
 */
export function validate<T>(schema: SafeParser<T>, data: unknown, reply: FastifyReply): T | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    void reply.code(400).send({ error: "validation", issues: result.error.issues });
    return undefined;
  }
  return result.data;
}

export function parsePagination(query: unknown): { limit: number; offset: number } {
  const q = (query ?? {}) as Record<string, unknown>;
  let limit = Number.parseInt(String(q.limit ?? ""), 10);
  let offset = Number.parseInt(String(q.offset ?? ""), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

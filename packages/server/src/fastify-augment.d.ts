// Module augmentation: authenticated principals attached by preHandlers.
import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    parent?: { id: string };
    device?: { id: string; childId: string };
  }
}

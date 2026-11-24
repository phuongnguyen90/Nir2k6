// Password hashing (scrypt), JWT sign/verify, and Fastify preHandlers.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { DEVICE_TOKEN_HEADER } from "@hearth/shared";
import type { Config } from "./config.js";
import type { Repos } from "./db/repos.js";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

/** Encode as `scrypt$<N>$<saltHex>$<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time verification of a password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(n)) return false;
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, { N: n, r: SCRYPT_R, p: SCRYPT_P });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

interface JwtPayload {
  parentId: string;
}

export function createAuth(repos: Repos, config: Config) {
  function signToken(parentId: string): string {
    const opts: SignOptions = { expiresIn: config.jwtTtl as SignOptions["expiresIn"] };
    return jwt.sign({ parentId }, config.jwtSecret, opts);
  }

  function verifyToken(token: string): JwtPayload | undefined {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (typeof decoded === "object" && decoded !== null && typeof (decoded as JwtPayload).parentId === "string") {
        return { parentId: (decoded as JwtPayload).parentId };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  function bearer(req: FastifyRequest): string | undefined {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) return undefined;
    return h.slice("Bearer ".length).trim();
  }

  const requireParent: preHandlerHookHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = bearer(req);
    const payload = token ? verifyToken(token) : undefined;
    if (!payload) {
      await reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    // Ensure the parent still exists.
    const parent = repos.getParentById(payload.parentId);
    if (!parent) {
      await reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    req.parent = { id: parent.id };
  };

  const requireDevice: preHandlerHookHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = req.headers[DEVICE_TOKEN_HEADER];
    const token = Array.isArray(raw) ? raw[0] : raw;
    const device = token ? repos.getDeviceByToken(token) : undefined;
    if (!device) {
      await reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    req.device = { id: device.id, childId: device.childId };
  };

  return { signToken, verifyToken, requireParent, requireDevice };
}

export type Auth = ReturnType<typeof createAuth>;

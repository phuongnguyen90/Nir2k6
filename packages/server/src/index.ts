// Server bootstrap: wire the app context, register plugins + routes, and listen.
import { pathToFileURL } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { config as defaultConfig, type Config } from "./config.js";
import { openDatabase } from "./db/index.js";
import { createRepos } from "./db/repos.js";
import { createAuth } from "./auth.js";
import { createNotifier } from "./notify.js";
import { createPipeline } from "./analysis/pipeline.js";
import { createHub } from "./ws/hub.js";
import type { AppContext } from "./context.js";
import { registerRoutes } from "./routes/index.js";

export interface BuildOptions {
  config?: Config;
  logger?: boolean;
  /** When false, the schedule auto-lock interval is not started (tests). */
  scheduleLoop?: boolean;
}

export interface BuiltServer {
  app: FastifyInstance;
  ctx: AppContext;
}

const CAPTURE_MAX_BYTES = 25 * 1024 * 1024;

export async function buildServer(options: BuildOptions = {}): Promise<BuiltServer> {
  const config = options.config ?? defaultConfig;

  const db = openDatabase(config.dbPath, { capturesDir: config.capturesDir });
  const repos = createRepos(db);
  const auth = createAuth(repos, config);
  const notifier = createNotifier(config);
  const pipeline = createPipeline({ repos, config, notifier });
  const hub = createHub({ repos, config, pipeline });
  const ctx: AppContext = { config, db, repos, auth, notifier, pipeline, hub };

  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2 * 1024 * 1024 });

  await app.register(cors, { origin: config.dashboardOrigin, credentials: true });
  await app.register(multipart, { limits: { fileSize: CAPTURE_MAX_BYTES } });
  await app.register(websocket);

  registerRoutes(app, ctx);
  hub.register(app);

  if (options.scheduleLoop !== false) hub.startScheduleLoop();

  app.addHook("onClose", async () => {
    hub.stop();
    db.close();
  });

  return { app, ctx };
}

export async function start(): Promise<void> {
  const { app } = await buildServer({ logger: true });
  try {
    await app.listen({ port: defaultConfig.port, host: defaultConfig.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Run only when executed directly (node dist/index.js), not when imported.
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedPath && import.meta.url === invokedPath) {
  void start();
}

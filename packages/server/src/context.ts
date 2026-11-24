// Shared application context wired once at boot and passed to route plugins.
import type { Config } from "./config.js";
import type { DB } from "./db/index.js";
import type { Repos } from "./db/repos.js";
import type { Auth } from "./auth.js";
import type { Notifier } from "./notify.js";
import type { Pipeline } from "./analysis/pipeline.js";
import type { Hub } from "./ws/hub.js";

export interface AppContext {
  config: Config;
  db: DB;
  repos: Repos;
  auth: Auth;
  notifier: Notifier;
  pipeline: Pipeline;
  hub: Hub;
}

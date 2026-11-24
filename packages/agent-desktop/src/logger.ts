// Tiny leveled, timestamped logger. No dependencies.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function envLevel(): LogLevel {
  const raw = (process.env.HEARTH_LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

let threshold: LogLevel = envLevel();

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) return;
  const ts = new Date().toISOString();
  const prefix = `${ts} [${level.toUpperCase()}] (${scope})`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(prefix, ...args);
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  child(scope: string): Logger;
}

export function createLogger(scope = "agent"): Logger {
  return {
    debug: (...args) => emit("debug", scope, args),
    info: (...args) => emit("info", scope, args),
    warn: (...args) => emit("warn", scope, args),
    error: (...args) => emit("error", scope, args),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const log = createLogger();

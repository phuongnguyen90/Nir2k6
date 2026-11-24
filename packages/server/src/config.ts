// Runtime configuration, loaded from environment (.env via dotenv).
import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv();

function str(key: string): string | undefined;
function str(key: string, def: string): string;
function str(key: string, def?: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? def : v;
}

function int(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return def;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  capturesDir: string;
  jwtSecret: string;
  jwtTtl: string;
  screenshotRetentionDays: number;
  screenshotIntervalSec: number;
  smtpUrl?: string;
  smtpFrom?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  dashboardOrigin: string;
  // Optional JSON file overriding/extending the built-in analysis term lists.
  analysisTermsFile?: string;
}

const DEV_JWT_FALLBACK = "dev-insecure-jwt-secret-change-me";

function resolveJwtSecret(): string {
  const secret = str("JWT_SECRET");
  if (secret) return secret;
  // Loud warning: never run this way in production.
  console.warn(
    "[config] WARNING: JWT_SECRET is not set — falling back to an INSECURE development secret. " +
      "Set JWT_SECRET in the environment before exposing this server.",
  );
  return DEV_JWT_FALLBACK;
}

function build(): Config {
  const dataDir = path.resolve(str("DATA_DIR", "./data"));
  const dbPath = path.resolve(str("DB_PATH", path.join(dataDir, "hearth.sqlite")));
  return {
    port: int("PORT", 8080),
    host: str("HOST", "0.0.0.0"),
    dataDir,
    dbPath,
    capturesDir: path.join(dataDir, "captures"),
    jwtSecret: resolveJwtSecret(),
    jwtTtl: str("JWT_TTL", "12h"),
    screenshotRetentionDays: int("SCREENSHOT_RETENTION_DAYS", 14),
    screenshotIntervalSec: int("SCREENSHOT_INTERVAL_SEC", 120),
    smtpUrl: str("SMTP_URL"),
    smtpFrom: str("SMTP_FROM"),
    telegramBotToken: str("TELEGRAM_BOT_TOKEN"),
    telegramChatId: str("TELEGRAM_CHAT_ID"),
    dashboardOrigin: str("DASHBOARD_ORIGIN", "http://localhost:5173"),
    analysisTermsFile: str("ANALYSIS_TERMS_FILE"),
  };
}

export const config: Config = build();

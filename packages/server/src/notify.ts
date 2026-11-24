// Best-effort alert notifications via SMTP (nodemailer) and/or Telegram.
// No-op when unconfigured; all errors are swallowed with a log.
import nodemailer, { type Transporter } from "nodemailer";
import type { Alert } from "@hearth/shared";
import type { Config } from "./config.js";

function formatAlert(alert: Alert): { subject: string; body: string } {
  const subject = `[Hearth] ${alert.severity.toUpperCase()}: ${alert.category} activity`;
  const lines = [
    alert.message,
    "",
    `Severity: ${alert.severity}`,
    `Category: ${alert.category}`,
    `When: ${alert.ts}`,
  ];
  if (alert.evidence?.url) lines.push(`URL: ${alert.evidence.url}`);
  if (alert.evidence?.title) lines.push(`Title: ${alert.evidence.title}`);
  if (alert.evidence?.app) lines.push(`App: ${alert.evidence.app}`);
  if (typeof alert.evidence?.score === "number") lines.push(`Score: ${alert.evidence.score}`);
  return { subject, body: lines.join("\n") };
}

export function createNotifier(config: Config) {
  let transport: Transporter | undefined;
  if (config.smtpUrl) {
    try {
      transport = nodemailer.createTransport(config.smtpUrl);
    } catch (err) {
      console.warn("[notify] failed to create SMTP transport:", err);
    }
  }

  async function sendEmail(alert: Alert): Promise<void> {
    if (!transport || !config.smtpFrom) return;
    const { subject, body } = formatAlert(alert);
    await transport.sendMail({ from: config.smtpFrom, to: config.smtpFrom, subject, text: body });
  }

  async function sendTelegram(alert: Alert): Promise<void> {
    if (!config.telegramBotToken || !config.telegramChatId) return;
    const { subject, body } = formatAlert(alert);
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: `${subject}\n\n${body}` }),
    });
    if (!res.ok) {
      throw new Error(`Telegram API responded ${res.status}`);
    }
  }

  async function sendAlertNotification(alert: Alert): Promise<void> {
    const tasks: Promise<void>[] = [];
    tasks.push(sendEmail(alert).catch((err) => console.warn("[notify] email failed:", err)));
    tasks.push(sendTelegram(alert).catch((err) => console.warn("[notify] telegram failed:", err)));
    await Promise.all(tasks);
  }

  return { sendAlertNotification, get configured() {
    return Boolean(transport || (config.telegramBotToken && config.telegramChatId));
  } };
}

export type Notifier = ReturnType<typeof createNotifier>;

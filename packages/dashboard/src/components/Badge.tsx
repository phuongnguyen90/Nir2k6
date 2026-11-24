import type { ReactNode } from "react";
import type { AlertSeverity, DeviceStatus } from "@hearth/shared";

type Tone = "info" | "warn" | "alert" | "online" | "offline" | "locked" | "unenrolled" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  info: "badge-info",
  warn: "badge-warn",
  alert: "badge-alert",
  online: "badge-online",
  offline: "badge-offline",
  locked: "badge-locked",
  unenrolled: "badge-unenrolled",
  neutral: "badge-neutral",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const label = severity === "alert" ? "Alert" : severity === "warn" ? "Warning" : "Info";
  return <Badge tone={severity}>{label}</Badge>;
}

/** A colored status dot (optionally followed by a text label). */
export function StatusDot({ status, withLabel = true }: { status: DeviceStatus; withLabel?: boolean }) {
  const label =
    status === "online"
      ? "Online"
      : status === "offline"
        ? "Offline"
        : status === "locked"
          ? "Locked"
          : "Not enrolled";
  return (
    <span className="status">
      <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
      {withLabel ? <span className="status-label">{label}</span> : null}
    </span>
  );
}

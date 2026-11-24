import { useEffect, useState } from "react";
import type { Alert } from "@hearth/shared";
import { api, ApiError } from "../../api";
import { Spinner } from "../../components/Spinner";
import { SeverityBadge, Badge } from "../../components/Badge";
import { CATEGORY_LABEL, formatDateTime, relativeTime } from "../../format";

export function AlertsTab({ childId }: { childId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await api.alerts.list(childId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function ack(id: string) {
    setAcking(id);
    try {
      const updated = await api.alerts.ack(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to acknowledge alert.");
    } finally {
      setAcking(null);
    }
  }

  if (loading) return <Spinner label="Loading alerts…" />;

  return (
    <div className="stack">
      {error ? (
        <div className="alert-box" role="alert">
          {error}{" "}
          <button type="button" className="link-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {alerts.length === 0 && !error ? (
        <div className="empty">
          <h2>No alerts</h2>
          <p className="muted">Nothing flagged for this child yet. That's a good thing.</p>
        </div>
      ) : (
        <ul className="alert-feed">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-item sev-${a.severity} ${a.acknowledgedAt ? "acked" : ""}`}>
              <div className="alert-item-head">
                <SeverityBadge severity={a.severity} />
                <Badge tone="neutral">{CATEGORY_LABEL[a.category]}</Badge>
                <span className="muted small" title={formatDateTime(a.ts)}>
                  {relativeTime(a.ts)}
                </span>
              </div>
              <p className="alert-message">{a.message}</p>
              {a.evidence ? (
                <div className="alert-evidence muted small">
                  {a.evidence.title ? <span>“{a.evidence.title}” </span> : null}
                  {a.evidence.app ? <span className="mono">{a.evidence.app} </span> : null}
                  {a.evidence.url ? (
                    <a href={a.evidence.url} target="_blank" rel="noreferrer noopener" className="mono">
                      {a.evidence.url}
                    </a>
                  ) : null}
                  {a.evidence.score != null ? (
                    <span> · score {a.evidence.score.toFixed(2)}</span>
                  ) : null}
                </div>
              ) : null}
              <div className="alert-item-foot">
                {a.acknowledgedAt ? (
                  <span className="muted small">
                    Acknowledged {relativeTime(a.acknowledgedAt)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void ack(a.id)}
                    disabled={acking === a.id}
                  >
                    {acking === a.id ? "Acknowledging…" : "Acknowledge"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

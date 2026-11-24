import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Device, ActivityEvent, Capture } from "@hearth/shared";
import { api, ApiError } from "../api";
import { Spinner } from "../components/Spinner";
import { StatusDot } from "../components/Badge";
import { Modal } from "../components/Modal";
import { PLATFORM_LABEL, formatDateTime, relativeTime } from "../format";

export function DeviceDetail() {
  const { deviceId = "" } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Capture | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.devices.get(deviceId),
      api.activity.listForDevice(deviceId),
      api.captures.listForDevice(deviceId),
    ])
      .then(([dev, acts, caps]) => {
        if (cancelled) return;
        setDevice(dev);
        setActivity(acts);
        setCaptures(caps);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load this device.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Loading device…" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="page">
        <div className="alert-box" role="alert">
          {error ?? "Device not found."}
        </div>
        <Link to="/" className="link-btn">
          ← Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">Overview</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/children/${device.childId}`}>Child</Link>
        <span aria-hidden="true">›</span>
        <span>{device.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h1>{device.name}</h1>
          <p className="muted device-subhead">
            {PLATFORM_LABEL[device.platform]}
            {device.agentVersion ? ` · agent ${device.agentVersion}` : ""}
            {device.lastSeenAt ? ` · seen ${relativeTime(device.lastSeenAt)}` : " · never seen"}
          </p>
        </div>
        <StatusDot status={device.status} />
      </div>

      <div className="two-col">
        <section className="card">
          <h2 className="section-title">Activity timeline</h2>
          {activity.length === 0 ? (
            <p className="muted small">No activity recorded yet.</p>
          ) : (
            <ul className="timeline">
              {activity.map((ev) => (
                <li key={ev.id} className={`timeline-item type-${ev.type}`}>
                  <span className="timeline-time muted small" title={formatDateTime(ev.ts)}>
                    {relativeTime(ev.ts)}
                  </span>
                  <span className={`timeline-tag tag-${ev.type}`}>{ev.type}</span>
                  <div className="timeline-body">
                    <div className="timeline-title">{ev.title || ev.app || ev.url || "Activity"}</div>
                    {ev.url ? (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mono small timeline-url"
                      >
                        {ev.url}
                      </a>
                    ) : ev.app ? (
                      <span className="mono small muted">{ev.app}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">Screenshots</h2>
          {captures.length === 0 ? (
            <p className="muted small">No screenshots captured yet.</p>
          ) : (
            <div className="gallery">
              {captures.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="thumb"
                  onClick={() => setZoom(c)}
                  title={formatDateTime(c.ts)}
                >
                  <img
                    src={api.captures.imageUrl(device.id, c)}
                    alt={`Screenshot from ${formatDateTime(c.ts)}`}
                    loading="lazy"
                  />
                  <span className="thumb-time">{relativeTime(c.ts)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal open={!!zoom} title={zoom ? `Screenshot · ${formatDateTime(zoom.ts)}` : ""} onClose={() => setZoom(null)}>
        {zoom ? (
          <div className="zoom">
            <img
              src={api.captures.imageUrl(device.id, zoom)}
              alt={`Screenshot from ${formatDateTime(zoom.ts)}`}
            />
            <p className="muted small">
              {zoom.width && zoom.height ? `${zoom.width}×${zoom.height} · ` : ""}
              {zoom.analyzed ? "Analyzed" : "Not analyzed"}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

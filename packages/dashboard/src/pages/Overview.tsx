import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Child, Device, Platform } from "@hearth/shared";
import { api, ApiError } from "../api";
import { Spinner } from "../components/Spinner";
import { StatusDot } from "../components/Badge";
import { Modal } from "../components/Modal";
import { relativeTime, PLATFORM_LABEL } from "../format";

const PLATFORMS: Platform[] = ["windows", "macos", "linux", "android", "ios"];

export function Overview() {
  const [children, setChildren] = useState<Child[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addChildOpen, setAddChildOpen] = useState(false);
  const [enrollFor, setEnrollFor] = useState<Child | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kids, devs] = await Promise.all([api.children.list(), api.devices.list()]);
      setChildren(kids);
      setDevices(devs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load your family.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const devicesByChild = useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const d of devices) {
      const list = map.get(d.childId) ?? [];
      list.push(d);
      map.set(d.childId, list);
    }
    return map;
  }, [devices]);

  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Loading your family…" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Family overview</h1>
          <p className="muted">Children, their devices, and quick status at a glance.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddChildOpen(true)}>
          + Add child
        </button>
      </div>

      {error ? (
        <div className="alert-box" role="alert">
          {error}{" "}
          <button type="button" className="link-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {children.length === 0 && !error ? (
        <div className="empty">
          <h2>No children yet</h2>
          <p className="muted">Add a child to start managing their devices.</p>
          <button type="button" className="btn btn-primary" onClick={() => setAddChildOpen(true)}>
            + Add your first child
          </button>
        </div>
      ) : (
        <div className="child-grid">
          {children.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              devices={devicesByChild.get(child.id) ?? []}
              onEnroll={() => setEnrollFor(child)}
            />
          ))}
        </div>
      )}

      <AddChildModal
        open={addChildOpen}
        onClose={() => setAddChildOpen(false)}
        onCreated={(c) => {
          setChildren((prev) => [...prev, c]);
          setAddChildOpen(false);
        }}
      />

      <EnrollModal
        child={enrollFor}
        onClose={() => setEnrollFor(null)}
        onEnrolled={() => void load()}
      />
    </div>
  );
}

function ChildCard({
  child,
  devices,
  onEnroll,
}: {
  child: Child;
  devices: Device[];
  onEnroll: () => void;
}) {
  return (
    <section className="card child-card">
      <div className="child-card-head">
        <span
          className="avatar"
          style={{ background: child.avatarColor || "var(--accent)" }}
          aria-hidden="true"
        >
          {child.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="child-card-title">
          <Link to={`/children/${child.id}`} className="child-name-link">
            {child.name}
          </Link>
          {child.birthYear ? (
            <span className="muted small">Born {child.birthYear}</span>
          ) : null}
        </div>
      </div>

      {devices.length === 0 ? (
        <p className="muted small device-empty">No devices enrolled yet.</p>
      ) : (
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.id} className="device-row">
              <Link to={`/devices/${d.id}`} className="device-main">
                <span className="device-name">{d.name}</span>
                <span className="muted small">{PLATFORM_LABEL[d.platform]}</span>
              </Link>
              <div className="device-meta">
                <StatusDot status={d.status} />
                <span className="muted small">
                  {d.lastSeenAt ? `seen ${relativeTime(d.lastSeenAt)}` : "never seen"}
                </span>
                <LockToggle device={d} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="child-card-actions">
        <Link to={`/children/${child.id}`} className="btn btn-ghost btn-sm">
          Manage
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEnroll}>
          Enroll a device
        </button>
      </div>
    </section>
  );
}

// Quick lock indicator. The shared API map exposes no parent→device command route
// (locking is delivered to the agent over WebSocket), so this surfaces status only.
// TODO(contract): add a REST command endpoint (lock/unlock) to the shared API map
// so the parent can trigger a lock from the dashboard.
function LockToggle({ device }: { device: Device }) {
  const locked = device.status === "locked";
  return (
    <button
      type="button"
      className={`btn btn-sm ${locked ? "btn-danger" : "btn-ghost"}`}
      disabled
      title="Locking is delivered to the agent over WebSocket; no REST command endpoint yet."
    >
      {locked ? "🔒 Locked" : "🔓 Unlocked"}
    </button>
  );
}

function AddChildModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Child) => void;
}) {
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [color, setColor] = useState("#7c6cff");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.children.create({
        name: name.trim(),
        birthYear: birthYear ? Number(birthYear) : undefined,
        avatarColor: color,
      });
      setName("");
      setBirthYear("");
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add child.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Add a child" onClose={onClose}>
      <form onSubmit={submit} className="form">
        {error ? (
          <div className="alert-box" role="alert">
            {error}
          </div>
        ) : null}
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Birth year (optional)</span>
            <input
              type="number"
              min={1990}
              max={2025}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g. 2014"
            />
          </label>
          <label className="field">
            <span className="field-label">Avatar color</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? "Adding…" : "Add child"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnrollModal({
  child,
  onClose,
  onEnrolled,
}: {
  child: Child | null;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("windows");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever the target child changes.
  useEffect(() => {
    setName("");
    setPlatform("windows");
    setCode(null);
    setExpiresAt(undefined);
    setError(null);
  }, [child?.id]);

  if (!child) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!child) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.devices.createEnrollCode({
        childId: child.id,
        name: name.trim(),
        platform,
      });
      setCode(res.enrollCode);
      setExpiresAt(res.expiresAt);
      onEnrolled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create an enroll code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!child} title={`Enroll a device for ${child.name}`} onClose={onClose}>
      {code ? (
        <div className="enroll-result">
          <p className="muted">Enter this code when running the Hearth agent on the device:</p>
          <div className="enroll-code">{code}</div>
          {expiresAt ? (
            <p className="muted small">Expires {relativeTime(expiresAt)}.</p>
          ) : null}
          <pre className="code-block">hearth-agent enroll --code {code}</pre>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="form">
          {error ? (
            <div className="alert-box" role="alert">
              {error}
            </div>
          ) : null}
          <label className="field">
            <span className="field-label">Device name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Living room PC"
              maxLength={80}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Platform</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? "Generating…" : "Generate enroll code"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

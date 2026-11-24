import { useEffect, useState, type FormEvent } from "react";
import type { Schedule, ScheduleType } from "@hearth/shared";
import { api, ApiError } from "../../api";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { DayPicker, describeDays } from "../../components/DayPicker";
import { TimeField } from "../../components/TimeField";
import { formatMinuteRange } from "../../format";

export function SchedulesTab({ childId }: { childId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await api.schedules.listForChild(childId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function remove(id: string) {
    const prev = schedules;
    setSchedules((s) => s.filter((x) => x.id !== id));
    try {
      await api.schedules.delete(id);
    } catch (err) {
      setSchedules(prev);
      setError(err instanceof ApiError ? err.message : "Failed to delete schedule.");
    }
  }

  async function addBedtimePreset() {
    setError(null);
    try {
      const created = await api.schedules.create({
        childId,
        name: "Bedtime lock",
        type: "lock",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startMinute: 21 * 60, // 21:00
        endMinute: 7 * 60, // 07:00 (wraps midnight)
        enabled: true,
      });
      setSchedules((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add preset.");
    }
  }

  if (loading) return <Spinner label="Loading schedules…" />;

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

      <section className="card">
        <div className="section-head">
          <h2 className="section-title">Schedules</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void addBedtimePreset()}>
            + Add bedtime lock 21:00–07:00
          </button>
        </div>

        {schedules.length === 0 ? (
          <p className="muted small">No schedules yet. Add one below.</p>
        ) : (
          <ul className="schedule-list">
            {schedules.map((s) => (
              <li key={s.id} className="schedule-row">
                <div className="schedule-main">
                  <span className="schedule-name">{s.name}</span>
                  <Badge tone={s.type === "lock" ? "locked" : "online"}>
                    {s.type === "lock" ? "Lock" : "Allowance"}
                  </Badge>
                  {!s.enabled ? <Badge tone="neutral">Disabled</Badge> : null}
                </div>
                <div className="schedule-desc muted">
                  {describeDays(s.daysOfWeek)} · {formatMinuteRange(s.startMinute, s.endMinute)}
                  {s.dailyQuotaMinutes != null
                    ? ` · quota ${Math.floor(s.dailyQuotaMinutes / 60)}h ${s.dailyQuotaMinutes % 60}m`
                    : ""}
                </div>
                <button type="button" className="link-btn danger" onClick={() => void remove(s.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddScheduleForm
        childId={childId}
        onAdded={(s) => setSchedules((prev) => [...prev, s])}
      />
    </div>
  );
}

function AddScheduleForm({
  childId,
  onAdded,
}: {
  childId: string;
  onAdded: (s: Schedule) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ScheduleType>("lock");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startMinute, setStartMinute] = useState(21 * 60);
  const [endMinute, setEndMinute] = useState(7 * 60);
  const [useQuota, setUseQuota] = useState(false);
  const [quotaMinutes, setQuotaMinutes] = useState(120);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.schedules.create({
        childId,
        name: name.trim(),
        type,
        daysOfWeek: days,
        startMinute,
        endMinute,
        dailyQuotaMinutes: useQuota ? quotaMinutes : undefined,
        enabled: true,
      });
      setName("");
      onAdded(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">New schedule</h2>
      <form className="form" onSubmit={submit}>
        {error ? (
          <div className="alert-box" role="alert">
            {error}
          </div>
        ) : null}
        <div className="form-row">
          <label className="field grow">
            <span className="field-label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bedtime lock"
              maxLength={80}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
              <option value="lock">Lock (device locked in window)</option>
              <option value="allowance">Allowance (usable only in window)</option>
            </select>
          </label>
        </div>

        <div className="field">
          <span className="field-label">Days</span>
          <DayPicker selected={days} onChange={setDays} />
        </div>

        <div className="form-row">
          <TimeField label="Start" minutes={startMinute} onChange={setStartMinute} />
          <TimeField label="End" minutes={endMinute} onChange={setEndMinute} />
        </div>
        {endMinute <= startMinute ? (
          <p className="muted small">This window wraps past midnight.</p>
        ) : null}

        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={useQuota}
              onChange={(e) => setUseQuota(e.target.checked)}
            />
            <span>Set a daily screen-time quota</span>
          </label>
          {useQuota ? (
            <label className="field">
              <span className="field-label">Quota (minutes)</span>
              <input
                type="number"
                min={0}
                max={1440}
                value={quotaMinutes}
                onChange={(e) => setQuotaMinutes(Number(e.target.value))}
              />
            </label>
          ) : null}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? "Adding…" : "Add schedule"}
          </button>
        </div>
      </form>
    </section>
  );
}

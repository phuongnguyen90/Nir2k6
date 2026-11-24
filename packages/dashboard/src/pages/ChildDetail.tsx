import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Child } from "@hearth/shared";
import { api, ApiError } from "../api";
import { Spinner } from "../components/Spinner";
import { RulesTab } from "./child/RulesTab";
import { SchedulesTab } from "./child/SchedulesTab";
import { AlertsTab } from "./child/AlertsTab";

type Tab = "rules" | "schedules" | "alerts";

const TABS: { id: Tab; label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "schedules", label: "Schedules" },
  { id: "alerts", label: "Alerts" },
];

export function ChildDetail() {
  const { childId = "" } = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rules");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.children
      .get(childId)
      .then((c) => {
        if (!cancelled) setChild(c);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Failed to load this child.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (error || !child) {
    return (
      <div className="page">
        <div className="alert-box" role="alert">
          {error ?? "Child not found."}
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
        <span>{child.name}</span>
      </div>

      <div className="page-head">
        <div className="child-head">
          <span
            className="avatar avatar-lg"
            style={{ background: child.avatarColor || "var(--accent)" }}
            aria-hidden="true"
          >
            {child.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1>{child.name}</h1>
            {child.birthYear ? <p className="muted">Born {child.birthYear}</p> : null}
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {tab === "rules" ? <RulesTab childId={child.id} /> : null}
        {tab === "schedules" ? <SchedulesTab childId={child.id} /> : null}
        {tab === "alerts" ? <AlertsTab childId={child.id} /> : null}
      </div>
    </div>
  );
}

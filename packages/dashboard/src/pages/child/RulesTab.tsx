import { useEffect, useState, type FormEvent } from "react";
import type { Rule, RuleKind, RuleAction, ContentCategory } from "@hearth/shared";
import { api, ApiError } from "../../api";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { CATEGORY_LABEL } from "../../format";

const CATEGORIES: ContentCategory[] = [
  "adult",
  "gambling",
  "violence",
  "drugs",
  "social",
  "games",
  "video",
  "malware",
  "custom",
  "unknown",
];

interface Group {
  key: string;
  title: string;
  kind: RuleKind;
  action: RuleAction;
  patternPlaceholder: string;
}

const GROUPS: Group[] = [
  {
    key: "blocked-web",
    title: "Blocked websites",
    kind: "domain",
    action: "block",
    patternPlaceholder: "e.g. *.example.com",
  },
  {
    key: "allowed-web",
    title: "Allowed websites",
    kind: "domain",
    action: "allow",
    patternPlaceholder: "e.g. wikipedia.org",
  },
  {
    key: "blocked-apps",
    title: "Blocked apps",
    kind: "app",
    action: "block",
    patternPlaceholder: "e.g. steam.exe",
  },
];

export function RulesTab({ childId }: { childId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRules(await api.rules.listForChild(childId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  async function removeRule(id: string) {
    const prev = rules;
    setRules((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await api.rules.delete(id);
    } catch (err) {
      setRules(prev); // rollback
      setError(err instanceof ApiError ? err.message : "Failed to delete rule.");
    }
  }

  if (loading) return <Spinner label="Loading rules…" />;

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

      {GROUPS.map((group) => {
        const groupRules = rules.filter(
          (r) => r.kind === group.kind && r.action === group.action,
        );
        return (
          <section key={group.key} className="card">
            <h2 className="section-title">{group.title}</h2>
            {groupRules.length === 0 ? (
              <p className="muted small">None yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{group.kind === "app" ? "App" : "Domain"}</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {groupRules.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.pattern}</td>
                      <td>
                        {r.category ? (
                          <Badge tone="neutral">{CATEGORY_LABEL[r.category]}</Badge>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td className="muted small">{r.note || "—"}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="link-btn danger"
                          onClick={() => void removeRule(r.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AddRuleForm
              group={group}
              childId={childId}
              onAdded={(rule) => setRules((prev) => [...prev, rule])}
            />
          </section>
        );
      })}
    </div>
  );
}

function AddRuleForm({
  group,
  childId,
  onAdded,
}: {
  group: Group;
  childId: string;
  onAdded: (rule: Rule) => void;
}) {
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<ContentCategory | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const rule = await api.rules.create({
        childId,
        kind: group.kind,
        action: group.action,
        pattern: pattern.trim(),
        category: category || undefined,
        note: note.trim() || undefined,
      });
      setPattern("");
      setCategory("");
      setNote("");
      onAdded(rule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      {error ? (
        <div className="alert-box small" role="alert">
          {error}
        </div>
      ) : null}
      <div className="inline-form-row">
        <input
          className="grow"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={group.patternPlaceholder}
          maxLength={255}
          required
          aria-label={`${group.title} pattern`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ContentCategory | "")}
          aria-label="Category"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          maxLength={255}
          aria-label="Note"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !pattern.trim()}>
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

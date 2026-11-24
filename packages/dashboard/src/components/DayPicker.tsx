// Weekday multi-select. Days are 0=Sun..6=Sat to match the shared Schedule contract.

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface DayPickerProps {
  selected: number[];
  onChange: (days: number[]) => void;
}

export function DayPicker({ selected, onChange }: DayPickerProps) {
  const toggle = (day: number) => {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <div className="day-picker" role="group" aria-label="Days of week">
      {DAY_LABELS.map((label, day) => (
        <button
          key={day}
          type="button"
          className={`day-chip ${selected.includes(day) ? "day-chip-on" : ""}`}
          aria-pressed={selected.includes(day)}
          onClick={() => toggle(day)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Human-readable summary of selected days, e.g. "every day", "weekdays", "Mon, Wed". */
export function describeDays(days: number[]): string {
  const set = [...days].sort((a, b) => a - b);
  if (set.length === 7) return "every day";
  if (set.length === 5 && [1, 2, 3, 4, 5].every((d) => set.includes(d))) return "weekdays";
  if (set.length === 2 && set.includes(0) && set.includes(6)) return "weekends";
  if (set.length === 0) return "no days";
  return set.map((d) => DAY_LABELS[d]).join(", ");
}

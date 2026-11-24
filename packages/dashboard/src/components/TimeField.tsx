// Converts between an <input type="time"> (HH:MM) value and minutes-since-midnight (0..1439).

export function minutesToHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
}

interface TimeFieldProps {
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
}

export function TimeField({ label, minutes, onChange }: TimeFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="time"
        value={minutesToHHMM(minutes)}
        onChange={(e) => onChange(hhmmToMinutes(e.target.value))}
        required
      />
    </label>
  );
}

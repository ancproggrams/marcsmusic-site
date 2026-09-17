export function MetricCard({
  label,
  value,
  note
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <article className="card metric">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {note ? <p className="muted">{note}</p> : null}
    </article>
  );
}

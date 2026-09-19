import Card from "./Card";

export default function MetricCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
  accent = "var(--primary)",
}: {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        >
          <Icon size={15} style={{ color: accent }} strokeWidth={2} />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      {change && (
        <p
          className="text-xs mt-1 font-medium"
          style={{ color: positive === false ? "var(--danger)" : "var(--success)" }}
        >
          {change}
        </p>
      )}
    </Card>
  );
}

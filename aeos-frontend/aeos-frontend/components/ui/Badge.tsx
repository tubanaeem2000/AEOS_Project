type BadgeTone = "success" | "warning" | "danger" | "neutral" | "primary";

const toneStyles: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  success: { bg: "var(--success-soft)", fg: "var(--success)", dot: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)", dot: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)", dot: "var(--danger)" },
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)", dot: "var(--primary)" },
  neutral: { bg: "var(--surface)", fg: "var(--text-secondary)", dot: "var(--text-muted)" },
};

export default function Badge({
  tone = "neutral",
  children,
  dot = true,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const s = toneStyles[tone];
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {children}
    </span>
  );
}

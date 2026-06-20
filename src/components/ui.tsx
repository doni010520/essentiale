import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-5 shadow-card", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "bg-brand-light text-brand",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accent)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="tnum text-2xl font-bold leading-tight text-ink">{value}</p>
        <p className="truncate text-xs text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "bg-gray-100 text-ink hover:bg-gray-200",
    danger: "bg-danger text-white hover:bg-red-600",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: "Conectado", cls: "bg-success-bg text-green-700" },
    connecting: { label: "Conectando", cls: "bg-amber-100 text-amber-700" },
    pending: { label: "Pendente", cls: "bg-gray-100 text-gray-600" },
    disconnected: { label: "Desconectado", cls: "bg-red-100 text-red-700" },
    error: { label: "Erro", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-gray-300 bg-surface/50 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

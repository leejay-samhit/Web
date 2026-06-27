export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[color:var(--sc-accent-light)] grid place-items-center mb-4">
          <Icon size={26} className="text-[color:var(--sc-primary)]" />
        </div>
      )}
      <h3 className="font-extrabold text-lg text-[color:var(--sc-ink)]">{title}</h3>
      {hint && <p className="text-sm text-[color:var(--sc-ink-muted)] mt-1 max-w-md">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

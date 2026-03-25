export function EmptyState({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[32px] border border-dashed border-[color:var(--line)] bg-white/65 p-10 text-center shadow-[0_16px_50px_rgba(108,91,69,0.08)]">
      <h3 className="font-display text-2xl text-[color:var(--foreground)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--muted)]">
        {description}
      </p>
    </div>
  )
}

export function QueryState({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[28px] border border-[color:var(--line)] bg-white/80 px-5 py-4 text-sm text-[color:var(--muted)]">
      <div className="font-semibold text-[color:var(--foreground)]">{title}</div>
      <div className="mt-1 leading-6">{description}</div>
    </div>
  )
}

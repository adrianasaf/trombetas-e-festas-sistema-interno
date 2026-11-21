import type { ReactNode } from 'react'

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-muted-foreground">{children}</div>}
      {action}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Label } from './label'

/** Rótulo + controle + ajuda/erro, com ids ligados para leitores de tela. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string
  label: string
  error?: string | null
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
      {message}
    </p>
  )
}

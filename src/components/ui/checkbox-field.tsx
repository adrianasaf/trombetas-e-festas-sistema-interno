import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Caixa de seleção nativa com área de toque de 44 px. */
export function CheckboxField({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 py-2', className)}>
      <input type="checkbox" className="mt-0.5 size-6 shrink-0 accent-[var(--navy)]" {...props} />
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  )
}

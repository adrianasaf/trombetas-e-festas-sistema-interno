import * as React from 'react'
import { cn } from '@/lib/utils'

/** Select nativo: melhor experiência em celular e leitores de tela. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'

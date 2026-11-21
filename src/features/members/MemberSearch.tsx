import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface MemberOption {
  id: string
  full_name: string
  group: { name: string } | null
  church: { name: string } | null
}

/** Busca de membro por nome (debounce), dentro do escopo do usuário (RLS). */
export function MemberSearch({
  id,
  value,
  onChange,
  onlyActive = true,
}: {
  id: string
  value: MemberOption | null
  onChange: (m: MemberOption | null) => void
  onlyActive?: boolean
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const results = useQuery({
    queryKey: ['member-search', debounced, onlyActive],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      let q = supabase
        .from('members')
        .select('id, full_name, group:assistance_groups(name), church:churches(name)')
        .ilike('full_name', `%${debounced.replace(/[%_,()]/g, ' ')}%`)
        .order('full_name')
        .limit(15)
      if (onlyActive) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as MemberOption[]
    },
  })

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border bg-secondary px-3 py-2">
        <span>
          <strong>{value.full_name}</strong>
          <span className="block text-sm text-muted-foreground">
            {value.group?.name} · {value.church?.name}
          </span>
        </span>
        <button
          type="button"
          className="min-h-11 rounded px-3 text-sm font-semibold underline"
          onClick={() => onChange(null)}
        >
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="search"
        autoComplete="off"
        placeholder="Digite pelo menos 2 letras do nome do membro…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-describedby={`${id}-results`}
      />
      <ul
        id={`${id}-results`}
        className={cn('max-h-64 overflow-y-auto rounded-md border bg-card', !debounced && 'hidden')}
      >
        {results.isLoading && <li className="p-3 text-sm text-muted-foreground">Buscando…</li>}
        {results.data?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">Nenhum membro encontrado.</li>
        )}
        {results.data?.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-secondary"
              onClick={() => {
                onChange(m)
                setTerm('')
              }}
            >
              <span className="font-medium">{m.full_name}</span>
              <span className="text-sm text-muted-foreground">
                {m.group?.name} · {m.church?.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

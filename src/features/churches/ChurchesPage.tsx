import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { translateError } from '@/lib/errors'
import { numberFmt } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useChurchOverview, type ChurchOverview } from './churchQueries'

export function ChurchesPage() {
  const { isAdmin } = useScope()
  const overview = useChurchOverview()
  const [editing, setEditing] = useState<ChurchOverview | 'new' | null>(null)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Igrejas"
        description="Igrejas do Polo Torre. Igrejas com histórico nunca são excluídas, apenas inativadas."
        actions={
          isAdmin && (
            <Button size="lg" onClick={() => setEditing('new')}>
              Nova igreja
            </Button>
          )
        }
      />
      {overview.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}
      {overview.error && (
        <p role="alert" className="text-destructive">
          {translateError(overview.error)}
        </p>
      )}
      {overview.data?.length === 0 && (
        <EmptyState title="Nenhuma igreja no seu escopo">
          Peça à coordenação para atribuir uma igreja ao seu usuário.
        </EmptyState>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.data?.map((c) => (
          <Card key={c.id} className={c.active ? '' : 'opacity-70'}>
            <CardContent className="flex h-full flex-col gap-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/igrejas/${c.id}`} className="text-lg font-bold hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">{c.city || 'Cidade não informada'}</div>
                </div>
                {!c.active && <Badge variant="destructive">Inativa</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted p-2">
                  <dt className="text-muted-foreground">Grupos ativos</dt>
                  <dd className="text-xl font-bold">{numberFmt.format(c.groups_active)}</dd>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <dt className="text-muted-foreground">Membros ativos</dt>
                  <dd className="text-xl font-bold">{numberFmt.format(c.members_active)}</dd>
                </div>
              </dl>
              <div className="mt-auto flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to={`/igrejas/${c.id}`}>Ver detalhes</Link>
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    Editar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && (
        <ChurchDialog church={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function ChurchDialog({ church, onClose }: { church: ChurchOverview | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(church?.name ?? '')
  const [city, setCity] = useState(church?.city ?? '')
  const [address, setAddress] = useState(church?.address ?? '')
  const [active, setActive] = useState(church?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), city: city.trim(), address: address.trim() || null, active }
      const { error } = church
        ? await supabase.from('churches').update(payload).eq('id', church.id)
        : await supabase.from('churches').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(church ? 'Igreja atualizada.' : 'Igreja cadastrada.')
      void qc.invalidateQueries({ queryKey: ['church-overview'] })
      void qc.invalidateQueries({ queryKey: ['churches'] })
      onClose()
    },
    onError: (e) => setError(translateError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Informe o nome da igreja.')
    if (church?.active && !active && !window.confirm('Inativar esta igreja? O histórico será preservado.'))
      return
    setError(null)
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{church ? 'Editar igreja' : 'Nova igreja'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="ch-name" label="Nome" required>
            <Input id="ch-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="ch-city" label="Cidade">
            <Input id="ch-city" value={city} maxLength={120} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field id="ch-address" label="Endereço" hint="Opcional">
            <Input
              id="ch-address"
              value={address}
              maxLength={300}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <CheckboxField
            label="Igreja ativa"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

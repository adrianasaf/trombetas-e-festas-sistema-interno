import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useChurches, useGroups } from '@/features/shared/queries'
import { translateError } from '@/lib/errors'
import { ROLE_LABELS, type AppRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

interface ManageableUser {
  id: string
  full_name: string
  email: string
  active: boolean
  last_sign_in_at: string | null
  invited_at: string | null
}

interface Assignment {
  id: string
  user_id: string
  role: AppRole
  church_id: string | null
  group_id: string | null
  church: { name: string } | null
  group: { name: string } | null
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Fortaleza',
})

export function UsersPage() {
  const { isAdmin, profile, assignments: myAssignments } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addFor, setAddFor] = useState<ManageableUser | null>(null)

  const users = useQuery({
    queryKey: ['manageable-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_manageable_users')
      if (error) throw error
      return (data ?? []) as ManageableUser[]
    },
  })
  const assignments = useQuery({
    queryKey: ['role-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_assignments')
        .select(
          'id, user_id, role, church_id, group_id, church:churches(name), group:assistance_groups(name)',
        )
      if (error) throw error
      return (data ?? []) as unknown as Assignment[]
    },
  })

  const byUser = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const a of assignments.data ?? []) {
      map.set(a.user_id, [...(map.get(a.user_id) ?? []), a])
    }
    return map
  }, [assignments.data])

  const managedChurchIds = useMemo(
    () => myAssignments.filter((a) => a.role === 'church_manager').map((a) => a.church_id as string),
    [myAssignments],
  )

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('role_assignments').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para remover este perfil.')
    },
    onSuccess: () => {
      toast.success('Perfil removido.')
      void qc.invalidateQueries({ queryKey: ['role-assignments'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })

  const resendInvite = useMutation({
    mutationFn: async (u: ManageableUser) => {
      const { data, error } = await supabase.functions.invoke('convidar-usuario', {
        body: { action: 'reenviar', email: u.email, redirect_to: window.location.origin },
      })
      if (error) {
        let message = translateError(error)
        try {
          const ctx = (error as { context?: Response }).context
          const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
          if (body?.error) message = body.error
        } catch {
          /* mantém a mensagem genérica */
        }
        throw new Error(message)
      }
      return (data as { message?: string })?.message ?? 'Convite reenviado.'
    },
    onSuccess: (message) => {
      toast.success(message)
      void qc.invalidateQueries({ queryKey: ['manageable-users'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const toggleActive = useMutation({
    mutationFn: async (u: ManageableUser) => {
      const { error } = await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Situação do usuário atualizada.')
      void qc.invalidateQueries({ queryKey: ['manageable-users'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })

  const loading = users.isLoading || assignments.isLoading
  const error = users.error || assignments.error

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Usuários e permissões"
        description={
          isAdmin
            ? 'Convide pessoas e defina o que cada uma pode acessar.'
            : 'Convide pessoas da sua igreja e defina o que cada uma pode acessar.'
        }
        actions={
          <Button onClick={() => setInviteOpen(true)} size="lg">
            Convidar usuário
          </Button>
        }
      />

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {translateError(error)}
        </p>
      )}
      {!loading && !error && (users.data?.length ?? 0) === 0 && (
        <EmptyState title="Nenhum usuário ainda">Convide a primeira pessoa usando o botão acima.</EmptyState>
      )}

      <div className="space-y-3">
        {(users.data ?? []).map((u) => {
          const list = byUser.get(u.id) ?? []
          const isMe = u.id === profile?.id
          return (
            <Card key={u.id}>
              <CardContent className="flex flex-col gap-3 pt-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.full_name || '(nome não informado)'}</span>
                    {!u.active && <Badge variant="destructive">Desativado</Badge>}
                    {!u.last_sign_in_at && u.invited_at && <Badge variant="warning">Convite pendente</Badge>}
                    {isMe && <Badge variant="secondary">Você</Badge>}
                  </div>
                  <div className="break-all text-sm text-muted-foreground">{u.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.last_sign_in_at
                      ? `Último acesso: ${dateFmt.format(new Date(u.last_sign_in_at))}`
                      : 'Ainda não acessou'}
                  </div>
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {list.length === 0 && (
                      <li className="text-sm text-muted-foreground">Sem perfil atribuído</li>
                    )}
                    {list.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-3 pr-1 text-sm"
                      >
                        <span>
                          {ROLE_LABELS[a.role]}
                          {a.group ? ` · ${a.group.name}` : a.church ? ` · ${a.church.name}` : ''}
                          {a.role === 'reader' && !a.church ? ' · Polo' : ''}
                        </span>
                        {!isMe && (
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-destructive/15"
                            aria-label={`Remover perfil ${ROLE_LABELS[a.role]}`}
                            onClick={() => {
                              if (window.confirm(`Remover o perfil "${ROLE_LABELS[a.role]}" de ${u.email}?`))
                                removeAssignment.mutate(a.id)
                            }}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddFor(u)}>
                    Adicionar perfil
                  </Button>
                  {!isMe && u.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resendInvite.isPending}
                      onClick={() => {
                        const msg = u.last_sign_in_at
                          ? `${u.email} já acessou o sistema. Enviar um link para definir nova senha?`
                          : `Reenviar o convite para ${u.email}? O link anterior deixa de valer.`
                        if (window.confirm(msg)) resendInvite.mutate(u)
                      }}
                    >
                      {u.last_sign_in_at ? 'Reenviar acesso' : 'Reenviar convite'}
                    </Button>
                  )}
                  {isAdmin && !isMe && (
                    <Button
                      variant={u.active ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        const verb = u.active ? 'Desativar' : 'Reativar'
                        if (window.confirm(`${verb} o acesso de ${u.email}?`)) toggleActive.mutate(u)
                      }}
                    >
                      {u.active ? 'Desativar' : 'Reativar'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <InviteDialog
        open={inviteOpen || addFor !== null}
        presetEmail={addFor?.email}
        onClose={() => {
          setInviteOpen(false)
          setAddFor(null)
        }}
        isAdmin={isAdmin}
        managedChurchIds={managedChurchIds}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ['manageable-users'] })
          void qc.invalidateQueries({ queryKey: ['role-assignments'] })
        }}
      />
    </div>
  )
}

function InviteDialog({
  open,
  presetEmail,
  onClose,
  isAdmin,
  managedChurchIds,
  onDone,
}: {
  open: boolean
  presetEmail?: string
  onClose: () => void
  isAdmin: boolean
  managedChurchIds: string[]
  onDone: () => void
}) {
  const churches = useChurches()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<AppRole>('group_leader')
  const [churchId, setChurchId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = useGroups(churchId || null)

  const roleOptions: AppRole[] = isAdmin
    ? ['polo_admin', 'church_manager', 'group_leader', 'reception', 'reader']
    : ['church_manager', 'group_leader', 'reader']
  const churchOptions = (churches.data ?? []).filter((c) => isAdmin || managedChurchIds.includes(c.id))
  const needsChurch = role === 'church_manager' || role === 'group_leader' || (role === 'reader' && !isAdmin)
  const allowsChurch = needsChurch || role === 'reader'
  const needsGroup = role === 'group_leader'
  const targetEmail = presetEmail ?? email

  function reset() {
    setEmail('')
    setFullName('')
    setRole('group_leader')
    setChurchId('')
    setGroupId('')
    setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail.trim())) return setError('Informe um e-mail válido.')
    if (needsChurch && !churchId) return setError('Escolha a igreja.')
    if (needsGroup && !groupId) return setError('Escolha o grupo de assistência.')
    setSubmitting(true)
    const { data, error } = await supabase.functions.invoke('convidar-usuario', {
      body: {
        email: targetEmail.trim(),
        full_name: fullName.trim(),
        role,
        church_id: allowsChurch && churchId ? churchId : null,
        group_id: needsGroup ? groupId : null,
        redirect_to: `${window.location.origin}/definir-senha?tipo=convite`,
      },
    })
    setSubmitting(false)
    if (error) {
      let message = translateError(error)
      try {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json()
          if (body?.error) message = body.error
        }
      } catch {
        /* mantém a mensagem genérica */
      }
      setError(message)
      return
    }
    toast.success((data as { message?: string })?.message ?? 'Convite enviado.')
    reset()
    onDone()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{presetEmail ? 'Adicionar perfil' : 'Convidar usuário'}</DialogTitle>
          <DialogDescription>
            {presetEmail
              ? `Novo perfil para ${presetEmail}.`
              : 'A pessoa receberá um e-mail com o link para criar a senha.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {!presetEmail && (
            <>
              <div className="space-y-2">
                <Label htmlFor="inv-email">E-mail</Label>
                <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-name">Nome completo</Label>
                <Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="inv-role">Perfil</Label>
            <NativeSelect
              id="inv-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as AppRole)
                setGroupId('')
              }}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {allowsChurch && (
            <div className="space-y-2">
              <Label htmlFor="inv-church">Igreja</Label>
              <NativeSelect
                id="inv-church"
                value={churchId}
                onChange={(e) => {
                  setChurchId(e.target.value)
                  setGroupId('')
                }}
              >
                <option value="">
                  {role === 'reader' && isAdmin ? 'Polo inteiro (todas as igrejas)' : 'Selecione…'}
                </option>
                {churchOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {needsGroup && (
            <div className="space-y-2">
              <Label htmlFor="inv-group">Grupo de assistência</Label>
              <NativeSelect
                id="inv-group"
                value={groupId}
                disabled={!churchId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">{churchId ? 'Selecione…' : 'Escolha a igreja primeiro'}</option>
                {(groups.data ?? [])
                  .filter((g) => g.active)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          )}
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{roleHelp(role)}</p>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : presetEmail ? 'Adicionar' : 'Enviar convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function roleHelp(role: AppRole): string {
  switch (role) {
    case 'polo_admin':
      return 'Acesso total: todas as igrejas, metas, eventos, configurações, usuários e auditoria.'
    case 'church_manager':
      return 'Gerencia grupos, membros, convidados e transporte da igreja; revisa duplicidades e desmarca presença.'
    case 'group_leader':
      return 'Gerencia membros e convidados do grupo de assistência.'
    case 'reception':
      return 'Opera o check-in do evento ativo: busca, marca presença e cadastra na chegada. Vê telefones mascarados.'
    case 'reader':
      return 'Vê apenas dashboards e relatórios com números agregados, sem nomes ou telefones de convidados.'
  }
}

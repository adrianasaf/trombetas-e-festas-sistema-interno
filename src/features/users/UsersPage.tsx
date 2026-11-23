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
import { generateTempPassword, validateNewPassword } from '@/features/auth/password'
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

/** Chama a função de contas no servidor e devolve a mensagem (ou lança o erro em português). */
async function callAccounts(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('convidar-usuario', { body })
  if (error) {
    let message = translateError(error)
    try {
      const ctx = (error as { context?: Response }).context
      const payload = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
      if (payload?.error) message = payload.error
    } catch {
      /* mantém a mensagem genérica */
    }
    throw new Error(message)
  }
  return (data as { message?: string })?.message ?? 'Pronto.'
}

export function UsersPage() {
  const { isAdmin, profile, assignments: myAssignments } = useAuth()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [addFor, setAddFor] = useState<ManageableUser | null>(null)
  const [passwordFor, setPasswordFor] = useState<ManageableUser | null>(null)

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
    for (const a of assignments.data ?? []) map.set(a.user_id, [...(map.get(a.user_id) ?? []), a])
    return map
  }, [assignments.data])

  const managedChurchIds = useMemo(
    () => myAssignments.filter((a) => a.role === 'church_manager').map((a) => a.church_id as string),
    [myAssignments],
  )

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['manageable-users'] })
    void qc.invalidateQueries({ queryKey: ['role-assignments'] })
  }

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('role_assignments').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para remover este perfil.')
    },
    onSuccess: () => {
      toast.success('Perfil removido.')
      refresh()
    },
    onError: (e) => toast.error(translateError(e)),
  })

  const toggleActive = useMutation({
    mutationFn: async (u: ManageableUser) => {
      const { error } = await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Situação do usuário atualizada.')
      refresh()
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
            ? 'Crie as contas com e-mail e senha inicial. No primeiro acesso, cada pessoa cria a própria senha.'
            : 'As contas são criadas pelo Administrador do Polo. Aqui você dá perfis da sua igreja a quem já tem conta.'
        }
        actions={
          isAdmin && (
            <Button onClick={() => setCreating(true)} size="lg">
              Criar conta
            </Button>
          )
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
        <EmptyState title="Ninguém por aqui ainda">
          {isAdmin
            ? 'Crie a primeira conta pelo botão acima.'
            : 'Peça ao Administrador do Polo para criar as contas.'}
        </EmptyState>
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
                    {!u.last_sign_in_at && <Badge variant="warning">Nunca acessou</Badge>}
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
                        className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-3 text-sm"
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
                  {isAdmin && !isMe && (
                    <Button variant="outline" size="sm" onClick={() => setPasswordFor(u)}>
                      Definir nova senha
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

      {(creating || addFor) && (
        <AccountDialog
          presetEmail={addFor?.email}
          onClose={() => {
            setCreating(false)
            setAddFor(null)
          }}
          isAdmin={isAdmin}
          managedChurchIds={managedChurchIds}
          onDone={refresh}
        />
      )}
      {passwordFor && <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />}
    </div>
  )
}

/** Mostra e-mail e senha inicial para o Admin repassar, com botão de copiar. */
function CredentialsBox({ email, password }: { email: string; password: string }) {
  const text = `Sistema Trombetas e Festas\nEndereço: ${window.location.origin}\nE-mail: ${email}\nSenha inicial: ${password}\nNo primeiro acesso, você vai criar a sua própria senha.`
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted p-4 text-sm">
        <div>
          E-mail: <strong className="break-all">{email}</strong>
        </div>
        <div>
          Senha inicial: <strong className="num tracking-wider">{password}</strong>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Repasse esses dados à pessoa por um canal privado (por exemplo, mensagem direta). No primeiro acesso
        ela será obrigada a criar a própria senha. Esta senha não será mostrada de novo.
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            toast.success('Dados copiados.')
          } catch {
            toast.error('Não foi possível copiar. Anote os dados acima.')
          }
        }}
      >
        Copiar dados de acesso
      </Button>
    </div>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="acc-pass">Senha inicial</Label>
      <div className="flex gap-2">
        <Input
          id="acc-pass"
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="num"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => onChange(generateTempPassword())}>
          Gerar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
    </div>
  )
}

function PasswordDialog({ user, onClose }: { user: ManageableUser; onClose: () => void }) {
  const [password, setPassword] = useState(generateTempPassword)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const save = useMutation({
    mutationFn: () => callAccounts({ action: 'definir_senha', user_id: user.id, password }),
    onSuccess: () => setDone(true),
    onError: (e) => setError((e as Error).message),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Definir nova senha</DialogTitle>
          <DialogDescription>
            {user.full_name || user.email}. A senha atual deixa de valer e a pessoa cria outra no próximo
            acesso.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <CredentialsBox email={user.email} password={password} />
            <DialogFooter>
              <Button onClick={onClose}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              const problem = validateNewPassword(password, password)
              if (problem) return setError(problem)
              setError(null)
              save.mutate()
            }}
          >
            <PasswordField value={password} onChange={setPassword} />
            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : 'Definir senha'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Criar conta (Admin: e-mail + nome + senha inicial + perfil) ou adicionar perfil a quem já tem conta. */
function AccountDialog({
  presetEmail,
  onClose,
  isAdmin,
  managedChurchIds,
  onDone,
}: {
  presetEmail?: string
  onClose: () => void
  isAdmin: boolean
  managedChurchIds: string[]
  onDone: () => void
}) {
  const creating = !presetEmail
  const churches = useChurches()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generateTempPassword)
  const [role, setRole] = useState<AppRole>('group_leader')
  const [churchId, setChurchId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const groups = useGroups(churchId || null)

  const roleOptions: AppRole[] = isAdmin
    ? ['polo_admin', 'church_manager', 'group_leader', 'reception', 'reader']
    : ['church_manager', 'group_leader', 'reader']
  const churchOptions = (churches.data ?? []).filter((c) => isAdmin || managedChurchIds.includes(c.id))
  const needsChurch = role === 'church_manager' || role === 'group_leader' || (role === 'reader' && !isAdmin)
  const allowsChurch = needsChurch || role === 'reader'
  const needsGroup = role === 'group_leader'
  const targetEmail = (presetEmail ?? email).trim().toLowerCase()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) return setError('Informe um e-mail válido.')
    if (creating && fullName.trim().length < 3) return setError('Informe o nome completo.')
    if (creating) {
      const problem = validateNewPassword(password, password)
      if (problem) return setError(problem)
    }
    if (needsChurch && !churchId) return setError('Escolha a igreja.')
    if (needsGroup && !groupId) return setError('Escolha o grupo de assistência.')
    setSubmitting(true)
    try {
      const message = await callAccounts({
        action: creating ? 'criar' : 'perfil',
        email: targetEmail,
        full_name: fullName.trim(),
        password: creating ? password : undefined,
        role,
        church_id: allowsChurch && churchId ? churchId : null,
        group_id: needsGroup ? groupId : null,
      })
      onDone()
      if (creating) {
        toast.success(message)
        setCreated({ email: targetEmail, password })
      } else {
        toast.success(message)
        onClose()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {creating ? (created ? 'Conta criada' : 'Criar conta') : 'Adicionar perfil'}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? created
                ? 'A conta já está ativa.'
                : 'Nenhum e-mail é enviado. Você repassa o e-mail e a senha inicial à pessoa.'
              : `Novo perfil para ${presetEmail}.`}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <>
            <CredentialsBox email={created.email} password={created.password} />
            <DialogFooter>
              <Button onClick={onClose}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {creating && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="acc-email">E-mail</Label>
                  <Input
                    id="acc-email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-name">Nome completo</Label>
                  <Input
                    id="acc-name"
                    autoComplete="off"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <PasswordField value={password} onChange={setPassword} />
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="acc-role">Perfil</Label>
              <NativeSelect
                id="acc-role"
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
                <Label htmlFor="acc-church">Igreja</Label>
                <NativeSelect
                  id="acc-church"
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
                <Label htmlFor="acc-group">Grupo de assistência</Label>
                <NativeSelect
                  id="acc-group"
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
              <p
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando…' : creating ? 'Criar conta' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        )}
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

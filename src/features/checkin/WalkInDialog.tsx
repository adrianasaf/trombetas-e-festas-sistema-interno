import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useChurches } from '@/features/shared/queries'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CONSENT_LABEL_ADULT,
  CONSENT_LABEL_MINOR,
  isMinor,
  type GuestCategory,
} from '@/features/guests/labels'
import { translateError } from '@/lib/errors'
import { formatTime } from '@/lib/format'
import { normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { checkinQueue, newRequestId, rpcWalkIn, type WalkInInput } from './checkinApi'
import { isNetworkError } from './offlineQueue'

interface MemberHit {
  member_id: string
  full_name: string
  group_name: string
  church_id: string
  church_name: string
}

const NO_MEMBER = '__sem_membro__'

/** Cadastro mínimo na chegada + presença (seção 11). */
export function WalkInDialog({
  initialName,
  initialPhone,
  onClose,
  onDone,
}: {
  initialName: string
  initialPhone: string
  onClose: () => void
  onDone: (ok: boolean) => void
}) {
  const churches = useChurches()
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [category, setCategory] = useState<GuestCategory | ''>('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [memberTerm, setMemberTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [member, setMember] = useState<MemberHit | typeof NO_MEMBER | null>(null)
  const [churchId, setChurchId] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const minor = isMinor(category)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(memberTerm.trim()), 250)
    return () => clearTimeout(t)
  }, [memberTerm])

  const members = useQuery({
    queryKey: ['walkin-members', debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_members_for_walkin', { p_query: debounced })
      if (error) throw error
      return (data ?? []) as MemberHit[]
    },
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (fullName.trim().length < 3) return setError('Informe o nome completo.')
    if (!category) return setError('Escolha a categoria.')
    if (phone.trim() && !normalizePhone(phone)) return setError('Telefone inválido.')
    if (!minor && !phone.trim())
      return setError('Informe o telefone (ou, se for criança/adolescente, o do responsável).')
    if (minor && (guardianName.trim().length < 3 || !normalizePhone(guardianPhone)))
      return setError('Informe nome e telefone do responsável legal.')
    if (!member) return setError('Informe o membro que convidou ou escolha “Sem membro identificado”.')
    if (member === NO_MEMBER && !churchId) return setError('Sem membro identificado: escolha a igreja.')
    if (!consent)
      return setError(minor ? 'Registre o consentimento do responsável legal.' : 'Registre o consentimento.')
    setError(null)
    setSending(true)
    const input: WalkInInput = {
      fullName,
      category,
      consent,
      phone,
      memberId: member === NO_MEMBER ? null : member.member_id,
      churchId: member === NO_MEMBER ? churchId : member.church_id,
      guardianName,
      guardianPhone,
    }
    const requestId = newRequestId()
    try {
      const r = await rpcWalkIn(input, requestId)
      toast.success(
        `${fullName.trim()} cadastrado(a). Presença registrada às ${formatTime(r.checked_in_at)}.`,
      )
      onDone(true)
      onClose()
    } catch (err) {
      if (isNetworkError(err)) {
        await checkinQueue.enqueue({
          id: requestId,
          kind: 'walk_in',
          label: fullName.trim(),
          payload: { ...input },
        })
        toast.warning('Sem internet: cadastro guardado e aguardando envio.')
        onDone(false)
        onClose()
      } else {
        setError(translateError(err))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar e marcar presença</DialogTitle>
          <DialogDescription>Cadastro rápido para quem chegou e não estava na lista.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="wi-name" label="Nome completo" required>
            <Input
              id="wi-name"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field id="wi-cat" label="Categoria" required>
            <NativeSelect
              id="wi-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as GuestCategory)}
            >
              <option value="">Selecione…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="wi-phone"
            label="Telefone"
            required={!minor}
            hint={minor ? 'Opcional para menores.' : undefined}
          >
            <Input
              id="wi-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          {minor && (
            <div className="grid gap-3 rounded-md border border-gold/60 bg-accent/40 p-3 sm:grid-cols-2">
              <Field id="wi-gname" label="Responsável legal" required>
                <Input id="wi-gname" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
              </Field>
              <Field id="wi-gphone" label="Telefone do responsável" required>
                <Input
                  id="wi-gphone"
                  type="tel"
                  inputMode="tel"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                />
              </Field>
            </div>
          )}
          <Field id="wi-member" label="Membro que convidou" required>
            {member && member !== NO_MEMBER ? (
              <div className="flex min-h-11 items-center justify-between rounded-md border bg-secondary px-3">
                <span>
                  <strong>{member.full_name}</strong> · {member.group_name} · {member.church_name}
                </span>
                <button
                  type="button"
                  className="min-h-11 px-2 text-sm font-semibold underline"
                  onClick={() => setMember(null)}
                >
                  Trocar
                </button>
              </div>
            ) : member === NO_MEMBER ? (
              <div className="space-y-2">
                <div className="flex min-h-11 items-center justify-between rounded-md border bg-secondary px-3">
                  <span>Sem membro identificado</span>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm font-semibold underline"
                    onClick={() => setMember(null)}
                  >
                    Trocar
                  </button>
                </div>
                <NativeSelect
                  aria-label="Igreja"
                  value={churchId}
                  onChange={(e) => setChurchId(e.target.value)}
                >
                  <option value="">Escolha a igreja…</option>
                  {(churches.data ?? [])
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Entra nos totais do Polo e da igreja, mas não nas metas individuais.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  id="wi-member"
                  type="search"
                  autoComplete="off"
                  placeholder="Buscar pelo nome do membro…"
                  value={memberTerm}
                  onChange={(e) => setMemberTerm(e.target.value)}
                />
                <ul className="max-h-52 overflow-y-auto rounded-md border bg-card">
                  {members.data?.map((m) => (
                    <li key={m.member_id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-col items-start px-3 py-1 text-left hover:bg-secondary"
                        onClick={() => setMember(m)}
                      >
                        <span className="font-medium">{m.full_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {m.group_name} · {m.church_name}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="min-h-11 w-full px-3 text-left font-semibold hover:bg-secondary"
                      onClick={() => setMember(NO_MEMBER)}
                    >
                      Sem membro identificado
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </Field>
          <CheckboxField
            label={minor ? CONSENT_LABEL_MINOR : CONSENT_LABEL_ADULT}
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <FormError message={error} />
          <Button
            type="submit"
            size="xl"
            className="w-full bg-success text-white hover:bg-success/90"
            disabled={sending}
          >
            {sending ? 'Registrando…' : 'Cadastrar e marcar presença ✓'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

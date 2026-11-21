import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent } from '@/features/events/EventProvider'
import { translateError } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import { EMPTY_GUEST, validateGuest } from './guestFormModel'
import { createGuest, invalidateGuestQueries, useGuests } from './guestQueries'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CONSENT_LABEL_ADULT,
  CONSENT_LABEL_MINOR,
  MODE_LABEL,
  inviteStatusLabel,
  isMinor,
  type GuestCategory,
} from './labels'

interface Row {
  key: number
  fullName: string
  phone: string
  category: GuestCategory | ''
  guardianName: string
  guardianPhone: string
  consent: boolean
  error: string | null
}

const INITIAL_ROWS = 5
let seq = 0
const newRow = (): Row => ({
  key: ++seq,
  fullName: '',
  phone: '',
  category: '',
  guardianName: '',
  guardianPhone: '',
  consent: false,
  error: null,
})
const isBlank = (r: Row) => !r.fullName.trim() && !r.phone.trim()

/** Seção da ficha do membro: convidados já cadastrados + 5 linhas de cadastro rápido (seção 7). */
export function MemberGuestsSection({ memberId, memberActive }: { memberId: string; memberActive: boolean }) {
  const qc = useQueryClient()
  const { current, readOnly } = useEvent()
  const guests = useGuests({ eventId: current?.id ?? null, memberId })
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, newRow))
  const [saving, setSaving] = useState(false)
  const canAdd = !readOnly && memberActive && current?.status !== 'encerrado'

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: null } : r)))

  async function saveAll() {
    const filled = rows.filter((r) => !isBlank(r))
    if (!filled.length) {
      toast.info('Preencha pelo menos uma linha.')
      return
    }
    setSaving(true)
    let ok = 0
    let dup = 0
    const next: Row[] = []
    for (const r of rows) {
      if (isBlank(r)) {
        next.push(r)
        continue
      }
      const values = { ...EMPTY_GUEST, ...r, category: r.category }
      const problem = validateGuest(values, { requireConsent: true })
      if (problem) {
        next.push({ ...r, error: problem })
        continue
      }
      try {
        const res = await createGuest({
          ...values,
          category: r.category as GuestCategory,
          memberId,
          inviteStatus: 'convidado',
        })
        ok++
        if (res.possible_duplicate) dup++
      } catch (e) {
        next.push({ ...r, error: translateError(e) })
      }
    }
    while (next.length < INITIAL_ROWS) next.push(newRow())
    setRows(next)
    setSaving(false)
    invalidateGuestQueries(qc)
    if (ok)
      toast.success(
        `${ok} convidado(s) cadastrado(s).${dup ? ` ${dup} enviado(s) para revisão de duplicidade.` : ''}`,
      )
    if (next.some((r) => r.error)) toast.error('Algumas linhas têm problemas. Corrija e salve de novo.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convidados deste membro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!current && <p className="text-muted-foreground">Nenhuma edição do evento cadastrada.</p>}
        {guests.isLoading && <Skeleton className="h-16" />}
        {guests.data?.length === 0 && (
          <p className="text-muted-foreground">Nenhum convidado ainda — cadastre o primeiro abaixo.</p>
        )}
        {!!guests.data?.length && (
          <ul className="divide-y rounded-md border">
            {guests.data.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/convidados/${g.id}`}
                  className="flex min-h-12 flex-col justify-center gap-1 px-3 py-2 hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {g.full_name}
                    {g.possible_duplicate && <Badge variant="warning">Possível duplicidade</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {CATEGORY_LABEL[g.category]} · {MODE_LABEL[g.mode]} ·{' '}
                    {inviteStatusLabel(g.invite_status, g.mode)}
                    {g.phone_normalized ? ` · ${formatPhone(g.phone_normalized)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {canAdd && (
          <div className="space-y-3">
            <h3 className="font-semibold">Cadastro rápido</h3>
            <p className="text-sm text-muted-foreground">
              Preencha uma linha por convidado. Detalhes como modalidade e transporte podem ser completados
              depois na ficha do convidado.
            </p>
            {rows.map((r, i) => {
              const minor = isMinor(r.category)
              return (
                <fieldset key={r.key} className="space-y-2 rounded-md border p-3">
                  <legend className="px-1 text-sm font-semibold">Convidado {i + 1}</legend>
                  <div className="grid gap-2 sm:grid-cols-[2fr_1.3fr_1.3fr]">
                    <Input
                      aria-label={`Nome do convidado ${i + 1}`}
                      placeholder="Nome completo"
                      value={r.fullName}
                      maxLength={150}
                      onChange={(e) => update(r.key, { fullName: e.target.value })}
                    />
                    <Input
                      aria-label={`Telefone do convidado ${i + 1}`}
                      placeholder={minor ? 'Telefone (opcional)' : 'Telefone com DDD'}
                      type="tel"
                      inputMode="tel"
                      value={r.phone}
                      onChange={(e) => update(r.key, { phone: e.target.value })}
                    />
                    <NativeSelect
                      aria-label={`Categoria do convidado ${i + 1}`}
                      value={r.category}
                      onChange={(e) => update(r.key, { category: e.target.value as GuestCategory })}
                    >
                      <option value="">Categoria…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  {minor && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        aria-label={`Responsável legal do convidado ${i + 1}`}
                        placeholder="Nome do responsável legal"
                        value={r.guardianName}
                        onChange={(e) => update(r.key, { guardianName: e.target.value })}
                      />
                      <Input
                        aria-label={`Telefone do responsável do convidado ${i + 1}`}
                        placeholder="Telefone do responsável"
                        type="tel"
                        inputMode="tel"
                        value={r.guardianPhone}
                        onChange={(e) => update(r.key, { guardianPhone: e.target.value })}
                      />
                    </div>
                  )}
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-6 shrink-0 accent-[var(--navy)]"
                      checked={r.consent}
                      onChange={(e) => update(r.key, { consent: e.target.checked })}
                    />
                    <span>{minor ? CONSENT_LABEL_MINOR : CONSENT_LABEL_ADULT}</span>
                  </label>
                  {r.error && (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {r.error}
                    </p>
                  )}
                </fieldset>
              )
            })}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, newRow()])}>
                + Adicionar mais
              </Button>
              <Button
                type="button"
                size="lg"
                className="sm:ml-auto"
                disabled={saving}
                onClick={() => void saveAll()}
              >
                {saving ? 'Salvando…' : 'Salvar convidados'}
              </Button>
            </div>
          </div>
        )}
        {!memberActive && (
          <p className="text-sm text-muted-foreground">
            Membro inativo: novos convites não podem ser cadastrados.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

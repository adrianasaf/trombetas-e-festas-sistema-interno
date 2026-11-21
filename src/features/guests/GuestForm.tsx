import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CONSENT_LABEL_ADULT,
  CONSENT_LABEL_MINOR,
  INVITE_STATUSES,
  INVITE_STATUS_LABEL,
  MODES,
  MODE_LABEL,
  NOTES_MAX,
  TRANSPORTS,
  TRANSPORT_LABEL,
  isMinor,
  type GuestCategory,
  type InviteStatus,
  type ParticipationMode,
  type TransportNeed,
} from './labels'
import { validateGuest, type GuestFormValues } from './guestFormModel'

export function GuestForm({
  initial,
  isEdit,
  submitting,
  serverError,
  onSubmit,
  onCancel,
  idPrefix = 'gf',
}: {
  initial: GuestFormValues
  isEdit: boolean
  submitting: boolean
  serverError: string | null
  onSubmit: (values: GuestFormValues) => void
  onCancel: () => void
  idPrefix?: string
}) {
  const [v, setV] = useState<GuestFormValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof GuestFormValues>(k: K, value: GuestFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))
  const minor = isMinor(v.category)
  const id = (s: string) => `${idPrefix}-${s}`

  function submit(e: FormEvent) {
    e.preventDefault()
    const problem = validateGuest(v, { requireConsent: !isEdit })
    setError(problem)
    if (!problem) onSubmit(v)
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id={id('name')} label="Nome completo" required>
        <Input
          id={id('name')}
          autoComplete="off"
          maxLength={150}
          value={v.fullName}
          onChange={(e) => set('fullName', e.target.value)}
        />
      </Field>
      <Field id={id('category')} label="Categoria" required>
        <NativeSelect
          id={id('category')}
          value={v.category}
          onChange={(e) => set('category', e.target.value as GuestCategory)}
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
        id={id('phone')}
        label="Telefone"
        required={!minor}
        hint={minor ? 'Opcional para criança/adolescente (usa o telefone do responsável).' : 'Com DDD.'}
      >
        <Input
          id={id('phone')}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(83) 98765-4321"
          value={v.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </Field>
      {minor && (
        <fieldset className="space-y-3 rounded-md border border-gold/60 bg-accent/40 p-3">
          <legend className="px-1 text-sm font-semibold">Responsável legal (obrigatório)</legend>
          <Field id={id('gname')} label="Nome do responsável" required>
            <Input
              id={id('gname')}
              maxLength={150}
              value={v.guardianName}
              onChange={(e) => set('guardianName', e.target.value)}
            />
          </Field>
          <Field id={id('gphone')} label="Telefone do responsável" required>
            <Input
              id={id('gphone')}
              type="tel"
              inputMode="tel"
              placeholder="(83) 98765-4321"
              value={v.guardianPhone}
              onChange={(e) => set('guardianPhone', e.target.value)}
            />
          </Field>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('mode')} label="Modalidade" required>
          <NativeSelect
            id={id('mode')}
            value={v.mode}
            onChange={(e) => set('mode', e.target.value as ParticipationMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {v.mode !== 'online' && (
          <Field id={id('transport')} label="Transporte" required>
            <NativeSelect
              id={id('transport')}
              value={v.transport}
              onChange={(e) => set('transport', e.target.value as TransportNeed)}
            >
              {TRANSPORTS.map((t) => (
                <option key={t} value={t}>
                  {TRANSPORT_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <Field id={id('status')} label="Situação do convite" required>
        <NativeSelect
          id={id('status')}
          value={v.inviteStatus}
          onChange={(e) => set('inviteStatus', e.target.value as InviteStatus)}
        >
          {INVITE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'confirmou' && v.mode === 'online'
                ? 'Confirmou participação online'
                : INVITE_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div>
        <span className="text-sm font-semibold">Marcação especial</span>
        <div className="flex flex-wrap gap-x-6">
          <CheckboxField
            label="Autoridade"
            checked={v.isAuthority}
            onChange={(e) => set('isAuthority', e.target.checked)}
          />
          <CheckboxField
            label="Pastor de outra igreja"
            checked={v.isPastor}
            onChange={(e) => set('isPastor', e.target.checked)}
          />
        </div>
      </div>
      <Field
        id={id('notes')}
        label="Observações"
        hint={`Opcional. ${v.notes.length}/${NOTES_MAX} caracteres.`}
      >
        <textarea
          id={id('notes')}
          rows={3}
          maxLength={NOTES_MAX}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
          value={v.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>
      {!isEdit && (
        <div className="rounded-md border-2 border-navy/20 bg-secondary/60 px-3">
          <CheckboxField
            label={minor ? CONSENT_LABEL_MINOR : CONSENT_LABEL_ADULT}
            description="Obrigatório. A data, a hora e o seu usuário ficam registrados."
            checked={v.consent}
            onChange={(e) => set('consent', e.target.checked)}
          />
        </div>
      )}
      <FormError message={error ?? serverError} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar convidado'}
        </Button>
      </div>
    </form>
  )
}

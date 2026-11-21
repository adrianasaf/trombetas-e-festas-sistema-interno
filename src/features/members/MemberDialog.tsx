import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { translateError } from '@/lib/errors'
import { todayIso } from '@/lib/format'
import { formatPhone, normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { GroupPicker } from './GroupPicker'
import { invalidateMemberQueries, type Member } from './memberQueries'

/** Cadastro e edição. A transferência de grupo é feita em TransferDialog (gera histórico). */
export function MemberDialog({
  member,
  defaultGroupId,
  onClose,
  onCreated,
}: {
  member: Member | null
  defaultGroupId?: string
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const qc = useQueryClient()
  const [fullName, setFullName] = useState(member?.full_name ?? '')
  const [groupId, setGroupId] = useState(member?.group_id ?? defaultGroupId ?? '')
  const [phone, setPhone] = useState(member?.phone_normalized ? formatPhone(member.phone_normalized) : '')
  const [joinedAt, setJoinedAt] = useState(member?.joined_at ?? todayIso())
  const [active, setActive] = useState(member?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (member) {
        const { error } = await supabase.from('members').update(payload).eq('id', member.id)
        if (error) throw error
        return member.id
      }
      const { data, error } = await supabase.from('members').insert(payload).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      toast.success(member ? 'Membro atualizado.' : 'Membro cadastrado.')
      invalidateMemberQueries(qc)
      if (!member) onCreated?.(id)
      onClose()
    },
    onError: (e) => setError(translateError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (fullName.trim().length < 3) return setError('Informe o nome completo.')
    if (!member && !groupId) return setError('Escolha o grupo de assistência.')
    let phoneNormalized: string | null = null
    if (phone.trim()) {
      phoneNormalized = normalizePhone(phone)
      if (!phoneNormalized) return setError('Telefone inválido. Use DDD + número, ex.: (83) 98765-4321.')
    }
    if (
      member?.active &&
      !active &&
      !window.confirm('Inativar este membro? Convites e presenças serão mantidos.')
    )
      return
    setError(null)
    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      phone_normalized: phoneNormalized,
      joined_at: joinedAt,
      active,
      inactivated_at: active ? null : (member?.inactivated_at ?? todayIso()),
    }
    // church_id não é enviado: o gatilho members_before_write copia a igreja do grupo.
    if (!member) payload.group_id = groupId
    save.mutate(payload)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? 'Editar membro' : 'Novo membro'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="mb-name" label="Nome completo" required>
            <Input
              id="mb-name"
              autoComplete="off"
              value={fullName}
              maxLength={150}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          {!member && (
            <Field id="mb-group" label="Grupo de assistência" required hint="A igreja vem do grupo.">
              <GroupPicker id="mb-group" value={groupId} onChange={setGroupId} />
            </Field>
          )}
          {member && (
            <p className="rounded-md bg-muted p-3 text-sm">
              Grupo atual: <strong>{member.group?.name}</strong> ({member.church?.name}). Para mudar, use
              “Transferir”.
            </p>
          )}
          <Field id="mb-phone" label="Telefone" hint="Opcional. Com DDD.">
            <Input
              id="mb-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(83) 98765-4321"
            />
          </Field>
          <Field id="mb-joined" label="Data de entrada">
            <Input
              id="mb-joined"
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
            />
          </Field>
          <CheckboxField
            label="Membro ativo"
            description="Inativar não apaga convites nem presenças."
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

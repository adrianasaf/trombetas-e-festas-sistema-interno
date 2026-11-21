import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { MemberSearch, type MemberOption } from '@/features/members/MemberSearch'
import { translateError } from '@/lib/errors'
import { normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { GuestForm } from './GuestForm'
import { EMPTY_GUEST, guestToFormValues, type GuestFormValues } from './guestFormModel'
import { createGuest, invalidateGuestQueries, type Guest } from './guestQueries'
import { isMinor } from './labels'

/** Cadastro (a partir de um membro) ou edição de convidado. */
export function GuestDialog({
  guest,
  member: fixedMember,
  onClose,
  onCreated,
}: {
  guest: Guest | null
  member?: MemberOption | null
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const qc = useQueryClient()
  const [member, setMember] = useState<MemberOption | null>(fixedMember ?? null)
  const [serverError, setServerError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async (v: GuestFormValues) => {
      if (guest) {
        const minor = isMinor(v.category)
        const { error } = await supabase
          .from('guests')
          .update({
            full_name: v.fullName.trim(),
            phone_normalized: v.phone.trim() ? normalizePhone(v.phone) : null,
            category: v.category,
            is_authority: v.isAuthority,
            is_other_church_pastor: v.isPastor,
            mode: v.mode,
            transport: v.mode === 'online' ? null : v.transport,
            invite_status: v.inviteStatus,
            notes: v.notes.trim() || null,
            guardian_name: minor ? v.guardianName.trim() : null,
            guardian_phone: minor ? normalizePhone(v.guardianPhone) : null,
          })
          .eq('id', guest.id)
        if (error) throw error
        return { id: guest.id, possible_duplicate: false }
      }
      if (!member) throw new Error('Escolha o membro que fez o convite.')
      return createGuest({ ...v, category: v.category as never, memberId: member.id })
    },
    onSuccess: (r) => {
      invalidateGuestQueries(qc)
      if (guest) toast.success('Convidado atualizado.')
      else if (r.possible_duplicate)
        toast.warning(
          'Convidado cadastrado. Ele parece com outro registro e foi enviado para revisão de duplicidade.',
        )
      else toast.success('Convidado cadastrado.')
      if (!guest) onCreated?.(r.id)
      onClose()
    },
    onError: (e) => setServerError(translateError(e)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{guest ? 'Editar convidado' : 'Novo convidado'}</DialogTitle>
          <DialogDescription>
            {guest
              ? 'Igreja, grupo e membro do convite não mudam por aqui (use “Reatribuir crédito”).'
              : 'Igreja e grupo são copiados do membro que convidou.'}
          </DialogDescription>
        </DialogHeader>
        {!guest && !fixedMember && (
          <div className="mb-4">
            <Field id="gd-member" label="Membro que convidou" required>
              <MemberSearch id="gd-member" value={member} onChange={setMember} />
            </Field>
          </div>
        )}
        <GuestForm
          initial={guest ? guestToFormValues(guest) : EMPTY_GUEST}
          isEdit={!!guest}
          submitting={save.isPending}
          serverError={serverError}
          onSubmit={(v) => {
            setServerError(null)
            if (!guest && !member) return setServerError('Escolha o membro que fez o convite.')
            save.mutate(v)
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

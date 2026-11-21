import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { translateError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { GroupPicker } from './GroupPicker'
import { invalidateMemberQueries, type Member } from './memberQueries'

export function TransferDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient()
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const transfer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .update({ group_id: groupId })
        .eq('id', member.id)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para transferir este membro.')
    },
    onSuccess: () => {
      toast.success('Membro transferido. O histórico foi registrado.')
      invalidateMemberQueries(qc)
      onClose()
    },
    onError: (e) => setError(translateError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!groupId) return setError('Escolha o novo grupo.')
    setError(null)
    transfer.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir membro</DialogTitle>
          <DialogDescription>
            {member.full_name} sai de <strong>{member.group?.name}</strong> ({member.church?.name}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="tr-group" label="Novo grupo de assistência" required>
            <GroupPicker
              id="tr-group"
              value={groupId}
              onChange={setGroupId}
              excludeGroupId={member.group_id}
            />
          </Field>
          <p className="rounded-md bg-accent p-3 text-sm text-accent-foreground">
            Os convidados já cadastrados continuam contando para o grupo e a igreja de origem. Novos convites
            passam a contar para o novo grupo.
          </p>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={transfer.isPending}>
              {transfer.isPending ? 'Transferindo…' : 'Transferir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

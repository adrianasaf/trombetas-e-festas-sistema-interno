import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useScope } from '@/features/auth/scope'
import { useChurches } from '@/features/shared/queries'
import { translateError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { GroupOverview } from './groupQueries'

export function GroupDialog({
  group,
  defaultChurchId,
  onClose,
}: {
  group: GroupOverview | null
  defaultChurchId?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const scope = useScope()
  const churches = useChurches()
  const [churchId, setChurchId] = useState(group?.church_id ?? defaultChurchId ?? '')
  const [name, setName] = useState(group?.name ?? '')
  const [leader, setLeader] = useState(group?.leader_name ?? '')
  const [assistant, setAssistant] = useState(group?.assistant_leader_name ?? '')
  const [active, setActive] = useState(group?.active ?? true)
  const [error, setError] = useState<string | null>(null)

  const churchOptions = (churches.data ?? []).filter((c) => c.active && scope.canManageChurch(c.id))

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        leader_name: leader.trim(),
        assistant_leader_name: assistant.trim() || null,
        active,
      }
      const { error } = group
        ? await supabase.from('assistance_groups').update(payload).eq('id', group.id)
        : await supabase.from('assistance_groups').insert({ ...payload, church_id: churchId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(group ? 'Grupo atualizado.' : 'Grupo cadastrado.')
      void qc.invalidateQueries({ queryKey: ['group-overview'] })
      void qc.invalidateQueries({ queryKey: ['groups'] })
      void qc.invalidateQueries({ queryKey: ['church-overview'] })
      onClose()
    },
    onError: (e) => {
      const msg = translateError(e)
      setError(msg.startsWith('Já existe') ? 'Já existe um grupo com este nome nesta igreja.' : msg)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!group && !churchId) return setError('Escolha a igreja.')
    if (name.trim().length < 2) return setError('Informe o nome do grupo.')
    if (group?.active && !active && !window.confirm('Inativar este grupo? O histórico será preservado.'))
      return
    setError(null)
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? 'Editar grupo de assistência' : 'Novo grupo de assistência'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            id="gr-church"
            label="Igreja"
            required
            hint={group ? 'Um grupo não muda de igreja; crie outro e transfira os membros.' : undefined}
          >
            <NativeSelect
              id="gr-church"
              value={churchId}
              disabled={!!group}
              onChange={(e) => setChurchId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {(group ? (churches.data ?? []) : churchOptions).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="gr-name" label="Nome do grupo" required hint="Precisa ser único dentro da igreja.">
            <Input id="gr-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="gr-leader" label="Responsável">
            <Input
              id="gr-leader"
              value={leader}
              maxLength={150}
              onChange={(e) => setLeader(e.target.value)}
            />
          </Field>
          <Field id="gr-assistant" label="Responsável auxiliar" hint="Opcional">
            <Input
              id="gr-assistant"
              value={assistant}
              maxLength={150}
              onChange={(e) => setAssistant(e.target.value)}
            />
          </Field>
          <CheckboxField label="Grupo ativo" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <p className="text-sm text-muted-foreground">
            Para o responsável acessar o sistema, convide-o em “Usuários e permissões” com o perfil
            Responsável de Grupo.
          </p>
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

import { NativeSelect } from '@/components/ui/native-select'
import { useScope } from '@/features/auth/scope'
import { useChurches, useGroups } from '@/features/shared/queries'

/** Seleção de grupo agrupada por igreja, limitada aos grupos que o usuário pode gerenciar. */
export function GroupPicker({
  id,
  value,
  onChange,
  excludeGroupId,
  disabled,
}: {
  id: string
  value: string
  onChange: (groupId: string) => void
  excludeGroupId?: string
  disabled?: boolean
}) {
  const scope = useScope()
  const churches = useChurches()
  const groups = useGroups()
  const allowed = (groups.data ?? []).filter(
    (g) => g.active && g.id !== excludeGroupId && scope.canManageGroup(g),
  )
  const byChurch = (churches.data ?? [])
    .map((c) => ({ church: c, groups: allowed.filter((g) => g.church_id === c.id) }))
    .filter((x) => x.groups.length > 0)

  return (
    <NativeSelect id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{groups.isLoading ? 'Carregando…' : 'Selecione o grupo…'}</option>
      {byChurch.map(({ church, groups: list }) => (
        <optgroup key={church.id} label={church.name}>
          {list.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  )
}

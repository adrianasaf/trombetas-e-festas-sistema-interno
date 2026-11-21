import { NativeSelect } from '@/components/ui/native-select'
import { useEvent } from './EventProvider'

const STATUS_LABEL = { planejamento: 'planejamento', ativo: 'ativo', encerrado: 'encerrado' } as const

export function EventSelector() {
  const { events, current, setCurrentId } = useEvent()
  if (events.length <= 1) return null
  return (
    <div className="max-w-56">
      <label htmlFor="evento-sel" className="sr-only">
        Edição do evento
      </label>
      <NativeSelect
        id="evento-sel"
        className="min-h-10 py-1 text-sm"
        value={current?.id ?? ''}
        onChange={(e) => setCurrentId(e.target.value)}
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({STATUS_LABEL[e.status]})
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}

export function ReadOnlyBanner() {
  const { current, readOnly, active } = useEvent()
  if (!current) {
    return (
      <div role="status" className="no-print border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
        Nenhuma edição do evento cadastrada. O Administrador do Polo cria a edição em Configurações.
      </div>
    )
  }
  if (readOnly) {
    return (
      <div role="status" className="no-print border-b bg-muted px-4 py-2 text-sm">
        Você está consultando <strong>{current.name}</strong>, edição encerrada — somente leitura.
        {active && ' Use o seletor no topo para voltar à edição ativa.'}
      </div>
    )
  }
  if (!active) {
    return (
      <div role="status" className="no-print border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
        Nenhuma edição está ativa. Cadastros de convidados e check-in ficam disponíveis quando o Administrador
        ativar o evento em Configurações.
      </div>
    )
  }
  return null
}

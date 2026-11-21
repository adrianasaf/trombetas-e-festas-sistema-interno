import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Field, FormError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { useEvent, type EventRow, type EventStatus } from '@/features/events/EventProvider'
import { translateError } from '@/lib/errors'
import { formatDateTime, fromLocalInput, toLocalInput } from '@/lib/format'
import { supabase } from '@/lib/supabase'

const STATUS_LABEL: Record<EventStatus, string> = {
  planejamento: 'Planejamento',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
}

export function SettingsPage({ retentionSlot }: { retentionSlot?: (event: EventRow) => ReactNode }) {
  const { events, current, setCurrentId } = useEvent()
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Configurações"
        description="Edições do evento, metas, data de corte, logomarca e retenção de dados."
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            Nova edição
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Edições do evento</CardTitle>
          <CardDescription>
            Apenas uma edição pode estar ativa. Edições encerradas ficam somente leitura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 && (
            <p className="text-muted-foreground">Nenhuma edição cadastrada. Crie a primeira.</p>
          )}
          <ul className="divide-y rounded-md border">
            {events.map((e) => (
              <li key={e.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <strong>{e.name}</strong> ({e.year}){' '}
                  <Badge
                    variant={
                      e.status === 'ativo' ? 'success' : e.status === 'encerrado' ? 'secondary' : 'gold'
                    }
                  >
                    {STATUS_LABEL[e.status]}
                  </Badge>
                </span>
                <Button
                  size="sm"
                  variant={current?.id === e.id ? 'secondary' : 'outline'}
                  onClick={() => setCurrentId(e.id)}
                >
                  {current?.id === e.id ? 'Selecionada' : 'Selecionar'}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && <EventForm event={null} onDone={() => setCreating(false)} />}
      {current && !creating && (
        <>
          <EventForm key={current.id} event={current} onDone={() => undefined} />
          <SnapshotCard event={current} />
          <LogoCard event={current} />
          <EventSettingsCard event={current} />
          {retentionSlot?.(current)}
        </>
      )}
    </div>
  )
}

function EventForm({ event, onDone }: { event: EventRow | null; onDone: () => void }) {
  const qc = useQueryClient()
  const { setCurrentId } = useEvent()
  const [name, setName] = useState(event?.name ?? 'Trombetas e Festas')
  const [year, setYear] = useState(String(event?.year ?? new Date().getFullYear()))
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.starts_at))
  const [location, setLocation] = useState(event?.location ?? '')
  const [streamUrl, setStreamUrl] = useState(event?.stream_url ?? '')
  const [goalInv, setGoalInv] = useState(String(event?.invites_goal_per_member ?? 3))
  const [goalAtt, setGoalAtt] = useState(String(event?.attendance_goal_per_member ?? 1))
  const [cutoff, setCutoff] = useState(toLocalInput(event?.cutoff_at))
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'planejamento')
  const [error, setError] = useState<string | null>(null)
  const readOnly = event?.status === 'encerrado'

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        year: Number(year),
        starts_at: fromLocalInput(startsAt),
        location: location.trim() || null,
        stream_url: streamUrl.trim() || null,
        invites_goal_per_member: Number(goalInv),
        attendance_goal_per_member: Number(goalAtt),
        cutoff_at: fromLocalInput(cutoff),
        status,
      }
      if (event) {
        const { error } = await supabase.from('events').update(payload).eq('id', event.id)
        if (error) throw error
        return event.id
      }
      const { data, error } = await supabase.from('events').insert(payload).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      toast.success(event ? 'Edição atualizada.' : 'Edição criada.')
      void qc.invalidateQueries({ queryKey: ['events'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      if (!event) setCurrentId(id)
      onDone()
    },
    onError: (e) => {
      const msg = translateError(e)
      setError(
        msg.startsWith('Já existe')
          ? 'Já existe outra edição ativa. Encerre-a ou volte-a para planejamento antes.'
          : msg,
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const y = Number(year)
    const gi = Number(goalInv)
    const ga = Number(goalAtt)
    if (name.trim().length < 2) return setError('Informe o nome da edição.')
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return setError('Ano inválido.')
    if (!Number.isInteger(gi) || gi < 0 || gi > 100 || !Number.isInteger(ga) || ga < 0 || ga > 100)
      return setError('As metas por membro devem ser números inteiros entre 0 e 100.')
    if (streamUrl.trim() && !/^https?:\/\//i.test(streamUrl.trim()))
      return setError('O link da transmissão deve começar com http:// ou https://.')
    if (event && status === 'encerrado' && event.status !== 'encerrado') {
      if (
        !window.confirm(
          'Encerrar esta edição? Ela ficará somente leitura e o snapshot das metas será gravado.',
        )
      )
        return
    }
    if (event && cutoff && fromLocalInput(cutoff)! <= new Date().toISOString() && !event.snapshot_taken_at) {
      if (!window.confirm('A data de corte já passou: o snapshot das metas será gravado agora. Continuar?'))
        return
    }
    setError(null)
    save.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{event ? `Editar: ${event.name}` : 'Nova edição'}</CardTitle>
        {readOnly && <CardDescription>Edição encerrada — somente leitura.</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field id="ev-name" label="Nome" required>
                <Input id="ev-name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field id="ev-year" label="Ano" required>
                <Input
                  id="ev-year"
                  type="number"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ev-starts" label="Data e hora do evento" hint="Horário de Fortaleza (UTC−3).">
                <Input
                  id="ev-starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>
              <Field id="ev-location" label="Local">
                <Input
                  id="ev-location"
                  value={location}
                  maxLength={300}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </Field>
            </div>
            <Field id="ev-stream" label="Link da transmissão" hint="Opcional.">
              <Input
                id="ev-stream"
                type="url"
                placeholder="https://"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ev-gi" label="Meta de convites por membro" required>
                <Input
                  id="ev-gi"
                  type="number"
                  min={0}
                  max={100}
                  value={goalInv}
                  onChange={(e) => setGoalInv(e.target.value)}
                />
              </Field>
              <Field id="ev-ga" label="Meta de presença por membro" required>
                <Input
                  id="ev-ga"
                  type="number"
                  min={0}
                  max={100}
                  value={goalAtt}
                  onChange={(e) => setGoalAtt(e.target.value)}
                />
              </Field>
            </div>
            <Field
              id="ev-cutoff"
              label="Data de corte das metas"
              hint="Até esta data, a meta usa os membros ativos ao vivo. Nela, a lista de membros é congelada (snapshot)."
            >
              <Input
                id="ev-cutoff"
                type="datetime-local"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
              />
            </Field>
            <Field id="ev-status" label="Situação" required>
              <NativeSelect
                id="ev-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
              >
                {(Object.keys(STATUS_LABEL) as EventStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </fieldset>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            {!event && (
              <Button type="button" variant="outline" onClick={onDone}>
                Cancelar
              </Button>
            )}
            {!readOnly && (
              <Button type="submit" size="lg" disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : event ? 'Salvar alterações' : 'Criar edição'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SnapshotCard({ event }: { event: EventRow }) {
  const qc = useQueryClient()
  const run = useMutation({
    mutationFn: async (replace: boolean) => {
      const { data, error } = await supabase.rpc('take_goal_snapshot_now', {
        p_event_id: event.id,
        p_replace: replace,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (n) => {
      toast.success(`Snapshot gravado com ${n} membros.`)
      void qc.invalidateQueries({ queryKey: ['events'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Snapshot das metas</CardTitle>
        <CardDescription>
          Membros inativados depois do corte continuam na meta; membros novos entram com meta zero, mas seus
          convites contam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>
          {event.snapshot_taken_at
            ? `Gravado em ${formatDateTime(event.snapshot_taken_at)}.`
            : event.cutoff_at
              ? `Será gravado automaticamente em ${formatDateTime(event.cutoff_at)}.`
              : 'Sem data de corte definida: a meta usa os membros ativos ao vivo.'}
        </p>
        {event.status !== 'encerrado' && (
          <div className="flex flex-wrap gap-2">
            {!event.snapshot_taken_at && (
              <Button
                variant="outline"
                disabled={run.isPending}
                onClick={() =>
                  window.confirm('Gravar o snapshot agora, congelando a lista de membros da meta?') &&
                  run.mutate(false)
                }
              >
                Gravar snapshot agora
              </Button>
            )}
            {event.snapshot_taken_at && (
              <Button
                variant="outline"
                disabled={run.isPending}
                onClick={() =>
                  window.confirm(
                    'Refazer o snapshot com a situação atual dos membros? A alteração é auditada.',
                  ) && run.mutate(true)
                }
              >
                Refazer snapshot
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg' }
const LOGO_MAX = 2 * 1024 * 1024

function LogoCard({ event }: { event: EventRow }) {
  const qc = useQueryClient()
  const { logoUrl } = useEvent()
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = LOGO_TYPES[file.type]
      if (!ext) throw new Error('Formato não aceito. Use PNG, SVG ou JPG.')
      if (file.size > LOGO_MAX) throw new Error('O arquivo passa de 2 MB.')
      const path = `${event.id}/logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('logos')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { error: e2 } = await supabase.from('events').update({ logo_path: path }).eq('id', event.id)
      if (e2) throw e2
      if (event.logo_path) await supabase.storage.from('logos').remove([event.logo_path])
    },
    onSuccess: () => {
      toast.success('Logomarca atualizada.')
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('events').update({ logo_path: null }).eq('id', event.id)
      if (error) throw error
      if (event.logo_path) await supabase.storage.from('logos').remove([event.logo_path])
    },
    onSuccess: () => {
      toast.success('Logomarca removida.')
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logomarca</CardTitle>
        <CardDescription>
          PNG, SVG ou JPG até 2 MB. Sem logo, o sistema mostra apenas o nome do evento — não usamos logomarca
          inventada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`Logomarca de ${event.name}`}
            className="h-20 w-auto rounded border bg-white p-2"
          />
        ) : (
          <p className="text-muted-foreground">Nenhuma logomarca enviada.</p>
        )}
        {event.status !== 'encerrado' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border bg-card px-4 font-semibold hover:bg-secondary">
              {upload.isPending ? 'Enviando…' : 'Enviar logomarca'}
              <input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                className="sr-only"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload.mutate(file)
                  e.target.value = ''
                }}
              />
            </label>
            {event.logo_path && (
              <Button variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remover
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface EventSettings {
  event_id: string
  retention_days: number
  checkin_sound_enabled: boolean
  anonymized_at: string | null
}

function EventSettingsCard({ event }: { event: EventRow }) {
  const qc = useQueryClient()
  const settings = useQuery({
    queryKey: ['event-settings', event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_settings')
        .select('event_id, retention_days, checkin_sound_enabled, anonymized_at')
        .eq('event_id', event.id)
        .maybeSingle()
      if (error) throw error
      return data as EventSettings | null
    },
  })
  if (!settings.data) return null
  return (
    <SettingsForm
      key={settings.data.event_id + settings.data.retention_days}
      data={settings.data}
      readOnly={event.status === 'encerrado'}
      onSaved={() => void qc.invalidateQueries({ queryKey: ['event-settings'] })}
    />
  )
}

function SettingsForm({
  data,
  readOnly,
  onSaved,
}: {
  data: EventSettings
  readOnly: boolean
  onSaved: () => void
}) {
  const [days, setDays] = useState(String(data.retention_days))
  const [sound, setSound] = useState(data.checkin_sound_enabled)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('event_settings')
        .update({ retention_days: Number(days), checkin_sound_enabled: sound })
        .eq('event_id', data.event_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Configurações salvas.')
      onSaved()
    },
    onError: (e) => setError(translateError(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-in e retenção de dados</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(days)
            if (!Number.isInteger(n) || n < 1 || n > 3650)
              return setError('Informe um prazo entre 1 e 3650 dias.')
            setError(null)
            save.mutate()
          }}
        >
          <CheckboxField
            label="Som de confirmação no check-in"
            description="Toca um aviso curto quando a presença é registrada."
            checked={sound}
            disabled={readOnly}
            onChange={(e) => setSound(e.target.checked)}
          />
          <Field
            id="st-days"
            label="Prazo para anonimização (dias após o encerramento)"
            hint="Padrão: 180 dias. Depois do prazo, o Administrador pode anonimizar nomes e telefones, preservando as estatísticas."
          >
            <Input
              id="st-days"
              type="number"
              min={1}
              max={3650}
              value={days}
              disabled={readOnly}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
          <div className="rounded-md bg-muted p-3 text-sm">
            <strong>Política de retenção:</strong> os dados pessoais dos convidados (nome, telefone e
            responsável) são usados só para o evento. Encerrada a edição e passado o prazo acima, o
            Administrador do Polo executa a anonimização: nomes e telefones são substituídos e as estatísticas
            permanecem. Pedidos do titular de exclusão ou anonimização são atendidos a qualquer momento.
          </div>
          <FormError message={error} />
          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

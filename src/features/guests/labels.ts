export const CATEGORIES = [
  'homem',
  'mulher',
  'crianca',
  'adolescente',
  'jovem_masculino',
  'jovem_feminino',
] as const
export type GuestCategory = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<GuestCategory, string> = {
  homem: 'Homem',
  mulher: 'Mulher',
  crianca: 'Criança',
  adolescente: 'Adolescente',
  jovem_masculino: 'Jovem masculino',
  jovem_feminino: 'Jovem feminino',
}
export const isMinor = (c: GuestCategory | '' | null | undefined) => c === 'crianca' || c === 'adolescente'

export const MODES = ['presencial', 'online', 'indefinido'] as const
export type ParticipationMode = (typeof MODES)[number]
export const MODE_LABEL: Record<ParticipationMode, string> = {
  presencial: 'Presencial',
  online: 'Online',
  indefinido: 'Indefinido',
}

export const TRANSPORTS = ['meios_proprios', 'precisa_transporte', 'indefinido'] as const
export type TransportNeed = (typeof TRANSPORTS)[number]
export const TRANSPORT_LABEL: Record<TransportNeed, string> = {
  meios_proprios: 'Meios próprios',
  precisa_transporte: 'Precisa de transporte',
  indefinido: 'Indefinido',
}

export const INVITE_STATUSES = ['nao_contatado', 'convidado', 'confirmou', 'nao_comparecera'] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  nao_contatado: 'Não contatado',
  convidado: 'Convidado',
  confirmou: 'Confirmou presença',
  nao_comparecera: 'Não poderá comparecer',
}

/** "Confirmou presença" + Online = confirmou participação online (seção 8). */
export function inviteStatusLabel(status: InviteStatus, mode: ParticipationMode): string {
  if (status === 'confirmou' && mode === 'online') return 'Confirmou participação online'
  return INVITE_STATUS_LABEL[status]
}

export const CONSENT_LABEL_ADULT =
  'O convidado autorizou o uso do nome e telefone para contato sobre o evento.'
export const CONSENT_LABEL_MINOR =
  'O responsável legal autorizou o uso do nome e telefone do menor para contato sobre o evento (LGPD, art. 14).'

export const NOTES_MAX = 500

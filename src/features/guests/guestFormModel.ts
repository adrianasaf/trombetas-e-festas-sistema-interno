import { formatPhone, normalizePhone } from '@/lib/phone'
import {
  NOTES_MAX,
  isMinor,
  type GuestCategory,
  type InviteStatus,
  type ParticipationMode,
  type TransportNeed,
} from './labels'

export interface GuestFormValues {
  fullName: string
  phone: string
  category: GuestCategory | ''
  isAuthority: boolean
  isPastor: boolean
  mode: ParticipationMode
  transport: TransportNeed
  inviteStatus: InviteStatus
  notes: string
  guardianName: string
  guardianPhone: string
  consent: boolean
}

export const EMPTY_GUEST: GuestFormValues = {
  fullName: '',
  phone: '',
  category: '',
  isAuthority: false,
  isPastor: false,
  mode: 'indefinido',
  transport: 'indefinido',
  inviteStatus: 'nao_contatado',
  notes: '',
  guardianName: '',
  guardianPhone: '',
  consent: false,
}

/** Valida no cliente as mesmas regras que o banco aplica (mensagens mais rápidas). */
export function validateGuest(
  v: GuestFormValues,
  { requireConsent }: { requireConsent: boolean },
): string | null {
  if (v.fullName.trim().length < 3) return 'Informe o nome completo do convidado.'
  if (!v.category) return 'Escolha a categoria.'
  const minor = isMinor(v.category)
  if (v.phone.trim() && !normalizePhone(v.phone)) return 'Telefone inválido. Use DDD + número.'
  if (!minor && !v.phone.trim()) return 'O telefone é obrigatório (exceto para criança e adolescente).'
  if (minor) {
    if (v.guardianName.trim().length < 3) return 'Informe o nome do responsável legal.'
    if (!normalizePhone(v.guardianPhone)) return 'Informe um telefone válido do responsável legal.'
  }
  if (v.notes.length > NOTES_MAX) return `As observações podem ter no máximo ${NOTES_MAX} caracteres.`
  if (requireConsent && !v.consent)
    return minor ? 'Registre o consentimento do responsável legal.' : 'Registre o consentimento do convidado.'
  return null
}

export function guestToFormValues(g: {
  full_name: string
  phone_normalized: string | null
  category: GuestCategory
  is_authority: boolean
  is_other_church_pastor: boolean
  mode: ParticipationMode
  transport: TransportNeed | null
  invite_status: InviteStatus
  notes: string | null
  guardian_name: string | null
  guardian_phone: string | null
}): GuestFormValues {
  return {
    fullName: g.full_name,
    phone: g.phone_normalized ? formatPhone(g.phone_normalized) : '',
    category: g.category,
    isAuthority: g.is_authority,
    isPastor: g.is_other_church_pastor,
    mode: g.mode,
    transport: g.transport ?? 'indefinido',
    inviteStatus: g.invite_status,
    notes: g.notes ?? '',
    guardianName: g.guardian_name ?? '',
    guardianPhone: g.guardian_phone ? formatPhone(g.guardian_phone) : '',
    consent: true,
  }
}

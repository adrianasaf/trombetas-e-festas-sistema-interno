/** DDD padrão do Polo Torre (Paraíba) quando o número é digitado sem DDD. */
export const DEFAULT_DDD = '83'

/**
 * Normaliza um telefone brasileiro para E.164 (+55DDNNNNNNNNN).
 * Retorna null se o número não for válido.
 * A mesma regra existe no banco (função public.normalize_phone) — mantenha as duas iguais.
 */
export function normalizePhone(input: string | null | undefined, defaultDdd = DEFAULT_DDD): string | null {
  if (!input) return null
  let digits = input.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2)
  // Zero de longa distância (ex.: 083 98765-4321)
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) digits = digits.slice(1)
  // Sem DDD: 8 (fixo) ou 9 (celular) dígitos
  if (digits.length === 8 || digits.length === 9) digits = defaultDdd + digits
  if (digits.length !== 10 && digits.length !== 11) return null
  const ddd = digits.slice(0, 2)
  if (ddd[0] === '0' || ddd[1] === '0') return null
  const local = digits.slice(2)
  if (local.length === 9 && local[0] !== '9') return null
  if (local.length === 8 && !/[2-5]/.test(local[0])) return null
  return `+55${digits}`
}

function localDigits(e164: string): string {
  return e164.replace(/\D/g, '').replace(/^55/, '')
}

/** Exibe "(83) 98765-4321" a partir do E.164. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const d = localDigits(e164)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return e164
}

/** Máscara para Recepção/Leitor: "(83) 9****-1234". */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const d = localDigits(e164)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]}****-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ****-${d.slice(6)}`
  return '****'
}

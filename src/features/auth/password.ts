export const MIN_PASSWORD_LENGTH = 8

/** Valida a nova senha. Retorna a mensagem de erro ou null. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.'
  if (password !== confirmation) return 'As senhas não conferem.'
  return null
}

/** Senha inicial gerada para o Administrador repassar (sem caracteres ambíguos como 0/O, 1/l/I). */
export function generateTempPassword(length = 10): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = letters + digits
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chars = [pick(letters), pick(digits)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

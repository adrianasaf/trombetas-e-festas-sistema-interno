export const MIN_PASSWORD_LENGTH = 8

/** Valida a nova senha. Retorna a mensagem de erro ou null. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.'
  if (password !== confirmation) return 'As senhas não conferem.'
  return null
}

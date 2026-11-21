/** Traduz erros do Supabase (Auth, PostgREST, Postgres) para português claro. */
export function translateError(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  const msg = raw.toLowerCase()

  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('email not confirmed'))
    return 'E-mail ainda não confirmado. Use o link enviado por e-mail.'
  if (msg.includes('password should be at least') || msg.includes('weak password'))
    return 'A senha precisa ter pelo menos 8 caracteres.'
  if (msg.includes('same password') || msg.includes('should be different'))
    return 'A nova senha precisa ser diferente da atual.'
  if (msg.includes('rate limit') || msg.includes('too many requests') || code === '429')
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'Já existe um usuário com este e-mail.'
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled'))
    return 'O cadastro público está desativado. Peça um convite à coordenação.'
  if (msg.includes('jwt expired') || msg.includes('session_not_found') || msg.includes('refresh token'))
    return 'Sua sessão expirou. Entre novamente.'
  if (msg.includes('failed to fetch') || msg.includes('network'))
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
  if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied'))
    return raw && !msg.includes('row-level security') && !msg.includes('permission denied')
      ? raw
      : 'Você não tem permissão para esta operação.'
  if (code === '23505' || msg.includes('duplicate key')) return 'Já existe um registro com esses dados.'
  if (code === '23503') return 'Este registro está vinculado a outros dados e não pode ser removido.'
  if (code === 'P0001' || code === '23514' || code === '22023') return raw
  return raw || 'Não foi possível concluir a operação. Tente novamente.'
}

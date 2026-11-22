// Edge Function: convida um usuário por e-mail e atribui um perfil.
// A service_role é usada SOMENTE aqui (variável de ambiente injetada pelo Supabase),
// nunca no frontend. A permissão é verificada com o JWT de quem chama, e a atribuição
// é gravada com o cliente de quem chama — ou seja, passa pelas políticas RLS.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const ROLES = ['polo_admin', 'church_manager', 'group_leader', 'reception', 'reader'] as const
type Role = (typeof ROLES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Função sem configuração do Supabase.' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sessão ausente. Entre novamente.' }, 401)

  let body: {
    action?: string
    email?: string
    full_name?: string
    role?: string
    church_id?: string | null
    group_id?: string | null
    redirect_to?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requisição inválida.' }, 400)
  }

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const fullName = String(body.full_name ?? '')
    .trim()
    .slice(0, 150)
  const role = body.role as Role
  const churchId = body.church_id || null
  const groupId = body.group_id || null
  if (!EMAIL_RE.test(email)) return json({ error: 'E-mail inválido.' }, 400)

  // ------------------------------------------------------------------
  // Reenviar convite (link expirado). Só para usuários que quem chama pode gerenciar.
  // ------------------------------------------------------------------
  if (body.action === 'reenviar') {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: me, error: meError } = await caller.auth.getUser()
    if (meError || !me.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)
    // list_manageable_users aplica a mesma regra de escopo da tela "Usuários e permissões".
    const { data: manageable, error: listError } = await caller.rpc('list_manageable_users')
    if (listError) return json({ error: 'Não foi possível verificar a permissão.' }, 500)
    const target = (
      manageable as { id: string; email: string; last_sign_in_at: string | null }[] | null
    )?.find((u) => u.email?.toLowerCase() === email)
    if (!target) return json({ error: 'Você não tem permissão para reenviar o convite deste usuário.' }, 403)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const origin = typeof body.redirect_to === 'string' ? new URL(body.redirect_to).origin : undefined
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/definir-senha?tipo=convite` : undefined,
    })
    if (!inviteError) return json({ ok: true, message: `Convite reenviado para ${email}.` })

    const msg = inviteError.message ?? ''
    if (/rate limit/i.test(msg)) {
      return json(
        { error: 'Limite de envio de e-mails atingido. Aguarde alguns minutos ou configure o SMTP próprio.' },
        429,
      )
    }
    // Usuário já confirmado: manda o link de definir nova senha (mesmo efeito para quem perdeu o acesso).
    if (/already|registered|exists/i.test(msg)) {
      const anonClient = createClient(url, anonKey, { auth: { persistSession: false } })
      const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, {
        redirectTo: origin ? `${origin}/definir-senha?tipo=recuperacao` : undefined,
      })
      if (resetError) return json({ error: `Não foi possível reenviar: ${resetError.message}` }, 500)
      return json({
        ok: true,
        message: `Este usuário já tinha ativado o acesso: enviamos um link para definir nova senha (${email}).`,
      })
    }
    return json({ error: `Não foi possível reenviar o convite: ${msg}` }, 500)
  }

  if (!ROLES.includes(role)) return json({ error: 'Perfil inválido.' }, 400)
  if ((churchId && !UUID_RE.test(churchId)) || (groupId && !UUID_RE.test(groupId))) {
    return json({ error: 'Igreja ou grupo inválido.' }, 400)
  }

  // Cliente com a identidade de quem chama (RLS aplicado).
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)

  const { data: allowed, error: permError } = await caller.rpc('can_grant_role', {
    p_role: role,
    p_church_id: churchId,
    p_group_id: groupId,
  })
  if (permError) return json({ error: 'Não foi possível verificar a permissão.' }, 500)
  if (!allowed) return json({ error: 'Você não tem permissão para conceder este perfil.' }, 403)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Usuário já existe? Então só adiciona a atribuição (sem novo e-mail).
  let targetId: string | null = null
  let invited = false
  const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: email })
  if (existing) {
    targetId = existing as string
  } else {
    const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    })
    if (inviteError || !invite.user) {
      const msg = inviteError?.message ?? ''
      if (/rate limit/i.test(msg)) {
        return json(
          { error: 'Limite de envio de e-mails atingido. Configure o SMTP próprio ou aguarde.' },
          429,
        )
      }
      return json({ error: `Não foi possível enviar o convite: ${msg}` }, 500)
    }
    targetId = invite.user.id
    invited = true
  }

  const { error: assignError } = await caller.from('role_assignments').insert({
    user_id: targetId,
    role,
    church_id: role === 'group_leader' ? null : churchId,
    group_id: groupId,
    created_by: userData.user.id,
  })
  if (assignError) {
    if (assignError.code === '23505')
      return json({ ok: true, invited, message: 'O usuário já tinha este perfil.' })
    return json({ error: 'Não foi possível atribuir o perfil.', detail: assignError.message }, 400)
  }

  return json({
    ok: true,
    invited,
    message: invited ? `Convite enviado para ${email}.` : `Perfil adicionado ao usuário ${email}.`,
  })
})

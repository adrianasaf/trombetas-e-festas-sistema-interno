// Edge Function de contas e perfis. NÃO envia e-mail.
//   action "criar"          → Administrador do Polo cria a conta com e-mail e senha inicial + perfil.
//   action "definir_senha"  → Administrador do Polo define uma nova senha (esqueceu a senha).
//   action "perfil"         → adiciona perfil a um usuário que JÁ tem conta (Admin ou Gestor da igreja).
// Senha definida pelo Admin obriga a pessoa a criar a própria senha no primeiro acesso
// (user_metadata.must_change_password).
// A service_role é usada SOMENTE aqui (variável injetada pelo Supabase), nunca no frontend.
// Permissões são verificadas com o JWT de quem chama, e a atribuição de perfil é gravada com o
// cliente de quem chama — ou seja, passa pelas políticas RLS.
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

/** Mesma regra do frontend e do Auth: 8+ caracteres, com letras e números. */
function passwordProblem(p: string): string | null {
  if (p.length < 8 || p.length > 72) return 'A senha precisa ter entre 8 e 72 caracteres.'
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) return 'A senha precisa ter letras e números.'
  return null
}

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
    password?: string
    user_id?: string
    role?: string
    church_id?: string | null
    group_id?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requisição inválida.' }, 400)
  }

  // Cliente com a identidade de quem chama (RLS aplicado).
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: me, error: meError } = await caller.auth.getUser()
  if (meError || !me.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // can_grant_role('polo_admin') só é verdadeiro para o Administrador do Polo.
  async function isPoloAdmin(): Promise<boolean> {
    const { data } = await caller.rpc('can_grant_role', {
      p_role: 'polo_admin',
      p_church_id: null,
      p_group_id: null,
    })
    return data === true
  }

  const action = body.action ?? 'perfil'

  // ------------------------------------------------------------------
  // Definir nova senha (Administrador do Polo)
  // ------------------------------------------------------------------
  if (action === 'definir_senha') {
    if (!(await isPoloAdmin())) return json({ error: 'Somente o Administrador do Polo define senhas.' }, 403)
    const userId = String(body.user_id ?? '')
    const password = String(body.password ?? '')
    if (!UUID_RE.test(userId)) return json({ error: 'Usuário inválido.' }, 400)
    if (userId === me.user.id)
      return json({ error: 'Para trocar a sua própria senha, use o menu do usuário.' }, 400)
    const problem = passwordProblem(password)
    if (problem) return json({ error: problem }, 400)
    const { data: target, error: getError } = await admin.auth.admin.getUserById(userId)
    if (getError || !target.user) return json({ error: 'Usuário não encontrado.' }, 404)
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { ...(target.user.user_metadata ?? {}), must_change_password: true },
    })
    if (error) return json({ error: `Não foi possível definir a senha: ${error.message}` }, 500)
    return json({
      ok: true,
      message: `Senha redefinida para ${target.user.email}. A pessoa criará uma nova no próximo acesso.`,
    })
  }

  // Validação comum a "criar" e "perfil"
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
  if (!ROLES.includes(role)) return json({ error: 'Perfil inválido.' }, 400)
  if ((churchId && !UUID_RE.test(churchId)) || (groupId && !UUID_RE.test(groupId))) {
    return json({ error: 'Igreja ou grupo inválido.' }, 400)
  }
  const { data: allowed, error: permError } = await caller.rpc('can_grant_role', {
    p_role: role,
    p_church_id: churchId,
    p_group_id: groupId,
  })
  if (permError) return json({ error: 'Não foi possível verificar a permissão.' }, 500)
  if (!allowed) return json({ error: 'Você não tem permissão para conceder este perfil.' }, 403)

  const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: email })

  async function assign(userId: string) {
    return await caller.from('role_assignments').insert({
      user_id: userId,
      role,
      church_id: role === 'group_leader' ? null : churchId,
      group_id: groupId,
      created_by: me.user!.id,
    })
  }

  // ------------------------------------------------------------------
  // Criar conta (Administrador do Polo)
  // ------------------------------------------------------------------
  if (action === 'criar') {
    if (!(await isPoloAdmin())) return json({ error: 'Somente o Administrador do Polo cria contas.' }, 403)
    if (existing) {
      return json(
        { error: 'Já existe uma conta com este e-mail. Use "Adicionar perfil" no cartão do usuário.' },
        409,
      )
    }
    if (fullName.length < 3) return json({ error: 'Informe o nome completo.' }, 400)
    const password = String(body.password ?? '')
    const problem = passwordProblem(password)
    if (problem) return json({ error: problem }, 400)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, must_change_password: true },
    })
    if (createError || !created.user) {
      return json(
        { error: `Não foi possível criar a conta: ${createError?.message ?? 'erro desconhecido'}` },
        500,
      )
    }
    const { error: assignError } = await assign(created.user.id)
    if (assignError) {
      // Desfaz: não deixa conta sem perfil.
      await admin.auth.admin.deleteUser(created.user.id)
      return json(
        { error: 'Não foi possível atribuir o perfil; a conta não foi criada.', detail: assignError.message },
        400,
      )
    }
    return json({ ok: true, message: `Conta criada para ${email}.` })
  }

  // ------------------------------------------------------------------
  // Adicionar perfil a quem já tem conta (Admin ou Gestor da igreja)
  // ------------------------------------------------------------------
  if (!existing) {
    return json(
      { error: 'Não existe conta com este e-mail. Peça ao Administrador do Polo para criá-la.' },
      404,
    )
  }
  const { error: assignError } = await assign(existing as string)
  if (assignError) {
    if (assignError.code === '23505') return json({ ok: true, message: 'O usuário já tinha este perfil.' })
    return json({ error: 'Não foi possível atribuir o perfil.', detail: assignError.message }, 400)
  }
  return json({ ok: true, message: `Perfil adicionado a ${email}.` })
})

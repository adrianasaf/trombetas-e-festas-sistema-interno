import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/lib/roles'

export interface RoleAssignment {
  id: string
  role: AppRole
  church_id: string | null
  group_id: string | null
  church?: { name: string } | null
  group?: { name: string; church_id: string } | null
}

export interface Profile {
  id: string
  full_name: string
  email: string
  active: boolean
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  assignments: RoleAssignment[]
  roles: AppRole[]
  loading: boolean
  /** true quando há sessão mas o carregamento do perfil falhou */
  profileError: string | null
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: (scope?: 'local' | 'global') => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadProfile(userId: string) {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, active').eq('id', userId).maybeSingle(),
    supabase
      .from('role_assignments')
      .select(
        'id, role, church_id, group_id, church:churches(name), group:assistance_groups(name, church_id)',
      )
      .eq('user_id', userId),
  ])
  if (profileRes.error) throw profileRes.error
  if (rolesRes.error) throw rolesRes.error
  return {
    profile: profileRes.data as Profile | null,
    assignments: (rolesRes.data ?? []) as unknown as RoleAssignment[],
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const hydrate = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setProfile(null)
      setAssignments([])
      setProfileError(null)
      setLoading(false)
      return
    }
    try {
      const data = await loadProfile(s.user.id)
      setProfile(data.profile)
      setAssignments(data.profile?.active ? data.assignments : [])
      setProfileError(null)
    } catch (e) {
      setProfileError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) void hydrate(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(s)
        return
      }
      // Evita chamar o Supabase dentro do callback (recomendação do supabase-js).
      setTimeout(() => {
        if (mounted) void hydrate(s)
      }, 0)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [hydrate])

  const value = useMemo<AuthState>(() => {
    const roles = [...new Set(assignments.map((a) => a.role))]
    return {
      session,
      profile,
      assignments,
      roles,
      loading,
      profileError,
      isAdmin: roles.includes('polo_admin'),
      refresh: async () => {
        const { data } = await supabase.auth.getSession()
        await hydrate(data.session)
      },
      signOut: async (scope = 'local') => {
        await supabase.auth.signOut({ scope })
      },
    }
  }, [session, profile, assignments, loading, profileError, hydrate])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

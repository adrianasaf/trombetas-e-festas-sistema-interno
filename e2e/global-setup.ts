// Prepara os usuários de teste no DEV com uma senha aleatória desta execução.
// A senha fica só na memória do processo (variável de ambiente herdada pelos workers).
export default async function globalSetup() {
  // @ts-expect-error módulo JS sem tipos
  const { prepareTestUsers } = await import('../scripts/lib/test-users.mjs')
  process.env.E2E_PASSWORD = prepareTestUsers()
}

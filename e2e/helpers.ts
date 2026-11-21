import { expect, type Page } from '@playwright/test'

export type TestUser =
  'rls.admin' | 'rls.gestor.a' | 'rls.resp.a1' | 'rls.recepcao' | 'rls.leitor.a' | 'rls.leitor.polo'

export async function login(page: Page, user: TestUser) {
  const password = process.env.E2E_PASSWORD
  if (!password) throw new Error('E2E_PASSWORD ausente: o global-setup não rodou.')
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${user}@teste.trombetas.dev`)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeVisible()
}

/** Página sem rolagem horizontal (layout responsivo). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'a página rola na horizontal').toBeLessThanOrEqual(1)
}

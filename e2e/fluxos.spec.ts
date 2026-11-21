import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'

const stamp = Date.now().toString().slice(-6)
const guestName = `Teste Ponta ${stamp}`

test.describe('autenticação', () => {
  test('senha errada mostra mensagem em português', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('rls.recepcao@teste.trombetas.dev')
    await page.getByLabel('Senha').fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  })

  test('rota protegida sem sessão vai para o login', async ({ page }) => {
    await page.goto('/convidados')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('permissões na interface', () => {
  test('Recepção vê apenas Dashboard e Check-in no menu', async ({ page }) => {
    await login(page, 'rls.recepcao')
    const nav = page.getByRole('navigation', { name: 'Menu principal' }).first()
    await expect(nav.getByRole('link')).toHaveText(['Dashboard geral', 'Check-in'])
  })

  test('Leitor que abre /convidados recebe 403', async ({ page }) => {
    await login(page, 'rls.leitor.a')
    await page.goto('/convidados')
    await expect(page.getByRole('heading', { name: 'Acesso não permitido' })).toBeVisible()
  })
})

test.describe('cadastro de convidado pela ficha do membro', () => {
  test('Responsável cadastra pelas linhas rápidas com consentimento', async ({ page }) => {
    await login(page, 'rls.resp.a1')
    await page.goto('/membros')
    await page.getByPlaceholder('Buscar por nome…').fill('TESTE RLS')
    await page.getByRole('link', { name: /\[TESTE RLS\] Membro A/ }).click()
    await expect(page.getByRole('heading', { name: 'Convidados deste membro' })).toBeVisible()
    await page.getByLabel('Nome do convidado 1').fill(guestName)
    await page.getByLabel('Telefone do convidado 1').fill(`(83) 99${stamp.slice(0, 3)}-${stamp.slice(3)}0`)
    await page.getByLabel('Categoria do convidado 1').selectOption('homem')
    // Sem consentimento: o cadastro é recusado
    await page.getByRole('button', { name: 'Salvar convidados' }).click()
    await expect(page.getByText('Registre o consentimento do convidado.')).toBeVisible()
    await page.locator('fieldset').filter({ hasText: 'Convidado 1' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Salvar convidados' }).click()
    await expect(page.getByRole('link', { name: new RegExp(guestName) })).toBeVisible()
  })
})

test.describe('check-in', () => {
  test('Recepção busca, marca presença e a segunda tentativa avisa "já registrada"', async ({ page }) => {
    await login(page, 'rls.recepcao')
    await page.goto('/check-in')
    const search = page.getByLabel('Buscar convidado por nome ou telefone')
    await search.fill(guestName)
    const card = page.getByRole('listitem').filter({ hasText: guestName })
    await expect(card).toBeVisible()
    await expect(card).toContainText(/\(83\) 9\*\*\*\*-\d{4}/) // telefone mascarado
    const t0 = Date.now()
    await card.getByRole('button', { name: 'COMPARECEU AO EVENTO ✓' }).click()
    await expect(card.getByText(/Presença registrada às \d{2}:\d{2}/)).toBeVisible()
    console.log(`  toque → confirmação: ${Date.now() - t0} ms`)
    await page.reload()
    await search.fill(guestName)
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: guestName })
        .getByText(/Presença já registrada às/),
    ).toBeVisible()
  })

  test('convidado inexistente oferece "Cadastrar e marcar presença"', async ({ page }) => {
    await login(page, 'rls.recepcao')
    await page.goto('/check-in')
    await page.getByLabel('Buscar convidado por nome ou telefone').fill('Nome Que Nao Existe Xyzw')
    await expect(page.getByRole('button', { name: 'Cadastrar e marcar presença' })).toBeVisible()
  })
})

test.describe('layout responsivo', () => {
  for (const [name, width, height] of [
    ['celular-360', 360, 780],
    ['tablet-768', 768, 1024],
    ['desktop-1280', 1280, 900],
  ] as const) {
    test(`dashboard do Polo em ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await login(page, 'rls.admin')
      await expect(page.getByRole('heading', { name: 'Dashboard geral do Polo' })).toBeVisible()
      await expect(page.getByText('Convidados cadastrados').first()).toBeVisible()
      await page.waitForTimeout(1500)
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: `test-results/layout/dashboard-${name}.png`, fullPage: false })
    })

    test(`check-in em ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await login(page, 'rls.recepcao')
      await page.goto('/check-in')
      await page.getByLabel('Buscar convidado por nome ou telefone').fill('maria')
      await expect(page.getByRole('button', { name: 'COMPARECEU AO EVENTO ✓' }).first()).toBeVisible()
      await expectNoHorizontalScroll(page)
      const box = await page.getByRole('button', { name: 'COMPARECEU AO EVENTO ✓' }).first().boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: `test-results/layout/checkin-${name}.png` })
    })
  }
})

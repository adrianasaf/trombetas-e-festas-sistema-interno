import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { AuthProvider } from './features/auth/AuthProvider'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('rotas básicas', () => {
  it('mostra 404 para rota inexistente', () => {
    renderAt('/nao-existe')
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument()
  })
  it('mostra a política de privacidade', () => {
    renderAt('/privacidade')
    expect(screen.getByRole('heading', { name: 'Política de privacidade' })).toBeInTheDocument()
  })
  it('mostra o login para rota protegida sem sessão', async () => {
    renderAt('/usuarios')
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
  it('exibe a faixa de demonstração em dev', () => {
    renderAt('/privacidade')
    expect(screen.getByRole('status')).toHaveTextContent(/ambiente de demonstração/i)
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
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
  it('exibe a faixa de demonstração em dev', () => {
    renderAt('/privacidade')
    expect(screen.getByRole('status')).toHaveTextContent(/ambiente de demonstração/i)
  })
})

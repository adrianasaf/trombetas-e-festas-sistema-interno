import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import './index.css'
import { App } from './App'
import { env } from './lib/env'
import { ConfigErrorPage } from './pages/StatusPages'
import { AuthProvider } from './features/auth/AuthProvider'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {env.ok ? (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
          <Toaster richColors position="top-center" />
        </QueryClientProvider>
      ) : (
        <ConfigErrorPage missing={env.missing} />
      )}
    </BrowserRouter>
  </StrictMode>,
)

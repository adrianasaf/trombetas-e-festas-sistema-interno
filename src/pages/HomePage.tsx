import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Página inicial provisória da Fase 1. Será substituída pelo dashboard real na Fase 7. */
export function HomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Sistema de Gestão Trombetas e Festas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Estrutura inicial publicada</CardTitle>
          <CardDescription>
            Fases 1 a 4 de 10 — estrutura, permissões, cadastros, convidados e duplicidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-base">
          Login, cadastros, check-in e dashboards serão liberados nas próximas fases. Nenhum dado é exibido
          nesta versão.
        </CardContent>
      </Card>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Brand } from '@/components/layout/Brand'
import { DemoBanner } from '@/components/layout/DemoBanner'

export function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <DemoBanner />
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <Brand />
        <h1 className="text-2xl font-bold">Política de privacidade</h1>
        <p>
          Este sistema é de uso interno da coordenação do Polo Torre da Igreja Cristã Maranata para organizar
          o evento Trombetas e Festas. Ele trata dados pessoais de convidados, inclusive de crianças e
          adolescentes, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
        <h2 className="text-xl font-bold">Quais dados tratamos</h2>
        <p>
          Nome, telefone, categoria (faixa etária/gênero), forma de participação, necessidade de transporte,
          situação do convite e presença no evento. Para crianças e adolescentes, também o nome e o telefone
          do responsável legal.
        </p>
        <h2 className="text-xl font-bold">Para que usamos</h2>
        <p>
          Exclusivamente para contato sobre o evento, organização de transporte, controle de presença e
          estatísticas internas. Os dados não são vendidos nem compartilhados com terceiros.
        </p>
        <h2 className="text-xl font-bold">Base legal</h2>
        <p>
          Consentimento do convidado, registrado no cadastro com data, hora e usuário. Para menores de idade,
          o consentimento é dado pelo responsável legal (art. 14 da LGPD).
        </p>
        <h2 className="text-xl font-bold">Quem tem acesso</h2>
        <p>
          Somente usuários autorizados, cada um limitado à sua igreja ou grupo. A recepção vê telefones
          mascarados e os perfis de leitura veem apenas números agregados. Operações sensíveis são registradas
          em auditoria.
        </p>
        <h2 className="text-xl font-bold">Por quanto tempo guardamos</h2>
        <p>
          Após o encerramento do evento, os dados pessoais podem ser anonimizados depois do prazo definido
          pela coordenação (padrão de 180 dias), mantendo apenas as estatísticas.
        </p>
        <h2 className="text-xl font-bold">Seus direitos</h2>
        <p>
          O titular pode pedir a qualquer momento a correção, a anonimização ou a exclusão dos seus dados,
          falando com o membro que o convidou ou com a coordenação da igreja.
        </p>
        <Link to="/" className="inline-block font-semibold text-primary underline underline-offset-2">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

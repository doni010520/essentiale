import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — MVF",
  description: "Política de Privacidade da plataforma de atendimento MVF.",
};

const UPDATED = "11 de junho de 2026";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-ink">
      <div className="mb-8 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mvf.png" alt="MVF" className="mb-4 h-20 w-auto rounded-xl" />
        <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
        <p className="text-sm text-ink-soft">Última atualização: {UPDATED}</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">1. Quem somos</h2>
          <p>
            A MVF (&ldquo;nós&rdquo;) opera uma plataforma de atendimento ao cliente que integra canais de
            mensagens, incluindo o WhatsApp, para permitir que empresas se comuniquem com seus contatos.
            Esta Política descreve como coletamos, usamos e protegemos as informações tratadas na plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">2. Dados que tratamos</h2>
          <p>Ao utilizar a plataforma, podemos tratar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Dados de cadastro dos usuários (nome, e-mail, organização).</li>
            <li>Número de telefone, nome de exibição e foto de perfil dos contatos atendidos.</li>
            <li>Conteúdo das mensagens trocadas (texto, mídia, áudio, documentos) para fins de atendimento.</li>
            <li>Metadados de envio e entrega (data, hora, status de leitura).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">3. Como usamos os dados</h2>
          <p>
            Os dados são utilizados exclusivamente para operar o serviço de atendimento: rotear conversas,
            registrar o histórico, permitir respostas dos atendentes, executar automações e gerar relatórios
            de desempenho para a empresa contratante. Não vendemos dados pessoais.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">4. WhatsApp Business Platform</h2>
          <p>
            A integração com o WhatsApp utiliza a API oficial da Meta (WhatsApp Business Platform). As
            mensagens são processadas conforme as políticas da Meta. O uso dos dados obtidos via WhatsApp
            limita-se à prestação do atendimento solicitado pelo contato.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">5. Compartilhamento</h2>
          <p>
            Compartilhamos dados apenas com provedores de infraestrutura necessários ao funcionamento do
            serviço (hospedagem, banco de dados e provedores de mensageria), sempre sob obrigações de
            confidencialidade, e quando exigido por lei.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">6. Retenção e segurança</h2>
          <p>
            Os dados são mantidos enquanto necessários à finalidade do atendimento e às obrigações legais.
            Adotamos medidas técnicas e organizacionais para proteger as informações, incluindo controle de
            acesso e criptografia de credenciais sensíveis.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">7. Seus direitos (LGPD)</h2>
          <p>
            Nos termos da Lei nº 13.709/2018 (LGPD), o titular pode solicitar acesso, correção, exclusão ou
            portabilidade de seus dados, bem como informações sobre o tratamento. As solicitações podem ser
            enviadas pelo contato abaixo.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">8. Exclusão de dados</h2>
          <p>
            Para solicitar a exclusão dos seus dados, entre em contato pelo e-mail informado abaixo. As
            informações serão removidas, ressalvadas as hipóteses de guarda obrigatória previstas em lei.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">9. Contato</h2>
          <p>
            Dúvidas sobre esta Política ou sobre o tratamento de dados podem ser enviadas para:{" "}
            <a href="mailto:adoni_santos@outlook.com" className="font-medium text-brand hover:underline">
              adoni_santos@outlook.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

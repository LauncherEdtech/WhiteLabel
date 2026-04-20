// frontend/src/app/privacidade/page.tsx
// Política de Privacidade — LGPD (Lei 13.709/2018)
// Adicionar ao RESERVED_SLUGS em proxy.ts: "privacidade"

import Link from "next/link";

const LAST_UPDATE = "20 de abril de 2025";
const EMAIL_PRIVACIDADE = "privacidade@launcheredu.com.br";

export const metadata = {
    title: "Política de Privacidade | Launcher EdTech",
    description:
        "Como a Launcher trata seus dados pessoais em conformidade com a LGPD (Lei 13.709/2018).",
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                {title}
            </h2>
            {children}
        </section>
    );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 my-4">
            <p className="font-semibold text-blue-800 mb-2">{title}</p>
            {children}
        </div>
    );
}

function TableOfContents() {
    const items = [
        { id: "controlador", label: "1. Identificação do Controlador" },
        { id: "dados", label: "2. Dados que Coletamos" },
        { id: "finalidades", label: "3. Finalidades e Bases Legais" },
        { id: "ia", label: "4. Uso de Inteligência Artificial" },
        { id: "compartilhamento", label: "5. Compartilhamento com Terceiros" },
        { id: "direitos", label: "6. Seus Direitos" },
        { id: "retencao", label: "7. Retenção e Exclusão de Dados" },
        { id: "seguranca", label: "8. Segurança da Informação" },
        { id: "cookies", label: "9. Cookies" },
        { id: "menores", label: "10. Menores de Idade" },
        { id: "alteracoes", label: "11. Alterações nesta Política" },
        { id: "contato", label: "12. Contato e Canal DPO" },
    ];
    return (
        <nav className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-10">
            <p className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
                Sumário
            </p>
            <ol className="space-y-1">
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                        >
                            {item.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

// ─── Tabelas ─────────────────────────────────────────────────────────────────

function FinaildadesTable() {
    const rows = [
        ["Criação e autenticação de conta", "Execução de contrato", "Art. 7º, V"],
        ["Prestação dos serviços educacionais", "Execução de contrato", "Art. 7º, V"],
        ["Personalização do cronograma e insights de IA", "Execução de contrato / Legítimo interesse", "Art. 7º, V e IX"],
        ["Gamificação e rankings", "Execução de contrato / Consentimento", "Art. 7º, I e V"],
        ["E-mails transacionais (senha, notificações)", "Execução de contrato", "Art. 7º, V"],
        ["Comunicações de marketing", "Consentimento", "Art. 7º, I"],
        ["Segurança e prevenção a fraudes", "Legítimo interesse", "Art. 7º, IX"],
        ["Obrigações legais (NFS-e etc.)", "Obrigação legal", "Art. 7º, II"],
        ["Cápsula de Estudos e compartilhamento público", "Consentimento", "Art. 7º, I"],
    ];
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 my-4">
            <table className="w-full text-sm">
                <thead className="bg-blue-700 text-white">
                    <tr>
                        <th className="text-left p-3 font-semibold">Finalidade</th>
                        <th className="text-left p-3 font-semibold">Base Legal (LGPD)</th>
                        <th className="text-left p-3 font-semibold">Artigo</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([fin, base, art], i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-3 text-gray-800">{fin}</td>
                            <td className="p-3 text-gray-700">{base}</td>
                            <td className="p-3 text-gray-500 whitespace-nowrap">{art}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SuboperadoresTable() {
    const rows = [
        ["Amazon Web Services", "Hospedagem, banco de dados, e-mail (SES)", "Todos os dados", "EUA"],
        ["Google LLC (Gemini)", "Geração de insights por IA", "Desempenho acadêmico", "EUA"],
        ["Vercel Inc.", "Hospedagem do frontend", "Dados de acesso", "EUA"],
        ["Gateway de Pagamento", "Processamento de pagamentos", "Dados financeiros", "EUA / BR"],
    ];
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 my-4">
            <table className="w-full text-sm">
                <thead className="bg-blue-700 text-white">
                    <tr>
                        <th className="text-left p-3 font-semibold">Terceiro</th>
                        <th className="text-left p-3 font-semibold">Serviço</th>
                        <th className="text-left p-3 font-semibold">Dados</th>
                        <th className="text-left p-3 font-semibold">País</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([t, s, d, p], i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-3 font-medium text-gray-800">{t}</td>
                            <td className="p-3 text-gray-700">{s}</td>
                            <td className="p-3 text-gray-700">{d}</td>
                            <td className="p-3 text-gray-500">{p}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PoliticaPrivacidadePage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-blue-700 text-white py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Link href="/" className="text-blue-200 hover:text-white text-sm mb-4 inline-block">
                        ← Voltar
                    </Link>
                    <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
                    <p className="text-blue-200 text-sm">
                        Em conformidade com a LGPD (Lei n.º 13.709/2018)
                    </p>
                    <p className="text-blue-200 text-xs mt-2">
                        Última atualização: {LAST_UPDATE}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-10">
                <TableOfContents />

                <Section id="controlador" title="1. Identificação do Controlador">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        A <strong>LAUNCHER EDTECH</strong> ("Launcher", "nós" ou "nosso"), pessoa jurídica de direito
                        privado, operadora da plataforma disponível em{" "}
                        <strong>launcheredu.com.br</strong>, é responsável pelo tratamento dos dados pessoais
                        descritos nesta Política, na qualidade de <strong>Controladora</strong>, nos termos da LGPD.
                    </p>
                    <InfoBox title="Dados de Contato">
                        <ul className="text-sm text-blue-900 space-y-1 mt-1">
                            <li>CNPJ: <em>[a preencher]</em></li>
                            <li>Endereço: <em>[a preencher]</em></li>
                            <li>Canal de Privacidade: <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="underline">{EMAIL_PRIVACIDADE}</a></li>
                            <li>Encarregado de Dados (DPO): <em>[a designar]</em></li>
                        </ul>
                    </InfoBox>
                </Section>

                <Section id="dados" title="2. Dados que Coletamos">
                    <p className="text-gray-700 mb-2 font-medium">Fornecidos diretamente por você:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                        <li>Nome completo e e-mail (cadastro)</li>
                        <li>Senha (armazenada com hash bcrypt — nunca em texto puro)</li>
                        <li>Informações de perfil opcionais (foto, biografia)</li>
                    </ul>
                    <p className="text-gray-700 mb-2 font-medium">Coletados automaticamente durante o uso:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                        <li>Histórico de questões respondidas e desempenho por disciplina</li>
                        <li>Progresso em videoaulas e módulos</li>
                        <li>Logs de acesso, endereços IP e agente de navegação</li>
                    </ul>
                    <p className="text-gray-700 mb-2 font-medium">Gerados pela plataforma:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Métricas de desempenho calculadas pelo sistema</li>
                        <li>Cronogramas de estudos via algoritmo SM-2 (repetição espaçada)</li>
                        <li>Insights gerados por Inteligência Artificial (Google Gemini)</li>
                        <li>Pontuações, insígnias e posições no ranking de gamificação</li>
                        <li>Cápsulas de Estudos mensais</li>
                    </ul>
                </Section>

                <Section id="finalidades" title="3. Finalidades e Bases Legais do Tratamento">
                    <p className="text-gray-700 mb-3">
                        Tratamos seus dados somente quando há uma base legal válida, conforme o art. 7º da LGPD:
                    </p>
                    <FinaildadesTable />
                </Section>

                <Section id="ia" title="4. Uso de Inteligência Artificial">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        A Launcher utiliza o modelo <strong>Gemini 2.5 Flash Lite da Google LLC</strong> para gerar
                        insights personalizados de desempenho acadêmico e questões de estudo. Em cumprimento ao
                        princípio da transparência (art. 6º, VI, LGPD):
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
                        <li>Os insights de IA são orientativos e não substituem acompanhamento pedagógico profissional</li>
                        <li>Você pode solicitar explicação sobre a lógica aplicada nos insights (art. 20, LGPD)</li>
                        <li>Existe sempre um sistema de regras alternativo quando a IA não está disponível</li>
                        <li>Nenhuma decisão automatizada produz efeito jurídico sem revisão humana</li>
                    </ul>
                </Section>

                <Section id="compartilhamento" title="5. Compartilhamento com Terceiros">
                    <p className="text-gray-700 mb-3">
                        Compartilhamos dados somente com parceiros essenciais para a prestação do serviço:
                    </p>
                    <SuboperadoresTable />
                    <p className="text-gray-700 text-sm mt-3">
                        A transferência internacional de dados para os EUA ocorre com base nas cláusulas contratuais
                        padrão (Standard Contractual Clauses) adotadas pelos respectivos fornecedores, conforme art.
                        33 da LGPD.
                    </p>
                    <p className="text-gray-700 mt-3">
                        Os <strong>Produtores parceiros</strong> têm acesso limitado aos dados de desempenho dos seus
                        respectivos alunos, regulado por contrato e Acordo de Processamento de Dados (DPA).
                    </p>
                </Section>

                <Section id="direitos" title="6. Seus Direitos">
                    <p className="text-gray-700 mb-3">
                        Nos termos dos arts. 17 a 22 da LGPD, você tem os seguintes direitos:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1.5 ml-2">
                        <li>Confirmação da existência de tratamento</li>
                        <li>Acesso aos dados tratados</li>
                        <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                        <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
                        <li>Portabilidade dos dados a outro fornecedor</li>
                        <li>Eliminação dos dados tratados com base no consentimento</li>
                        <li>Informação sobre entidades com quem compartilhamos seus dados</li>
                        <li>Revogação do consentimento a qualquer momento</li>
                        <li>Petição perante a ANPD</li>
                        <li>Revisão de decisões tomadas unicamente por meios automatizados</li>
                    </ul>
                    <InfoBox title="Como exercer seus direitos">
                        <p className="text-sm text-blue-900">
                            Envie sua solicitação para{" "}
                            <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="underline font-medium">
                                {EMAIL_PRIVACIDADE}
                            </a>
                            . Responderemos em até 15 dias úteis.
                        </p>
                    </InfoBox>
                </Section>

                <Section id="retencao" title="7. Retenção e Exclusão de Dados">
                    <ul className="list-disc list-inside text-gray-700 space-y-1.5 ml-2">
                        <li>Dados de conta ativa: enquanto durar a relação contratual</li>
                        <li>Logs de acesso: 6 meses (art. 15, Marco Civil da Internet)</li>
                        <li>Dados fiscais e transacionais: 5 anos (legislação tributária)</li>
                        <li>Dados de marketing: até revogação do consentimento</li>
                    </ul>
                    <p className="text-gray-700 mt-3">
                        Após os prazos de retenção, os dados são eliminados de forma segura ou anonimizados para
                        fins estatísticos.
                    </p>
                </Section>

                <Section id="seguranca" title="8. Segurança da Informação">
                    <p className="text-gray-700 mb-3">
                        Adotamos medidas técnicas e administrativas para proteger seus dados:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Criptografia de senhas com bcrypt</li>
                        <li>Transmissão por HTTPS (TLS 1.2+) com HSTS forçado</li>
                        <li>Autenticação via JWT com expiração configurada</li>
                        <li>Headers de segurança: X-Frame-Options, X-Content-Type-Options, Referrer-Policy</li>
                        <li>Banco de dados isolado em VPC privada na AWS</li>
                        <li>Controle de acesso por função (RBAC)</li>
                        <li>Monitoramento de logs via CloudWatch</li>
                    </ul>
                    <p className="text-gray-700 mt-3">
                        Em caso de incidente relevante, notificaremos a ANPD e os titulares afetados em até 72 horas,
                        conforme art. 48 da LGPD.
                    </p>
                </Section>

                <Section id="cookies" title="9. Cookies">
                    <p className="text-gray-700 mb-3">
                        Utilizamos somente cookies estritamente necessários para o funcionamento do serviço:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li><code className="bg-gray-100 px-1 rounded text-xs">access_token</code> — token JWT de autenticação</li>
                        <li><code className="bg-gray-100 px-1 rounded text-xs">tenant_slug</code> — identificação do portal do produtor</li>
                        <li>Cookies de preferência de interface (tema, layout)</li>
                    </ul>
                    <p className="text-gray-700 mt-3">
                        Não utilizamos cookies de rastreamento publicitário de terceiros.
                    </p>
                </Section>

                <Section id="menores" title="10. Menores de Idade">
                    <p className="text-gray-700 leading-relaxed">
                        A plataforma não é direcionada a menores de 18 anos. Caso identifiquemos coleta de dados de
                        menores sem o consentimento verificável dos responsáveis legais, os dados serão eliminados
                        imediatamente. Produtores que atendem menores são responsáveis pelo consentimento dos
                        responsáveis legais, conforme art. 14 da LGPD.
                    </p>
                </Section>

                <Section id="alteracoes" title="11. Alterações nesta Política">
                    <p className="text-gray-700 leading-relaxed">
                        Esta Política pode ser atualizada periodicamente. Notificaremos alterações relevantes por
                        e-mail ou por aviso na plataforma com antecedência mínima de 15 dias. A continuidade do uso
                        após a vigência das alterações constitui aceitação dos novos termos.
                    </p>
                </Section>

                <Section id="contato" title="12. Contato e Canal DPO">
                    <InfoBox title="Fale com nossa equipe de privacidade">
                        <ul className="text-sm text-blue-900 space-y-1 mt-1">
                            <li>
                                E-mail:{" "}
                                <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="underline font-medium">
                                    {EMAIL_PRIVACIDADE}
                                </a>
                            </li>
                            <li>Prazo de resposta: 15 dias úteis</li>
                            <li>
                                ANPD:{" "}
                                <a
                                    href="https://www.gov.br/anpd"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    www.gov.br/anpd
                                </a>
                            </li>
                        </ul>
                    </InfoBox>
                </Section>

                <p className="text-xs text-gray-400 mt-10 text-center">
                    Última atualização: {LAST_UPDATE} · Launcher EdTech · launcheredu.com.br
                </p>
            </div>
        </main>
    );
}
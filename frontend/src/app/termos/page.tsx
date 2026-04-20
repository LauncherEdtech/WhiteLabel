// frontend/src/app/termos/page.tsx
// Termos de Uso — Launcher EdTech
// Adicionar ao RESERVED_SLUGS em proxy.ts: "termos"

import Link from "next/link";

const LAST_UPDATE = "20 de abril de 2025";

export const metadata = {
    title: "Termos de Uso | Launcher EdTech",
    description:
        "Condições gerais para uso da plataforma Launcher de preparação para concursos públicos.",
};

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

function InfoBox({
    title,
    variant = "blue",
    children,
}: {
    title: string;
    variant?: "blue" | "amber" | "red";
    children: React.ReactNode;
}) {
    const styles = {
        blue: "bg-blue-50 border-blue-200 text-blue-800",
        amber: "bg-amber-50 border-amber-200 text-amber-800",
        red: "bg-red-50 border-red-200 text-red-800",
    };
    return (
        <div className={`border rounded-lg p-4 my-4 ${styles[variant]}`}>
            <p className="font-semibold mb-2">{title}</p>
            {children}
        </div>
    );
}

function TableOfContents() {
    const items = [
        { id: "aceitacao", label: "1. Aceitação dos Termos" },
        { id: "definicoes", label: "2. Definições" },
        { id: "cadastro", label: "3. Cadastro e Conta" },
        { id: "servicos", label: "4. Serviços Prestados" },
        { id: "ia", label: "5. Uso de Inteligência Artificial" },
        { id: "propriedade", label: "6. Propriedade Intelectual" },
        { id: "capsula", label: "7. Cápsula de Estudos" },
        { id: "obrigacoes", label: "8. Obrigações do Usuário" },
        { id: "sla", label: "9. Disponibilidade e SLA" },
        { id: "responsabilidade", label: "10. Limitação de Responsabilidade" },
        { id: "rescisao", label: "11. Rescisão e Exclusão de Conta" },
        { id: "foro", label: "12. Legislação e Foro" },
        { id: "geral", label: "13. Disposições Gerais" },
    ];
    return (
        <nav className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-10">
            <p className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Sumário</p>
            <ol className="space-y-1">
                {items.map((item) => (
                    <li key={item.id}>
                        <a href={`#${item.id}`} className="text-sm text-blue-700 hover:underline">
                            {item.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

export default function TermosPage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-blue-700 text-white py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <Link href="/" className="text-blue-200 hover:text-white text-sm mb-4 inline-block">
                        ← Voltar
                    </Link>
                    <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
                    <p className="text-blue-200 text-sm">
                        Condições gerais para uso da plataforma Launcher
                    </p>
                    <p className="text-blue-200 text-xs mt-2">Última atualização: {LAST_UPDATE}</p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-10">
                <InfoBox title="Leia com atenção antes de usar a plataforma" variant="amber">
                    <p className="text-sm">
                        Ao criar uma conta ou utilizar a plataforma, você declara ter lido e aceito
                        integralmente estes Termos, bem como nossa{" "}
                        <Link href="/privacidade" className="underline font-medium">
                            Política de Privacidade
                        </Link>
                        .
                    </p>
                </InfoBox>

                <TableOfContents />

                <Section id="aceitacao" title="1. Aceitação dos Termos">
                    <p className="text-gray-700 leading-relaxed">
                        Estes Termos de Uso regem o acesso e uso da plataforma de preparação para concursos
                        públicos operada pela <strong>LAUNCHER EDTECH</strong>, disponível em launcheredu.com.br e
                        nos subdomínios dos Produtores parceiros.
                    </p>
                    <p className="text-gray-700 leading-relaxed mt-3">
                        Se você não concordar com qualquer cláusula destes Termos, não utilize a plataforma.
                        Usuários menores de 18 anos devem ter o consentimento expresso de seu responsável legal.
                    </p>
                </Section>

                <Section id="definicoes" title="2. Definições">
                    <dl className="space-y-3">
                        {[
                            ["Plataforma", "O sistema SaaS operado pela Launcher, incluindo frontend, API, banco de dados e ferramentas associadas."],
                            ["Produtor", "A pessoa física ou jurídica que contratou a Launcher para disponibilizar conteúdo educacional em sua área exclusiva da plataforma."],
                            ["Aluno", "O usuário final que acessa a plataforma por meio do portal de um Produtor para preparação a concursos públicos."],
                            ["Conteúdo", "Todo material disponibilizado na plataforma, incluindo questões, videoaulas, simulados, cronogramas e materiais complementares."],
                            ["Serviços de IA", "As funcionalidades automatizadas de geração de insights, questões e recomendações baseadas no modelo Gemini da Google LLC."],
                        ].map(([term, def]) => (
                            <div key={term} className="flex gap-3">
                                <dt className="font-semibold text-gray-900 min-w-[120px] text-sm">{term}</dt>
                                <dd className="text-gray-700 text-sm leading-relaxed">{def}</dd>
                            </div>
                        ))}
                    </dl>
                </Section>

                <Section id="cadastro" title="3. Cadastro e Conta">
                    <p className="text-gray-700 mb-3 font-medium">Requisitos para cadastro:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2 mb-4">
                        <li>Ter 18 anos ou mais, ou contar com autorização de responsável legal</li>
                        <li>Fornecer informações verdadeiras, precisas e completas</li>
                        <li>Manter as informações da conta atualizadas</li>
                    </ul>
                    <p className="text-gray-700 mb-3 font-medium">Segurança da conta:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Você é responsável pela confidencialidade de sua senha</li>
                        <li>Não compartilhe sua conta com terceiros</li>
                        <li>Notifique-nos imediatamente em caso de acesso não autorizado</li>
                    </ul>
                </Section>

                <Section id="servicos" title="4. Serviços Prestados">
                    <p className="text-gray-700 mb-3">A plataforma oferece, conforme contratado pelo Produtor:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2 mb-4">
                        <li>Banco de questões com correção detalhada e dicas de estudo</li>
                        <li>Cronograma de estudos personalizado com algoritmo SM-2</li>
                        <li>Simulados temporizados por disciplina e formato de banca</li>
                        <li>Dashboard de desempenho com análise por disciplina</li>
                        <li>Sistema de gamificação com patentes, insígnias e rankings</li>
                        <li>Coach IA com recomendação da próxima ação de estudo</li>
                        <li>Cápsula de Estudos mensal (relatório compartilhável)</li>
                        <li>Videoaulas hospedadas pelo Produtor</li>
                    </ul>
                    <InfoBox title="Natureza do serviço" variant="amber">
                        <p className="text-sm">
                            A Launcher é uma plataforma tecnológica de apoio educacional. Os serviços não
                            constituem garantia de aprovação em concursos, aconselhamento jurídico, psicológico
                            ou vocacional, nem relação de emprego de qualquer natureza.
                        </p>
                    </InfoBox>
                </Section>

                <Section id="ia" title="5. Uso de Inteligência Artificial">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        A plataforma utiliza IA generativa (Google Gemini) para gerar insights de desempenho e
                        questões de estudo. Ao usar estes recursos, você reconhece que:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1.5 ml-2">
                        <li>Os insights e questões gerados por IA são orientativos e não constituem verdade absoluta</li>
                        <li>Existe sempre um sistema de regras alternativo (fallback) quando a IA não está disponível</li>
                        <li>A Launcher realiza monitoramento contínuo da qualidade do conteúdo gerado por IA</li>
                        <li>Você pode reportar conteúdo inadequado pelo suporte da plataforma</li>
                        <li>Nenhuma decisão automatizada produz efeito jurídico sem revisão humana</li>
                    </ul>
                </Section>

                <Section id="propriedade" title="6. Propriedade Intelectual">
                    <p className="text-gray-700 mb-2 font-medium">Conteúdo da Launcher:</p>
                    <p className="text-gray-700 mb-3 text-sm">
                        São de propriedade exclusiva da Launcher: o código-fonte, a marca "Launcher", a interface
                        gráfica, o algoritmo de personalização e todo conteúdo nativo da plataforma. É vedado
                        reproduzir, modificar, distribuir ou fazer engenharia reversa sem autorização expressa.
                    </p>
                    <p className="text-gray-700 mb-2 font-medium">Conteúdo do Produtor:</p>
                    <p className="text-gray-700 mb-3 text-sm">
                        O conteúdo publicado pelo Produtor é de sua responsabilidade exclusiva. A Launcher não se
                        responsabiliza por violações de direito autoral praticadas por Produtores.
                    </p>
                    <p className="text-gray-700 mb-2 font-medium">Banco de questões global:</p>
                    <p className="text-gray-700 text-sm">
                        O banco de questões compartilhado pode incluir questões de concursos públicos reproduzidas
                        com fins estritamente educativos, com base no art. 46, III, da Lei n.º 9.610/1998. O usuário
                        não poderá reproduzir, exportar ou comercializar questões da plataforma.
                    </p>
                </Section>

                <Section id="capsula" title="7. Cápsula de Estudos e Compartilhamento">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        A funcionalidade "Cápsula de Estudos" permite compartilhar publicamente um resumo mensal do
                        seu desempenho. Você compreende que:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>O compartilhamento é opcional e iniciado exclusivamente por você</li>
                        <li>Ao compartilhar, você torna público seu resumo de desempenho, patente e métricas</li>
                        <li>Você pode desativar o compartilhamento a qualquer momento</li>
                        <li>A Launcher não usa o conteúdo compartilhado para fins publicitários sem consentimento adicional</li>
                    </ul>
                </Section>

                <Section id="obrigacoes" title="8. Obrigações do Usuário">
                    <p className="text-gray-700 mb-3">É expressamente vedado ao usuário:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Violar leis aplicáveis, incluindo a LGPD e o Marco Civil da Internet</li>
                        <li>Tentar acessar dados de outros usuários ou fazer scraping da plataforma</li>
                        <li>Compartilhar conteúdo da plataforma sem autorização</li>
                        <li>Criar contas falsas ou assumir identidade de terceiros</li>
                        <li>Utilizar bots, scripts ou qualquer automação não autorizada</li>
                        <li>Publicar conteúdo difamatório, ofensivo, discriminatório ou ilegal</li>
                        <li>Interferir no funcionamento técnico da plataforma</li>
                    </ul>
                </Section>

                <Section id="sla" title="9. Disponibilidade e SLA">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        A Launcher empenha seus melhores esforços para manter a plataforma disponível 24/7, com meta
                        de disponibilidade de <strong>99% ao mês</strong>, exceto em:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Manutenções programadas, com aviso prévio de 24 horas sempre que possível</li>
                        <li>Falhas de infraestrutura de terceiros (AWS, Vercel, Google)</li>
                        <li>Casos fortuitos ou de força maior</li>
                    </ul>
                </Section>

                <Section id="responsabilidade" title="10. Limitação de Responsabilidade">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Na máxima extensão permitida pela lei, a Launcher não será responsável por:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2 mb-4">
                        <li>Danos indiretos, incidentais, especiais ou punitivos</li>
                        <li>Perda de dados, receita ou oportunidades</li>
                        <li>Conteúdo publicado por Produtores ou terceiros</li>
                        <li>Não aprovação em concurso público</li>
                    </ul>
                    <p className="text-gray-700 text-sm">
                        A responsabilidade total da Launcher, em qualquer hipótese, ficará limitada ao valor pago
                        pelo usuário nos 3 meses anteriores ao evento danoso.
                    </p>
                    <InfoBox title="Proteção ao Consumidor (CDC)" variant="blue">
                        <p className="text-sm">
                            Você é consumidor nos termos do Código de Defesa do Consumidor (Lei n.º 8.078/1990).
                            Nenhuma cláusula destes Termos afasta a responsabilidade da Launcher por danos causados
                            por defeito na prestação do serviço (art. 14 do CDC).
                        </p>
                    </InfoBox>
                </Section>

                <Section id="rescisao" title="11. Rescisão e Exclusão de Conta">
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Você pode excluir sua conta a qualquer momento via e-mail ao suporte. A exclusão implica:
                    </p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>Eliminação dos dados de desempenho e histórico de estudo</li>
                        <li>Manutenção dos dados fiscais pelo prazo legal (5 anos)</li>
                        <li>Encerramento imediato do acesso ao conteúdo do Produtor</li>
                    </ul>
                    <p className="text-gray-700 mt-3">
                        A Launcher pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso
                        prévio.
                    </p>
                </Section>

                <Section id="foro" title="12. Legislação Aplicável e Foro">
                    <p className="text-gray-700 leading-relaxed">
                        Estes Termos são regidos pela legislação brasileira. As partes elegem o foro da comarca de{" "}
                        <strong>[CIDADE/UF]</strong> para dirimir eventuais controvérsias, comprometendo-se a buscar
                        resolução amigável no prazo de 30 dias antes de acionar o Poder Judiciário.
                    </p>
                </Section>

                <Section id="geral" title="13. Disposições Gerais">
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                        <li>A invalidade de qualquer cláusula não afeta a validade das demais</li>
                        <li>A tolerância de qualquer violação não implica renúncia ao direito de exigi-la no futuro</li>
                        <li>Estes Termos constituem o acordo integral entre as partes sobre o objeto aqui tratado</li>
                        <li>Alterações serão comunicadas com antecedência mínima de 15 dias</li>
                    </ul>
                </Section>

                <p className="text-xs text-gray-400 mt-10 text-center">
                    Última atualização: {LAST_UPDATE} · Launcher EdTech · launcheredu.com.br
                </p>
            </div>
        </main>
    );
}
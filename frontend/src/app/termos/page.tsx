// frontend/src/app/termos/page.tsx
// Termos de Uso v2.0 — Launcher EdTech
// LGPD | CDC | Marco Civil | Lei de Direitos Autorais | Lei de Software

import Link from "next/link";

export const metadata = {
    title: "Termos de Uso | Launcher EdTech",
    description:
        "Condições gerais de uso da plataforma Launcher EdTech — aplicáveis a Produtores e Alunos.",
};

const SUPORTE_EMAIL = "suporte@launcheredu.com.br";
const VERSION = "2.0";
const DATE = "20 de abril de 2025";

function PageHeader() {
    return (
        <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-14 px-4">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="text-blue-300 hover:text-white text-sm mb-6 inline-flex items-center gap-1">
                    ← Voltar
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Termos de Uso</h1>
                        <p className="text-blue-200">Condições gerais aplicáveis a Produtores e Alunos</p>
                    </div>
                    <div className="text-right text-blue-300 text-sm">
                        <p>Versão {VERSION}</p>
                        <p>Vigência: {DATE}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Toc() {
    const sections = [
        { id: "partes", n: "1", label: "Partes e Definições" },
        { id: "aceitacao", n: "2", label: "Aceitação e Adesão" },
        { id: "natureza", n: "3", label: "Natureza do Serviço e Limitações" },
        { id: "cadastro", n: "4", label: "Cadastro, Conta e Segurança" },
        { id: "funcionalidades", n: "5", label: "Funcionalidades da Plataforma" },
        { id: "ia", n: "6", label: "Serviços de Inteligência Artificial" },
        { id: "produtor", n: "7", label: "Obrigações do Produtor" },
        { id: "aluno", n: "8", label: "Obrigações do Aluno" },
        { id: "pi", n: "9", label: "Propriedade Intelectual" },
        { id: "sla", n: "10", label: "Disponibilidade e SLA" },
        { id: "pagamento", n: "11", label: "Pagamento e Cancelamento" },
        { id: "responsabilidade", n: "12", label: "Limitação de Responsabilidade" },
        { id: "rescisao", n: "13", label: "Rescisão e Encerramento" },
        { id: "geral", n: "14", label: "Disposições Gerais" },
    ];
    return (
        <nav className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-10">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Sumário</p>
            <div className="grid sm:grid-cols-2 gap-1">
                {sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`}
                        className="flex items-baseline gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline py-0.5">
                        <span className="text-xs text-blue-400 font-mono min-w-[1.5rem]">{s.n}.</span>
                        {s.label}
                    </a>
                ))}
            </div>
        </nav>
    );
}

function Sec({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="mb-12 scroll-mt-6">
            <h2 className="text-xl font-bold text-blue-900 mb-1 flex items-center gap-2 border-b-2 border-blue-100 pb-2">
                <span className="text-blue-400 font-mono text-base">{n}.</span> {title}
            </h2>
            <div className="mt-4 space-y-3">{children}</div>
        </section>
    );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-5">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase tracking-wide text-blue-700">{title}</h3>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function T({ children }: { children: React.ReactNode }) {
    return <p className="text-gray-700 leading-relaxed text-sm">{children}</p>;
}

function UL({ items }: { items: string[] }) {
    return (
        <ul className="space-y-1.5 ml-1">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

function AlertBox({ children, variant = "amber" }: { children: React.ReactNode; variant?: "amber" | "blue" | "red" }) {
    const cls = {
        amber: "bg-amber-50 border-l-4 border-amber-400 text-amber-900",
        blue: "bg-blue-50 border-l-4 border-blue-400 text-blue-900",
        red: "bg-red-50 border-l-4 border-red-400 text-red-900",
    }[variant];
    return <div className={`p-4 rounded-r-lg text-sm leading-relaxed ${cls}`}>{children}</div>;
}

function InfoBox({ title, items, variant = "blue" }: { title: string; items: string[]; variant?: "blue" | "amber" }) {
    const cls = variant === "blue"
        ? "bg-blue-50 border-blue-200 text-blue-900"
        : "bg-amber-50 border-amber-200 text-amber-900";
    return (
        <div className={`border rounded-lg p-4 ${cls}`}>
            {title && <p className="font-semibold text-sm mb-2">{title}</p>}
            <ul className="space-y-1">
                {items.map((item, i) => (
                    <li key={i} className="text-sm">{item}</li>
                ))}
            </ul>
        </div>
    );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 my-3">
            <table className="w-full text-xs">
                <thead className="bg-blue-800 text-white">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="text-left p-3 font-semibold">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            {row.map((cell, j) => (
                                <td key={j} className="p-3 text-gray-700 align-top">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function TermosPage() {
    return (
        <main className="min-h-screen bg-white">
            <PageHeader />

            <div className="max-w-4xl mx-auto px-4 py-10">

                <AlertBox variant="amber">
                    <strong>LEIA COM ATENÇÃO.</strong> Ao criar uma conta, acessar ou utilizar qualquer
                    funcionalidade da Plataforma, você declara ter lido, compreendido e aceito integralmente
                    estes Termos e a{" "}
                    <Link href="/privacidade" className="underline font-medium">Política de Privacidade</Link>.
                    Se não concordar com qualquer cláusula, não utilize a plataforma.
                </AlertBox>
                <div className="mt-8" />

                <Toc />

                {/* ── 1. PARTES E DEFINIÇÕES ────────────────────────────────────────── */}
                <Sec id="partes" n="1" title="Partes e Definições">
                    <InfoBox title="LAUNCHER EDTECH (Empresa / nós / nosso)" variant="blue" items={[
                        "Razão Social: [INSERIR RAZÃO SOCIAL]",
                        "CNPJ: [INSERIR CNPJ]",
                        "Endereço: [INSERIR ENDEREÇO COMPLETO]",
                        "E-mail: contato@launcheredu.com.br",
                        "Site: https://launcheredu.com.br",
                    ]} />
                    <Sub title="Definições">
                        <DataTable
                            headers={["Termo", "Definição"]}
                            rows={[
                                ['"Plataforma"', 'Sistema SaaS de preparação para concursos públicos da Launcher, acessível em launcheredu.com.br e nos subdomínios dos Produtores, incluindo todos os módulos, APIs, banco de questões, sistema de IA e gamificação.'],
                                ['"Produtor"', 'Pessoa física ou jurídica que celebrou Contrato de Licença com a Launcher para disponibilizar conteúdo educacional a seus Alunos em área exclusiva (tenant) da Plataforma.'],
                                ['"Aluno"', 'Pessoa física que acessa a Plataforma por meio do portal de um Produtor, como cliente direto do Produtor. O Aluno não possui vínculo jurídico direto com a Launcher, salvo nas hipóteses destes Termos.'],
                                ['"Usuário"', 'Termo genérico que abrange Produtores e Alunos, quando a disposição se aplica a ambos.'],
                                ['"Conteúdo do Produtor"', 'Todo material criado, editado ou publicado pelo Produtor: questões próprias, videoaulas, apostilas, cronogramas e simulados personalizados.'],
                                ['"Banco de Questões Global"', 'Conjunto de questões compartilhadas entre Produtores (tenant_id = NULL), gerenciado pela Launcher e disponibilizado para uso educativo.'],
                                ['"Serviços de IA"', 'Funcionalidades baseadas no modelo Google Gemini 2.5 Flash Lite: insights de desempenho, Coach IA e geração de questões.'],
                                ['"Gamificação"', 'Sistema com 9 patentes (Recruta ao General), 34 insígnias e rankings. Personalizável pelo Produtor.'],
                                ['"Cápsula de Estudos"', 'Relatório mensal automático com desempenho, patente e mensagem motivacional, compartilhável publicamente (opt-in voluntário).'],
                                ['"Tenant"', 'Espaço logicamente isolado atribuído a cada Produtor, com dados, configurações e usuários completamente separados dos demais.'],
                                ['"SLA"', 'Service Level Agreement — acordo de nível de serviço que define metas de disponibilidade e suporte.'],
                            ]}
                        />
                    </Sub>
                </Sec>

                {/* ── 2. ACEITAÇÃO ─────────────────────────────────────────────────── */}
                <Sec id="aceitacao" n="2" title="Aceitação e Adesão">
                    <T>A aceitação destes Termos é condição indispensável para o acesso à Plataforma, perfectibilizando-se pelo simples uso, pelo clique no botão de aceite no cadastro ou pela assinatura do Contrato de Licença (Produtores).</T>
                    <T>Ao aceitar, o Usuário declara:</T>
                    <UL items={[
                        "Ter capacidade civil plena para celebrar contratos eletrônicos (maior de 18 anos, emancipado ou representante com poderes de pessoa jurídica)",
                        "Ter lido e compreendido integralmente estes Termos e a Política de Privacidade",
                        "Que as informações fornecidas no cadastro são verdadeiras, precisas, completas e atualizadas",
                        "Que responde civil e criminalmente pela veracidade das informações prestadas",
                    ]} />
                    <T>Menores de 18 anos só podem utilizar a Plataforma mediante autorização expressa e documentada de responsáveis legais, sendo estes solidariamente responsáveis pelo cumprimento destes Termos.</T>
                </Sec>

                {/* ── 3. NATUREZA DO SERVIÇO ───────────────────────────────────────── */}
                <Sec id="natureza" n="3" title="Natureza do Serviço e Limitações">
                    <AlertBox variant="blue">
                        <strong>A Launcher é uma plataforma de infraestrutura educacional — NÃO um estabelecimento de ensino,
                            NÃO uma instituição regulada pelo MEC e NÃO uma plataforma de comercialização de produtos digitais.</strong>
                        {" "}O relacionamento dos Alunos é com o PRODUTOR, não com a Launcher diretamente.
                    </AlertBox>
                    <Sub title="O que a Launcher NÃO faz">
                        <UL items={[
                            "NÃO garante aprovação de qualquer Aluno em qualquer concurso",
                            "NÃO é responsável pela qualidade ou precisão do Conteúdo do Produtor",
                            "NÃO atua como gestora de pagamentos dos Alunos",
                            "NÃO presta aconselhamento jurídico, psicológico ou vocacional",
                            "NÃO estabelece vínculo empregatício com Alunos ou Produtores",
                            "NÃO é responsável por disputas comerciais entre Produtores e seus Alunos (incluindo reembolsos)",
                        ]} />
                    </Sub>
                </Sec>

                {/* ── 4. CADASTRO E CONTA ──────────────────────────────────────────── */}
                <Sec id="cadastro" n="4" title="Cadastro, Conta e Segurança">
                    <Sub title="4.1 Obrigações do Usuário quanto à conta">
                        <T>O Usuário é o <strong>único responsável</strong> por:</T>
                        <UL items={[
                            "Manter a confidencialidade de sua senha e dados de acesso",
                            "Todas as atividades realizadas em sua conta, inclusive por terceiros que acessem com suas credenciais",
                            "Notificar imediatamente a Launcher em caso de suspeita de acesso não autorizado: suporte@launcheredu.com.br",
                            "Manter seus dados cadastrais atualizados e verdadeiros",
                        ]} />
                        <AlertBox variant="amber">
                            <strong>A Launcher NUNCA solicita senhas por e-mail, WhatsApp ou telefone.</strong> Não informe
                            sua senha a ninguém que afirme ser da Launcher.
                        </AlertBox>
                    </Sub>
                    <Sub title="4.2 Unicidade e intransferibilidade">
                        <UL items={[
                            "Cada Usuário pode possuir apenas uma conta ativa",
                            "Contas são pessoais e intransferíveis — é vedada cessão, venda, aluguel ou qualquer transferência a terceiros",
                            "A Launcher pode recusar novo cadastro de Usuário cujo cadastro anterior foi cancelado por violação destes Termos",
                        ]} />
                    </Sub>
                    <Sub title="4.3 Suspensão e encerramento pela Launcher">
                        <T>A Launcher pode suspender ou encerrar contas sem aviso prévio nos casos de: violação destes Termos, informações falsas, inadimplência do Produtor superior a 15 dias, determinação judicial, suspeita fundada de fraude ou atividade ilegal.</T>
                    </Sub>
                </Sec>

                {/* ── 5. FUNCIONALIDADES ───────────────────────────────────────────── */}
                <Sec id="funcionalidades" n="5" title="Funcionalidades da Plataforma">
                    <DataTable
                        headers={["Funcionalidade", "Descrição"]}
                        rows={[
                            ["Banco de Questões", "Acesso ao banco global e ao banco próprio do Produtor, com correção detalhada e dicas pedagógicas. Questões podem ser geradas por IA ou importadas."],
                            ["Cronograma Inteligente SM-2", "Algoritmo de repetição espaçada que adapta o cronograma automaticamente com base no desempenho, priorizando disciplinas com maior déficit."],
                            ["Simulados", "Simulados temporizados configuráveis por disciplina, quantidade, dificuldade e banca. Questões selecionadas dinamicamente por Aluno no início."],
                            ["Dashboard de Desempenho", "Painel com métricas de acerto por disciplina, evolução temporal, volume de estudo, aulas assistidas e indicadores de risco de abandono."],
                            ["Coach IA", "Widget que recomenda a próxima ação prioritária com base no desempenho atual (modelo Gemini, cache de 15 min)."],
                            ["Insights de Desempenho (IA)", "Análise semanal com tom personalizado conforme o perfil do concurso (cache de 2h)."],
                            ["Gamificação", "9 patentes, 34 insígnias e ranking de turma — personalizável pelo Produtor (nome, tema, cores)."],
                            ["Cápsula de Estudos", "Relatório mensal com métricas, patente e mensagem motivacional. Compartilhável por link público (opt-in)."],
                            ["Videoaulas", "Hospedagem e streaming via S3 (AWS), com controle de progresso por Aluno."],
                            ["Notificações", "Sistema interno com contagem de não lidas em tempo real."],
                            ["White Label", "Personalização completa: logo, cores (7 paletas), layouts (sidebar, topbar, minimal), página de login. Sem menção à Launcher para o Aluno (conforme Plano)."],
                            ["Painel do Produtor", "Gestão completa: alunos, cursos, questões, cronogramas, simulados, gamificação, aparência e analytics."],
                        ]}
                    />
                    <T>Funcionalidades adicionais (domínio personalizado, limites de Alunos, suporte prioritário) variam conforme o Plano contratado. A Launcher pode adicionar, modificar ou descontinuar funcionalidades, comunicando alterações relevantes com 30 dias de antecedência.</T>
                </Sec>

                {/* ── 6. IA ────────────────────────────────────────────────────────── */}
                <Sec id="ia" n="6" title="Serviços de Inteligência Artificial">
                    <T>Ao utilizar os Serviços de IA, o Usuário reconhece e concorda que:</T>
                    <UL items={[
                        "Os insights e recomendações são ORIENTATIVOS e PROBABILÍSTICOS — não constituem garantia, certeza ou aconselhamento profissional vinculante",
                        "A IA pode gerar conteúdo impreciso ou inadequado — o Usuário é encorajado a reportar erros pelo suporte",
                        "Dados de desempenho (anonimizados) são transmitidos ao modelo Gemini da Google LLC. Ao usar os Serviços de IA, o Usuário consente com esse processamento",
                        "Existe sempre um sistema de fallback baseado em regras quando a IA não está disponível",
                        "Nenhuma decisão automatizada produz efeito jurídico sem revisão humana (art. 20, LGPD)",
                        "O Usuário tem direito a solicitar explicação sobre a lógica dos insights de IA",
                    ]} />
                </Sec>

                {/* ── 7. OBRIGAÇÕES DO PRODUTOR ────────────────────────────────────── */}
                <Sec id="produtor" n="7" title="Obrigações Específicas do Produtor">
                    <Sub title="7.1 Quanto ao conteúdo">
                        <T>O Produtor é o <strong>único e exclusivo responsável</strong> por todo Conteúdo publicado em seu tenant:</T>
                        <UL items={[
                            "Garantir todos os direitos autorais, de imagem e de uso necessários para o Conteúdo publicado",
                            "Garantir que o Conteúdo é verídico, preciso, atualizado e adequado ao nível anunciado",
                            "Garantir que o Conteúdo não viola direitos de terceiros, não é difamatório, enganoso ou ilegal",
                            "Remover imediatamente conteúdo que se torne desatualizado, incorreto ou inadequado",
                            "Respeitar os limites do uso educativo de questões de concursos (art. 46, III, Lei 9.610/1998)",
                        ]} />
                    </Sub>
                    <Sub title="7.2 Quanto aos Alunos">
                        <T>O Produtor é o <strong>responsável legal</strong> pelo atendimento a seus Alunos, incluindo suporte, reembolsos, cancelamentos e resolução de reclamações. O Produtor deve:</T>
                        <UL items={[
                            "Informar os Alunos que a Plataforma é operada pela Launcher e que seus dados serão tratados conforme a Política de Privacidade da Launcher",
                            "Obter de seus Alunos todos os consentimentos necessários para o tratamento de dados pessoais, incluindo para uso de IA, conforme a LGPD",
                            "Fornecer informações claras sobre conteúdo, preço, condições de acesso e política de reembolso",
                        ]} />
                    </Sub>
                    <Sub title="7.3 Quanto ao uso técnico">
                        <UL items={[
                            "Não ultrapassar os limites do Plano contratado",
                            "Não realizar engenharia reversa, decompilação ou tentativas de acesso ao código-fonte",
                            "Não utilizar bots, scripts ou automações não autorizadas",
                            "Comunicar à Launcher em até 48h qualquer vulnerabilidade identificada (responsible disclosure)",
                        ]} />
                    </Sub>
                    <Sub title="7.4 Indenização pelo Produtor">
                        <T>O Produtor obriga-se a indenizar e manter a Launcher indene de demandas, perdas, danos e honorários decorrentes de: violação destes Termos, violação de direitos autorais no Conteúdo, reclamações de Alunos pelo serviço educacional, violações da LGPD como Controlador, e conduta ilegal do Produtor.</T>
                    </Sub>
                </Sec>

                {/* ── 8. OBRIGAÇÕES DO ALUNO ───────────────────────────────────────── */}
                <Sec id="aluno" n="8" title="Obrigações Específicas do Aluno">
                    <UL items={[
                        "Utilizar o conteúdo exclusivamente para preparação pessoal a concursos públicos",
                        "Não gravar, reproduzir, distribuir ou comercializar qualquer conteúdo da Plataforma sem autorização expressa",
                        "Não compartilhar credenciais de acesso com terceiros",
                        "Não utilizar aplicativos ou extensões que realizem captura automática de conteúdo",
                        "Não criar conteúdos derivados para fins comerciais baseados exclusivamente no conteúdo da Plataforma",
                    ]} />
                </Sec>

                {/* ── 9. PROPRIEDADE INTELECTUAL ───────────────────────────────────── */}
                <Sec id="pi" n="9" title="Propriedade Intelectual">
                    <Sub title="9.1 Propriedade da Launcher">
                        <T>São de propriedade exclusiva da Launcher, protegidos pelas Leis 9.610/1998 e 9.609/1998:</T>
                        <UL items={[
                            "Código-fonte da Plataforma e toda a arquitetura de software",
                            "A marca \"Launcher\", \"Launcher EdTech\" e \"launcheredu.com.br\"",
                            "Design da interface, layouts e elementos gráficos originais",
                            "Algoritmo SM-2 customizado e sistema de gamificação (9 patentes, 34 insígnias)",
                            "Prompts de IA e arquitetura dos Serviços de IA",
                            "Relatórios, métricas e dashboards gerados pela Plataforma",
                            "Banco de Questões Global (questões de titularidade da Launcher)",
                        ]} />
                    </Sub>
                    <Sub title="9.2 Propriedade do Produtor">
                        <T>O Conteúdo do Produtor permanece de sua propriedade intelectual. Ao publicá-lo, o Produtor concede à Launcher licença não exclusiva, gratuita e revogável para armazenar, processar e exibir o Conteúdo exclusivamente na Plataforma e durante a vigência do contrato.</T>
                    </Sub>
                    <Sub title="9.3 Banco de Questões Global — Direito Autoral">
                        <T>O Banco de Questões Global pode incluir questões de certames públicos reproduzidas com base no art. 46, III, da Lei 9.610/1998 (uso educativo). Produtores e Alunos estão <strong>expressamente proibidos</strong> de exportar, reproduzir em massa ou comercializar questões do banco global.</T>
                    </Sub>
                </Sec>

                {/* ── 10. SLA ──────────────────────────────────────────────────────── */}
                <Sec id="sla" n="10" title="Disponibilidade do Serviço e SLA">
                    <Sub title="10.1 Meta de disponibilidade">
                        <T>A Launcher compromete-se a manter a Plataforma disponível com meta de <strong>99% ao mês</strong>, excluindo janelas de manutenção programada.</T>
                    </Sub>
                    <Sub title="10.2 Hipóteses excluídas do SLA">
                        <UL items={[
                            "Manutenções programadas (aviso mínimo de 12h, preferencialmente entre 00h–06h BRT)",
                            "Falhas de infraestrutura de terceiros (AWS, Vercel, Cloudflare, Google)",
                            "Ataques DDoS em andamento",
                            "Força maior: desastres naturais, blecautes, guerras, pandemias",
                            "Ações ou omissões do Usuário que causem indisponibilidade",
                        ]} />
                    </Sub>
                    <Sub title="10.3 Consequências do descumprimento do SLA">
                        <T>Em caso de disponibilidade inferior a 99% no mês (excluídas as hipóteses acima), o Produtor terá direito a crédito proporcional na fatura seguinte, calculado sobre o tempo excedente de indisponibilidade.</T>
                    </Sub>
                </Sec>

                {/* ── 11. PAGAMENTO ────────────────────────────────────────────────── */}
                <Sec id="pagamento" n="11" title="Pagamento, Faturamento e Cancelamento (Produtores)">
                    <Sub title="11.1 Modelo de remuneração">
                        <UL items={[
                            "Taxa fixa mensal de assinatura (conforme o Plano contratado)",
                            "Taxa variável sobre cada venda processada dentro da Plataforma (conforme percentual do Plano)",
                        ]} />
                    </Sub>
                    <Sub title="11.2 Inadimplência">
                        <UL items={[
                            "Atraso > 10 dias: multa moratória de 2% + juros de 1% ao mês pro rata die",
                            "Atraso > 15 dias: suspensão preventiva do acesso ao painel administrativo",
                            "Atraso > 30 dias: rescisão contratual unilateral pela Launcher",
                        ]} />
                    </Sub>
                    <Sub title="11.3 Política de reembolso">
                        <UL items={[
                            "DIREITO DE ARREPENDIMENTO: nos primeiros 7 dias após a primeira assinatura (art. 49, CDC), reembolso integral sem necessidade de justificativa",
                            "APÓS 7 DIAS: sem reembolso de períodos já vigentes, salvo falha comprovada da Launcher ou acordo específico por escrito",
                            "Valores de períodos futuros (pagamentos antecipados) são reembolsados proporcionalmente em caso de cancelamento",
                        ]} />
                    </Sub>
                    <Sub title="11.4 Cancelamento pelo Produtor">
                        <UL items={[
                            "Cancelamento a qualquer momento com aviso prévio de 30 dias, sem multa rescisória",
                            "Acesso ao painel mantido até o fim do período pago",
                            "15 dias após o encerramento para exportar dados dos Alunos",
                        ]} />
                    </Sub>
                </Sec>

                {/* ── 12. RESPONSABILIDADE ─────────────────────────────────────────── */}
                <Sec id="responsabilidade" n="12" title="Limitação de Responsabilidade">
                    <Sub title="12.1 Exclusões">
                        <T>A Launcher NÃO será responsável por:</T>
                        <UL items={[
                            "Danos indiretos, incidentais, especiais ou punitivos",
                            "Perda de dados, receita, lucros cessantes ou oportunidades de negócio",
                            "Conteúdo publicado por Produtores e sua precisão ou adequação pedagógica",
                            "Não aprovação de Alunos em concursos públicos",
                            "Falhas de terceiros (AWS, Google, Vercel, Cloudflare, gateways de pagamento)",
                            "Ações baseadas em insights ou recomendações de IA",
                            "Interrupções dentro das hipóteses excluídas do SLA",
                        ]} />
                    </Sub>
                    <Sub title="12.2 Teto de responsabilidade">
                        <T>A responsabilidade total da Launcher, por qualquer causa, fica limitada ao <strong>valor total pago pelo Produtor nos 3 meses anteriores</strong> ao evento danoso.</T>
                    </Sub>
                    <AlertBox variant="blue">
                        <strong>Proteção ao Consumidor (Alunos — CDC):</strong> Alunos são consumidores nos termos do
                        CDC (Lei 8.078/1990). As exclusões acima não afastam a responsabilidade da Launcher por defeito
                        na prestação do serviço de infraestrutura (art. 14, CDC). A Launcher não responde solidariamente
                        por atos exclusivos do Produtor (conteúdo, preços, reembolsos).
                    </AlertBox>
                </Sec>

                {/* ── 13. RESCISÃO ─────────────────────────────────────────────────── */}
                <Sec id="rescisao" n="13" title="Rescisão e Encerramento">
                    <Sub title="13.1 Pelo Usuário">
                        <UL items={[
                            "Produtor: resiliência com aviso prévio de 30 dias, sem multa, mantendo acesso até o fim do período pago",
                            "Aluno: encerramento de conta a qualquer tempo pelo canal de suporte ou e-mail de privacidade",
                        ]} />
                    </Sub>
                    <Sub title="13.2 Pela Launcher">
                        <UL items={[
                            "Por conveniência: aviso prévio de 30 dias, sem multa, com reembolso proporcional do período não fruído",
                            "Por justa causa (sem aviso e sem reembolso): violação grave dos Termos, conteúdo ilegal, inadimplência > 30 dias, fraude ou dano reputacional doloso à Launcher",
                        ]} />
                    </Sub>
                    <Sub title="13.3 Consequências da rescisão">
                        <UL items={[
                            "15 dias para exportação de dados (Produtor) a partir do encerramento",
                            "Eliminação segura dos dados nos prazos da Política de Privacidade",
                            "Sobrevivência das cláusulas de confidencialidade, propriedade intelectual, indenização e limitação de responsabilidade",
                        ]} />
                    </Sub>
                </Sec>

                {/* ── 14. DISPOSIÇÕES GERAIS ───────────────────────────────────────── */}
                <Sec id="geral" n="14" title="Disposições Gerais">
                    <UL items={[
                        "INTEGRALIDADE: estes Termos e a Política de Privacidade constituem o acordo integral entre as partes, revogando entendimentos anteriores",
                        "TOLERÂNCIA: a tolerância de infrações não implica renúncia ou novação",
                        "INVALIDADE PARCIAL: a nulidade de qualquer cláusula não afeta as demais",
                        "CESSÃO: o Usuário não pode ceder seus direitos sem autorização prévia da Launcher. A Launcher pode ceder em caso de fusão, aquisição ou venda de ativos (notificação com 30 dias)",
                        "ATUALIZAÇÕES: alterações relevantes comunicadas por e-mail com 15 dias de antecedência",
                    ]} />
                    <Sub title="Legislação aplicável">
                        <UL items={[
                            "Lei 13.709/2018 (LGPD)",
                            "Lei 12.965/2014 (Marco Civil da Internet)",
                            "Lei 8.078/1990 (CDC)",
                            "Lei 9.610/1998 (Direitos Autorais)",
                            "Lei 9.609/1998 (Software)",
                            "Lei 10.406/2002 (Código Civil)",
                        ]} />
                        <T>As partes elegem o foro da comarca de <strong>[CIDADE/UF]</strong> para dirimir controvérsias. Antes do Judiciário, comprometem-se a tentar solução amigável em 30 dias.</T>
                    </Sub>
                    <InfoBox title="Canais de contato" variant="blue" items={[
                        `Suporte técnico: ${SUPORTE_EMAIL} | WhatsApp: (62) 99559-4055`,
                        "Privacidade e dados: privacidade@launcheredu.com.br",
                        "Comercial: contato@launcheredu.com.br",
                        "Instagram: @plataforma_launcher",
                    ]} />
                </Sec>

                <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400 space-y-1">
                    <p>Termos de Uso — Versão {VERSION} — Vigência: {DATE}</p>
                    <p>Launcher EdTech · launcheredu.com.br</p>
                </div>
            </div>
        </main>
    );
}
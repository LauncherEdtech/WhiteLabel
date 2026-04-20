// frontend/src/app/privacidade/page.tsx
// Política de Privacidade v2.0 — Launcher EdTech
// LGPD (Lei 13.709/2018) | Marco Civil (Lei 12.965/2014) | CDC (Lei 8.078/1990)

import Link from "next/link";

export const metadata = {
    title: "Política de Privacidade | Launcher EdTech",
    description:
        "Como a Launcher EdTech coleta, usa, armazena e protege seus dados pessoais, em conformidade com a LGPD (Lei 13.709/2018).",
};

const DPO_EMAIL = "privacidade@launcheredu.com.br";
const VERSION = "2.0";
const DATE = "20 de abril de 2025";

// ─── Componentes ──────────────────────────────────────────────────────────────

function PageHeader() {
    return (
        <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-14 px-4">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="text-blue-300 hover:text-white text-sm mb-6 inline-flex items-center gap-1">
                    ← Voltar
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Política de Privacidade</h1>
                        <p className="text-blue-200">Em conformidade com a LGPD (Lei n.º 13.709/2018)</p>
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
    const items = [
        { id: "controlador", n: "1", label: "Identificação do Controlador" },
        { id: "definicoes", n: "2", label: "Definições" },
        { id: "dados", n: "3", label: "Dados que Coletamos" },
        { id: "finalidades", n: "4", label: "Finalidades e Bases Legais" },
        { id: "ia", n: "5", label: "Inteligência Artificial e Decisões Automatizadas" },
        { id: "compartilhamento", n: "6", label: "Compartilhamento com Terceiros" },
        { id: "retencao", n: "7", label: "Retenção e Eliminação de Dados" },
        { id: "seguranca", n: "8", label: "Segurança da Informação" },
        { id: "direitos", n: "9", label: "Seus Direitos" },
        { id: "capsula", n: "10", label: "Cápsula de Estudos e Compartilhamento Público" },
        { id: "cookies", n: "11", label: "Cookies e Tecnologias Similares" },
        { id: "menores", n: "12", label: "Proteção de Menores" },
        { id: "internacional", n: "13", label: "Transferência Internacional de Dados" },
        { id: "alteracoes", n: "14", label: "Alterações nesta Política" },
        { id: "lei", n: "15", label: "Legislação e Foro" },
        { id: "contato", n: "16", label: "Contato e Canal DPO" },
    ];
    return (
        <nav className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-10">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Sumário</p>
            <div className="grid sm:grid-cols-2 gap-1">
                {items.map((i) => (
                    <a key={i.id} href={`#${i.id}`}
                        className="flex items-baseline gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline py-0.5">
                        <span className="text-xs text-blue-400 font-mono min-w-[1.5rem]">{i.n}.</span>
                        {i.label}
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
            <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
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

function InfoBox({ title, items, variant = "blue" }: { title: string; items: string[]; variant?: "blue" | "amber" | "green" }) {
    const cls = {
        blue: "bg-blue-50 border-blue-200 text-blue-900",
        amber: "bg-amber-50 border-amber-300 text-amber-900",
        green: "bg-green-50 border-green-200 text-green-900",
    }[variant];
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

function AlertBox({ children, variant = "amber" }: { children: React.ReactNode; variant?: "amber" | "blue" | "red" }) {
    const cls = {
        amber: "bg-amber-50 border-l-4 border-amber-400 text-amber-900",
        blue: "bg-blue-50 border-l-4 border-blue-400 text-blue-900",
        red: "bg-red-50 border-l-4 border-red-400 text-red-900",
    }[variant];
    return <div className={`p-4 rounded-r-lg text-sm leading-relaxed ${cls}`}>{children}</div>;
}

function DataTable({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths?: string[] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 my-3">
            <table className="w-full text-xs">
                <thead className="bg-blue-800 text-white">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={`text-left p-3 font-semibold ${widths?.[i] ?? ""}`}>{h}</th>
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

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PoliticaPrivacidadePage() {
    return (
        <main className="min-h-screen bg-white">
            <PageHeader />

            <div className="max-w-4xl mx-auto px-4 py-10">

                <AlertBox variant="blue">
                    <strong>Ao utilizar a plataforma Launcher, você declara ter lido, compreendido e aceito integralmente esta Política.</strong>{" "}
                    Se não concordar com qualquer disposição, não utilize a plataforma.
                </AlertBox>
                <div className="mt-8" />

                <Toc />

                {/* ── 1. CONTROLADOR ──────────────────────────────────────────────── */}
                <Sec id="controlador" n="1" title="Identificação do Controlador">
                    <T>
                        A <strong>LAUNCHER EDTECH</strong> ("Launcher", "nós", "nosso") é a{" "}
                        <strong>Controladora</strong> dos dados pessoais tratados por meio desta Política, nos
                        termos do art. 5°, VI, da LGPD.
                    </T>
                    <InfoBox title="Controlador de Dados" variant="blue" items={[
                        "Razão Social: [INSERIR RAZÃO SOCIAL]",
                        "CNPJ: [INSERIR CNPJ]",
                        "Endereço: [INSERIR ENDEREÇO COMPLETO]",
                        `Canal de Privacidade / DPO: ${DPO_EMAIL}`,
                        "Encarregado de Dados (DPO): [NOME DO DPO]",
                        "Site: https://launcheredu.com.br",
                    ]} />
                    <T>
                        Na relação com os <strong>Produtores parceiros</strong>, a Launcher atua como{" "}
                        <strong>Operadora</strong> dos dados pessoais dos Alunos, processando-os em nome do
                        Produtor (Controlador), conforme art. 5°, VII, LGPD. As obrigações recíprocas estão
                        detalhadas no Acordo de Processamento de Dados (DPA) de cada Produtor.
                    </T>
                </Sec>

                {/* ── 2. DEFINIÇÕES ───────────────────────────────────────────────── */}
                <Sec id="definicoes" n="2" title="Definições">
                    <DataTable
                        headers={["Termo", "Definição"]}
                        widths={["w-32", ""]}
                        rows={[
                            ["Dado Pessoal", "Informação relacionada a pessoa natural identificada ou identificável (art. 5°, I, LGPD)."],
                            ["Titular", "Pessoa natural a quem se referem os dados pessoais tratados."],
                            ["Controlador", "Quem decide sobre o tratamento. Para dados dos Produtores: Launcher. Para dados dos Alunos: o Produtor."],
                            ["Operador", "Quem realiza o tratamento em nome do Controlador. Para dados dos Alunos: Launcher."],
                            ["Tratamento", "Toda operação com dados pessoais: coleta, armazenamento, uso, compartilhamento, eliminação, etc. (art. 5°, X, LGPD)."],
                            ["ANPD", "Autoridade Nacional de Proteção de Dados — órgão federal responsável por zelar pelo cumprimento da LGPD."],
                            ["Produtor", "Pessoa física ou jurídica que contratou a Launcher para hospedar e disponibilizar conteúdo educacional a seus Alunos."],
                            ["Aluno", "Usuário final que acessa a plataforma por meio do portal de um Produtor."],
                            ["Plataforma", "Sistema SaaS da Launcher, disponível em launcheredu.com.br e nos subdomínios dos Produtores."],
                            ["IA Generativa", "Modelo Google Gemini 2.5 Flash Lite, utilizado para insights de desempenho e questões de estudo."],
                        ]}
                    />
                </Sec>

                {/* ── 3. DADOS COLETADOS ───────────────────────────────────────────── */}
                <Sec id="dados" n="3" title="Dados que Coletamos">
                    <Sub title="3.1 Fornecidos diretamente por você">
                        <UL items={[
                            "Nome completo e endereço de e-mail (cadastro)",
                            "Senha (armazenada sob hash bcrypt — nunca em texto puro)",
                            "Foto de perfil e biografia (opcionais)",
                            "Dados de contato complementares fornecidos voluntariamente",
                            "Para Produtores: CPF/CNPJ, dados bancários para repasse e materiais de identidade visual",
                        ]} />
                    </Sub>
                    <Sub title="3.2 Coletados automaticamente pelo uso">
                        <UL items={[
                            "Histórico completo de questões respondidas, alternativas selecionadas e tempo de resposta",
                            "Índice de acerto por disciplina, tópico e nível de dificuldade",
                            "Progresso em videoaulas (tempo assistido, percentual concluído, pontos de pausa)",
                            "Atividades no cronograma de estudos (itens concluídos, atrasos, reorganizações)",
                            "Resultados e desempenho em simulados temporizados",
                            "Interações com o sistema de gamificação (patentes, insígnias, ranking)",
                            "Timestamps de acesso, duração de sessões e última atividade",
                            "Endereços IP, agentes de navegação (user-agent) e tipo de dispositivo",
                            "Logs de acesso exigidos pelo art. 15 do Marco Civil da Internet",
                            "Preferências de interface (tema, layout de navegação)",
                        ]} />
                    </Sub>
                    <Sub title="3.3 Gerados e inferidos pela plataforma">
                        <UL items={[
                            "Métricas consolidadas de desempenho (taxa de acerto global e por disciplina, evolução temporal)",
                            "Cronogramas de estudos personalizados via algoritmo SM-2 (repetição espaçada)",
                            "Insights e recomendações gerados por IA (Google Gemini)",
                            "Próximo passo de estudo recomendado pelo Coach IA (cache de 15 min)",
                            "Classificação de risco de abandono (sem atividade há mais de 7 dias)",
                            "Cápsulas de Estudos mensais: relatório consolidado de desempenho e patente conquistada",
                            "Pontuação e posição no ranking de gamificação da turma",
                        ]} />
                    </Sub>
                    <AlertBox variant="blue">
                        <strong>Dados que NÃO coletamos:</strong> números de cartão de crédito ou dados bancários de Alunos,
                        dados biométricos, dados de saúde, conteúdo de comunicações privadas, ou dados de menores de 18 anos
                        sem consentimento verificável do responsável legal.
                    </AlertBox>
                </Sec>

                {/* ── 4. FINALIDADES E BASES LEGAIS ───────────────────────────────── */}
                <Sec id="finalidades" n="4" title="Finalidades e Bases Legais do Tratamento">
                    <T>Nos termos do art. 7° da LGPD, todo tratamento possui base legal específica:</T>
                    <DataTable
                        headers={["Finalidade", "Base Legal", "Art. LGPD"]}
                        rows={[
                            ["Criação e gestão de conta", "Execução de contrato", "Art. 7°, V"],
                            ["Autenticação e controle de sessões", "Execução de contrato", "Art. 7°, V"],
                            ["Serviços educacionais (questões, simulados, videoaulas)", "Execução de contrato", "Art. 7°, V"],
                            ["Cronograma personalizado via SM-2", "Execução de contrato", "Art. 7°, V"],
                            ["Insights de IA e Coach IA", "Execução de contrato / Legítimo interesse", "Art. 7°, V e IX"],
                            ["Gamificação (patentes, insígnias, rankings)", "Execução de contrato / Consentimento", "Art. 7°, I e V"],
                            ["Cápsula de Estudos — relatório interno", "Execução de contrato", "Art. 7°, V"],
                            ["Cápsula de Estudos — compartilhamento público", "Consentimento", "Art. 7°, I"],
                            ["E-mails transacionais (confirmação, redefinição de senha)", "Execução de contrato", "Art. 7°, V"],
                            ["Notificações do sistema (novas aulas, conquistas)", "Execução de contrato / Legítimo interesse", "Art. 7°, V e IX"],
                            ["Comunicações de marketing", "Consentimento", "Art. 7°, I"],
                            ["Análise de uso e melhoria da plataforma", "Legítimo interesse", "Art. 7°, IX"],
                            ["Prevenção a fraudes e segurança", "Legítimo interesse / Obrigação legal", "Art. 7°, II e IX"],
                            ["Cumprimento de obrigações fiscais (NFS-e)", "Obrigação legal", "Art. 7°, II"],
                            ["Atendimento a determinações judiciais/administrativas", "Obrigação legal", "Art. 7°, II"],
                            ["Estatísticas anonimizadas", "Legítimo interesse (dado anonimizado não é dado pessoal)", "Art. 12, LGPD"],
                        ]}
                    />
                </Sec>

                {/* ── 5. IA ────────────────────────────────────────────────────────── */}
                <Sec id="ia" n="5" title="Inteligência Artificial e Decisões Automatizadas">
                    <Sub title="5.1 Como utilizamos IA">
                        <T>Utilizamos o modelo <strong>Gemini 2.5 Flash Lite (Google LLC)</strong> para:</T>
                        <UL items={[
                            "Gerar insights personalizados de desempenho (analisando acertos, disciplinas com menor rendimento, volume semanal e missões pendentes)",
                            "Recomendar a próxima ação de estudo prioritária (Coach IA)",
                            "Gerar questões de prática com dicas pedagógicas adaptadas ao nível do aluno",
                            "Personalizar o tom dos insights conforme o perfil do concurso (militar, policial, jurídico, fiscal, administrativo, saúde)",
                        ]} />
                    </Sub>
                    <Sub title="5.2 Dados utilizados pela IA">
                        <T>Para gerar insights, a IA recebe <strong>somente métricas de desempenho anonimizadas</strong>: taxa de acerto por disciplina, progresso nas missões, última atividade e perfil de concurso. A IA <strong>não tem acesso</strong> ao nome, e-mail ou qualquer identificador direto do usuário.</T>
                    </Sub>
                    <Sub title="5.3 Seus direitos sobre decisões automatizadas (art. 20, LGPD)">
                        <AlertBox variant="blue">
                            <strong>Direito de revisão:</strong> você pode solicitar explicação sobre a lógica dos insights de IA
                            e a revisão de qualquer recomendação automatizada que afete seus interesses. Entre em contato: {DPO_EMAIL}
                        </AlertBox>
                        <UL items={[
                            "Os insights de IA são ORIENTATIVOS — não constituem garantia de aprovação ou aconselhamento profissional",
                            "Existe sempre um sistema de fallback baseado em regras quando a IA não está disponível",
                            "Nenhuma decisão automatizada produz efeito jurídico sem revisão humana",
                            "A Launcher monitora continuamente a qualidade do conteúdo gerado pela IA",
                        ]} />
                    </Sub>
                </Sec>

                {/* ── 6. COMPARTILHAMENTO ──────────────────────────────────────────── */}
                <Sec id="compartilhamento" n="6" title="Compartilhamento com Terceiros">
                    <AlertBox variant="blue">
                        <strong>A Launcher NÃO vende, aluga ou comercializa dados pessoais.</strong> O compartilhamento ocorre
                        exclusivamente com os parceiros abaixo, todos com DPA próprio e base legal adequada.
                    </AlertBox>
                    <Sub title="6.1 Suboperadores e fornecedores">
                        <DataTable
                            headers={["Terceiro", "Serviço", "Dados", "País"]}
                            rows={[
                                ["Amazon Web Services", "Hospedagem (ECS), banco de dados (RDS), cache (ElastiCache), fila (SQS), e-mail (SES)", "Todos os dados da plataforma", "EUA — SCC"],
                                ["Google LLC (Gemini API)", "Geração de insights por IA", "Métricas anonimizadas de desempenho", "EUA — Google DPA"],
                                ["Vercel Inc.", "Hospedagem e CDN do frontend", "Dados de acesso e cookies de sessão", "EUA — Vercel DPA"],
                                ["Cloudflare Inc.", "Tunnel e DNS da API", "Metadados de tráfego", "EUA — Cloudflare DPA"],
                                ["Gateway de Pagamento (Produtor)", "Pagamentos das assinaturas", "Dados financeiros do Produtor", "BR/EUA"],
                            ]}
                        />
                    </Sub>
                    <Sub title="6.2 Produtores parceiros">
                        <T>Cada Produtor tem acesso restrito apenas aos dados de desempenho dos seus próprios Alunos, por meio do painel administrativo isolado por tenant. A Launcher <strong>nunca</strong> compartilha dados de Alunos de um Produtor com outro.</T>
                    </Sub>
                    <Sub title="6.3 Autoridades">
                        <T>Dados podem ser compartilhados com autoridades judiciais ou administrativas quando exigido por lei, ordem judicial ou inquérito administrativo. O usuário será notificado sempre que legalmente permitido.</T>
                    </Sub>
                </Sec>

                {/* ── 7. RETENÇÃO ──────────────────────────────────────────────────── */}
                <Sec id="retencao" n="7" title="Retenção e Eliminação de Dados">
                    <DataTable
                        headers={["Categoria de Dado", "Prazo", "Base Legal"]}
                        rows={[
                            ["Dados de conta (nome, e-mail, senha)", "Durante a vigência da conta", "Execução de contrato"],
                            ["Histórico acadêmico", "Conta ativa + 90 dias após exclusão", "Legítimo interesse (portabilidade)"],
                            ["Logs de acesso e segurança", "6 meses", "Art. 15, Marco Civil da Internet"],
                            ["Dados fiscais e transacionais", "5 anos após o exercício fiscal", "Legislação tributária"],
                            ["Registros de consentimento e aceite", "5 anos após revogação", "Prova de cumprimento legal"],
                            ["E-mails de marketing", "Até revogação do consentimento", "Art. 7°, I, LGPD"],
                            ["Cápsulas compartilhadas publicamente", "Até revogação pelo usuário", "Consentimento"],
                            ["Backups de banco de dados", "30 dias após a data do backup", "Segurança da informação"],
                        ]}
                    />
                    <T>Após os prazos acima, os dados são eliminados de forma segura ou anonimizados para fins estatísticos. Dados de obrigação legal são isolados em ambiente separado pelo prazo exigido.</T>
                </Sec>

                {/* ── 8. SEGURANÇA ─────────────────────────────────────────────────── */}
                <Sec id="seguranca" n="8" title="Segurança da Informação">
                    <Sub title="8.1 Medidas técnicas implementadas">
                        <DataTable
                            headers={["Medida", "Detalhamento"]}
                            rows={[
                                ["Senhas com bcrypt", "Hash criptográfico com salt aleatório — senhas nunca em texto puro"],
                                ["HTTPS obrigatório", "TLS 1.2+ em toda comunicação. HSTS com max-age de 1 ano e includeSubDomains"],
                                ["Headers de segurança HTTP", "X-Frame-Options: DENY; X-Content-Type-Options: nosniff; Referrer-Policy; Permissions-Policy"],
                                ["Autenticação JWT", "Tokens com expiração configurada, validados a cada requisição"],
                                ["VPC privada (AWS)", "Banco de dados e cache em subnet privada, sem exposição pública direta"],
                                ["RBAC", "3 níveis de acesso: Super Admin (Launcher), Produtor e Aluno — permissões estritas por nível"],
                                ["Isolamento multi-tenant", "Dados de cada Produtor separados por tenant_id — impossível acesso cruzado na camada de aplicação"],
                                ["Rate limiting", "Limites por IP e por usuário via Redis para prevenir abuso e ataques de força bruta"],
                                ["Backups automáticos", "Snapshots diários do RDS com retenção de 30 dias"],
                            ]}
                        />
                    </Sub>
                    <Sub title="8.2 Resposta a incidentes (art. 48, LGPD)">
                        <T>Em caso de incidente relevante, a Launcher notificará a ANPD em até <strong>72 horas</strong> e os titulares afetados de forma direta e clara, informando: natureza dos dados, riscos possíveis, medidas adotadas e canal de contato.</T>
                    </Sub>
                </Sec>

                {/* ── 9. DIREITOS ──────────────────────────────────────────────────── */}
                <Sec id="direitos" n="9" title="Seus Direitos">
                    <DataTable
                        headers={["Direito", "O que você pode solicitar", "Art. LGPD"]}
                        rows={[
                            ["Confirmação e acesso", "Confirmar se tratamos seus dados e receber cópia completa", "Art. 18, I e II"],
                            ["Correção", "Corrigir dados incompletos, inexatos ou desatualizados", "Art. 18, III"],
                            ["Anonimização e bloqueio", "Dados desnecessários ou excessivos anonimizados, bloqueados ou eliminados", "Art. 18, IV"],
                            ["Eliminação", "Eliminar dados tratados com base no consentimento (exceto retenção legal)", "Art. 18, VI"],
                            ["Portabilidade", "Receber seus dados em formato estruturado para transferência", "Art. 18, V"],
                            ["Informação sobre compartilhamento", "Saber com quem compartilhamos seus dados", "Art. 18, VII"],
                            ["Revogação de consentimento", "Revogar qualquer consentimento a qualquer momento", "Art. 18, IX"],
                            ["Petição à ANPD", "Registrar reclamação perante a Autoridade Nacional", "Art. 18, X"],
                            ["Revisão de decisão automatizada", "Solicitar revisão de qualquer recomendação de IA", "Art. 20"],
                        ]}
                    />
                    <InfoBox title="Como exercer seus direitos" variant="blue" items={[
                        `E-mail: ${DPO_EMAIL}`,
                        "Prazo de resposta: 15 dias úteis (prorrogáveis com justificativa)",
                        "Gratuito: o exercício de direitos não implica cobrança",
                        "ANPD: www.gov.br/anpd | anpd@anpd.gov.br",
                    ]} />
                </Sec>

                {/* ── 10. CÁPSULA ──────────────────────────────────────────────────── */}
                <Sec id="capsula" n="10" title="Cápsula de Estudos e Compartilhamento Público">
                    <T>A "Cápsula de Estudos" gera mensalmente um relatório visual com métricas de desempenho, patente conquistada e mensagem motivacional. O compartilhamento público é <strong>voluntário</strong> e requer ação explícita do usuário.</T>
                    <UL items={[
                        "Ao compartilhar, você consente com a publicação pública das informações contidas na Cápsula",
                        "O link gerado é acessível por qualquer pessoa que o receba, sem autenticação",
                        "Você pode revogar o compartilhamento a qualquer momento, tornando o link inativo",
                        "A Launcher não usa o conteúdo das Cápsulas compartilhadas para fins publicitários próprios sem consentimento adicional",
                    ]} />
                </Sec>

                {/* ── 11. COOKIES ──────────────────────────────────────────────────── */}
                <Sec id="cookies" n="11" title="Cookies e Tecnologias Similares">
                    <DataTable
                        headers={["Cookie", "Finalidade", "Tipo", "Duração"]}
                        rows={[
                            ["access_token", "Token JWT de autenticação do usuário", "Estritamente necessário", "Sessão (expira conforme config. JWT)"],
                            ["tenant_slug", "Identifica o portal do Produtor (subdomínio)", "Estritamente necessário", "1 dia (maxAge: 86400s)"],
                            ["Preferências de UI", "Tema visual e layout de navegação", "Funcional", "Persistente (até alteração pelo usuário)"],
                        ]}
                    />
                    <AlertBox variant="blue">
                        <strong>A Launcher NÃO utiliza:</strong> cookies de rastreamento publicitário, pixels de conversão
                        (Meta Pixel, Google Ads), ferramentas de analytics comportamental (Hotjar, FullStory) ou cookies
                        de fingerprinting. Por utilizarmos exclusivamente cookies necessários e funcionais, <strong>não
                            é exigido banner de consentimento de cookies</strong> pela legislação brasileira vigente.
                    </AlertBox>
                </Sec>

                {/* ── 12. MENORES ──────────────────────────────────────────────────── */}
                <Sec id="menores" n="12" title="Proteção de Menores de Idade">
                    <AlertBox variant="amber">
                        <strong>A plataforma NÃO é direcionada a menores de 18 anos.</strong> Conforme o art. 14 da LGPD,
                        o tratamento de dados de crianças e adolescentes exige consentimento específico dos pais ou responsável legal.
                        Produtores que atendam menores de 18 anos são integralmente responsáveis por obter e documentar esse consentimento.
                    </AlertBox>
                    <T>Caso identifiquemos coleta de dados de menores sem consentimento verificável, esses dados serão eliminados imediatamente. Comunique-nos pelo canal {DPO_EMAIL}.</T>
                </Sec>

                {/* ── 13. TRANSFERÊNCIA INTERNACIONAL ──────────────────────────────── */}
                <Sec id="internacional" n="13" title="Transferência Internacional de Dados">
                    <T>Alguns dados são transferidos para servidores nos EUA (AWS, Google, Vercel). Essas transferências são realizadas com base no art. 33 da LGPD, com as seguintes salvaguardas:</T>
                    <UL items={[
                        "Cláusulas Contratuais Padrão (Standard Contractual Clauses — SCCs) adotadas pelos fornecedores",
                        "Acordos de Processamento de Dados (DPAs) com cada suboperador, com obrigações equivalentes à LGPD",
                        "Fornecedores sujeitos a regulamentações de proteção de dados nos seus países de origem",
                    ]} />
                </Sec>

                {/* ── 14. ALTERAÇÕES ───────────────────────────────────────────────── */}
                <Sec id="alteracoes" n="14" title="Alterações nesta Política">
                    <T>Em caso de alterações <strong>relevantes</strong> (novas finalidades, bases legais, novos tipos de dados ou compartilhamentos), a Launcher notificará por e-mail com antecedência mínima de <strong>15 dias</strong> e exibirá aviso em destaque na plataforma. Versões anteriores ficam arquivadas e disponíveis mediante solicitação. A continuidade do uso constitui aceite das alterações.</T>
                </Sec>

                {/* ── 15. LEGISLAÇÃO ───────────────────────────────────────────────── */}
                <Sec id="lei" n="15" title="Legislação Aplicável e Foro">
                    <UL items={[
                        "Lei n.° 13.709/2018 — LGPD",
                        "Lei n.° 12.965/2014 — Marco Civil da Internet",
                        "Lei n.° 8.078/1990 — Código de Defesa do Consumidor",
                        "Lei n.° 9.610/1998 — Lei de Direitos Autorais",
                        "Decreto n.° 8.771/2016 — Regulamenta o Marco Civil",
                        "Resoluções e orientações da ANPD",
                    ]} />
                    <T>As partes elegem o foro da comarca de <strong>[CIDADE/UF]</strong> para dirimir controvérsias, comprometendo-se a buscar solução amigável em 30 dias antes de recorrer ao Judiciário.</T>
                </Sec>

                {/* ── 16. CONTATO ──────────────────────────────────────────────────── */}
                <Sec id="contato" n="16" title="Contato e Canal do DPO">
                    <InfoBox title="Fale com nossa equipe de privacidade" variant="blue" items={[
                        `Encarregado de Dados (DPO): [NOME COMPLETO]`,
                        `E-mail: ${DPO_EMAIL}`,
                        `Prazo de resposta: 15 dias úteis`,
                        `Endereço: [INSERIR ENDEREÇO COMPLETO]`,
                        `ANPD: www.gov.br/anpd`,
                    ]} />
                </Sec>

                <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400 space-y-1">
                    <p>Política de Privacidade — Versão {VERSION} — Vigência: {DATE}</p>
                    <p>Launcher EdTech · launcheredu.com.br · {DPO_EMAIL}</p>
                </div>
            </div>
        </main>
    );
}
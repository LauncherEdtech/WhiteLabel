// frontend/src/app/landing/page.tsx
// Landing Page de Alta Conversão — Launcher EdTech
// Experiência interativa: visitante "sente" como é ter a plataforma personalizada

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProducerAccessForm } from "./ProducerAccessForm";

// ─── DADOS ───────────────────────────────────────────────────────────────────

const BRAND_COLORS = [
  { name: "Seu Azul", color: "#3B82F6", accent: "#60A5FA" },
  { name: "Verde Militar", color: "#16A34A", accent: "#4ADE80" },
  { name: "Vermelho Bombeiro", color: "#DC2626", accent: "#F87171" },
  { name: "Roxo Premium", color: "#7C3AED", accent: "#A78BFA" },
  { name: "Dourado Elite", color: "#D97706", accent: "#FBBF24" },
];

const LAYOUTS = [
  { key: "sidebar", label: "Sidebar", desc: "Menu lateral completo" },
  { key: "topbar", label: "Top Bar", desc: "Navegação superior" },
  { key: "minimal", label: "Minimal", desc: "Clean e direto" },
];

const GAMIFICATION_THEMES = [
  { key: "militar", title: "Militar", ranks: ["Recruta", "Soldado", "Cabo", "Sargento", "Tenente", "Capitão", "Major", "Coronel", "General"], emoji: "🎖️" },
  { key: "espacial", title: "Espacial", ranks: ["Cadete", "Piloto", "Navegador", "Comandante", "Almirante"], emoji: "🚀" },
  { key: "medieval", title: "Medieval", ranks: ["Escudeiro", "Cavaleiro", "Barão", "Conde", "Duque", "Rei"], emoji: "⚔️" },
];

const FEATURES = [
  {
    id: "cronograma",
    icon: "📅",
    title: "Cronograma Inteligente",
    description: "Adapta a rotina dos seus alunos automaticamente. Se ele ficou devendo ontem, o sistema reorganiza hoje. Se acertou tudo em Constitucional, foca em Administrativo.",
    benefit: "Seus alunos estudam o que realmente precisam, não o que acham que precisam.",
  },
  {
    id: "questoes",
    icon: "❓",
    title: "Banco de Questões com IA",
    description: "Correção detalhada de todas as alternativas. Dicas que não entregam a resposta, mas direcionam o raciocínio. Seu aluno aprende de verdade.",
    benefit: "Taxa de acerto sobe porque o aluno entende, não decora.",
  },
  {
    id: "simulados",
    icon: "📋",
    title: "Simulados Realistas",
    description: "Tempo limitado que simula o dia da prova. Gere simulados personalizados em segundos com a cara do concurso que seu aluno vai prestar.",
    benefit: "Aluno chega no dia D preparado para a pressão.",
  },
  {
    id: "dashboard",
    icon: "📊",
    title: "Dashboard de Performance",
    description: "Leitura completa do desempenho do aluno sintetizada em dados claros. Feedback com insights que mostram exatamente onde ele deve focar.",
    benefit: "Você vê quem está performando e quem precisa de atenção.",
  },
  {
    id: "gamificacao",
    icon: "🏆",
    title: "Motor de Retenção",
    description: "O que faz seu aluno abrir a plataforma na segunda de manhã mesmo quando a rotina aperta. Níveis, medalhas, rankings. Tudo personalizável com sua identidade.",
    benefit: "Aluno que joga, fica. Aluno que fica, renova.",
  },
  {
    id: "mentor",
    icon: "🤖",
    title: "Mentor Inteligente",
    description: "É impossível seu aluno ficar perdido. O mentor diz exatamente qual é o próximo passo de forma automática conforme o avanço dele.",
    benefit: "Você não precisa responder dúvida básica às 23h.",
  },
  {
    id: "capsula",
    icon: "📱",
    title: "Cápsula de Estudos",
    description: "Todo mês, cada aluno recebe um card com seus resultados reais, a patente conquistada e uma frase motivacional. Ele posta no Instagram e te marca.",
    benefit: "Marketing zero custo. Sua marca se espalha sozinha.",
  },
];

const COMPETITOR_PROBLEMS = [
  { name: "Área de membros comum", problem: "Aluno esquece que comprou", icon: "💤" },
  { name: "Plataforma genérica", problem: "Zero diferenciação", icon: "🏭" },
  { name: "Sem gamificação", problem: "Desistência em 30 dias", icon: "📉" },
  { name: "Analytics básico", problem: "Você não sabe o que funciona", icon: "🎯" },
];

const PRICING_MONTHLY = [
  {
    name: "Starter",
    price: "597",
    fee: "5%",
    desc: "Para quem quer começar e validar",
    features: ["Produto customizável", "Analytics completo", "Gestão de alunos", "Mentor Inteligente", "Cronograma personalizado", "Dashboard inteligente", "Banco de questões + simulados"],
    excluded: ["Domínio personalizado", "Gamificação"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "897",
    fee: "4,5%",
    desc: "Para quem já está vendendo",
    features: ["Tudo do Starter", "Domínio personalizado", "Gamificação completa", "Suporte prioritário", "Onboarding dedicado"],
    excluded: [],
    highlight: true,
  },
  {
    name: "Scale",
    price: "1.127",
    fee: "4%",
    desc: "Para operações em escala",
    features: ["Tudo do Growth", "API de integração", "Relatórios avançados", "Account manager", "SLA garantido"],
    excluded: [],
    highlight: false,
  },
];

const PRICING_YEARLY = [
  {
    name: "Starter",
    price: "297",
    fee: "3,5%",
    desc: "Para quem quer começar e validar",
    features: ["Produto customizável", "Analytics completo", "Gestão de alunos", "Mentor Inteligente", "Cronograma personalizado", "Dashboard inteligente", "Banco de questões + simulados"],
    excluded: ["Domínio personalizado", "Gamificação"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "597",
    fee: "3%",
    desc: "Para quem já está vendendo",
    features: ["Tudo do Starter", "Domínio personalizado", "Gamificação completa", "Suporte prioritário", "Onboarding dedicado"],
    excluded: [],
    highlight: true,
  },
  {
    name: "Scale",
    price: "897",
    fee: "2,5%",
    desc: "Para operações em escala",
    features: ["Tudo do Growth", "API de integração", "Relatórios avançados", "Account manager", "SLA garantido"],
    excluded: [],
    highlight: false,
  },
];

const INTEGRATIONS = [
  { name: "Hotmart", color: "#F04E23" },
  { name: "Kiwify", color: "#00D4AA" },
  { name: "Eduzz", color: "#5956E9" },
  { name: "PagarMe", color: "#65A300" },
];

const FAQS = [
  {
    q: "Preciso de equipe técnica para usar a Launcher?",
    a: "Não. A Launcher foi feita para infoprodutores que focam em ensinar, não em código. Você configura tudo pelo painel sem precisar de desenvolvedor. Se precisar de ajuda, nosso time está no WhatsApp."
  },
  {
    q: "Em quanto tempo consigo migrar meus alunos?",
    a: "Normalmente em menos de 24 horas. Fazemos a importação da sua base atual e você já pode operar. Seu aluno nem percebe que mudou, só percebe que ficou melhor."
  },
  {
    q: "A plataforma funciona para qualquer tipo de concurso?",
    a: "Sim. Seja concurso policial, fiscal, tribunal, carreiras federais ou estaduais. O sistema se adapta ao edital e à banca que você trabalha."
  },
  {
    q: "Como funciona a taxa por venda?",
    a: "Você paga o valor fixo mensal mais uma porcentagem sobre cada venda processada. Isso alinha nosso interesse: quanto mais você vende, melhor para os dois."
  },
  {
    q: "Posso usar meu próprio domínio?",
    a: "Sim. A partir do plano Growth, você pode usar seudominio.com.br. Seus alunos nunca veem a marca Launcher, só a sua."
  },
  {
    q: "E se eu quiser cancelar?",
    a: "Sem burocracia. Não tem multa, não tem fidelidade. Se não estiver funcionando para você, é só avisar. Mas a gente confia que você vai querer ficar."
  },
];

const TESTIMONIALS = [
  {
    text: "Antes eu perdia aluno porque ele esquecia de estudar. Agora ele abre a plataforma todo dia porque quer subir de patente. A retenção da minha turma subiu 40%.",
    name: "João Figueiredo",
    role: "Carreiras Policiais",
    avatar: "JF",
    color: "#7C3AED"
  },
  {
    text: "A Cápsula de Estudos foi genial. Todo mês meus alunos postam no Instagram e me marcam. É marketing zero custo e parece que foi minha equipe que criou.",
    name: "Carla Azevedo",
    role: "Fiscal de Rendas",
    avatar: "CA",
    color: "#059669"
  },
  {
    text: "Finalmente consigo ver quem está estudando de verdade e quem está só pagando. Os dados mudaram como eu estruturo minhas turmas.",
    name: "Rafael Mendes",
    role: "Tribunal Regional",
    avatar: "RM",
    color: "#D97706"
  },
];

// ─── CSS ─────────────────────────────────────────────────────────────────────

const css = `
/* ─── RESET & TOKENS ─────────────────────────────────────────────────────── */
.lp {
    --bg: #050810;
    --bg2: #0a0f1a;
    --bg3: #0f1525;
    --bg4: #151d2e;
    --tx: #f0ece0;
    --tx2: #9ca3bf;
    --tx3: #5c6380;
    --pr: #5D5FEF;
    --pr-light: #8183F4;
    --pr-glow: rgba(93, 95, 239, 0.25);
    --ac: #10B981;
    --ac-glow: rgba(16, 185, 129, 0.2);
    --gold: #F59E0B;
    --border: rgba(255, 255, 255, 0.08);
    --border2: rgba(255, 255, 255, 0.15);
    --ff: 'Plus Jakarta Sans', -apple-system, sans-serif;
    --ff-display: 'Fraunces', Georgia, serif;
    --radius: 12px;
    --radius-lg: 20px;
    
    font-family: var(--ff);
    background: var(--bg);
    color: var(--tx);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── UTILITY ────────────────────────────────────────────────────────────── */
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 120px 0; }
.section-alt { padding: 120px 0; background: var(--bg2); }

/* Reveal animations */
.reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-d1 { transition-delay: 0.1s; }
.reveal-d2 { transition-delay: 0.2s; }
.reveal-d3 { transition-delay: 0.3s; }

/* Typography */
.headline {
    font-family: var(--ff-display);
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--tx);
}
.headline-sm {
    font-family: var(--ff-display);
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
}
.subheadline { font-size: 18px; color: var(--tx2); line-height: 1.7; max-width: 560px; }
.gradient-text {
    background: linear-gradient(135deg, var(--pr-light) 0%, var(--ac) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.section-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--pr-light);
    margin-bottom: 16px;
}
.section-label::before {
    content: '';
    width: 24px;
    height: 2px;
    background: var(--pr);
    border-radius: 2px;
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--pr);
    color: #fff;
    font-family: var(--ff);
    font-size: 16px;
    font-weight: 600;
    padding: 16px 32px;
    border-radius: var(--radius);
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.25s ease;
    box-shadow: 0 0 40px var(--pr-glow);
}
.btn-primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 20px 50px var(--pr-glow);
}
.btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: transparent;
    color: var(--tx);
    font-family: var(--ff);
    font-size: 16px;
    font-weight: 500;
    padding: 15px 28px;
    border-radius: var(--radius);
    border: 1px solid var(--border2);
    cursor: pointer;
    text-decoration: none;
    transition: all 0.25s ease;
}
.btn-secondary:hover {
    border-color: var(--tx2);
    background: rgba(255,255,255,0.03);
}

/* ─── NAVBAR ─────────────────────────────────────────────────────────────── */
.navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    padding: 20px 0;
    background: rgba(5, 8, 16, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid transparent;
    transition: all 0.3s ease;
}
.navbar.scrolled {
    padding: 14px 0;
    border-color: var(--border);
}
.navbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--ff-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--tx);
    text-decoration: none;
}
.logo-icon {
    width: 36px;
    height: 36px;
    background: var(--pr);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.nav-links {
    display: flex;
    align-items: center;
    gap: 36px;
    list-style: none;
}
.nav-links a {
    color: var(--tx2);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
}
.nav-links a:hover { color: var(--tx); }
.nav-cta { display: flex; gap: 12px; }

/* ─── HERO ───────────────────────────────────────────────────────────────── */
.hero {
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 140px 0 100px;
    position: relative;
    overflow: hidden;
}
.hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(ellipse 900px 700px at 75% 35%, rgba(93, 95, 239, 0.12) 0%, transparent 60%),
        radial-gradient(ellipse 500px 600px at 5% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 65%);
}
.hero-grid {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 80px;
    align-items: center;
}
.hero-content { position: relative; z-index: 2; }
.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--ac-glow);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--ac);
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 100px;
    margin-bottom: 28px;
}
.hero-badge::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--ac);
    border-radius: 50%;
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
}
.hero h1 { margin-bottom: 24px; }
.hero .subheadline { margin-bottom: 40px; }
.hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
.hero-social {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--border);
}
.avatars { display: flex; }
.avatars span {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    margin-right: -10px;
}
.hero-social-text {
    font-size: 14px;
    color: var(--tx2);
}
.hero-social-text strong {
    color: var(--tx);
    font-weight: 600;
}

/* ─── DEMO PREVIEW (Interactive) ─────────────────────────────────────────── */
.demo-preview {
    position: relative;
    perspective: 1200px;
}
.demo-frame {
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow:
        0 50px 100px rgba(0, 0, 0, 0.5),
        0 0 100px rgba(93, 95, 239, 0.1);
    transform: rotateY(-3deg) rotateX(2deg);
    transition: transform 0.5s ease;
}
.demo-frame:hover {
    transform: rotateY(0) rotateX(0);
}
.demo-topbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
}
.demo-dot { width: 10px; height: 10px; border-radius: 50%; }
.demo-dot-red { background: #FF5F56; }
.demo-dot-yellow { background: #FFBD2E; }
.demo-dot-green { background: #27C93F; }
.demo-url {
    flex: 1;
    margin-left: 12px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
    padding: 6px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--tx3);
}
.demo-url strong { color: var(--tx2); }
.demo-body { display: flex; min-height: 380px; }
.demo-sidebar {
    width: 180px;
    border-right: 1px solid var(--border);
    padding: 16px;
    flex-shrink: 0;
    transition: all 0.4s ease;
}
.demo-sidebar.hidden { display: none; }
.demo-sidebar-logo {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 20px;
    transition: background 0.4s ease;
}
.demo-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--tx2);
    margin-bottom: 4px;
    transition: all 0.2s;
}
.demo-nav-item:hover { background: rgba(255,255,255,0.04); }
.demo-nav-item.active {
    background: rgba(93, 95, 239, 0.15);
    color: var(--pr-light);
}
.demo-main { flex: 1; padding: 20px; overflow: hidden; }
.demo-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}
.demo-welcome { font-size: 13px; color: var(--tx2); }
.demo-welcome strong { color: var(--tx); }
.demo-user {
    width: 32px;
    height: 32px;
    background: var(--pr);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
}
.demo-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
}
.demo-card-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--tx3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
}
.demo-progress-item {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}
.demo-progress-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: background 0.4s ease;
}
.demo-progress-info { flex: 1; }
.demo-progress-name { font-size: 12px; font-weight: 600; color: var(--tx); }
.demo-progress-pct { font-size: 10px; color: var(--tx3); }
.demo-progress-bar {
    height: 4px;
    background: var(--bg4);
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
}
.demo-progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: all 0.4s ease;
}
.demo-rank-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02));
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 12px;
    padding: 14px 16px;
}
.demo-rank-badge {
    width: 44px;
    height: 44px;
    background: rgba(245, 158, 11, 0.15);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}
.demo-rank-info { flex: 1; }
.demo-rank-title { font-size: 10px; color: var(--tx3); text-transform: uppercase; letter-spacing: 0.05em; }
.demo-rank-name { font-size: 16px; font-weight: 700; color: var(--gold); }
.demo-rank-next { font-size: 11px; color: var(--tx2); }

/* Demo Topbar Layout */
.demo-topbar-layout { display: none; }
.demo-topbar-layout.visible { display: block; }
.demo-topbar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
}
.demo-topbar-links {
    display: flex;
    gap: 24px;
}
.demo-topbar-link {
    font-size: 13px;
    color: var(--tx2);
    padding: 6px 0;
    border-bottom: 2px solid transparent;
}
.demo-topbar-link.active {
    color: var(--tx);
    border-color: var(--pr);
}

/* Demo Minimal Layout */
.demo-minimal-dock {
    display: none;
    height: 56px;
    background: rgba(255,255,255,0.03);
    border-top: 1px solid var(--border);
    align-items: center;
    justify-content: center;
    gap: 32px;
}
.demo-minimal-dock.visible { display: flex; }
.demo-minimal-dock span {
    font-size: 20px;
    opacity: 0.5;
    transition: all 0.2s;
}
.demo-minimal-dock span.active { opacity: 1; }

/* ─── VSL SECTION ────────────────────────────────────────────────────────── */
.vsl-section {
    padding: 100px 0;
    background: var(--bg2);
    text-align: center;
}
.vsl-wrapper {
    max-width: 900px;
    margin: 0 auto;
}
.vsl-placeholder {
    aspect-ratio: 16/9;
    background: var(--bg3);
    border: 2px dashed var(--border2);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
}
.vsl-placeholder:hover {
    border-color: var(--pr);
    background: rgba(93, 95, 239, 0.05);
}
.vsl-play-btn {
    width: 80px;
    height: 80px;
    background: var(--pr);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 60px var(--pr-glow);
}
.vsl-text { font-size: 14px; color: var(--tx2); }

/* ─── FEATURES GRID ──────────────────────────────────────────────────────── */
.features-section { text-align: center; }
.features-header { max-width: 700px; margin: 0 auto 80px; }
.features-header .headline-sm { margin-bottom: 16px; }
.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 24px;
}
.feature-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px;
    text-align: left;
    transition: all 0.4s ease;
    position: relative;
    overflow: hidden;
}
.feature-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--pr), var(--ac));
    opacity: 0;
    transition: opacity 0.3s;
}
.feature-card:hover {
    border-color: var(--border2);
    transform: translateY(-4px);
}
.feature-card:hover::before { opacity: 1; }
.feature-icon {
    width: 56px;
    height: 56px;
    background: var(--bg3);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    margin-bottom: 20px;
}
.feature-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--tx);
    margin-bottom: 12px;
}
.feature-desc {
    font-size: 15px;
    color: var(--tx2);
    line-height: 1.7;
    margin-bottom: 16px;
}
.feature-benefit {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    background: var(--ac-glow);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 10px;
    font-size: 14px;
    color: var(--tx);
}
.feature-benefit-icon {
    width: 20px;
    height: 20px;
    background: var(--ac);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* ─── EXPERIENCE SECTION (Interactive Demo) ──────────────────────────────── */
.experience-section {
    padding: 140px 0;
    background: var(--bg);
}
.experience-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    align-items: center;
}
.experience-controls { position: sticky; top: 140px; }
.experience-controls h2 { margin-bottom: 8px; }
.experience-controls p { margin-bottom: 40px; color: var(--tx2); font-size: 16px; }

.control-group { margin-bottom: 36px; }
.control-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--tx3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 14px;
}
.color-swatches {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}
.color-swatch {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    cursor: pointer;
    border: 3px solid transparent;
    transition: all 0.25s ease;
}
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.selected {
    border-color: #fff;
    transform: scale(1.15);
    box-shadow: 0 0 20px rgba(255,255,255,0.2);
}
.layout-tabs {
    display: flex;
    gap: 8px;
}
.layout-tab {
    padding: 12px 20px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--tx2);
    cursor: pointer;
    transition: all 0.2s;
}
.layout-tab:hover { border-color: var(--border2); }
.layout-tab.selected {
    background: var(--pr);
    border-color: var(--pr);
    color: #fff;
}
.gami-theme-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}
.gami-theme-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--tx2);
    cursor: pointer;
    transition: all 0.2s;
}
.gami-theme-btn:hover { border-color: var(--border2); }
.gami-theme-btn.selected {
    background: rgba(245, 158, 11, 0.1);
    border-color: var(--gold);
    color: var(--gold);
}

/* ─── COMPARISON SECTION ─────────────────────────────────────────────────── */
.comparison-section {
    padding: 140px 0;
    background: var(--bg2);
}
.comparison-header {
    text-align: center;
    max-width: 800px;
    margin: 0 auto 80px;
}
.comparison-header h2 { margin-bottom: 16px; }
.comparison-header p { color: var(--tx2); font-size: 18px; }

.comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    max-width: 1000px;
    margin: 0 auto;
}
.comparison-col h3 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
}
.comparison-problems { display: flex; flex-direction: column; gap: 16px; }
.problem-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: var(--radius);
}
.problem-icon {
    width: 48px;
    height: 48px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
}
.problem-text { flex: 1; }
.problem-name { font-size: 15px; font-weight: 600; color: var(--tx); margin-bottom: 2px; }
.problem-desc { font-size: 13px; color: #EF4444; }

.solution-list { display: flex; flex-direction: column; gap: 12px; }
.solution-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: var(--ac-glow);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: var(--radius);
}
.solution-check {
    width: 28px;
    height: 28px;
    background: var(--ac);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.solution-text { font-size: 15px; color: var(--tx); font-weight: 500; }

/* ─── TESTIMONIALS ───────────────────────────────────────────────────────── */
.testimonials-section { padding: 140px 0; text-align: center; }
.testimonials-header { max-width: 600px; margin: 0 auto 60px; }
.testimonials-header h2 { margin-bottom: 16px; }

.testimonials-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
}
.testimonial-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px;
    text-align: left;
    transition: all 0.3s ease;
}
.testimonial-card:hover {
    border-color: var(--border2);
    transform: translateY(-4px);
}
.testimonial-text {
    font-size: 15px;
    color: var(--tx2);
    line-height: 1.8;
    margin-bottom: 24px;
    font-style: italic;
}
.testimonial-text::before {
    content: '"';
    font-size: 48px;
    font-family: Georgia, serif;
    color: var(--pr);
    line-height: 0;
    display: block;
    margin-bottom: 8px;
}
.testimonial-author {
    display: flex;
    align-items: center;
    gap: 14px;
}
.testimonial-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
}
.testimonial-info {}
.testimonial-name { font-size: 15px; font-weight: 700; color: var(--tx); }
.testimonial-role { font-size: 13px; color: var(--tx3); }

/* ─── PRICING ────────────────────────────────────────────────────────────── */
.pricing-section {
    padding: 140px 0;
    background: var(--bg2);
}
.pricing-header {
    text-align: center;
    max-width: 700px;
    margin: 0 auto 60px;
}
.pricing-header h2 { margin-bottom: 16px; }
.pricing-header p { color: var(--tx2); font-size: 17px; margin-bottom: 32px; }

.pricing-toggle {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    background: var(--bg3);
    padding: 6px;
    border-radius: 100px;
    border: 1px solid var(--border);
}
.pricing-toggle-btn {
    padding: 12px 28px;
    border-radius: 100px;
    font-size: 15px;
    font-weight: 600;
    color: var(--tx2);
    cursor: pointer;
    transition: all 0.25s;
    border: none;
    background: transparent;
}
.pricing-toggle-btn.active {
    background: var(--pr);
    color: #fff;
}
.pricing-toggle-badge {
    background: var(--ac);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 100px;
}

.pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    max-width: 1100px;
    margin: 0 auto;
}
.pricing-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 36px;
    transition: all 0.3s ease;
    position: relative;
}
.pricing-card.highlighted {
    border-color: var(--pr);
    box-shadow: 0 0 60px var(--pr-glow);
}
.pricing-card.highlighted::before {
    content: 'Mais popular';
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--pr);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 16px;
    border-radius: 100px;
}
.pricing-name {
    font-size: 20px;
    font-weight: 700;
    color: var(--tx);
    margin-bottom: 4px;
}
.pricing-desc {
    font-size: 14px;
    color: var(--tx3);
    margin-bottom: 24px;
}
.pricing-amount {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 4px;
}
.pricing-currency { font-size: 18px; color: var(--tx2); }
.pricing-value {
    font-family: var(--ff-display);
    font-size: 52px;
    font-weight: 800;
    color: var(--tx);
    line-height: 1;
}
.pricing-period { font-size: 14px; color: var(--tx3); }
.pricing-fee {
    font-size: 14px;
    color: var(--tx2);
    margin-bottom: 28px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--border);
}
.pricing-fee strong { color: var(--pr-light); }
.pricing-features { margin-bottom: 28px; }
.pricing-feature {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--tx2);
    margin-bottom: 12px;
}
.pricing-feature-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.pricing-feature-icon.check { background: var(--ac); }
.pricing-feature-icon.cross { background: rgba(239, 68, 68, 0.2); }
.pricing-feature.excluded { color: var(--tx3); text-decoration: line-through; opacity: 0.6; }
.pricing-cta { width: 100%; }

/* ─── INTEGRATIONS ───────────────────────────────────────────────────────── */
.integrations-section { padding: 100px 0; text-align: center; }
.integrations-header { margin-bottom: 48px; }
.integrations-header h2 { font-size: 28px; margin-bottom: 12px; }
.integrations-header p { color: var(--tx2); font-size: 16px; }
.integrations-logos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    flex-wrap: wrap;
}
.integration-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}
.integration-icon {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 800;
    color: #fff;
}
.integration-name { font-size: 14px; color: var(--tx2); }

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
.faq-section {
    padding: 140px 0;
    background: var(--bg2);
}
.faq-header {
    text-align: center;
    max-width: 600px;
    margin: 0 auto 60px;
}
.faq-header h2 { margin-bottom: 16px; }

.faq-grid {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.faq-item {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: all 0.3s ease;
}
.faq-item:hover { border-color: var(--border2); }
.faq-question {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
}
.faq-question-text {
    font-size: 17px;
    font-weight: 600;
    color: var(--tx);
}
.faq-icon {
    width: 32px;
    height: 32px;
    background: var(--bg4);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--tx2);
    transition: all 0.3s;
    flex-shrink: 0;
}
.faq-item.open .faq-icon { transform: rotate(45deg); background: var(--pr); color: #fff; }
.faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.4s ease;
}
.faq-item.open .faq-answer { max-height: 300px; }
.faq-answer-inner {
    padding: 0 24px 24px;
    font-size: 15px;
    color: var(--tx2);
    line-height: 1.8;
}

/* ─── FINAL CTA ──────────────────────────────────────────────────────────── */
.final-cta {
    padding: 140px 0;
    text-align: center;
    position: relative;
    overflow: hidden;
}
.final-cta-bg {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse 600px 400px at 50% 50%, var(--pr-glow) 0%, transparent 70%);
    pointer-events: none;
}
.final-cta-content { position: relative; z-index: 2; max-width: 700px; margin: 0 auto; }
.final-cta h2 { margin-bottom: 20px; }
.final-cta p { font-size: 18px; color: var(--tx2); margin-bottom: 40px; }
.final-cta-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.final-cta-note {
    margin-top: 32px;
    font-size: 14px;
    color: var(--tx3);
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────── */
.footer {
    padding: 60px 0;
    border-top: 1px solid var(--border);
    background: var(--bg);
}
.footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
}
.footer-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: var(--tx2);
}
.footer-links {
    display: flex;
    gap: 32px;
}
.footer-links a {
    font-size: 14px;
    color: var(--tx2);
    text-decoration: none;
    transition: color 0.2s;
}
.footer-links a:hover { color: var(--tx); }
.footer-social {
    display: flex;
    gap: 20px;
}
.footer-social a {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--tx2);
    text-decoration: none;
    transition: color 0.2s;
}
.footer-social a:hover { color: var(--tx); }

/* ─── RESPONSIVE ─────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
    .hero-grid { grid-template-columns: 1fr; gap: 60px; }
    .demo-preview { max-width: 600px; margin: 0 auto; }
    .demo-frame { transform: none; }
    .experience-grid { grid-template-columns: 1fr; gap: 60px; }
    .experience-controls { position: static; }
    .comparison-grid { grid-template-columns: 1fr; gap: 32px; }
    .pricing-grid { grid-template-columns: 1fr; max-width: 400px; }
    .testimonials-grid { grid-template-columns: 1fr; }
    .nav-links { display: none; }
}

@media (max-width: 768px) {
    .section, .section-alt { padding: 80px 0; }
    .hero { padding: 120px 0 60px; }
    .hero-actions { flex-direction: column; }
    .hero-actions .btn-primary, .hero-actions .btn-secondary { width: 100%; }
    .demo-sidebar { width: 140px; padding: 12px; }
    .features-grid { grid-template-columns: 1fr; }
    .pricing-toggle { flex-direction: column; gap: 8px; }
    .footer-inner { flex-direction: column; text-align: center; }
}
`;

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [brandIdx, setBrandIdx] = useState(0);
  const [layout, setLayout] = useState<"sidebar" | "topbar" | "minimal">("sidebar");
  const [gamiIdx, setGamiIdx] = useState(0);
  const [pricingPeriod, setPricingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentBrand = BRAND_COLORS[brandIdx];
  const currentGami = GAMIFICATION_THEMES[gamiIdx];
  const pricing = pricingPeriod === "yearly" ? PRICING_YEARLY : PRICING_MONTHLY;

  // Scroll handler for navbar
  useEffect(() => {
    const handleScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const reveals = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp">
      <style>{css}</style>

      {/* ─── NAVBAR ─── */}
      <nav className="navbar" ref={navRef}>
        <div className="container navbar-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L20 7v10l-8 5-8-5V7l8-5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            Launcher
          </Link>

          <ul className="nav-links">
            <li><a href="#features">Funcionalidades</a></li>
            <li><a href="#experience">Experiência</a></li>
            <li><a href="#pricing">Preços</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>

          <div className="nav-cta">
            <a href="https://wa.me/5562995594055" target="_blank" rel="noopener" className="btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              Falar no WhatsApp
            </a>
            <a href="#pricing" className="btn-primary">Começar agora</a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="hero-badge reveal">
              Feito para concursos públicos
            </div>

            <h1 className="headline reveal reveal-d1">
              O sistema que faz seu aluno <span className="gradient-text">estudar mais</span> e você <span className="gradient-text">vender mais</span>
            </h1>

            <p className="subheadline reveal reveal-d2">
              Você não precisa de mais uma área de membros. Você precisa de uma infraestrutura
              que aumenta retenção, valor percebido e receita com dados de verdade.
            </p>

            <div className="hero-actions reveal reveal-d3">
              <a href="#pricing" className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Quero essa infraestrutura
              </a>
              <a href="https://wa.me/5562995594055" target="_blank" rel="noopener" className="btn-secondary">
                Conversar pelo WhatsApp
              </a>
            </div>

            <div className="hero-social reveal reveal-d3">
              <div className="avatars">
                <span style={{ background: "#7C3AED" }}>JF</span>
                <span style={{ background: "#059669" }}>CA</span>
                <span style={{ background: "#D97706" }}>RM</span>
                <span style={{ background: "#3B82F6" }}>+12</span>
              </div>
              <div className="hero-social-text">
                <strong>+15 infoprodutores</strong> já usam a Launcher
              </div>
            </div>
          </div>

          {/* ─── DEMO PREVIEW ─── */}
          <div className="demo-preview reveal">
            <div className="demo-frame">
              <div className="demo-topbar">
                <div className="demo-dot demo-dot-red" />
                <div className="demo-dot demo-dot-yellow" />
                <div className="demo-dot demo-dot-green" />
                <div className="demo-url">
                  <strong>seudominio</strong>.launcheredu.com.br
                </div>
              </div>

              {/* Topbar Layout */}
              {layout === "topbar" && (
                <div className="demo-topbar-nav">
                  <div
                    className="demo-sidebar-logo"
                    style={{ background: currentBrand.color, width: 32, height: 32, marginBottom: 0 }}
                  >
                    SN
                  </div>
                  <div className="demo-topbar-links">
                    <span className="demo-topbar-link active">Dashboard</span>
                    <span className="demo-topbar-link">Cursos</span>
                    <span className="demo-topbar-link">Questões</span>
                    <span className="demo-topbar-link">Simulados</span>
                  </div>
                  <div className="demo-user">AL</div>
                </div>
              )}

              <div className="demo-body">
                {/* Sidebar (only for sidebar layout) */}
                {layout === "sidebar" && (
                  <div className="demo-sidebar">
                    <div
                      className="demo-sidebar-logo"
                      style={{ background: currentBrand.color }}
                    >
                      SN
                    </div>
                    <div className="demo-nav-item active">
                      <span>📊</span> Dashboard
                    </div>
                    <div className="demo-nav-item">
                      <span>📚</span> Cursos
                    </div>
                    <div className="demo-nav-item">
                      <span>❓</span> Questões
                    </div>
                    <div className="demo-nav-item">
                      <span>📋</span> Simulados
                    </div>
                    <div className="demo-nav-item">
                      <span>📅</span> Cronograma
                    </div>
                    <div className="demo-nav-item">
                      <span>🏆</span> Conquistas
                    </div>
                  </div>
                )}

                <div className="demo-main">
                  <div className="demo-main-header">
                    <div className="demo-welcome">
                      Olá, <strong>Aluno</strong>! Bora estudar?
                    </div>
                    {layout !== "topbar" && <div className="demo-user">AL</div>}
                  </div>

                  {/* Rank Card */}
                  <div className="demo-rank-card">
                    <div className="demo-rank-badge">{currentGami.emoji}</div>
                    <div className="demo-rank-info">
                      <div className="demo-rank-title">Sua patente atual</div>
                      <div className="demo-rank-name">{currentGami.ranks[3]}</div>
                      <div className="demo-rank-next">
                        Faltam 240 XP para {currentGami.ranks[4]}
                      </div>
                    </div>
                  </div>

                  {/* Progress Card */}
                  <div className="demo-card" style={{ marginTop: 12 }}>
                    <div className="demo-card-title">Progresso por matéria</div>
                    {[
                      { name: "Dir. Constitucional", pct: 68, icon: "⚖️" },
                      { name: "Dir. Administrativo", pct: 45, icon: "📜" },
                      { name: "Português", pct: 82, icon: "📝" },
                    ].map((item) => (
                      <div key={item.name} className="demo-progress-item">
                        <div
                          className="demo-progress-icon"
                          style={{ background: `${currentBrand.color}25` }}
                        >
                          {item.icon}
                        </div>
                        <div className="demo-progress-info">
                          <div className="demo-progress-name">{item.name}</div>
                          <div className="demo-progress-pct">{item.pct}% concluído</div>
                          <div className="demo-progress-bar">
                            <div
                              className="demo-progress-fill"
                              style={{
                                width: `${item.pct}%`,
                                background: currentBrand.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Minimal Dock */}
              {layout === "minimal" && (
                <div className="demo-minimal-dock visible">
                  <span className="active">🏠</span>
                  <span>📚</span>
                  <span>🎯</span>
                  <span>📊</span>
                  <span>👤</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── VSL SECTION ─── */}
      <section className="vsl-section">
        <div className="container">
          <div className="vsl-wrapper reveal">
            <div className="vsl-placeholder">
              <div className="vsl-play-btn">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="vsl-text">
                Não somos uma plataforma. Somos a infraestrutura de aumento de receita do infoprodutor.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="section features-section">
        <div className="container">
          <div className="features-header reveal">
            <span className="section-label">Funcionalidades</span>
            <h2 className="headline-sm">
              Um mentor inteligente em <span className="gradient-text">toda parte</span>
            </h2>
            <p className="subheadline" style={{ margin: "0 auto" }}>
              A engrenagem que direciona seu aluno e aumenta o valor percebido do seu produto.
            </p>
          </div>

          <div className="features-grid">
            {FEATURES.map((feature, idx) => (
              <div
                key={feature.id}
                className={`feature-card reveal reveal-d${(idx % 3) + 1}`}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.description}</p>
                <div className="feature-benefit">
                  <div className="feature-benefit-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" fill="none" />
                    </svg>
                  </div>
                  {feature.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EXPERIENCE (Interactive Customization) ─── */}
      <section id="experience" className="experience-section">
        <div className="container experience-grid">
          <div className="experience-controls">
            <span className="section-label reveal">Personalização</span>
            <h2 className="headline-sm reveal reveal-d1">
              Sua marca na frente.<br />
              <span className="gradient-text">A Launcher nos bastidores.</span>
            </h2>
            <p className="reveal reveal-d2">
              Personalize cada detalhe. Cores, layout, gamificação. Seus alunos nunca veem nossa marca, só a sua.
            </p>

            {/* Color Swatches */}
            <div className="control-group reveal reveal-d2">
              <div className="control-label">Cor da sua marca</div>
              <div className="color-swatches">
                {BRAND_COLORS.map((color, idx) => (
                  <div
                    key={color.name}
                    className={`color-swatch${brandIdx === idx ? " selected" : ""}`}
                    style={{ background: color.color }}
                    onClick={() => setBrandIdx(idx)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Layout Tabs */}
            <div className="control-group reveal reveal-d2">
              <div className="control-label">Layout de navegação</div>
              <div className="layout-tabs">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.key}
                    className={`layout-tab${layout === l.key ? " selected" : ""}`}
                    onClick={() => setLayout(l.key as "sidebar" | "topbar" | "minimal")}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gamification Theme */}
            <div className="control-group reveal reveal-d3">
              <div className="control-label">Tema de gamificação</div>
              <div className="gami-theme-buttons">
                {GAMIFICATION_THEMES.map((theme, idx) => (
                  <button
                    key={theme.key}
                    className={`gami-theme-btn${gamiIdx === idx ? " selected" : ""}`}
                    onClick={() => setGamiIdx(idx)}
                  >
                    {theme.emoji} {theme.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="demo-preview reveal">
            <div className="demo-frame" style={{ transform: "none" }}>
              <div className="demo-topbar">
                <div className="demo-dot demo-dot-red" />
                <div className="demo-dot demo-dot-yellow" />
                <div className="demo-dot demo-dot-green" />
                <div className="demo-url">
                  <strong>seudominio</strong>.launcheredu.com.br
                </div>
              </div>

              {layout === "topbar" && (
                <div className="demo-topbar-nav">
                  <div
                    className="demo-sidebar-logo"
                    style={{ background: currentBrand.color, width: 32, height: 32, marginBottom: 0 }}
                  >
                    SN
                  </div>
                  <div className="demo-topbar-links">
                    <span className="demo-topbar-link active">Dashboard</span>
                    <span className="demo-topbar-link">Cursos</span>
                    <span className="demo-topbar-link">Questões</span>
                    <span className="demo-topbar-link">Simulados</span>
                  </div>
                  <div className="demo-user">AL</div>
                </div>
              )}

              <div className="demo-body">
                {layout === "sidebar" && (
                  <div className="demo-sidebar">
                    <div
                      className="demo-sidebar-logo"
                      style={{ background: currentBrand.color }}
                    >
                      SN
                    </div>
                    <div className="demo-nav-item active">
                      <span>📊</span> Dashboard
                    </div>
                    <div className="demo-nav-item">
                      <span>📚</span> Cursos
                    </div>
                    <div className="demo-nav-item">
                      <span>❓</span> Questões
                    </div>
                    <div className="demo-nav-item">
                      <span>📋</span> Simulados
                    </div>
                    <div className="demo-nav-item">
                      <span>📅</span> Cronograma
                    </div>
                    <div className="demo-nav-item">
                      <span>🏆</span> Conquistas
                    </div>
                  </div>
                )}

                <div className="demo-main">
                  <div className="demo-main-header">
                    <div className="demo-welcome">
                      Olá, <strong>Aluno</strong>! Bora estudar?
                    </div>
                    {layout !== "topbar" && <div className="demo-user">AL</div>}
                  </div>

                  <div className="demo-rank-card">
                    <div className="demo-rank-badge">{currentGami.emoji}</div>
                    <div className="demo-rank-info">
                      <div className="demo-rank-title">Sua patente atual</div>
                      <div className="demo-rank-name">{currentGami.ranks[3]}</div>
                      <div className="demo-rank-next">
                        Faltam 240 XP para {currentGami.ranks[4]}
                      </div>
                    </div>
                  </div>

                  <div className="demo-card" style={{ marginTop: 12 }}>
                    <div className="demo-card-title">Progresso por matéria</div>
                    {[
                      { name: "Dir. Constitucional", pct: 68, icon: "⚖️" },
                      { name: "Dir. Administrativo", pct: 45, icon: "📜" },
                    ].map((item) => (
                      <div key={item.name} className="demo-progress-item">
                        <div
                          className="demo-progress-icon"
                          style={{ background: `${currentBrand.color}25` }}
                        >
                          {item.icon}
                        </div>
                        <div className="demo-progress-info">
                          <div className="demo-progress-name">{item.name}</div>
                          <div className="demo-progress-pct">{item.pct}% concluído</div>
                          <div className="demo-progress-bar">
                            <div
                              className="demo-progress-fill"
                              style={{
                                width: `${item.pct}%`,
                                background: currentBrand.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {layout === "minimal" && (
                <div className="demo-minimal-dock visible">
                  <span className="active">🏠</span>
                  <span>📚</span>
                  <span>🎯</span>
                  <span>📊</span>
                  <span>👤</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="comparison-section">
        <div className="container">
          <div className="comparison-header reveal">
            <h2 className="headline-sm">
              Enquanto nas outras plataformas seu aluno <span style={{ color: "#EF4444" }}>estuda</span>,<br />
              na Launcher ele é <span className="gradient-text">aprovado</span>
            </h2>
            <p>E você coloca mais dinheiro no bolso.</p>
          </div>

          <div className="comparison-grid">
            <div className="reveal">
              <h3><span style={{ color: "#EF4444" }}>❌</span> O problema das outras</h3>
              <div className="comparison-problems">
                {COMPETITOR_PROBLEMS.map((problem) => (
                  <div key={problem.name} className="problem-card">
                    <div className="problem-icon">{problem.icon}</div>
                    <div className="problem-text">
                      <div className="problem-name">{problem.name}</div>
                      <div className="problem-desc">{problem.problem}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal reveal-d2">
              <h3><span style={{ color: "var(--ac)" }}>✓</span> Com a Launcher você consegue</h3>
              <div className="solution-list">
                {[
                  "Aumentar ticket médio",
                  "Melhorar taxa de conversão",
                  "Aplicar order bump e upsell com mais eficiência",
                  "Tomar decisões com base em dados reais",
                  "Profissionalizar sua operação",
                  "Fazer seu aluno performar melhor",
                ].map((item) => (
                  <div key={item} className="solution-item">
                    <div className="solution-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" fill="none" />
                      </svg>
                    </div>
                    <span className="solution-text">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="testimonials-section">
        <div className="container">
          <div className="testimonials-header reveal">
            <span className="section-label">Depoimentos</span>
            <h2 className="headline-sm">
              Quem usa, <span className="gradient-text">recomenda</span>
            </h2>
          </div>

          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, idx) => (
              <div key={t.name} className={`testimonial-card reveal reveal-d${idx + 1}`}>
                <p className="testimonial-text">{t.text}</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div className="testimonial-info">
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="pricing-header reveal">
            <span className="section-label">Preços</span>
            <h2 className="headline-sm">
              Aqui você ganha um <span className="gradient-text">parceiro</span>
            </h2>
            <p>Sem burocracia. Sem taxa de implantação. Evoluímos junto com você.</p>

            <div className="pricing-toggle">
              <button
                className={`pricing-toggle-btn${pricingPeriod === "monthly" ? " active" : ""}`}
                onClick={() => setPricingPeriod("monthly")}
              >
                Mensal
              </button>
              <button
                className={`pricing-toggle-btn${pricingPeriod === "yearly" ? " active" : ""}`}
                onClick={() => setPricingPeriod("yearly")}
              >
                Anual
              </button>
              {pricingPeriod === "yearly" && (
                <span className="pricing-toggle-badge">Economize até 50%</span>
              )}
            </div>
          </div>

          <div className="pricing-grid">
            {pricing.map((plan, idx) => (
              <div
                key={plan.name}
                className={`pricing-card reveal reveal-d${idx + 1}${plan.highlight ? " highlighted" : ""}`}
              >
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-desc">{plan.desc}</div>

                <div className="pricing-amount">
                  <span className="pricing-currency">R$</span>
                  <span className="pricing-value">{plan.price}</span>
                  <span className="pricing-period">/mês</span>
                </div>

                <div className="pricing-fee">
                  + <strong>{plan.fee}</strong> de taxa por venda
                </div>

                <div className="pricing-features">
                  {plan.features.map((f) => (
                    <div key={f} className="pricing-feature">
                      <div className="pricing-feature-icon check">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" fill="none" />
                        </svg>
                      </div>
                      {f}
                    </div>
                  ))}
                  {plan.excluded.map((f) => (
                    <div key={f} className="pricing-feature excluded">
                      <div className="pricing-feature-icon cross">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#EF4444">
                          <path d="M18 6L6 18M6 6l12 12" stroke="#EF4444" strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                      {f}
                    </div>
                  ))}
                </div>

                <a
                  href="https://wa.me/5562995594055"
                  target="_blank"
                  rel="noopener"
                  className={`pricing-cta ${plan.highlight ? "btn-primary" : "btn-secondary"}`}
                >
                  Começar com {plan.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTEGRATIONS ─── */}
      <section className="integrations-section">
        <div className="container">
          <div className="integrations-header reveal">
            <h2 className="headline-sm">Desbloqueie o potencial máximo</h2>
            <p>Integramos com os maiores provedores do mercado digital. Fácil e rápido.</p>
          </div>

          <div className="integrations-logos reveal">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="integration-logo">
                <div className="integration-icon" style={{ background: i.color }}>
                  {i.name.charAt(0)}
                </div>
                <span className="integration-name">{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="faq-section">
        <div className="container">
          <div className="faq-header reveal">
            <span className="section-label">FAQ</span>
            <h2 className="headline-sm">Perguntas frequentes</h2>
          </div>

          <div className="faq-grid">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className={`faq-item reveal${openFaq === idx ? " open" : ""}`}
                style={{ transitionDelay: `${idx * 0.05}s` }}
              >
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="final-cta">
        <div className="final-cta-bg" />
        <div className="container final-cta-content">
          <h2 className="headline-sm reveal">
            Pronto para transformar<br />
            <span className="gradient-text">seu negócio?</span>
          </h2>
          <p className="reveal reveal-d1">
            Pare de perder alunos para plataformas genéricas. Comece a vender mais
            com uma infraestrutura que realmente funciona.
          </p>
          <div className="final-cta-actions reveal reveal-d2">
            <a href="#pricing" className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Quero essa infraestrutura
            </a>
            <a href="https://wa.me/5562995594055" target="_blank" rel="noopener" className="btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              Falar no WhatsApp
            </a>
          </div>
          <div className="final-cta-note reveal reveal-d3">
            Sem contrato anual · Setup em menos de um dia · Suporte via WhatsApp
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="logo-icon" style={{ width: 28, height: 28 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L20 7v10l-8 5-8-5V7l8-5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            Launcher · launcheredu.com.br
          </div>

          <div className="footer-links">
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
          </div>

          <div className="footer-social">
            <a href="https://instagram.com/plataforma_launcher" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              @plataforma_launcher
            </a>
            <a href="https://wa.me/5562995594055" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              (62) 99559-4055
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
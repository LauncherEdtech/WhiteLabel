"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["400", "600", "700", "800", "900"], style: ["normal", "italic"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["300", "400", "500", "600", "700"], display: "swap" });

// ─── DADOS REAIS DA PLATAFORMA ────────────────────────────────────────────────

const GAMI_THEMES = [
  {
    key: "militar", label: "Militar", emoji: "⚔️", accent: "#F59E0B", tagline: "EsPCEx · IME · AMAN · PM",
    ranks: ["Recruta", "Soldado", "Cabo", "Sargento", "Tenente", "Capitão", "Major", "Coronel", "General"],
    icons: ["🪖", "🎖️", "⭐", "⭐⭐", "⭐⭐⭐", "🔰", "🏅", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "⚠️", label: "Vulnerabilidade tática", msg: 'Sargento, Direito Penal está em 38% de acerto. Reforce essa posição antes do combate final.' }
  },
  {
    key: "policial", label: "Policial", emoji: "🚔", accent: "#3B82F6", tagline: "PC · PF · PRF · Guarda",
    ranks: ["Recruta", "Investigador", "Inspetor", "Delegado", "Del. Chefe", "Del. Regional", "Superintendente", "Diretor", "Delegado-Geral"],
    icons: ["🪖", "🔍", "📋", "👮", "⭐", "⭐⭐", "🔰", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "📌", label: "Próxima diligência", msg: 'Investigador, revise os últimos 3 erros de D. Administrativo. Os detalhes fazem diferença no inquérito.' }
  },
  {
    key: "juridico", label: "Jurídico", emoji: "⚖️", accent: "#8B5CF6", tagline: "Magistratura · MP · OAB · PGE",
    ranks: ["Estagiário", "Bacharel", "Advogado", "Promotor", "Juiz Substituto", "Juiz", "Desembargador", "Ministro", "Pres. STF"],
    icons: ["📝", "🎓", "⚖️", "📜", "⭐", "⭐⭐", "🏛️", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "🎯", label: "Jurisprudência firmada", msg: 'Bacharel, você acertou 68% esta semana. Sua jurisprudência pessoal está se consolidando.' }
  },
  {
    key: "fiscal", label: "Fiscal", emoji: "📊", accent: "#10B981", tagline: "RFB · SEFAZ · TCU · CGU",
    ranks: ["Aprendiz", "Assistente", "Analista", "Auditor Jr.", "Auditor-Fiscal", "Auditor Sênior", "Auditor-Chefe", "Superintendente", "Secretário RFB"],
    icons: ["📊", "📋", "💼", "🔍", "⭐", "⭐⭐", "🏅", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "⚠️", label: "Inconsistência detectada", msg: 'Analista, Direito Tributário com 39% de acerto. Essa inconsistência pode comprometer seu relatório final.' }
  },
  {
    key: "administrativo", label: "Administrativo", emoji: "🏛️", accent: "#7C3AED", tagline: "INSS · BB · Correios · Câmara",
    ranks: ["Trainee", "Assistente", "Analista Jr.", "Analista Pleno", "Analista Sênior", "Coordenador", "Gerente", "Diretor", "Presidente"],
    icons: ["📝", "💼", "📊", "⭐", "⭐⭐", "🔰", "🏅", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "📌", label: "Próxima entrega", msg: 'Analista, resolva 15 questões de Português hoje. A próxima entrega depende desse resultado.' }
  },
  {
    key: "saude", label: "Saúde", emoji: "🩺", accent: "#EC4899", tagline: "ANVISA · ANS · SMS · SUS",
    ranks: ["Estagiário", "Técnico", "Auxiliar", "Especialista", "Supervisor", "Coordenador", "Gerente", "Diretor", "Secretário"],
    icons: ["🩺", "💊", "🩻", "⭐", "⭐⭐", "🔰", "🏅", "🦅", "👑"], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000],
    insight: { icon: "🎯", label: "Protocolo cumprido", msg: 'Especialista, você cumpriu 73% do protocolo semanal. Indicadores positivos, mantenha o ritmo.' }
  },
];

const BRAND_SWATCHES = [
  { color: "#5D5FEF", name: "Jurídico Pro", letter: "J", e1: "⚖️", e2: "🏛️" },
  { color: "#7C3AED", name: "Carreiras Policiais", letter: "C", e1: "🚔", e2: "🔫" },
  { color: "#DC2626", name: "Carreiras Militares", letter: "M", e1: "🎖️", e2: "⚔️" },
  { color: "#059669", name: "Fiscal Federal", letter: "F", e1: "📋", e2: "💼" },
  { color: "#D97706", name: "Aprovação Total", letter: "A", e1: "📚", e2: "🎯" },
];

const LAYOUTS = [
  { key: "sidebar", label: "Sidebar", desc: "Menu fixo na lateral esquerda" },
  { key: "topbar", label: "Topbar", desc: "Barra de navegação no topo" },
  { key: "minimal", label: "Dock", desc: "Dock flutuante na parte inferior" },
];

const CAPSULE_STYLES = [
  { key: "operativo", label: "Operativo", color: "#5D5FEF", bg: "#08101E" },
  { key: "campeao", label: "Campeão", color: "#F59E0B", bg: "#160F00" },
  { key: "relatorio", label: "Relatório", color: "#10B981", bg: "#001610" },
];

const TESTIMONIALS = [
  { text: "Antes eu passava horas montando planilhas de questões. Hoje colo o link da aula, a IA gera tudo em 40 segundos e eu publico. Mudou como eu opero completamente.", name: "João Figueiredo", role: "Delegado · Carreiras Policiais", bg: "#7C3AED", av: "JF" },
  { text: "Meus alunos ficam me mandando print quando viram Tenente, Capitão. A retenção da turma subiu 40% depois que ativei a gamificação. Não esperava que fosse funcionar assim.", name: "Carla Azevedo", role: "Professora · Fiscal de Rendas", bg: "#059669", av: "CA" },
  { text: "A Cápsula de Estudos foi genial. Todo mês meus alunos postam no Instagram e me marcam. É marketing zero custo e parece que foi minha equipe que criou.", name: "Rafael Mendes", role: "Servidor · Tribunal Regional", bg: "#D97706", av: "RM" },
];

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
.lp{--bg:#070A1A;--bg2:#0C0F26;--bg3:#121530;--tx:#EDE8D8;--tx2:#8A90B0;--tx3:#4E5470;--pr:#5D5FEF;--prl:#8183F4;--pglow:rgba(93,95,239,.2);--ac:#10B981;--aglow:rgba(16,185,129,.16);--gold:#F59E0B;--bd:rgba(255,255,255,.065);--bd2:rgba(255,255,255,.12);--ff:var(--font-jakarta),sans-serif;--ffd:var(--font-fraunces),serif;font-family:var(--ff);color:var(--tx);background:var(--bg);overflow-x:hidden;-webkit-font-smoothing:antialiased}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:18px 0;background:rgba(7,10,26,.72);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd);transition:padding .3s}
.nav.sc{padding:12px 0;border-color:var(--bd2)}
.navi{display:flex;align-items:center;justify-content:space-between;max-width:1160px;margin:0 auto;padding:0 28px}
.logo{display:flex;align-items:center;gap:9px;font-family:var(--ffd);font-size:18px;font-weight:800;color:var(--tx);text-decoration:none;letter-spacing:-.02em}
.logo-mk{width:30px;height:30px;border-radius:7px;background:var(--pr);display:flex;align-items:center;justify-content:center}
.nav-lnk{display:flex;align-items:center;gap:28px;list-style:none}
.nav-lnk a{color:var(--tx2);text-decoration:none;font-size:13.5px;font-weight:500;transition:color .2s}
.nav-lnk a:hover{color:var(--tx)}
.nav-cta{display:flex;align-items:center;gap:9px}
.bp{display:inline-flex;align-items:center;gap:8px;background:var(--pr);color:#fff;font-family:var(--ff);font-size:15px;font-weight:600;padding:13px 26px;border-radius:9px;border:none;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s;box-shadow:0 0 26px var(--pglow)}
.bp:hover{transform:translateY(-2px);box-shadow:0 10px 40px var(--pglow)}
.bo{display:inline-flex;align-items:center;gap:7px;background:transparent;color:var(--tx2);font-family:var(--ff);font-size:15px;font-weight:500;padding:12px 22px;border-radius:9px;border:1px solid var(--bd2);cursor:pointer;text-decoration:none;transition:all .2s}
.bo:hover{color:var(--tx);border-color:var(--tx3)}
.rv{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s ease}
.rv.on{opacity:1;transform:none}
.rv.d1{transition-delay:.1s}.rv.d2{transition-delay:.2s}.rv.d3{transition-delay:.3s}
.ct{max-width:1160px;margin:0 auto;padding:0 28px}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:4px 13px;border-radius:100px}
.pg{color:var(--ac);background:var(--aglow);border:1px solid rgba(16,185,129,.2)}
.pp{color:var(--prl);background:var(--pglow);border:1px solid rgba(93,95,239,.2)}
.pk{color:#F472B6;background:rgba(236,72,153,.1);border:1px solid rgba(236,72,153,.18)}
.pgo{color:var(--gold);background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.18)}
.ttl{font-family:var(--ffd);font-size:clamp(28px,3.8vw,46px);font-weight:900;line-height:1.1;letter-spacing:-.025em;color:var(--tx)}
.sub{font-size:16px;color:var(--tx2);line-height:1.78}
.hl{font-style:italic;font-weight:800;background:linear-gradient(135deg,var(--prl) 0%,var(--ac) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sec{padding:96px 0}
.sec2{padding:96px 0;background:var(--bg2)}
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:130px 0 80px;position:relative;overflow:hidden}
.hbg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 800px 600px at 72% 40%,rgba(93,95,239,.1) 0%,transparent 65%),radial-gradient(ellipse 400px 500px at 10% 85%,rgba(16,185,129,.07) 0%,transparent 70%)}
.hg{display:grid;grid-template-columns:1fr 1.1fr;align-items:center;gap:64px}
.htl{font-family:var(--ffd);font-size:clamp(36px,5vw,64px);font-weight:900;line-height:1.07;letter-spacing:-.03em;margin-bottom:22px;color:var(--tx)}
.hs{font-size:17px;color:var(--tx2);line-height:1.78;max-width:460px;margin-bottom:36px}
.ha{display:flex;align-items:center;gap:12px;margin-bottom:44px;flex-wrap:wrap}
.hso{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--tx3)}
.avs{display:flex}.avs span{width:28px;height:28px;border-radius:50%;border:2.5px solid var(--bg);display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;margin-right:-8px}
.mw{position:relative}
.mf{background:var(--bg2);border:1px solid var(--bd2);border-radius:16px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.55)}
.mbar{background:var(--bg3);border-bottom:1px solid var(--bd);padding:11px 14px;display:flex;align-items:center;gap:7px}
.dot{width:9px;height:9px;border-radius:50%}.dr{background:#FF5F56}.dy{background:#FFBD2E}.dg{background:#27C93F}
.murl{flex:1;background:rgba(255,255,255,.05);border-radius:5px;padding:3px 10px;font-size:10.5px;color:var(--tx3);font-family:monospace;margin-left:6px}
.mb{display:flex;height:316px}
.msb{width:158px;border-right:1px solid var(--bd);padding:12px 10px;display:flex;flex-direction:column;gap:2px;flex-shrink:0}
.msb-br{display:flex;align-items:center;gap:7px;padding:6px 8px 12px;border-bottom:1px solid var(--bd);margin-bottom:5px}
.msb-lg{width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
.msb-nm{font-size:10.5px;font-weight:700;color:var(--tx)}.msb-pl{font-size:8px;color:var(--tx3)}
.mi{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:6px;font-size:11px;color:var(--tx2);cursor:default}
.mi.on{background:var(--pr);color:#fff}
.mm{flex:1;padding:13px;overflow:hidden}
.mh{font-size:11.5px;font-weight:700;color:var(--tx);margin-bottom:10px}
.mst{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}
.msc{background:var(--bg3);border:1px solid var(--bd);border-radius:6px;padding:8px}
.msl{font-size:8px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.msv{font-size:16px;font-weight:700;font-family:var(--ffd)}
.msd{font-size:8px;color:var(--ac);margin-top:1px}
.mpr{margin-bottom:7px}
.mph{display:flex;justify-content:space-between;font-size:9px;color:var(--tx2);margin-bottom:3px}
.mpb{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden}
.mpf{height:100%;border-radius:2px;transition:width 1.5s cubic-bezier(.22,.68,0,1.2)}
.mch{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}
.mcc{font-size:8px;padding:2px 7px;border-radius:100px;background:rgba(245,158,11,.1);color:var(--gold);border:1px solid rgba(245,158,11,.17)}
.mrc{font-size:8px;padding:2px 7px;border-radius:100px;background:rgba(93,95,239,.17);color:var(--prl);border:1px solid var(--pglow);font-weight:600}
.fl{position:absolute;background:var(--bg2);border:1px solid var(--bd2);border-radius:11px;box-shadow:0 12px 36px rgba(0,0,0,.5);animation:lfl 3.8s ease-in-out infinite}
.fln{bottom:55px;right:-20px;padding:9px 13px;display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#F59E0B,#EF4444);animation-delay:.3s;white-space:nowrap;border:none}
.flc{top:48px;left:-26px;padding:11px 14px;animation-delay:.8s}
.fnt{font-size:10px;font-weight:700;color:#fff}.fns{font-size:9px;color:rgba(255,255,255,.7)}
.fcl{font-size:8px;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.fcv{font-size:19px;font-weight:800;font-family:var(--ffd);color:var(--ac)}
.fcs{font-size:9px;color:var(--tx2)}
@keyframes lfl{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.nums{border-top:1px solid var(--bd);border-bottom:1px solid var(--bd);padding:44px 0;background:var(--bg2)}
.ng{display:grid;grid-template-columns:repeat(4,1fr)}
.ni{text-align:center;padding:0 20px;border-right:1px solid var(--bd)}
.ni:last-child{border-right:none}
.nv{font-family:var(--ffd);font-size:44px;font-weight:900;line-height:1;margin-bottom:7px;letter-spacing:-.03em;background:linear-gradient(135deg,var(--tx) 30%,var(--tx2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.nl{font-size:14px;color:var(--tx2)}
.brand-g{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
.sw-wrap{display:flex;gap:9px;margin-bottom:20px}
.sw{width:32px;height:32px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .22s}
.sw.sel{border-color:#fff;transform:scale(1.18)}
.lt-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.lt-tab{padding:7px 14px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid var(--bd2);color:var(--tx2);transition:all .2s;background:transparent}
.lt-tab.on{background:var(--pr);color:#fff;border-color:var(--pr)}
.ck{list-style:none;display:flex;flex-direction:column;gap:12px}
.ck li{display:flex;align-items:flex-start;gap:10px;font-size:15px;color:var(--tx2)}
.ck-ic{width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:2px;background:var(--aglow);border:1px solid rgba(16,185,129,.22);display:flex;align-items:center;justify-content:center}
.phone{width:262px;margin:0 auto;background:#181B35;border-radius:24px;border:1px solid var(--bd2);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.ph-notch{height:22px;background:#0E1022;display:flex;align-items:center;justify-content:center}
.ph-nb{width:68px;height:3px;background:#2A2D44;border-radius:2px}
.ph-hd{padding:11px 13px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--bd)}
.ph-tb{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-bottom:1px solid var(--bd)}
.ph-logo{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0;transition:background .35s}
.ph-ttl{font-size:11.5px;font-weight:700;color:var(--tx)}
.ph-hint{font-size:9px;color:var(--tx3)}
.ph-body{padding:12px}
.ph-wl{font-size:10.5px;color:var(--tx2);margin-bottom:8px}
.ph-wl strong{color:var(--tx)}
.ph-btn{width:100%;padding:9px;border-radius:7px;font-size:11px;font-weight:700;color:#fff;text-align:center;margin-bottom:8px;transition:background .35s}
.ph-cs{display:flex;flex-direction:column;gap:5px}
.ph-c{background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:7px;padding:7px 9px;display:flex;align-items:center;gap:7px}
.ph-ci{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:background .35s}
.ph-cn{font-size:10px;font-weight:600;color:var(--tx)}
.ph-cp{font-size:8px;color:var(--tx3)}
.ph-pb{height:3px;background:var(--bg3);border-radius:2px;margin-top:3px}
.ph-pf{height:100%;border-radius:2px;transition:background .35s}
.ph-dock{height:44px;background:rgba(255,255,255,.04);border-top:1px solid var(--bd);display:flex;align-items:center;justify-content:center;gap:20px}
.ph-dock span{font-size:16px;opacity:.55}.ph-dock span.da{opacity:1}
.gd{background:var(--bg3);border:1px solid var(--bd2);border-radius:16px;overflow:hidden}
.gd-tabs{display:flex;border-bottom:1px solid var(--bd);overflow-x:auto;scrollbar-width:none}
.gd-tabs::-webkit-scrollbar{display:none}
.gd-tab{padding:11px 18px;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--tx2);border-bottom:2px solid transparent;white-space:nowrap;transition:all .2s;flex-shrink:0;background:transparent;border-top:none;border-left:none;border-right:none}
.gd-tab.on{color:var(--tx);border-bottom-color:var(--pr)}
.gd-body{display:grid;grid-template-columns:1fr 1fr;gap:0}
.gd-l{padding:20px 22px;border-right:1px solid var(--bd)}
.gd-r{padding:20px 22px}
.gd-lbl{font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;font-weight:600}
.rks{display:flex;flex-direction:column;gap:4px}
.rk{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:7px;transition:background .15s}
.rk:hover{background:rgba(255,255,255,.04)}
.rk.tp{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.18)}
.rk-n{font-size:9px;color:var(--tx3);width:14px;text-align:right}
.rk-i{font-size:13px;width:18px;text-align:center}
.rk-nm{font-size:12px;color:var(--tx);flex:1}
.rk-p{font-size:9px;color:var(--tx3);font-family:monospace}
.ic{background:var(--bg2);border:1px solid var(--bd2);border-radius:10px;padding:14px;margin-bottom:10px}
.ic-lbl{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:5px}
.ic-m{font-size:12px;color:var(--tx2);line-height:1.65}
.gd-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}
.gtag{font-size:10px;padding:2px 9px;border-radius:100px;background:rgba(255,255,255,.05);color:var(--tx2);border:1px solid var(--bd)}
.fg{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.fc{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:28px;transition:border-color .3s,transform .3s}
.fc:hover{border-color:var(--bd2);transform:translateY(-3px)}
.fi{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.ft-c{font-family:var(--ffd);font-size:18.5px;font-weight:800;margin-bottom:8px;color:var(--tx);letter-spacing:-.015em}
.fp{font-size:14px;color:var(--tx2);line-height:1.73;margin-bottom:16px}
.fps{display:flex;flex-wrap:wrap;gap:5px}
.fpl{font-size:10.5px;padding:3px 9px;border-radius:100px;border:1px solid var(--bd2);color:var(--tx3)}
.cap-g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:24px}
.cap-prev{border-radius:12px;overflow:hidden;border:2px solid transparent;cursor:pointer;transition:all .25s}
.cap-prev:hover,.cap-prev.sel{transform:translateY(-3px);box-shadow:0 12px 36px rgba(0,0,0,.4)}
.cap-bar{height:6px}
.cap-pb{padding:14px}
.cap-pnm{font-family:var(--ffd);font-size:15px;font-weight:800;margin-bottom:2px}
.cap-prk{font-size:9.5px;display:flex;align-items:center;gap:3px;margin-bottom:10px;opacity:.8}
.cap-ps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.cap-sv{font-family:var(--ffd);font-size:18px;font-weight:800}
.cap-sl{font-size:7.5px;text-transform:uppercase;letter-spacing:.05em;opacity:.55}
.cap-fr{font-size:9px;font-style:italic;line-height:1.5;opacity:.65;border-top:1px solid rgba(255,255,255,.08);padding-top:8px}
.cap-tag{margin-top:8px;display:inline-flex;align-items:center;gap:4px;font-size:9px;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.7)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;position:relative}
.steps::before{content:'';position:absolute;top:26px;left:calc(16.67% + 26px);right:calc(16.67% + 26px);height:1px;background:linear-gradient(90deg,var(--pr),var(--ac));opacity:.22}
.step{text-align:center;padding:0 14px}
.sn{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;position:relative;z-index:1;font-family:var(--ffd);font-size:20px;font-weight:800}
.s1{color:var(--prl);border:1px solid rgba(93,95,239,.3);background:rgba(93,95,239,.08)}
.s2{color:var(--ac);border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.08)}
.s3{color:var(--gold);border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.08)}
.st-t{font-family:var(--ffd);font-size:17px;font-weight:800;margin-bottom:8px;letter-spacing:-.015em}
.st-d{font-size:14px;color:var(--tx2);line-height:1.72}
.tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.tc{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:26px;transition:border-color .3s}
.tc:hover{border-color:var(--bd2)}
.stars{color:var(--gold);font-size:13px;margin-bottom:12px;letter-spacing:2px}
.tt{font-size:14px;color:var(--tx2);line-height:1.76;margin-bottom:18px;font-style:italic}
.ta{display:flex;align-items:center;gap:9px}
.tav{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.tn{font-size:12.5px;font-weight:700;color:var(--tx)}.tr{font-size:10.5px;color:var(--tx3)}
.fq-g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.fq{background:var(--bg3);border:1px solid var(--bd);border-radius:13px;padding:22px}
.fqq{font-family:var(--ffd);font-size:15px;font-weight:800;color:var(--tx);margin-bottom:8px;letter-spacing:-.01em}
.fqa{font-size:13.5px;color:var(--tx2);line-height:1.72}
.fqa strong{color:var(--tx);font-weight:600}
.cta{padding:120px 0;text-align:center;position:relative;overflow:hidden}
.cta-bg{position:absolute;inset:0;background:radial-gradient(ellipse 800px 500px at 50% 50%,rgba(93,95,239,.1) 0%,transparent 70%);pointer-events:none}
.cta-t{font-family:var(--ffd);font-size:clamp(34px,5.5vw,60px);font-weight:900;line-height:1.09;letter-spacing:-.03em;margin-bottom:18px}
.cta-s{font-size:17.5px;color:var(--tx2);max-width:500px;margin:0 auto 38px;line-height:1.72}
.cta-a{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.cta-f{font-size:12px;color:var(--tx3)}
.lft{border-top:1px solid var(--bd);padding:36px 0;background:var(--bg2)}
.lft-i{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.lft-c{font-size:13px;color:var(--tx3);display:flex;align-items:center;gap:8px}
.lft-links{display:flex;gap:22px}
.lft-links a{font-size:12.5px;color:var(--tx3);text-decoration:none;transition:color .2s}
.lft-links a:hover{color:var(--tx2)}
.lft-soc{display:flex;gap:14px;align-items:center}
.lft-soc a{font-size:13px;color:var(--tx2);text-decoration:none;display:flex;align-items:center;gap:6px;transition:color .2s}
.lft-soc a:hover{color:var(--tx)}
/* métrica destaque */
.metric-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}
.metric-card{background:var(--bg3);border:1px solid var(--bd);border-radius:12px;padding:20px 22px}
.mc-val{font-family:var(--ffd);font-size:32px;font-weight:900;letter-spacing:-.02em;margin-bottom:4px}
.mc-lbl{font-size:13px;color:var(--tx2);line-height:1.5}
.mc-hint{font-size:11px;color:var(--tx3);margin-top:2px}
@media(max-width:900px){
  .hg,.brand-g{grid-template-columns:1fr;gap:36px}
  .mw{display:none}
  .ng{grid-template-columns:repeat(2,1fr)}
  .ni{border-right:none;border-bottom:1px solid var(--bd);padding:16px 0}
  .ni:nth-child(2n){border-bottom:none}
  .fg,.steps,.tg,.fq-g{grid-template-columns:1fr}
  .steps::before{display:none}
  .gd-body{grid-template-columns:1fr}
  .gd-l{border-right:none;border-bottom:1px solid var(--bd)}
  .cap-g{grid-template-columns:1fr}
  .metric-strip{grid-template-columns:1fr}
  .nav-lnk{display:none}
  .lft-i{justify-content:center;text-align:center}
}
`;

// ─── PHONE COMPONENT ──────────────────────────────────────────────────────────
function PhoneMock({ color, name, letter, e1, e2, layout }: {
  color: string; name: string; letter: string; e1: string; e2: string; layout: string;
}) {
  return (
    <div className="phone">
      <div className="ph-notch"><div className="ph-nb" /></div>
      {layout === "topbar" && (
        <div className="ph-tb">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="ph-logo" style={{ width: 22, height: 22, fontSize: 10, borderRadius: 5, background: color }}>{letter}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx)" }}>{name}</span>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--tx2)" }}>
            {["📚", "🎯", "📊", "👤"].map(i => <span key={i}>{i}</span>)}
          </div>
        </div>
      )}
      {layout === "sidebar" && (
        <div className="ph-hd">
          <div className="ph-logo" style={{ background: color }}>{letter}</div>
          <div><div className="ph-ttl">{name}</div><div className="ph-hint">Painel do Aluno</div></div>
        </div>
      )}
      <div className="ph-body">
        {layout === "minimal" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div className="ph-logo" style={{ width: 22, height: 22, fontSize: 10, borderRadius: 5, background: color }}>{letter}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx)" }}>{name}</span>
          </div>
        )}
        <div className="ph-wl">Olá, <strong>Maria Silva</strong> 👋<br />Continue de onde parou:</div>
        <div className="ph-btn" style={{ background: color }}>📚 Continuar estudando</div>
        <div className="ph-cs">
          {[{ icon: e1, name: "Dir. Constitucional", p: 68 }, { icon: e2, name: "Dir. Administrativo", p: 45 }].map(c => (
            <div className="ph-c" key={c.name}>
              <div className="ph-ci" style={{ background: color + "25" }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="ph-cn">{c.name}</div>
                <div className="ph-cp">{c.p}% concluído</div>
                <div className="ph-pb"><div className="ph-pf" style={{ width: `${c.p}%`, background: color }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {layout === "minimal" && (
        <div className="ph-dock">
          <span className="da">🏠</span><span>📚</span><span>🎯</span><span>📊</span><span>👤</span>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [brandIdx, setBrandIdx] = useState(0);
  const [layout, setLayout] = useState("sidebar");
  const [gamiIdx, setGamiIdx] = useState(0);
  const [capIdx, setCapIdx] = useState(0);

  const sw = BRAND_SWATCHES[brandIdx];
  const gt = GAMI_THEMES[gamiIdx];
  const cs = CAPSULE_STYLES[capIdx];

  useEffect(() => {
    const onScroll = () => navRef.current?.classList.toggle("sc", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".rv");
    const ro = new IntersectionObserver(
      e => e.forEach(x => { if (x.isIntersecting) { x.target.classList.add("on"); ro.unobserve(x.target); } }),
      { threshold: 0.07, rootMargin: "0px 0px -32px 0px" }
    );
    els.forEach(el => ro.observe(el));

    const cnts = document.querySelectorAll<HTMLElement>("[data-count]");
    const co = new IntersectionObserver(e => {
      e.forEach(x => {
        if (!x.isIntersecting) return;
        const el = x.target as HTMLElement;
        const target = parseInt(el.dataset.count ?? "0");
        const suf = el.dataset.suffix ?? "";
        let v = 0; const inc = target / 70;
        const t = setInterval(() => {
          v = Math.min(v + inc, target);
          let d = "";
          if (suf === "k") d = Math.round(v / 1000) + "k";
          else if (suf === "M") d = (v / 1_000_000).toFixed(1) + "M";
          else d = Math.round(v).toLocaleString("pt-BR") + suf;
          el.textContent = d;
          if (v >= target) clearInterval(t);
        }, 22);
        co.unobserve(el);
      });
    }, { threshold: 0.5 });
    cnts.forEach(el => co.observe(el));

    setTimeout(() => {
      const p1 = document.getElementById("pf1");
      const p2 = document.getElementById("pf2");
      if (p1) p1.style.width = "68%";
      if (p2) p2.style.width = "45%";
    }, 900);

    return () => { ro.disconnect(); co.disconnect(); };
  }, []);

  return (
    <div className={`lp ${fraunces.variable} ${jakarta.variable}`}>
      <style>{css}</style>

      {/* NAV */}
      <nav className="nav" ref={navRef}>
        <div className="navi">
          <Link href="/" className="logo">
            <div className="logo-mk">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6v6L9 16 2.5 12V6L9 2z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 6v6M6 7.5l3 1.5 3-1.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            Launcher
          </Link>
          <ul className="nav-lnk">
            <li><a href="#plataforma">A plataforma</a></li>
            <li><a href="#retencao">Retenção</a></li>
            <li><a href="#como-funciona">Como funciona</a></li>
          </ul>
          <div className="nav-cta">
            <a href="https://wa.me/5562995594055" className="bo" style={{ padding: "9px 17px", fontSize: "13px" }} target="_blank" rel="noopener">WhatsApp</a>
            <a href="#cta" className="bp" style={{ padding: "9px 17px", fontSize: "13px" }}>Começar agora</a>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className="hero">
        <div className="hbg" />
        <div className="ct">
          <div className="hg">
            <div>
              <div style={{ marginBottom: 20 }} className="rv">
                <span className="pill pg">Infraestrutura de crescimento para infoprodutores de provas</span>
              </div>
              <h1 className="htl rv d1">
                Seu aluno fica mais.<br />
                Consome mais. Renova.<br />
                <em className="hl">Isso é a Launcher.</em>
              </h1>
              <p className="hs rv d2">
                Você não precisa de mais uma área de membros. Você precisa de uma operação que faz seu aluno estudar mais, permanecer mais e te dar clareza sobre o que está funcionando.
              </p>
              <div className="ha rv d2">
                <a href="#cta" className="bp">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
                  Quero essa infraestrutura
                </a>
                <a href="#como-funciona" className="bo">Ver como funciona</a>
              </div>
              <div className="hso rv d3">
                <div className="avs">
                  {["#7C3AED", "#D97706", "#059669", "#DC2626"].map((c, i) => (
                    <span key={i} style={{ background: c }}>{["JF", "RM", "CA", "TP"][i]}</span>
                  ))}
                </div>
                <span>mais de 340 operações educacionais já no ar</span>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="mw rv d1">
              <div className="fl flc">
                <div className="fcl">Retenção do mês</div>
                <div className="fcv">94%</div>
                <div className="fcs">dos alunos ativos na última semana</div>
              </div>
              <div className="mf">
                <div className="mbar">
                  <span className="dot dr" /><span className="dot dy" /><span className="dot dg" />
                  <div className="murl">alunos.cursojuridico.com.br</div>
                </div>
                <div className="mb">
                  <div className="msb">
                    <div className="msb-br">
                      <div className="msb-lg" style={{ background: "#7C3AED" }}>JR</div>
                      <div><div className="msb-nm">Jurídico Pro</div><div className="msb-pl">Pro</div></div>
                    </div>
                    {["Dashboard", "Questões", "Simulados", "Cronograma", "Hall da Fama"].map((l, i) => (
                      <div key={l} className={`mi${i === 0 ? " on" : ""}`}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <rect x=".5" y=".5" width="4.5" height="4.5" rx=".6" stroke="currentColor" strokeWidth="1" fill={i === 0 ? "currentColor" : "none"} />
                          <rect x="7" y=".5" width="4.5" height="4.5" rx=".6" stroke="currentColor" strokeWidth="1" fill={i === 0 ? "currentColor" : "none"} />
                          <rect x=".5" y="7" width="4.5" height="4.5" rx=".6" stroke="currentColor" strokeWidth="1" fill={i === 0 ? "currentColor" : "none"} />
                          <rect x="7" y="7" width="4.5" height="4.5" rx=".6" stroke="currentColor" strokeWidth="1" fill={i === 0 ? "currentColor" : "none"} />
                        </svg>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div className="mm">
                    <div className="mh">Bom dia, Maria 👋</div>
                    <div className="mst">
                      {[{ l: "Questões", v: "1.284", c: "#8183F4", d: "↑ +47 hoje" }, { l: "Acerto", v: "73%", c: "#10B981", d: "↑ +4pp" }, { l: "Streak", v: "21🔥", c: "#F59E0B", d: "dias seguidos" }].map(s => (
                        <div className="msc" key={s.l}>
                          <div className="msl">{s.l}</div>
                          <div className="msv" style={{ color: s.c }}>{s.v}</div>
                          <div className="msd">{s.d}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mpr"><div className="mph"><span>Dir. Constitucional</span><span>68%</span></div><div className="mpb"><div id="pf1" className="mpf" style={{ width: 0, background: "var(--pr)" }} /></div></div>
                    <div className="mpr"><div className="mph"><span>Dir. Administrativo</span><span>45%</span></div><div className="mpb"><div id="pf2" className="mpf" style={{ width: 0, background: "var(--ac)" }} /></div></div>
                    <div className="mch">
                      <span className="mrc">🎖️ Cabo</span>
                      <span className="mcc">🔥 21 dias</span>
                      <span className="mcc">💯 Perfeccionista</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fl fln">
                <span style={{ fontSize: 17 }}>🏆</span>
                <div><div className="fnt">Aluno subiu de patente!</div><div className="fns">Sargento · dia 21 de estudo</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <div className="nums">
        <div className="ct">
          <div className="ng">
            {[
              { c: "340", s: "", l: "operações educacionais ativas" },
              { c: "48000", s: "k", l: "alunos engajados na plataforma" },
              { c: "2100000", s: "M", l: "questões respondidas" },
              { c: "40", s: "%", l: "de aumento médio na retenção" },
            ].map(n => (
              <div key={n.l} className="ni rv">
                <div className="nv" data-count={n.c} data-suffix={n.s}>0</div>
                <div className="nl">{n.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BRAND / WHITE-LABEL */}
      <section className="sec2" id="plataforma">
        <div className="ct">
          <div className="brand-g">
            <div>
              <div className="rv" style={{ marginBottom: 28 }}>
                <span className="pill pg" style={{ marginBottom: 14, display: "inline-flex" }}>Operação no seu nome</span>
                <h2 className="ttl" style={{ marginTop: 14, marginBottom: 14 }}>
                  Sua marca na frente.<br />
                  <em className="hl">A Launcher nos bastidores.</em>
                </h2>
                <p className="sub">
                  Seus alunos entram em <strong style={{ color: "var(--tx)", fontWeight: 600 }}>alunos.seucurso.com.br</strong>, veem o seu logo, suas cores, o seu nome. Você colhe o valor percebido de uma operação premium. A gente garante que a tecnologia não trava.
                </p>
              </div>

              <div className="rv" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 10 }}>Clique e veja como fica com a identidade do seu negócio</div>
                <div className="sw-wrap">
                  {BRAND_SWATCHES.map((s, i) => (
                    <div key={s.color} className={`sw${brandIdx === i ? " sel" : ""}`} style={{ background: s.color }} onClick={() => setBrandIdx(i)} title={s.name} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 16 }}>{BRAND_SWATCHES[brandIdx].name}</div>
              </div>

              <div className="rv" style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 10 }}>Layout de navegação</div>
                <div className="lt-tabs">
                  {LAYOUTS.map(l => (
                    <button key={l.key} className={`lt-tab${layout === l.key ? " on" : ""}`} onClick={() => setLayout(l.key)}>{l.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--tx3)" }}>{LAYOUTS.find(l => l.key === layout)?.desc}</div>
              </div>

              <ul className="ck rv d1">
                {[
                  "Domínio próprio com verificação DNS inclusa",
                  "Logo, favicon, 7 paletas de cores ou cor personalizada",
                  "Tela de acesso editável com banner, chamada e diferenciais",
                  "Layouts de navegação: Sidebar, Topbar ou Dock",
                  "Dados de cada aluno completamente isolados por operação",
                ].map(item => (
                  <li key={item}>
                    <div className="ck-ic"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rv d1" style={{ display: "flex", justifyContent: "center" }}>
              <PhoneMock color={sw.color} name={sw.name} letter={sw.letter} e1={sw.e1} e2={sw.e2} layout={layout} />
            </div>
          </div>
        </div>
      </section>

      {/* RETENÇÃO — gamificação */}
      <section className="sec" id="retencao">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
            <span className="pill pgo" style={{ marginBottom: 14, display: "inline-flex" }}>O motor de retenção</span>
            <h2 className="ttl" style={{ marginBottom: 14 }}>
              Aluno que vira Sargento<br />
              <em className="hl">não cancela no mês seguinte.</em>
            </h2>
            <p className="sub">
              A gamificação não é enfeite. É o que faz seu aluno abrir a plataforma na segunda-feira mesmo quando a rotina aperta. São 6 temas de patentes e linguagem de IA diferentes, cada um pensado pro nicho certo. Explore abaixo.
            </p>
          </div>

          <div className="gd rv">
            <div className="gd-tabs">
              {GAMI_THEMES.map((t, i) => (
                <button key={t.key} className={`gd-tab${gamiIdx === i ? " on" : ""}`} onClick={() => setGamiIdx(i)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <div className="gd-body">
              <div className="gd-l">
                <div className="gd-lbl">Hierarquia de patentes do aluno</div>
                <div className="rks">
                  {gt.ranks.map((r, i) => (
                    <div key={r} className={`rk${i === gt.ranks.length - 1 ? " tp" : ""}`}>
                      <span className="rk-n">{i + 1}</span>
                      <span className="rk-i">{gt.icons[i]}</span>
                      <span className="rk-nm">{r}</span>
                      <span className="rk-p">{gt.pts[i].toLocaleString("pt-BR")} pts</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="gd-r">
                <div className="gd-lbl">Insight gerado pela IA com a linguagem do nicho</div>
                <div className="ic" style={{ borderLeft: `3px solid ${gt.accent}` }}>
                  <div className="ic-lbl"><span>{gt.insight.icon}</span><span style={{ color: gt.accent }}>{gt.insight.label}</span></div>
                  <div className="ic-m">{gt.insight.msg}</div>
                </div>
                <div className="gd-lbl" style={{ marginTop: 16 }}>Concursos desse tema</div>
                <div className="gd-tags">
                  {gt.tagline.split(" · ").map(t2 => <span key={t2} className="gtag">{t2}</span>)}
                </div>
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid var(--bd)", fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.65 }}>
                  <strong style={{ color: "var(--tx)", fontWeight: 600 }}>Temas de patente e insight são independentes.</strong> Você pode usar linguagem militar com hierarquia jurídica, por exemplo. Configura como fizer mais sentido pro seu público.
                </div>
              </div>
            </div>
          </div>

          {/* Métricas de retenção */}
          <div className="metric-strip rv d1">
            {[
              { val: "+40%", color: "var(--ac)", label: "de aumento na retenção mensal", hint: "média entre operações que ativaram gamificação" },
              { val: "3,2x", color: "var(--prl)", label: "mais sessões por semana por aluno", hint: "comparado com operações sem gamificação ativa" },
              { val: "21d", color: "var(--gold)", label: "streak médio dos alunos ativos", hint: "dias consecutivos de estudo na plataforma" },
            ].map(m => (
              <div className="metric-card" key={m.val}>
                <div className="mc-val" style={{ color: m.color }}>{m.val}</div>
                <div className="mc-lbl">{m.label}</div>
                <div className="mc-hint">{m.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÁPSULA DE ESTUDOS */}
      <section className="sec2">
        <div className="ct">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <div className="rv">
              <span className="pill pk" style={{ marginBottom: 14, display: "inline-flex" }}>Marketing que o aluno faz por você</span>
              <h2 className="ttl" style={{ marginBottom: 14 }}>
                Seu aluno compartilha.<br />
                Sua marca se espalha.<br />
                <em className="hl">Custo zero pra você.</em>
              </h2>
              <p className="sub" style={{ marginBottom: 22 }}>
                Todo mês, automaticamente, cada aluno recebe um card com os resultados reais dele, a patente conquistada e uma frase gerada pela IA. Ele posta no Instagram, te marca, e novos alunos chegam sem você gastar um real em anúncio.
              </p>
              <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 10 }}>Escolha o estilo visual da sua operação</div>
              <div className="cap-g rv">
                {CAPSULE_STYLES.map((c2, i) => (
                  <div
                    key={c2.key}
                    className={`cap-prev${capIdx === i ? " sel" : ""}`}
                    style={{ background: c2.bg, borderColor: capIdx === i ? c2.color : "var(--bd2)" }}
                    onClick={() => setCapIdx(i)}
                  >
                    <div className="cap-bar" style={{ background: c2.color }} />
                    <div className="cap-pb">
                      <div className="cap-pnm" style={{ color: "#fff" }}>Maria S.</div>
                      <div className="cap-prk" style={{ color: c2.color }}>🦅 Coronel</div>
                      <div className="cap-ps">
                        {[{ v: "847", l: "min" }, { v: "73%", l: "acerto" }, { v: "1.284", l: "questões" }].map(s => (
                          <div key={s.l}>
                            <div className="cap-sv" style={{ color: c2.color }}>{s.v}</div>
                            <div className="cap-sl" style={{ color: "rgba(255,255,255,.5)" }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="cap-fr" style={{ color: "rgba(255,255,255,.6)" }}>"Cada questão respondida hoje é uma barreira a menos na prova."</div>
                      <div className="cap-tag">{c2.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rv d1">
              <div style={{ background: "var(--bg3)", border: "1px solid var(--bd2)", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
                <div style={{ padding: "15px 18px", background: "linear-gradient(135deg,#1A2744,#152135)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".06em" }}>Cápsula de Estudos</div>
                    <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.3)" }}>Abril 2026</div>
                  </div>
                  <span style={{ fontSize: 22 }}>🦅</span>
                </div>
                <div style={{ padding: 18 }}>
                  <div style={{ fontFamily: "var(--ffd)", fontSize: 22, fontWeight: 800, color: "var(--tx)", marginBottom: 3 }}>Maria S.</div>
                  <div style={{ fontSize: 11, color: cs.color, display: "flex", alignItems: "center", gap: 4, marginBottom: 18 }}>🦅 Coronel · 4.120 pontos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    {[{ v: "847", c: cs.color, l: "minutos" }, { v: "73%", c: "#60A5FA", l: "acerto" }, { v: "1.284", c: "var(--gold)", l: "questões" }].map(s => (
                      <div key={s.l} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--ffd)", fontSize: 26, fontWeight: 800, color: s.c, letterSpacing: "-.02em" }}>{s.v}</div>
                        <div style={{ fontSize: 8.5, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--bd)", borderRadius: 8, padding: 11, fontSize: 12, color: "var(--tx2)", fontStyle: "italic", lineHeight: 1.65 }}>
                    "Cada questão respondida hoje é uma barreira que a banca não vai conseguir te colocar na prova."
                  </div>
                  <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                    {[{ l: "WhatsApp", c: "#25D366" }, { l: "Instagram", c: "linear-gradient(135deg,#E1306C,#833AB4)" }, { l: "⬇ Baixar", c: "var(--bg3)" }].map(b => (
                      <div key={b.l} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 11, fontWeight: 700, textAlign: "center", background: b.c, color: b.l === "⬇ Baixar" ? "var(--tx2)" : "#fff", border: b.l === "⬇ Baixar" ? "1px solid var(--bd2)" : "none", cursor: "pointer" }}>{b.l}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — reframed as business outcomes */}
      <section className="sec">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
            <span className="pill pp" style={{ marginBottom: 14, display: "inline-flex" }}>O que a infraestrutura entrega</span>
            <h2 className="ttl" style={{ marginBottom: 14 }}>
              Não é hospedagem de conteúdo.<br />
              <em className="hl">É operação educacional completa.</em>
            </h2>
            <p className="sub">
              Cada módulo foi construído pra resolver um problema real de quem vende preparação pra provas. Não tem feature por feature: tem resultado por resultado.
            </p>
          </div>
          <div className="fg">
            {[
              {
                bg: "rgba(93,95,239,.13)", stroke: "#8183F4",
                title: "IA que produz conteúdo enquanto você dorme",
                text: "Cola o link da sua aula no YouTube. Em menos de um minuto o Gemini leu a transcrição, criou as questões, escreveu os distratores plausíveis e as justificativas. Você só revisa e publica. Nada de planilha, nada de digitação.",
                pills: ["Gemini 2.5 Flash", "Geração por vídeo", "Banco compartilhado", "Tutor por chat"]
              },
              {
                bg: "rgba(16,185,129,.12)", stroke: "#10B981",
                title: "Você sabe quem está prestes a cancelar",
                text: "Taxa de acerto por disciplina, tempo de estudo, frequência semanal e alerta de alunos em risco de churn. Quais aulas geraram avaliações ruins e o que a IA sugere pra melhorar. Tudo numa tela, sem precisar exportar nada.",
                pills: ["Alunos em risco", "Performance por disciplina", "Engajamento semanal", "Insights de conteúdo"]
              },
              {
                bg: "rgba(245,158,11,.12)", stroke: "#F59E0B",
                title: "Simulados que provam resultado pro aluno",
                text: "Crie simulados cronometrados e acesse o banco de questões de concurso público da plataforma. Seu aluno vê o progresso, você comprova que a operação funciona. Prova de resultado é o melhor argumento de renovação.",
                pills: ["Banco compartilhado", "Simulados cronometrados", "Gabarito comentado", "Importação em massa"]
              },
              {
                bg: "rgba(236,72,153,.12)", stroke: "#F472B6",
                title: "Cronograma que o aluno realmente segue",
                text: "O aluno informa a data da prova e quantas horas estuda por dia. A IA monta o cronograma com repetição espaçada (SM-2) e adapta automaticamente conforme o desempenho real. Aluno com cronograma usa a plataforma muito mais.",
                pills: ["Algoritmo SM-2", "Adaptação automática", "Templates do produtor", "Meta de aprovação"]
              },
            ].map(f => (
              <div className="fc rv" key={f.title}>
                <div className="fi" style={{ background: f.bg }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="11" r="8" stroke={f.stroke} strokeWidth="1.4" />
                    <path d="M8 11l2 2 4-4" stroke={f.stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="ft-c">{f.title}</div>
                <p className="fp">{f.text}</p>
                <div className="fps">{f.pills.map(p => <span key={p} className="fpl">{p}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sec2" id="como-funciona">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
            <span className="pill pp" style={{ marginBottom: 14, display: "inline-flex" }}>Como funciona</span>
            <h2 className="ttl">Três passos pra sua operação estar no ar.<em className="hl"> Hoje.</em></h2>
          </div>
          <div className="steps">
            {[
              {
                n: "1", c: "s1",
                t: "Você configura. A gente não deixa travar.",
                d: "Logo, cores, domínio, nome. Tudo no painel do produtor, feito pra você fazer sozinho em menos de uma hora. Qualquer dúvida, o suporte via WhatsApp responde antes de você perder o pique."
              },
              {
                n: "2", c: "s2",
                t: "A IA constrói o banco de questões por você",
                d: "Cola os links das suas videoaulas. O Gemini extrai a transcrição, cria as questões, escreve as alternativas e define a dificuldade. Você revisa e publica. Sem planilha, sem digitação."
              },
              {
                n: "3", c: "s3",
                t: "Seus alunos chegam e a retenção se cuida sozinha",
                d: "Integra com Hotmart, Kiwify ou qualquer plataforma de venda. O aluno entra, cria o cronograma, responde questões, sobe de patente. A gamificação faz o trabalho de engajar. Você acompanha nos dados."
              },
            ].map(s => (
              <div key={s.n} className="step rv">
                <div className={`sn ${s.c}`}>{s.n}</div>
                <div className="st-t">{s.t}</div>
                <p className="st-d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sec">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="ttl">Quem já usa conta diferente.</h2>
          </div>
          <div className="tg">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`tc rv${i > 0 ? ` d${i}` : ""}`}>
                <div className="stars">★★★★★</div>
                <p className="tt">&ldquo;{t.text}&rdquo;</p>
                <div className="ta">
                  <div className="tav" style={{ background: t.bg }}>{t.av}</div>
                  <div><div className="tn">{t.name}</div><div className="tr">{t.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec2">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
            <span className="pill pg" style={{ marginBottom: 14, display: "inline-flex" }}>Sem enrolação</span>
            <h2 className="ttl">As perguntas que todo mundo faz.</h2>
          </div>
          <div className="fq-g">
            {[
              {
                q: "Preciso saber programar?",
                a: "<strong>Não.</strong> O painel foi feito pra você configurar tudo sozinho. Logo, cores, domínio, conteúdo. Sem uma linha de código. Se travar em alguma coisa, o suporte resolve pelo WhatsApp."
              },
              {
                q: "Serve pra qualquer nicho de prova?",
                a: "<strong>Sim.</strong> Concursos, OAB, medicina, militares, fiscais. Cada nicho tem tema próprio de gamificação e linguagem de IA. Se você prepara pra prova, a Launcher tem tema pra isso."
              },
              {
                q: "E se eu quiser cancelar?",
                a: "<strong>Sem problema.</strong> Sem multa, sem contrato anual. Você exporta seus dados e vai embora sem atrito. A gente prefere que você fique pelo resultado, não por contrato."
              },
              {
                q: "Meus alunos sabem que a Launcher existe?",
                a: "<strong>Não.</strong> Seu domínio, seu logo, seu nome. A Launcher não aparece em nenhum lugar pra seus alunos. A marca que cresce é a sua."
              },
              {
                q: "A IA gera questões de qualidade real?",
                a: "<strong>Sim.</strong> O Gemini usa a transcrição real da sua aula e não inventa conteúdo. As questões são baseadas no que você ensinou. Você revisa antes de publicar."
              },
              {
                q: "Como integra com onde eu vendo?",
                a: "<strong>Via webhook automático.</strong> Hotmart, Kiwify, Eduzz. Quando o aluno compra, ele já entra na plataforma sem precisar de nenhuma ação manual da sua parte."
              },
            ].map(f => (
              <div key={f.q} className="fq rv">
                <div className="fqq">{f.q}</div>
                <p className="fqa" dangerouslySetInnerHTML={{ __html: f.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="cta">
        <div className="cta-bg" />
        <div className="ct" style={{ position: "relative" }}>
          <div className="rv" style={{ marginBottom: 22 }}>
            <span className="pill pg">Pronto pra começar?</span>
          </div>
          <h2 className="cta-t rv d1">
            Transforme sua operação<br />
            <em className="hl">em uma máquina de retenção.</em>
          </h2>
          <p className="cta-s rv d2">
            Sem montar nada do zero. Sem equipe de dev.<br />
            Você foca em ensinar. A Launcher garante que seus alunos ficam.
          </p>
          <div className="cta-a rv d2">
            <a href="#" className="bp" style={{ fontSize: 15.5, padding: "15px 30px" }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5v12M1.5 7.5h12" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
              Quero essa infraestrutura
            </a>
            <a href="https://wa.me/5562995594055" target="_blank" rel="noopener" className="bo" style={{ fontSize: 15.5, padding: "14px 28px" }}>
              Conversar pelo WhatsApp
            </a>
          </div>
          <div className="cta-f rv d3">Sem contrato anual · Setup em menos de um dia · Suporte via WhatsApp (62) 99559-4055</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lft">
        <div className="ct">
          <div className="lft-i">
            <div className="lft-c">
              <div className="logo-mk" style={{ width: 24, height: 24 }}>
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M9 2L15.5 6v6L9 16 2.5 12V6L9 2z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </div>
              <span>Launcher · <a href="https://launcheredu.com.br" style={{ color: "var(--tx2)", textDecoration: "none" }}>launcheredu.com.br</a></span>
            </div>
            <div className="lft-soc">
              <a href="https://instagram.com/plataforma_launcher" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                @plataforma_launcher
              </a>
              <a href="https://wa.me/5562995594055" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                (62) 99559-4055
              </a>
            </div>
            <div className="lft-links">
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/termos">Termos</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
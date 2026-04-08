"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// ── Brand demo swatches ──────────────────────────────────────────────────────
const SWATCHES = [
  { color: "#5D5FEF", name: "Jurídico Pro",        letter: "J", emoji1: "⚖️", emoji2: "🏛️" },
  { color: "#7C3AED", name: "Carreiras Policiais", letter: "C", emoji1: "🚔", emoji2: "🔫" },
  { color: "#DC2626", name: "Carreiras Militares",  letter: "M", emoji1: "🎖️", emoji2: "⚔️" },
  { color: "#059669", name: "Fiscal Federal",       letter: "F", emoji1: "📋", emoji2: "💼" },
  { color: "#D97706", name: "Aprovação Total",      letter: "A", emoji1: "📚", emoji2: "🎯" },
];

const RANKS = [
  { emoji: "🪖", name: "Recruta",  pts: "0"    },
  { emoji: "🎖️", name: "Soldado",  pts: "100"  },
  { emoji: "⭐",  name: "Cabo",     pts: "300"  },
  { emoji: "⭐⭐", name: "Sargento", pts: "600"  },
  { emoji: "⭐⭐⭐",name: "Tenente",  pts: "1.000"},
  { emoji: "🔰",  name: "Capitão",  pts: "1.600"},
  { emoji: "🏅",  name: "Major",    pts: "2.500"},
  { emoji: "🦅",  name: "Coronel",  pts: "4.000"},
  { emoji: "👑",  name: "General",  pts: "6.000"},
];

const BADGES = [
  { icon: "🎯", name: "Primeira Questão" },
  { icon: "🔥", name: "Semana de Fogo"   },
  { icon: "💯", name: "Perfeccionista"   },
  { icon: "🌙", name: "Mês Inabalável"   },
  { icon: "🏃", name: "Maratonista"      },
  { icon: "🦉", name: "Coruja da Madrugada" },
  { icon: "🎊", name: "Aprovado!"        },
  { icon: "🤖", name: "Máquina de Estudar" },
];

const TESTIMONIALS = [
  {
    text: "Antes eu passava horas montando planilhas de questões. Hoje colo o link da aula, a IA gera tudo em 40 segundos e eu publico. Mudou como eu opero completamente.",
    name: "João Figueiredo",
    role: "Delegado · Carreiras Policiais",
    bg: "#7C3AED",
    initials: "JF",
  },
  {
    text: "Meus alunos ficam me mandando print quando viram Tenente, Capitão... A retenção da minha turma subiu 40% depois que ativei a gamificação. Não sabia que ia funcionar assim.",
    name: "Carla Azevedo",
    role: "Professora · Fiscal de Rendas",
    bg: "#059669",
    initials: "CA",
  },
  {
    text: "A Cápsula de Estudos foi genial. Todo mês meus alunos postam no Instagram e me marcam. É marketing zero custo — e parece que foi minha equipe que criou.",
    name: "Rafael Mendes",
    role: "Servidor · Tribunal Regional",
    bg: "#D97706",
    initials: "RM",
  },
];

// ── CSS global da landing ────────────────────────────────────────────────────
const css = `
  .lp-root {
    --bg:            #080B1C;
    --bg-2:          #0D1030;
    --bg-3:          #131629;
    --text:          #EDE8D8;
    --text-2:        #8E94B2;
    --text-3:        #52597A;
    --primary:       #5D5FEF;
    --primary-l:     #8183F4;
    --primary-glow:  rgba(93,95,239,.22);
    --accent:        #10B981;
    --accent-glow:   rgba(16,185,129,.18);
    --gold:          #F59E0B;
    --border:        rgba(255,255,255,.065);
    --border-2:      rgba(255,255,255,.12);
    --r:             14px;
    --r-sm:          9px;
    --ff:            var(--font-jakarta), sans-serif;
    --ff-display:    var(--font-fraunces), serif;
    font-family: var(--ff);
    color: var(--text);
    background: var(--bg);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Nav ── */
  .lp-nav {
    position: fixed; top:0; left:0; right:0; z-index:100;
    padding: 18px 0;
    background: rgba(8,11,28,.65);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transition: padding .3s, border-color .3s;
  }
  .lp-nav.scrolled { padding: 12px 0; border-color: var(--border-2); }
  .lp-nav-inner {
    display:flex; align-items:center; justify-content:space-between;
    max-width:1160px; margin:0 auto; padding:0 28px;
  }
  .lp-logo {
    display:flex; align-items:center; gap:10px;
    font-family: var(--ff-display); font-size:19px; font-weight:800;
    color: var(--text); text-decoration:none; letter-spacing:-.02em;
  }
  .lp-logo-mark {
    width:32px; height:32px; border-radius:8px;
    background: var(--primary);
    display:flex; align-items:center; justify-content:center;
  }
  .lp-nav-links { display:flex; align-items:center; gap:30px; list-style:none; }
  .lp-nav-links a {
    color: var(--text-2); text-decoration:none; font-size:14px;
    font-weight:500; transition:color .2s;
  }
  .lp-nav-links a:hover { color: var(--text); }
  .lp-nav-cta { display:flex; align-items:center; gap:10px; }

  /* ── Buttons ── */
  .btn-p {
    display:inline-flex; align-items:center; gap:8px;
    background: var(--primary); color:#fff;
    font-family: var(--ff); font-size:15px; font-weight:600;
    padding:13px 26px; border-radius:var(--r-sm); border:none; cursor:pointer;
    text-decoration:none; transition: transform .2s, box-shadow .2s;
    box-shadow: 0 0 28px var(--primary-glow);
  }
  .btn-p:hover { transform:translateY(-2px); box-shadow: 0 10px 40px var(--primary-glow); }
  .btn-o {
    display:inline-flex; align-items:center; gap:8px;
    background:transparent; color:var(--text-2);
    font-family: var(--ff); font-size:15px; font-weight:500;
    padding:12px 24px; border-radius:var(--r-sm);
    border:1px solid var(--border-2); cursor:pointer;
    text-decoration:none; transition: border-color .2s, color .2s;
  }
  .btn-o:hover { border-color:var(--text-3); color:var(--text); }

  /* ── Reveal ── */
  .rv { opacity:0; transform:translateY(24px); transition: opacity .75s ease, transform .75s ease; }
  .rv.on { opacity:1; transform:none; }
  .rv.d1 { transition-delay:.1s; }
  .rv.d2 { transition-delay:.2s; }
  .rv.d3 { transition-delay:.3s; }

  /* ── Container ── */
  .ct { max-width:1160px; margin:0 auto; padding:0 28px; }

  /* ── Tag pill ── */
  .tag-pill {
    display:inline-flex; align-items:center; gap:6px;
    font-size:11.5px; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
    padding:4px 14px; border-radius:100px;
  }
  .tag-green { color:var(--accent); background:var(--accent-glow); border:1px solid rgba(16,185,129,.22); }
  .tag-purple { color:var(--primary-l); background:var(--primary-glow); border:1px solid rgba(93,95,239,.22); }
  .tag-pink { color:#F472B6; background:rgba(236,72,153,.1); border:1px solid rgba(236,72,153,.2); }
  .tag-gold { color:var(--gold); background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.2); }

  /* ── Section titles ── */
  .sec-title {
    font-family: var(--ff-display); font-size: clamp(28px,3.8vw,48px);
    font-weight:800; line-height:1.1; letter-spacing:-.025em; color:var(--text);
  }
  .sec-sub { font-size:16.5px; color:var(--text-2); line-height:1.75; }
  .hl {
    font-style:italic; font-weight:800;
    background: linear-gradient(135deg, var(--primary-l) 0%, var(--accent) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }

  /* ════════ HERO ════════ */
  .hero {
    min-height:100vh; display:flex; flex-direction:column; justify-content:center;
    padding:130px 0 80px; position:relative; overflow:hidden;
  }
  .hero-bg {
    position:absolute; inset:0; pointer-events:none;
    background:
      radial-gradient(ellipse 800px 600px at 72% 40%, rgba(93,95,239,.11) 0%, transparent 65%),
      radial-gradient(ellipse 400px 500px at 10% 85%, rgba(16,185,129,.07) 0%, transparent 70%);
  }
  .hero-noise {
    position:absolute; inset:0; pointer-events:none; opacity:.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
  }
  .hero-grid {
    display:grid; grid-template-columns:1fr 1.1fr; align-items:center; gap:60px;
  }

  /* hero text */
  .hero-eyebrow { margin-bottom:20px; }
  .hero-title {
    font-family:var(--ff-display); font-size:clamp(36px,5vw,65px);
    font-weight:900; line-height:1.07; letter-spacing:-.03em;
    margin-bottom:22px; color:var(--text);
  }
  .hero-sub {
    font-size:17px; color:var(--text-2); line-height:1.75;
    max-width:470px; margin-bottom:36px;
  }
  .hero-actions { display:flex; align-items:center; gap:12px; margin-bottom:44px; flex-wrap:wrap; }
  .hero-social {
    display:flex; align-items:center; gap:10px;
    font-size:13px; color:var(--text-3);
  }
  .ava-stack { display:flex; }
  .ava-stack span {
    width:28px; height:28px; border-radius:50%; border:2.5px solid var(--bg);
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; margin-right:-8px;
  }

  /* ── Dashboard mockup ── */
  .mockup-wrap { position:relative; }
  .mockup-frame {
    background:var(--bg-2); border:1px solid var(--border-2); border-radius:16px;
    overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04);
  }
  .mock-bar {
    background:var(--bg-3); border-bottom:1px solid var(--border);
    padding:11px 14px; display:flex; align-items:center; gap:7px;
  }
  .dot { width:9px; height:9px; border-radius:50%; }
  .dr { background:#FF5F56; } .dy { background:#FFBD2E; } .dg { background:#27C93F; }
  .mock-url {
    flex:1; background:rgba(255,255,255,.05); border-radius:5px;
    padding:3px 10px; font-size:11px; color:var(--text-3); font-family:monospace;
    margin-left:6px;
  }
  .mock-body { display:flex; height:320px; }
  .mock-sidebar {
    width:168px; border-right:1px solid var(--border); padding:14px 10px;
    display:flex; flex-direction:column; gap:3px; flex-shrink:0;
  }
  .mock-brand {
    display:flex; align-items:center; gap:8px;
    padding:6px 8px 13px; border-bottom:1px solid var(--border); margin-bottom:6px;
  }
  .mock-logo {
    width:26px; height:26px; border-radius:6px;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:800; color:#fff; flex-shrink:0;
  }
  .mock-name { font-size:11px; font-weight:700; color:var(--text); }
  .mock-plan { font-size:9px; color:var(--text-3); }
  .mock-item {
    display:flex; align-items:center; gap:7px;
    padding:6px 9px; border-radius:6px;
    font-size:11.5px; color:var(--text-2); cursor:pointer;
  }
  .mock-item.active { background:var(--primary); color:#fff; }
  .mock-main { flex:1; padding:14px; overflow:hidden; }
  .mock-header { font-size:12px; font-weight:700; color:var(--text); margin-bottom:10px; }
  .mock-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-bottom:10px; }
  .mock-stat {
    background:var(--bg-3); border:1px solid var(--border);
    border-radius:7px; padding:9px;
  }
  .ms-label { font-size:8.5px; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px; }
  .ms-val { font-size:17px; font-weight:700; font-family:var(--ff-display); }
  .ms-delta { font-size:8.5px; color:var(--accent); margin-top:1px; }
  .ms-primary { color:var(--primary-l); }
  .ms-accent  { color:var(--accent); }
  .ms-gold    { color:var(--gold); }
  .prog-row { margin-bottom:8px; }
  .prog-head { display:flex; justify-content:space-between; font-size:9.5px; color:var(--text-2); margin-bottom:4px; }
  .prog-bar { height:4px; background:var(--bg-3); border-radius:2px; overflow:hidden; }
  .prog-fill { height:100%; border-radius:2px; transition:width 1.6s cubic-bezier(.22,.68,0,1.2); }
  .badge-chips { display:flex; gap:4px; flex-wrap:wrap; margin-top:8px; }
  .badge-chip {
    font-size:8.5px; padding:2px 7px; border-radius:100px;
    background:rgba(245,158,11,.1); color:var(--gold);
    border:1px solid rgba(245,158,11,.18);
  }
  .rank-chip {
    font-size:8.5px; padding:2px 8px; border-radius:100px;
    background:rgba(93,95,239,.18); color:var(--primary-l);
    border:1px solid var(--primary-glow); font-weight:600;
  }

  /* floating cards */
  .float-card {
    position:absolute;
    background:var(--bg-2); border:1px solid var(--border-2);
    border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,.5);
    animation: lp-float 3.5s ease-in-out infinite;
  }
  .float-notif {
    bottom:60px; right:-22px;
    padding:9px 13px; display:flex; align-items:center; gap:8px;
    background:linear-gradient(135deg,#F59E0B,#EF4444);
    animation-delay:.3s; white-space:nowrap;
  }
  .notif-txt-main { font-size:10.5px; font-weight:700; color:#fff; }
  .notif-txt-sub  { font-size:9.5px; color:rgba(255,255,255,.72); }
  .float-capsule {
    top:50px; left:-28px; padding:12px 15px;
    animation-delay:.8s;
  }
  .cap-lbl { font-size:8.5px; color:var(--text-3); text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px; }
  .cap-val { font-size:20px; font-weight:800; font-family:var(--ff-display); color:var(--accent); }
  .cap-sub { font-size:9px; color:var(--text-2); }

  @keyframes lp-float {
    0%,100% { transform:translateY(0); }
    50%      { transform:translateY(-7px); }
  }

  /* ════════ NUMBERS ════════ */
  .numbers-bar {
    border-top:1px solid var(--border); border-bottom:1px solid var(--border);
    padding:44px 0; background:var(--bg-2);
  }
  .numbers-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
  .number-item {
    text-align:center; padding:0 20px;
    border-right:1px solid var(--border);
  }
  .number-item:last-child { border-right:none; }
  .number-val {
    font-family:var(--ff-display); font-size:44px; font-weight:900;
    line-height:1; margin-bottom:7px; letter-spacing:-.03em;
    background:linear-gradient(135deg, var(--text) 30%, var(--text-2) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .number-lbl { font-size:14px; color:var(--text-2); }

  /* ════════ SECTION COMMON ════════ */
  section.lp { padding:96px 0; }
  .sec-hd { margin-bottom:60px; }

  /* ════════ BRAND ════════ */
  .brand-sec { background:var(--bg-2); position:relative; overflow:hidden; }
  .brand-grid { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; }
  .swatches { display:flex; gap:10px; margin-bottom:28px; }
  .swatch {
    width:34px; height:34px; border-radius:50%;
    cursor:pointer; border:3px solid transparent;
    transition:all .22s;
  }
  .swatch.sel { border-color:#fff; transform:scale(1.18); }
  .checklist { list-style:none; display:flex; flex-direction:column; gap:13px; }
  .checklist li { display:flex; align-items:flex-start; gap:10px; font-size:15px; color:var(--text-2); }
  .check-ic {
    width:20px; height:20px; border-radius:50%; flex-shrink:0; margin-top:2px;
    background:var(--accent-glow); border:1px solid rgba(16,185,129,.25);
    display:flex; align-items:center; justify-content:center;
  }

  /* phone frame */
  .phone-frame {
    width:268px; margin:0 auto;
    background:#181B35; border-radius:26px;
    border:1px solid var(--border-2);
    overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.5);
  }
  .phone-notch {
    height:24px; background:#0E1022;
    display:flex; align-items:center; justify-content:center;
  }
  .phone-notch-b { width:72px; height:3.5px; background:#2A2D44; border-radius:2px; }
  .phone-hd { padding:12px 14px 9px; display:flex; align-items:center; gap:9px; border-bottom:1px solid var(--border); }
  .phone-logo { width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#fff; flex-shrink:0; transition:background .4s; }
  .phone-title { font-size:12px; font-weight:700; color:var(--text); }
  .phone-hint  { font-size:9.5px; color:var(--text-3); }
  .phone-body  { padding:13px; }
  .phone-welcome { font-size:11px; color:var(--text-2); margin-bottom:9px; }
  .phone-welcome strong { color:var(--text); }
  .phone-cta { width:100%; padding:9px; border-radius:7px; font-size:11.5px; font-weight:700; color:#fff; text-align:center; margin-bottom:9px; transition:background .4s; }
  .phone-courses { display:flex; flex-direction:column; gap:5px; }
  .phone-course {
    background:rgba(255,255,255,.04); border:1px solid var(--border);
    border-radius:7px; padding:7px 9px; display:flex; align-items:center; gap:7px;
  }
  .phone-ci { width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:11px; transition:background .4s; }
  .phone-cn { font-size:10.5px; font-weight:600; color:var(--text); }
  .phone-cp { font-size:8.5px; color:var(--text-3); }
  .phone-pb { height:3px; background:var(--bg-3); border-radius:2px; margin-top:3px; }
  .phone-pf { height:100%; border-radius:2px; transition:background .4s; }

  /* ════════ FEATURES ════════ */
  .features-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:22px; }
  .feat-card {
    background:var(--bg-2); border:1px solid var(--border);
    border-radius:var(--r); padding:30px;
    position:relative; overflow:hidden;
    transition:border-color .3s, transform .3s;
  }
  .feat-card:hover { border-color:var(--border-2); transform:translateY(-3px); }
  .feat-icon {
    width:46px; height:46px; border-radius:11px;
    display:flex; align-items:center; justify-content:center; margin-bottom:18px;
  }
  .feat-title {
    font-family:var(--ff-display); font-size:19px; font-weight:800;
    margin-bottom:9px; color:var(--text); letter-spacing:-.015em;
  }
  .feat-text { font-size:14px; color:var(--text-2); line-height:1.72; margin-bottom:18px; }
  .feat-pills { display:flex; flex-wrap:wrap; gap:6px; }
  .fpill { font-size:11px; padding:3px 10px; border-radius:100px; border:1px solid var(--border-2); color:var(--text-3); }

  /* ════════ RANKS ════════ */
  .ranks-sec { background:var(--bg-2); }
  .ranks-header-grid { display:grid; grid-template-columns:1fr 1.8fr; gap:60px; align-items:end; margin-bottom:48px; }
  .ranks-row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .rank-card {
    background:var(--bg-3); border:1px solid var(--border);
    border-radius:var(--r-sm); padding:12px 14px; text-align:center; min-width:86px;
    transition:all .25s; cursor:default;
  }
  .rank-card:hover { border-color:var(--gold); transform:translateY(-4px); background:rgba(245,158,11,.04); }
  .rank-emoji { font-size:22px; margin-bottom:5px; display:block; }
  .rank-name { font-size:10.5px; font-weight:700; color:var(--text-2); }
  .rank-pts  { font-size:8.5px; color:var(--text-3); margin-top:1px; }
  .rank-card.top { border-color:rgba(245,158,11,.28); }
  .rank-card.top .rank-name { color:var(--gold); }
  .badges-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:8px; margin-top:28px; }
  .badge-item {
    background:var(--bg-3); border:1px solid var(--border);
    border-radius:var(--r-sm); padding:10px 6px; text-align:center; transition:border-color .2s;
  }
  .badge-item:hover { border-color:var(--border-2); }
  .badge-icon { font-size:20px; display:block; margin-bottom:4px; }
  .badge-name { font-size:8.5px; color:var(--text-2); font-weight:600; line-height:1.3; }

  /* ════════ CÁPSULA ════════ */
  .capsule-grid { display:grid; grid-template-columns:1.1fr 1fr; gap:80px; align-items:center; }
  .cap-card {
    background:var(--bg-2); border:1px solid var(--border);
    border-radius:16px; overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,.4);
  }
  .cap-card-hd {
    padding:15px 18px; background:linear-gradient(135deg,#1A2744,#152135);
    display:flex; align-items:center; justify-content:space-between;
  }
  .cap-title { font-size:10.5px; font-weight:700; color:rgba(255,255,255,.45); text-transform:uppercase; letter-spacing:.06em; }
  .cap-month { font-size:9.5px; color:rgba(255,255,255,.3); }
  .cap-body  { padding:18px; }
  .cap-student-name { font-family:var(--ff-display); font-size:22px; font-weight:800; color:var(--text); margin-bottom:3px; letter-spacing:-.015em; }
  .cap-rank { font-size:11px; color:var(--gold); display:flex; align-items:center; gap:4px; margin-bottom:18px; }
  .cap-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
  .cap-stat { text-align:center; }
  .cap-stat-val { font-family:var(--ff-display); font-size:26px; font-weight:800; letter-spacing:-.02em; }
  .cv-green { color:var(--accent); }
  .cv-blue  { color:#60A5FA; }
  .cv-gold  { color:var(--gold); }
  .cap-stat-lbl { font-size:8.5px; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; }
  .cap-quote {
    background:rgba(255,255,255,.04); border:1px solid var(--border);
    border-radius:var(--r-sm); padding:11px;
    font-size:12px; color:var(--text-2); font-style:italic; line-height:1.65;
  }
  .cap-share { display:flex; gap:7px; margin-top:11px; }
  .share-btn {
    flex:1; padding:8px; border-radius:6px;
    font-size:11px; font-weight:700; text-align:center; cursor:pointer;
    border:none; transition:opacity .2s;
  }
  .share-btn:hover { opacity:.85; }
  .sw { background:#25D366; color:#fff; }
  .si { background:linear-gradient(135deg,#E1306C,#833AB4); color:#fff; }
  .sd { background:var(--bg-3); color:var(--text-2); border:1px solid var(--border-2); }

  /* floating mini card */
  .cap-mini {
    position:absolute; right:-22px; top:24px; width:200px;
    background:var(--bg-2); border:1px solid var(--border-2);
    border-radius:11px; overflow:hidden;
    box-shadow:0 16px 48px rgba(0,0,0,.5);
    transform:rotate(3.5deg);
    animation: lp-float 4s ease-in-out infinite .5s;
  }
  .cap-mini-bar { height:6px; background:linear-gradient(90deg,var(--accent),var(--primary)); }
  .cap-mini-body { padding:12px 14px; }
  .cap-mini-name { font-size:12px; font-weight:800; font-family:var(--ff-display); margin-bottom:6px; letter-spacing:-.01em; }
  .cap-mini-val { font-size:22px; font-weight:800; font-family:var(--ff-display); color:var(--accent); }
  .cap-mini-lbl { font-size:8.5px; color:var(--text-3); }
  .cap-cards-wrap { position:relative; }

  /* ════════ HOW IT WORKS ════════ */
  .how-sec { background:var(--bg-2); }
  .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; position:relative; }
  .steps::before {
    content:''; position:absolute;
    top:27px; left:calc(16.67% + 27px); right:calc(16.67% + 27px);
    height:1px; background:linear-gradient(90deg,var(--primary),var(--accent));
    opacity:.25;
  }
  .step { text-align:center; padding:0 14px; }
  .step-n {
    width:54px; height:54px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    margin:0 auto 22px; position:relative; z-index:1;
    font-family:var(--ff-display); font-size:20px; font-weight:800;
  }
  .sn1 { color:var(--primary-l); border:1px solid rgba(93,95,239,.3); background:rgba(93,95,239,.08); }
  .sn2 { color:var(--accent);    border:1px solid rgba(16,185,129,.3); background:rgba(16,185,129,.08); }
  .sn3 { color:var(--gold);      border:1px solid rgba(245,158,11,.3); background:rgba(245,158,11,.08); }
  .step-title { font-family:var(--ff-display); font-size:17.5px; font-weight:800; margin-bottom:9px; letter-spacing:-.015em; }
  .step-txt { font-size:14px; color:var(--text-2); line-height:1.72; }

  /* ════════ TESTIMONIALS ════════ */
  .testimonials { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .tcard {
    background:var(--bg-2); border:1px solid var(--border);
    border-radius:var(--r); padding:26px; transition:border-color .3s;
  }
  .tcard:hover { border-color:var(--border-2); }
  .stars { color:var(--gold); font-size:13px; margin-bottom:13px; letter-spacing:2px; }
  .ttext { font-size:14px; color:var(--text-2); line-height:1.76; margin-bottom:18px; font-style:italic; }
  .tauthor { display:flex; align-items:center; gap:9px; }
  .tav {
    width:34px; height:34px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700; color:#fff; flex-shrink:0;
  }
  .tname { font-size:12.5px; font-weight:700; color:var(--text); }
  .trole { font-size:10.5px; color:var(--text-3); }

  /* ════════ OBJECTIONS ════════ */
  .obj-sec { background:var(--bg-2); }
  .obj-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .obj-card {
    background:var(--bg-3); border:1px solid var(--border);
    border-radius:var(--r); padding:26px;
  }
  .obj-q { font-family:var(--ff-display); font-size:15.5px; font-weight:700; color:var(--text); margin-bottom:9px; letter-spacing:-.01em; }
  .obj-a { font-size:13.5px; color:var(--text-2); line-height:1.7; }
  .obj-a strong { color:var(--text); font-weight:600; }

  /* ════════ CTA ════════ */
  .cta-sec {
    padding:120px 0; text-align:center; position:relative; overflow:hidden;
  }
  .cta-bg {
    position:absolute; inset:0; pointer-events:none;
    background:radial-gradient(ellipse 800px 500px at 50% 50%, rgba(93,95,239,.1) 0%, transparent 70%);
  }
  .cta-title {
    font-family:var(--ff-display); font-size:clamp(34px,5.5vw,62px);
    font-weight:900; line-height:1.09; letter-spacing:-.03em; margin-bottom:18px;
  }
  .cta-sub { font-size:17.5px; color:var(--text-2); max-width:500px; margin:0 auto 38px; line-height:1.7; }
  .cta-actions { display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
  .cta-foot { font-size:12.5px; color:var(--text-3); }

  /* ════════ FOOTER ════════ */
  .lp-footer { border-top:1px solid var(--border); padding:36px 0; background:var(--bg-2); }
  .foot-inner { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
  .foot-copy { font-size:13px; color:var(--text-3); }
  .foot-links { display:flex; gap:22px; }
  .foot-links a { font-size:12.5px; color:var(--text-3); text-decoration:none; transition:color .2s; }
  .foot-links a:hover { color:var(--text-2); }

  /* ════════ RESPONSIVE ════════ */
  @media (max-width: 900px) {
    .hero-grid, .brand-grid, .capsule-grid { grid-template-columns:1fr; gap:36px; }
    .mockup-wrap { display:none; }
    .numbers-grid { grid-template-columns:repeat(2,1fr); gap:20px; }
    .number-item { border-right:none; border-bottom:1px solid var(--border); padding:16px 0; }
    .number-item:nth-child(2n) { border-bottom:none; }
    .features-grid { grid-template-columns:1fr; }
    .steps { grid-template-columns:1fr; gap:28px; }
    .steps::before { display:none; }
    .testimonials, .obj-grid { grid-template-columns:1fr; }
    .ranks-header-grid { grid-template-columns:1fr; }
    .badges-grid { grid-template-columns:repeat(4,1fr); }
    .cap-cards-wrap { padding-bottom:0; }
    .cap-mini { display:none; }
    .lp-nav-links { display:none; }
    .foot-inner { justify-content:center; text-align:center; }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [activeSwatch, setActiveSwatch] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  // Brand demo update
  const swatch = SWATCHES[activeSwatch];

  useEffect(() => {
    // Scroll nav shadow
    const onScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Reveal on scroll
    const reveals = document.querySelectorAll<HTMLElement>(".rv");
    const ro = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add("on"); ro.unobserve(e.target); } }),
      { threshold: 0.08, rootMargin: "0px 0px -36px 0px" }
    );
    reveals.forEach((el) => ro.observe(el));

    // Counters
    const counters = document.querySelectorAll<HTMLElement>("[data-count]");
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const target = parseInt(el.dataset.count ?? "0");
        const suffix = el.dataset.suffix ?? "";
        let start = 0;
        const steps = 70;
        const inc = target / steps;
        const timer = setInterval(() => {
          start = Math.min(start + inc, target);
          let display = "";
          if (suffix === "k") display = Math.round(start / 1000) + "k";
          else if (suffix === "M") display = (start / 1_000_000).toFixed(1) + "M";
          else display = Math.round(start).toLocaleString("pt-BR") + suffix;
          el.textContent = display;
          if (start >= target) clearInterval(timer);
        }, 22);
        co.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => co.observe(el));

    // Progress bars
    setTimeout(() => {
      const pf1 = document.getElementById("pf1");
      const pf2 = document.getElementById("pf2");
      if (pf1) pf1.style.width = "68%";
      if (pf2) pf2.style.width = "45%";
    }, 900);

    return () => { ro.disconnect(); co.disconnect(); };
  }, []);

  return (
    <div className={`lp-root ${fraunces.variable} ${jakarta.variable}`}>
      <style>{css}</style>

      {/* ══ NAV ══ */}
      <nav className="lp-nav" ref={navRef}>
        <div className="lp-nav-inner">
          <Link href="/" className="lp-logo">
            <div className="lp-logo-mark">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6v6L9 16 2.5 12V6L9 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M9 6v6M6 7.5l3 1.5 3-1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            launcher<span style={{ color: "var(--primary-l)" }}>edu</span>
          </Link>
          <ul className="lp-nav-links">
            <li><a href="#funcionalidades">Funcionalidades</a></li>
            <li><a href="#gamificacao">Gamificação</a></li>
            <li><a href="#como-funciona">Como funciona</a></li>
          </ul>
          <div className="lp-nav-cta">
            <a href="#cta" className="btn-o" style={{ padding: "9px 18px", fontSize: "13.5px" }}>Ver demo</a>
            <a href="#cta" className="btn-p" style={{ padding: "9px 18px", fontSize: "13.5px" }}>Começar grátis</a>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-noise" />
        <div className="ct">
          <div className="hero-grid">
            {/* Left */}
            <div>
              <div className="hero-eyebrow rv">
                <span className="tag-pill tag-green">Plataforma white-label para concursos</span>
              </div>
              <h1 className="hero-title rv d1">
                Você construiu<br />
                a autoridade.<br />
                <em className="hl">A tecnologia é nossa.</em>
              </h1>
              <p className="hero-sub rv d2">
                Uma plataforma completa , no seu nome, no seu domínio , com IA generativa, gamificação personalizada e tudo que seus alunos precisam pra não largar os estudos. Sem equipe de dev, sem dor de cabeça.
              </p>
              <div className="hero-actions rv d2">
                <a href="#cta" className="btn-p">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 1.5v12M1.5 7.5h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Criar minha plataforma
                </a>
                <a href="#como-funciona" className="btn-o">Como funciona →</a>
              </div>
              <div className="hero-social rv d3">
                <div className="ava-stack">
                  <span style={{ background: "#7C3AED" }}>JF</span>
                  <span style={{ background: "#D97706" }}>RM</span>
                  <span style={{ background: "#059669" }}>CA</span>
                  <span style={{ background: "#DC2626" }}>TP</span>
                </div>
                <span>+340 infoprodutores já no ar</span>
              </div>
            </div>

            {/* Right — dashboard mockup */}
            <div className="mockup-wrap rv d1">
              {/* Floating capsule */}
              <div className="float-card float-capsule">
                <div className="cap-lbl">Cápsula de Estudos · Abr</div>
                <div className="cap-val">847min</div>
                <div className="cap-sub">de estudo esse mês ✨</div>
              </div>

              <div className="mockup-frame">
                <div className="mock-bar">
                  <span className="dot dr" /><span className="dot dy" /><span className="dot dg" />
                  <div className="mock-url">alunos.cursojuridico.com.br</div>
                </div>
                <div className="mock-body">
                  {/* Sidebar */}
                  <div className="mock-sidebar">
                    <div className="mock-brand">
                      <div className="mock-logo" style={{ background: "#7C3AED" }}>JR</div>
                      <div>
                        <div className="mock-name">Jurídico Pro</div>
                        <div className="mock-plan">Pro</div>
                      </div>
                    </div>
                    {["Dashboard","Questões","Simulados","Cronograma","Hall da Fama"].map((label, i) => (
                      <div key={label} className={`mock-item${i === 0 ? " active" : ""}`}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <rect x=".5" y=".5" width="5" height="5" rx=".8" fill={i===0?"white":"none"} stroke={i===0?"white":"currentColor"} strokeWidth="1"/>
                          <rect x="7.5" y=".5" width="5" height="5" rx=".8" fill={i===0?"white":"none"} stroke={i===0?"white":"currentColor"} strokeWidth="1"/>
                          <rect x=".5" y="7.5" width="5" height="5" rx=".8" fill={i===0?"white":"none"} stroke={i===0?"white":"currentColor"} strokeWidth="1"/>
                          <rect x="7.5" y="7.5" width="5" height="5" rx=".8" fill={i===0?"white":"none"} stroke={i===0?"white":"currentColor"} strokeWidth="1"/>
                        </svg>
                        {label}
                      </div>
                    ))}
                  </div>
                  {/* Main */}
                  <div className="mock-main">
                    <div className="mock-header">Bom dia, Maria 👋</div>
                    <div className="mock-stats">
                      {[
                        { label:"Questões", val:"1.284", cls:"ms-primary", delta:"↑ +47 hoje" },
                        { label:"Acerto",   val:"73%",   cls:"ms-accent",  delta:"↑ +4pp" },
                        { label:"Streak",   val:"21 🔥", cls:"ms-gold",    delta:"dias seguidos" },
                      ].map(s => (
                        <div className="mock-stat" key={s.label}>
                          <div className="ms-label">{s.label}</div>
                          <div className={`ms-val ${s.cls}`}>{s.val}</div>
                          <div className="ms-delta">{s.delta}</div>
                        </div>
                      ))}
                    </div>
                    <div className="prog-row">
                      <div className="prog-head"><span>Dir. Constitucional</span><span>68%</span></div>
                      <div className="prog-bar"><div id="pf1" className="prog-fill" style={{ width: 0, background: "var(--primary)" }} /></div>
                    </div>
                    <div className="prog-row">
                      <div className="prog-head"><span>Dir. Administrativo</span><span>45%</span></div>
                      <div className="prog-bar"><div id="pf2" className="prog-fill" style={{ width: 0, background: "var(--accent)" }} /></div>
                    </div>
                    <div className="badge-chips">
                      <span className="rank-chip">🎖️ Cabo</span>
                      <span className="badge-chip">🔥 21 dias</span>
                      <span className="badge-chip">💯 Perfeccionista</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge notif */}
              <div className="float-card float-notif">
                <span style={{ fontSize: 18 }}>🏆</span>
                <div>
                  <div className="notif-txt-main">Nova conquista!</div>
                  <div className="notif-txt-sub">Sargento · +300 pontos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ NUMBERS ══ */}
      <div className="numbers-bar">
        <div className="ct">
          <div className="numbers-grid">
            {[
              { count: "340",       suffix: "",  label: "infoprodutores ativos" },
              { count: "48000",     suffix: "k", label: "alunos na plataforma" },
              { count: "2100000",   suffix: "M", label: "questões respondidas" },
              { count: "98",        suffix: "%", label: "de uptime garantido" },
            ].map((n) => (
              <div key={n.label} className="number-item rv">
                <div
                  className="number-val"
                  data-count={n.count}
                  data-suffix={n.suffix}
                >
                  0
                </div>
                <div className="number-lbl">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ BRAND / WHITE-LABEL ══ */}
      <section className="lp brand-sec" id="funcionalidades">
        <div className="ct">
          <div className="brand-grid">
            {/* Text */}
            <div>
              <div className="sec-hd rv" style={{ marginBottom: 28 }}>
                <div className="tag-pill tag-green" style={{ marginBottom: 16 }}>Identidade própria</div>
                <h2 className="sec-title" style={{ marginBottom: 14 }}>
                  Se parece seu, é porque <em className="hl">é.</em>
                </h2>
                <p className="sec-sub">
                  Logo, domínio, cores, nome — tudo configurável em minutos pelo painel, sem precisar de dev. Seus alunos entram em <strong style={{ color: "var(--text)", fontWeight: 600 }}>alunos.seucurso.com.br</strong> e nunca precisam saber que a gente existe.
                </p>
              </div>

              <div className="rv" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>Clique e veja como fica com a sua cor →</div>
                <div className="swatches">
                  {SWATCHES.map((sw, i) => (
                    <div
                      key={sw.color}
                      className={`swatch${activeSwatch === i ? " sel" : ""}`}
                      style={{ background: sw.color }}
                      onClick={() => setActiveSwatch(i)}
                      title={sw.name}
                    />
                  ))}
                </div>
              </div>

              <ul className="checklist rv d1">
                {[
                  "Domínio próprio — alunos.seucurso.com.br",
                  "Logo, favicon, paleta de cores e nome da plataforma",
                  "Tela de login totalmente editável — banner, chamada, benefícios",
                  "Layouts de nav configuráveis: sidebar, topbar ou dock",
                  "Dados 100% isolados por produtor — zero risco de mistura",
                ].map((item) => (
                  <li key={item}>
                    <div className="check-ic">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Phone mockup */}
            <div className="rv d1" style={{ display: "flex", justifyContent: "center" }}>
              <div className="phone-frame">
                <div className="phone-notch"><div className="phone-notch-b" /></div>
                <div className="phone-hd">
                  <div className="phone-logo" style={{ background: swatch.color }}>
                    {swatch.letter}
                  </div>
                  <div>
                    <div className="phone-title">{swatch.name}</div>
                    <div className="phone-hint">Painel do Aluno</div>
                  </div>
                </div>
                <div className="phone-body">
                  <div className="phone-welcome">
                    Olá, <strong>Maria Silva</strong> 👋<br />Continue de onde parou:
                  </div>
                  <div className="phone-cta" style={{ background: swatch.color }}>
                    📚 Continuar estudando
                  </div>
                  <div className="phone-courses">
                    {[
                      { icon: swatch.emoji1, name: "Dir. Constitucional", prog: "68%", pct: "68" },
                      { icon: swatch.emoji2, name: "Dir. Administrativo",  prog: "45%", pct: "45" },
                    ].map((c) => (
                      <div className="phone-course" key={c.name}>
                        <div className="phone-ci" style={{ background: swatch.color + "25" }}>{c.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div className="phone-cn">{c.name}</div>
                          <div className="phone-cp">{c.prog} concluído</div>
                          <div className="phone-pb">
                            <div className="phone-pf" style={{ width: `${c.pct}%`, background: swatch.color }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="lp">
        <div className="ct">
          <div className="sec-hd rv" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 60px" }}>
            <div className="tag-pill tag-purple" style={{ marginBottom: 16 }}>Tecnologia que faz sentido</div>
            <h2 className="sec-title">
              O que os maiores infoprodutores do mundo têm.<br />
              <em className="hl">Agora disponível pra você.</em>
            </h2>
          </div>
          <div className="features-grid">
            {[
              {
                cls: "ai", bg: "rgba(93,95,239,.14)", stroke: "#8183F4",
                title: "IA que escreve as questões enquanto você dorme",
                text: "Cola o link da sua aula no YouTube. Em menos de um minuto, o Gemini leu a transcrição, criou as questões, escreveu os distratores plausíveis e as justificativas completas. Você só escolhe o que publicar.",
                pills: ["Gemini 2.5 Flash", "Geração por vídeo", "Cronograma SM-2", "Tutor por chat", "Análise de avaliações"],
                svgPath: "M11 3C8.79 3 7 4.79 7 7v1H5a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2h-2V7c0-2.21-1.79-4-4-4z",
              },
              {
                cls: "gami", bg: "rgba(245,158,11,.12)", stroke: "#F59E0B",
                title: "Gamificação que faz o aluno não querer cancelar",
                text: "34 conquistas, 9 patentes militares do Recruta ao General, Hall da Fama e notificações de desbloqueio em tempo real. Quando o aluno está na metade do caminho pro Capitão, ele não sai.",
                pills: ["34 badges", "9 patentes militares", "Hall da Fama", "Pontos por ação", "Streak de dias"],
                svgPath: "M11 2L13.4 8.2H20L14.7 11.8 16.6 18 11 14.4 5.4 18 7.3 11.8 2 8.2H8.6Z",
              },
              {
                cls: "analytics", bg: "rgba(16,185,129,.11)", stroke: "#10B981",
                title: "Analytics que você entende sem precisar de BI",
                text: "Taxa de acerto por disciplina, tempo real de estudo, quais aulas geraram avaliações ruins — e a sugestão da IA para melhorar. Tudo numa tela, sem exportar planilha.",
                pills: ["Performance por aluno", "Ranking por disciplina", "Alunos em risco", "Engajamento diário"],
                svgPath: "M3 17l4-5 4 3 4-7 4 3",
              },
              {
                cls: "share", bg: "rgba(236,72,153,.11)", stroke: "#F472B6",
                title: "Marketing orgânico que seus alunos fazem por você",
                text: "Todo mês, cada aluno recebe um card com os resultados reais dele, uma frase gerada pela IA e o logo da sua plataforma. Ele posta no Instagram, te marca, e novos alunos chegam — sem você gastar um real.",
                pills: ["Card mensal automático", "Frase IA personalizada", "WhatsApp · Instagram", "3 estilos visuais"],
                svgPath: "M17 5a2 2 0 100-4 2 2 0 000 4zM5 11a2 2 0 100-4 2 2 0 000 4zM17 17a2 2 0 100-4 2 2 0 000 4zM7 10l8-4M7 12l8 4",
              },
            ].map((f) => (
              <div key={f.title} className="feat-card rv">
                <div className="feat-icon" style={{ background: f.bg }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d={f.svgPath} stroke={f.stroke} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    {f.cls === "ai" && <circle cx="11" cy="13" r="1.5" fill={f.stroke}/>}
                  </svg>
                </div>
                <div className="feat-title">{f.title}</div>
                <p className="feat-text">{f.text}</p>
                <div className="feat-pills">
                  {f.pills.map((p) => <span key={p} className="fpill">{p}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ RANKS ══ */}
      <section className="lp ranks-sec" id="gamificacao">
        <div className="ct">
          <div className="ranks-header-grid">
            <div className="rv" style={{ marginBottom: 0 }}>
              <div className="tag-pill tag-gold" style={{ marginBottom: 16 }}>Gamificação militar</div>
              <h2 className="sec-title" style={{ marginBottom: 14 }}>
                O aluno que virar Sargento<br />
                <em className="hl">não vai cancelar.</em>
              </h2>
              <p className="sec-sub" style={{ marginTop: 12 }}>
                A progressão de Recruta a General é o melhor engine de retenção que você pode ter. Seus alunos ficam meses engajados — porque têm uma missão em andamento.
              </p>
            </div>
            <div className="rv d1">
              <div className="ranks-row">
                {RANKS.map((r, i) => (
                  <div key={r.name} className={`rank-card${i === RANKS.length - 1 ? " top" : ""}`}>
                    <span className="rank-emoji">{r.emoji}</span>
                    <div className="rank-name">{r.name}</div>
                    <div className="rank-pts">{r.pts} pts</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="badges-grid rv d2">
            {BADGES.map((b) => (
              <div key={b.name} className="badge-item">
                <span className="badge-icon">{b.icon}</span>
                <div className="badge-name">{b.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CÁPSULA DE ESTUDOS ══ */}
      <section className="lp" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 600px 500px at 50% 50%, rgba(16,185,129,.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="ct">
          <div className="capsule-grid">
            {/* Card visual */}
            <div className="cap-cards-wrap rv">
              <div className="cap-card">
                <div className="cap-card-hd">
                  <div>
                    <div className="cap-title">📊 Cápsula de Estudos</div>
                    <div className="cap-month">Abril · 2026</div>
                  </div>
                  <span style={{ fontSize: 22 }}>🦅</span>
                </div>
                <div className="cap-body">
                  <div className="cap-student-name">Maria S.</div>
                  <div className="cap-rank">🦅 Coronel · 4.120 pontos</div>
                  <div className="cap-stats">
                    {[
                      { val: "847", cls: "cv-green", lbl: "minutos" },
                      { val: "73%", cls: "cv-blue",  lbl: "acerto"  },
                      { val: "1.284", cls: "cv-gold", lbl: "questões" },
                    ].map((s) => (
                      <div key={s.lbl} className="cap-stat">
                        <div className={`cap-stat-val ${s.cls}`}>{s.val}</div>
                        <div className="cap-stat-lbl">{s.lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div className="cap-quote">
                    "Cada questão respondida hoje é uma barreira que a banca não vai conseguir te colocar na prova."
                  </div>
                  <div className="cap-share">
                    <div className="share-btn sw">WhatsApp</div>
                    <div className="share-btn si">Instagram</div>
                    <div className="share-btn sd">⬇ Baixar</div>
                  </div>
                </div>
              </div>

              {/* Mini card flutuante */}
              <div className="cap-mini">
                <div className="cap-mini-bar" />
                <div className="cap-mini-body">
                  <div className="cap-mini-name">Pedro A.</div>
                  <div className="cap-mini-val">621</div>
                  <div className="cap-mini-lbl">minutos em Março</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    <span className="badge-chip" style={{ fontSize: 8 }}>🔥 18 dias</span>
                    <span className="badge-chip" style={{ fontSize: 8 }}>🎖️ Sargento</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="rv d1">
              <div className="tag-pill tag-pink" style={{ marginBottom: 16 }}>Cápsula de Estudos</div>
              <h2 className="sec-title" style={{ marginBottom: 16 }}>
                Seu aluno compartilha.<br />
                Sua marca aparece.<br />
                <em className="hl">Você não faz nada.</em>
              </h2>
              <p className="sec-sub" style={{ marginBottom: 28 }}>
                Todo mês, automaticamente, cada aluno recebe um card com os resultados reais dele — minutos estudados, taxa de acerto, patente conquistada. Ele posta no Instagram. Sua plataforma aparece pra todo mundo. Sem gastar nada.
              </p>
              <ul className="checklist">
                {[
                  "Gerado automaticamente todo mês, zero trabalho seu",
                  "Frase motivacional única gerada por IA para cada aluno",
                  "3 estilos visuais configuráveis pelo produtor",
                  "Compartilhamento nativo: WhatsApp, Instagram Stories e download PNG",
                ].map((item) => (
                  <li key={item}>
                    <div className="check-ic" style={{ background: "rgba(236,72,153,.1)", borderColor: "rgba(236,72,153,.25)" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#F472B6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="lp how-sec" id="como-funciona">
        <div className="ct">
          <div className="sec-hd rv" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 60px" }}>
            <div className="tag-pill tag-purple" style={{ marginBottom: 16 }}>Em três passos</div>
            <h2 className="sec-title">
              Da contratação ao primeiro aluno estudando — <em className="hl">antes do fim do dia.</em>
            </h2>
          </div>
          <div className="steps">
            {[
              { n: "1", cls: "sn1",
                title: "Você configura, sem dev",
                text: "Logo, cores, nome, domínio — tudo no painel do produtor. É simples de propósito. Você não deveria precisar de um programador pra personalizar a própria plataforma." },
              { n: "2", cls: "sn2",
                title: "A IA monta o banco de questões",
                text: "Cola os links das suas videoaulas do YouTube. A Gemini extrai a transcrição, cria as questões, escreve as alternativas e define a dificuldade. Você revisa e publica." },
              { n: "3", cls: "sn3",
                title: "Seus alunos chegam e ficam",
                text: "Integra com Hotmart, Kiwify ou qualquer plataforma de venda. O aluno cria o cronograma com IA, resolve questões, sobe de patente. A retenção cuida de si mesma." },
            ].map((s) => (
              <div key={s.n} className="step rv">
                <div className={`step-n ${s.cls}`}>{s.n}</div>
                <div className="step-title">{s.title}</div>
                <p className="step-txt">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className="lp">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="sec-title">O que os produtores falam</h2>
          </div>
          <div className="testimonials">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`tcard rv${i > 0 ? ` d${i}` : ""}`}>
                <div className="stars">★★★★★</div>
                <p className="ttext">&ldquo;{t.text}&rdquo;</p>
                <div className="tauthor">
                  <div className="tav" style={{ background: t.bg }}>{t.initials}</div>
                  <div>
                    <div className="tname">{t.name}</div>
                    <div className="trole">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ OBJECTIONS — "Antes de você fechar" ══ */}
      <section className="lp obj-sec">
        <div className="ct">
          <div className="rv" style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="tag-pill tag-green" style={{ marginBottom: 16 }}>Perguntas diretas</div>
            <h2 className="sec-title">Antes de você continuar —<br /><em className="hl">as respostas honestas.</em></h2>
          </div>
          <div className="obj-grid">
            {[
              { q: "Preciso de equipe de dev?",      a: "<strong>Não.</strong> O painel do produtor foi desenhado pra você configurar tudo sozinho. Logo, cores, domínio, conteúdo. Sem uma linha de código." },
              { q: "Serve pra qualquer concurso?",   a: "<strong>Sim.</strong> Jurídico, policial, militar, fiscal — qualquer nicho de concurso público. Cada produtor cria o banco de questões da sua área." },
              { q: "E se eu quiser cancelar?",       a: "<strong>Tudo bem.</strong> Sem multa, sem contrato anual, sem burocracia. Você exporta seus dados e vai embora sem atrito." },
              { q: "Meus alunos ficam no meu nome?", a: "<strong>Sempre.</strong> Seus alunos acessam o seu domínio, veem o seu logo e o nome da sua plataforma. A gente não aparece em lugar nenhum." },
              { q: "A IA gera questões boas mesmo?", a: "<strong>Sim.</strong> O Gemini usa a transcrição real da sua aula — não inventa nada. As questões são baseadas no que você ensinou." },
              { q: "Como integra com vendas?",       a: "<strong>Via webhook.</strong> Hotmart, Kiwify, Eduzz — quando o aluno compra, ele já entra na plataforma automaticamente." },
            ].map((o) => (
              <div key={o.q} className="obj-card rv">
                <div className="obj-q">{o.q}</div>
                <p className="obj-a" dangerouslySetInnerHTML={{ __html: o.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="cta-sec" id="cta">
        <div className="cta-bg" />
        <div className="ct" style={{ position: "relative" }}>
          <div className="rv" style={{ marginBottom: 24 }}>
            <span className="tag-pill tag-green">Pronto pra começar?</span>
          </div>
          <h2 className="cta-title rv d1">
            Sua plataforma no ar<br />
            <em className="hl">antes da semana acabar.</em>
          </h2>
          <p className="cta-sub rv d2">
            Sem equipe de dev. Sem contrato anual. Sem taxa de setup.<br />
            Você foca em ensinar. A gente cuida da tecnologia.
          </p>
          <div className="cta-actions rv d2">
            <a href="#" className="btn-p" style={{ fontSize: 16, padding: "15px 30px" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5v13M1.5 8h13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Criar minha plataforma agora
            </a>
            <a href="#" className="btn-o" style={{ fontSize: 16, padding: "14px 28px" }}>
              Agendar demonstração →
            </a>
          </div>
          <div className="cta-foot rv d3">
            Sem cartão de crédito · Setup em minutos · Suporte via WhatsApp
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="lp-footer">
        <div className="ct">
          <div className="foot-inner">
            <div className="foot-copy">launcher edu · Todos os direitos reservados</div>
            <div className="foot-links">
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/termos">Termos</Link>
              <Link href="/contato">Contato</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
'use client';
import { useState, ReactNode, CSSProperties } from 'react';
import { launcherStyles, SectionHeader, Btn, GlowBG } from './primitives';

/* ════════════════════════════════════════════════════════════════════
   PRODUCER DASHBOARD
   ════════════════════════════════════════════════════════════════════ */

function Svg24({ path }: { path: string }) {
  const c = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (path) {
    case 'users': return <svg {...c}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'trend': return <svg {...c}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'warn': return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case 'book': return <svg {...c}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
    case 'target': return <svg {...c}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'clock': return <svg {...c}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    default: return null;
  }
}

function KPI({ icon, value, label, sub, iconBg = '#0F1F3A', iconColor = '#3B82F6' }: { icon: ReactNode; value: string; label: string; sub?: string; iconBg?: string; iconColor?: string }) {
  return (
    <div style={{ padding: '18px 20px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#9A9A9A', marginTop: 6 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function PerfBar({ label, pct, extra, labelWidth = 200 }: { label: string; pct: number; extra?: string; labelWidth?: number }) {
  const color = pct < 40 ? '#EF4444' : pct < 65 ? '#F59E0B' : '#10B981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div className="l-mono" style={{ width: labelWidth, fontSize: 11, color: '#B8B8B8', letterSpacing: '0.04em', flexShrink: 0 }}>{label.toUpperCase()}</div>
      <div style={{ flex: 1, position: 'relative', height: 14, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: '#1F1F1F', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, height: 3, width: `${Math.max(pct, 1.5)}%`, background: color, borderRadius: 2, boxShadow: `0 0 8px ${color}88` }} />
      </div>
      {extra && <div className="l-mono" style={{ fontSize: 10, color: '#6B6B6B', width: 85, textAlign: 'right' }}>{extra}</div>}
      <div className="l-mono" style={{ fontSize: 12, fontWeight: 600, color, width: 50, textAlign: 'right' }}>{pct.toFixed(1)}%</div>
    </div>
  );
}

function InsightCard({ icon, title, body, accent }: { icon: string; title: string; body: string; accent: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, background: '#141414', borderLeft: `3px solid ${accent}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#9A9A9A', lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

function DashboardMock() {
  const perf = [
    { name: 'Direito Constitucional', pct: 82.4 }, { name: 'Língua Portuguesa', pct: 76.1 },
    { name: 'Direito Administrativo', pct: 71.8 }, { name: 'Raciocínio Lógico', pct: 64.3 },
    { name: 'Direito Tributário', pct: 41.7 },
  ];
  return (
    <>
      <div><div style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 700, color: '#fff' }}>Dashboard</div><div style={{ fontSize: 12, color: '#8F8F8F', marginTop: 3 }}>Visão geral da sua turma</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KPI icon={<Svg24 path="users" />} value="1.284" label="Total de alunos" />
        <KPI icon={<Svg24 path="trend" />} value="78%" label="Engajamento (7d)" sub="1.002 ativos" iconBg="#0F2A1A" iconColor="#10B981" />
        <KPI icon={<Svg24 path="warn" />} value="34" label="Em risco" sub="risco de abandono" iconBg="#2A1F0A" iconColor="#F59E0B" />
        <KPI icon={<Svg24 path="book" />} value="11" label="Disciplinas" sub="com dados" iconBg="#1F1F1F" iconColor="#6B6B6B" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: '18px 20px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#fff' }}><span style={{ color: '#F59E0B', fontSize: 14 }}>⚠</span>Alunos em risco</div>
            <div style={{ fontSize: 11, color: 'var(--accent)' }}>Ver todos ›</div>
          </div>
          {[{ letter: 'G', name: 'Gabriela Lima', note: 'Sem atividade há 9 dias', tag: 'alto', bg: '#7F1D1D' }, { letter: 'R', name: 'Rafael Nunes', note: 'Queda de 40% no engajamento', tag: 'médio', bg: '#92400E' }].map((a) => (
            <div key={a.name} style={{ padding: '12px 14px', background: '#1A1A1A', border: '1px solid #262626', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, background: a.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{a.letter}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.name}</div><div style={{ fontSize: 11, color: '#8F8F8F', marginTop: 1 }}>{a.note}</div></div>
              <div style={{ fontSize: 10, padding: '3px 8px', background: a.tag === 'alto' ? '#2A1515' : '#3A2A0A', color: a.tag === 'alto' ? '#EF4444' : '#F59E0B', borderRadius: 4, fontWeight: 600 }}>{a.tag}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 20px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 14 }}><span style={{ color: 'var(--accent)' }}>📊</span>Performance da turma</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {perf.map((p) => <PerfBar key={p.name} label={p.name} pct={p.pct} labelWidth={150} />)}
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}><span>💡</span>Insights da turma</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <InsightCard icon="📈" accent="#10B981" title="Engajamento saudável" body="78% de engajamento semanal. A turma está 3x mais ativa que a média." />
          <InsightCard icon="⚠" accent="#F59E0B" title="34 alunos em risco" body="Cerca de 2,6% da turma está inativa há mais de 7 dias." />
          <InsightCard icon="📚" accent="var(--accent)" title="Oportunidade: Direito Tributário" body="A turma tem apenas 41,7% de acerto. Considere criar material de revisão." />
        </div>
      </div>
    </>
  );
}

function AnalyticsMock() {
  const perf = [
    { name: 'Direito Constitucional', pct: 82.4, tries: 3214 }, { name: 'Língua Portuguesa', pct: 76.1, tries: 4102 },
    { name: 'Direito Administrativo', pct: 71.8, tries: 2847 }, { name: 'Informática', pct: 68.9, tries: 1923 },
    { name: 'Raciocínio Lógico', pct: 64.3, tries: 2456 }, { name: 'Contabilidade Pública', pct: 58.2, tries: 1682 },
    { name: 'Direito Tributário', pct: 41.7, tries: 2183 },
  ];
  return (
    <>
      <div><div style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 700, color: '#fff' }}>Analytics</div><div style={{ fontSize: 12, color: '#8F8F8F', marginTop: 3 }}>Visão detalhada do desempenho</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KPI icon={<Svg24 path="users" />} value="1.284" label="Total de alunos" />
        <KPI icon={<Svg24 path="trend" />} value="78%" label="Engajamento (7d)" iconBg="#0F2A1A" iconColor="#10B981" />
        <KPI icon={<Svg24 path="warn" />} value="34" label="Em risco" iconBg="#2A1F0A" iconColor="#F59E0B" />
        <KPI icon={<Svg24 path="target" />} value="68,4%" label="Acerto médio" />
      </div>
      <div style={{ padding: '18px 22px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Performance por disciplina</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {perf.map((p) => <PerfBar key={p.name} label={p.name} pct={p.pct} extra={`${p.tries.toLocaleString('pt-BR')} tentativas`} labelWidth={200} />)}
        </div>
      </div>
    </>
  );
}

function StudentMock() {
  const perf = [
    { name: 'Direito Constitucional', pct: 92.3, tag: 'forte' }, { name: 'Língua Portuguesa', pct: 87.1, tag: 'forte' },
    { name: 'Direito Administrativo', pct: 81.6, tag: 'forte' }, { name: 'Informática', pct: 74.4, tag: 'bom' },
    { name: 'Raciocínio Lógico', pct: 68.2, tag: 'bom' }, { name: 'Contabilidade Pública', pct: 54.7, tag: 'medio' },
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, color: '#fff' }}>Arlindo Candini</div>
        <div style={{ fontSize: 11, padding: '5px 10px', background: '#0F2A1A', color: '#10B981', borderRadius: 6, fontWeight: 600, border: '1px solid #1A4A2F' }}>● Em ritmo</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KPI icon={<Svg24 path="target" />} value="84,7%" label="Acerto geral" />
        <KPI icon={<Svg24 path="book" />} value="2.140" label="Questões" />
        <KPI icon={<Svg24 path="clock" />} value="126min" label="Esta semana" iconBg="#0F2A1A" iconColor="#10B981" />
        <KPI icon={<Svg24 path="trend" />} value="187/617" label="Aulas" />
      </div>
      <div style={{ padding: '18px 22px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Meta semanal</div>
          <div className="l-mono" style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>21%</div>
        </div>
        <div style={{ height: 6, background: '#1F1F1F', borderRadius: 3, marginBottom: 10 }}>
          <div style={{ width: '21%', height: '100%', background: '#10B981', borderRadius: 3, boxShadow: '0 0 8px #10B98188' }} />
        </div>
        <div style={{ fontSize: 11, color: '#6B6B6B' }}>126min de 600min</div>
      </div>
      <div style={{ padding: '18px 22px', background: '#141414', border: '1px solid #1F1F1F', borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Performance por disciplina</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {perf.map((p) => <PerfBar key={p.name} label={p.name} pct={p.pct} labelWidth={200} />)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 10 }}>Insights deste aluno</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InsightCard icon="🎯" accent="#10B981" title="Ritmo acima da média" body="Arlindo está com 84,7% de acerto geral e 126 minutos estudados nesta semana." />
          <InsightCard icon="⭐" accent="var(--accent)" title="Pontos fortes consolidados" body="Direito Constitucional, Língua Portuguesa e Direito Administrativo acima de 80%." />
          <InsightCard icon="📌" accent="#F59E0B" title="Próxima ação recomendada" body="Reforçar Contabilidade Pública, que está em 54,7%. O Mentor sugere 30 questões e revisão da aula 12." />
        </div>
      </div>
    </>
  );
}

function PanelShell({ step, kind, title, desc, bullets, side = 'right', children }: { step: string; kind: string; title: string; desc: string; bullets: string[]; side?: 'left' | 'right'; children: ReactNode }) {
  const explanation = (
    <div style={{ padding: 36, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-elev)', borderRight: side === 'right' ? '1px solid var(--line)' : 'none', borderLeft: side === 'left' ? '1px solid var(--line)' : 'none' }}>
      <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.14em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />{step} · {kind}
      </div>
      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bullets.map((x) => <li key={x} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}><span style={{ color: '#10B981', fontSize: 14 }}>✓</span>{x}</li>)}
      </ul>
    </div>
  );
  const mock = <div style={{ background: '#0A0A0A', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 540 }}>{children}</div>;
  return (
    <div className="reveal" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden', display: 'grid', gridTemplateColumns: side === 'right' ? '360px 1fr' : '1fr 360px' }}>
      {side === 'right' ? <>{explanation}{mock}</> : <>{mock}{explanation}</>}
    </div>
  );
}

export function ProducerDashboard() {
  return (
    <section id="painel" style={{ ...launcherStyles.section, position: 'relative', overflow: 'hidden' }}>
      <GlowBG color="var(--accent)" size={520} opacity={0.06} top={-80} left={-120} />
      <div style={launcherStyles.container}>
        <SectionHeader eyebrow="O que você enxerga" title="A operação do seu produto em um painel." sub="Dashboard resumido, analytics detalhado e ficha técnica de cada aluno. O Mentor Inteligente acompanha você nos bastidores para transformar dados em decisões e oportunidades." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <PanelShell step="01" kind="DASHBOARD RESUMIDO" title="Visão geral da turma em um piscar de olhos." desc="Os indicadores essenciais no topo, alunos em risco, performance por disciplina e insights acionáveis gerados pelo Mentor." bullets={['KPIs da turma em tempo real', 'Alertas de risco por aluno', 'Performance por disciplina', 'Insights acionáveis automáticos']} side="right"><DashboardMock /></PanelShell>
          <PanelShell step="02" kind="ANALYTICS" title="Análise profunda, disciplina por disciplina." desc="Visão detalhada da performance da turma, identificação de gargalos por conteúdo e clusterização entre top performers e alunos que precisam de atenção." bullets={['Performance de toda a turma', 'Top performers e alunos em atenção', 'Clusterização automática', 'Insights por disciplina']} side="left"><AnalyticsMock /></PanelShell>
          <PanelShell step="03" kind="FICHA DO ALUNO" title="Ficha técnica completa de cada aluno." desc="Acompanhe acerto geral, questões respondidas, meta semanal e performance por disciplina. Insights personalizados pelo Mentor mantêm o aluno engajado." bullets={['Ficha técnica individual', 'Meta semanal em tempo real', 'Performance por disciplina', 'Insights personalizados do Mentor']} side="right"><StudentMock /></PanelShell>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PRICING
   ════════════════════════════════════════════════════════════════════ */
const FEATURES_INCLUDED = ['Cronograma estruturado', 'Banco de questões completo', 'Simulados realistas', 'Dashboard de performance', 'Motor de retenção', 'Cápsula de estudos'];

const PLANS = [
  { id: 'semestral', name: 'Semestral', duration: '6 meses', totalPerStudent: 89.40, monthlyEquivalent: 14.90, cashback: 20, popular: false, desc: 'Para começar com flexibilidade', setupFee: 997 },
  { id: 'anual', name: 'Anual', duration: '12 meses', totalPerStudent: 118.80, monthlyEquivalent: 9.90, cashback: 25, popular: false, highlightDiscount: true, desc: 'O melhor custo-benefício', discount: '-34%' },
  { id: 'bianual', name: '2 anos', duration: '24 meses', totalPerStudent: 237.60, monthlyEquivalent: 9.90, cashback: 30, popular: true, highlightCashback: true, desc: 'Para quem pensa em escala', discount: '-34%' },
] as const;

type Plan = typeof PLANS[number];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PlanCard({ p, i }: { p: Plan; i: number }) {
  const popular = p.popular;
  const hDiscount = 'highlightDiscount' in p && p.highlightDiscount;
  const hCashback = 'highlightCashback' in p && p.highlightCashback;
  const setupFee = 'setupFee' in p ? p.setupFee : undefined;
  const discount = 'discount' in p ? p.discount : undefined;
  return (
    <div className="reveal" data-delay={`${i}`} style={{ position: 'relative', background: popular ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--bg-card)), var(--bg-card))' : 'var(--bg-card)', border: popular ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--line)', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: popular ? '0 30px 60px rgba(59,130,246,0.2)' : 'none' }}>
      {popular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 999, fontFamily: 'JetBrains Mono', boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}>MAIOR CASHBACK</div>}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{p.name}</div>
          {discount && <span className="l-mono" style={{ fontSize: hDiscount ? 12 : 10, padding: hDiscount ? '5px 12px' : '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.18)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.35)', letterSpacing: '0.08em', fontWeight: 700 }}>{discount}</span>}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginTop: 4 }}>{p.desc}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>R$</span>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 56, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtBRL(p.monthlyEquivalent)}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>/mês por aluno</span>
        </div>
        <div className="l-mono" style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 8 }}>R$ {fmtBRL(p.totalPerStudent)} por aluno · parcela única</div>
        {setupFee && <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6, padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#EAB308' }}>⚡</span><span>+ taxa de implantação de <strong style={{ color: 'var(--ink)' }}>R$ {fmtBRL(setupFee)}</strong></span></div>}
      </div>
      <div style={{ padding: hCashback ? '20px 18px' : '14px 16px', background: hCashback ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(59,130,246,0.12))' : 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.04))', border: hCashback ? '1.5px solid rgba(59,130,246,0.6)' : '1px solid rgba(59,130,246,0.35)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, boxShadow: hCashback ? '0 0 24px rgba(59,130,246,0.3)' : 'none' }}>
        <div style={{ width: hCashback ? 46 : 38, height: hCashback ? 46 : 38, borderRadius: 10, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-halo)' }}>
          <svg width={hCashback ? 22 : 18} height={hCashback ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: hCashback ? 28 : 20, fontWeight: 700, color: hCashback ? 'var(--accent-halo)' : 'var(--ink)', lineHeight: 1 }}>{p.cashback}% <span style={{ fontSize: hCashback ? 14 : 13, color: 'var(--ink-dim)', fontWeight: 500 }}>de cashback</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 3 }}>da esteira de produtos</div>
        </div>
      </div>
      <Btn variant={popular ? 'primary' : 'ghost'} style={{ width: '100%', justifyContent: 'center' }}>Começar com {p.name}</Btn>
      <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div className="l-mono" style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', marginBottom: 10 }}>INCLUSO</div>
        {FEATURES_INCLUDED.map((t, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13 }}>
            <span style={{ color: 'var(--success)' }}>✓</span><span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{label}</span>
        <span className="l-mono" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
    </div>
  );
}

const PLAN_META = {
  semestral: { label: 'Semestral', perStudentMonth: 14.90, months: 6, cashback: 20, setup: 997 },
  anual: { label: 'Anual', perStudentMonth: 9.90, months: 12, cashback: 25, setup: 0 },
  bianual: { label: '2 anos', perStudentMonth: 9.90, months: 24, cashback: 30, setup: 0 },
};

function ROICalc() {
  const [students, setStudents] = useState(1000);
  const [plan, setPlan] = useState<keyof typeof PLAN_META>('anual');
  const [repassRate, setRepassRate] = useState(50);
  const [upsellRate, setUpsellRate] = useState(30);
  const [cashbackMonthly, setCashbackMonthly] = useState(195);

  const meta = PLAN_META[plan];
  const launcherCostPerStudent = meta.perStudentMonth * meta.months;
  const launcherCost = students * launcherCostPerStudent + meta.setup;
  const repassRevenue = students * repassRate * meta.months;
  const repassMargin = repassRevenue - students * launcherCostPerStudent;
  const upsellStudents = Math.round(students * (upsellRate / 100));
  const cashbackTotal = Math.round(upsellStudents * cashbackMonthly * (meta.cashback / 100) * meta.months);
  const netGain = repassMargin + cashbackTotal - meta.setup;
  const roiPct = launcherCost > 0 ? Math.round(netGain / launcherCost * 100) : 0;
  const fmt = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

  return (
    <div className="reveal" style={{ marginTop: 64, background: 'var(--bg-card)', border: '1px solid var(--line-strong)', borderRadius: 24, padding: 36, position: 'relative', overflow: 'hidden' }}>
      <GlowBG color="var(--accent)" size={500} opacity={0.15} top={-120} right={-120} />
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-halo)', boxShadow: '0 0 10px var(--accent-halo)' }} />CALCULADORA DE ROI
        </div>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1 }}>A Launcher pode virar uma nova linha de receita.</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 10 }}>1. Qual plano você contrata?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {(Object.entries(PLAN_META) as [keyof typeof PLAN_META, typeof PLAN_META[keyof typeof PLAN_META]][]).map(([k, m]) => (
                <button key={k} onClick={() => setPlan(k)} style={{ padding: '12px 8px', borderRadius: 10, background: plan === k ? 'rgba(59,130,246,0.2)' : 'var(--bg-elev)', border: plan === k ? '1px solid rgba(59,130,246,0.55)' : '1px solid var(--line)', color: plan === k ? 'var(--ink)' : 'var(--ink-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'Space Grotesk', fontSize: 14 }}>{m.label}</span>
                  <span className="l-mono" style={{ fontSize: 10, color: 'var(--accent-halo)' }}>{m.cashback}% cashback</span>
                </button>
              ))}
            </div>
          </div>
          <Slider label="2. Quantos alunos ativos você tem?" value={students} min={20} max={2000} step={10} onChange={setStudents} fmt={(v) => `${v} alunos`} />
          <Slider label="3. Quanto você repassa ao aluno?" value={repassRate} min={Math.ceil(meta.perStudentMonth)} max={197} step={1} onChange={setRepassRate} fmt={(v) => `R$ ${v}/mês`} />
          <Slider label="4. % dos alunos que sobem na esteira" value={upsellRate} min={5} max={60} step={1} onChange={setUpsellRate} fmt={(v) => `${v}%`} />
          <Slider label="5. Ticket mensal da esteira (por aluno)" value={cashbackMonthly} min={30} max={500} step={5} onChange={setCashbackMonthly} fmt={(v) => `R$ ${v}`} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '24px 24px', background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.06))', border: '1.5px solid rgba(59,130,246,0.55)', borderRadius: 16, boxShadow: '0 0 28px rgba(59,130,246,0.22)' }}>
            <div className="l-mono" style={{ fontSize: 10, color: 'var(--accent-halo)', letterSpacing: '0.14em', marginBottom: 6 }}>SEU LUCRO LÍQUIDO · {meta.months} MESES</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 44, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>{fmt(netGain)}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.18)', color: 'var(--success)', fontSize: 12, fontWeight: 700 }}>+{roiPct}% ROI</span>
              <span>margem do repasse + cashback</span>
            </div>
          </div>
          {[
            { label: 'Margem do repasse', value: fmt(repassMargin) },
            { label: 'Cashback da esteira', value: fmt(cashbackTotal) },
            { label: 'Investimento na Launcher', value: fmt(launcherCost) },
          ].map((m) => (
            <div key={m.label} style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.04))', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div className="l-mono" style={{ fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, color: 'var(--accent-halo)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="preços" style={launcherStyles.section}>
      <div style={launcherStyles.container}>
        <SectionHeader eyebrow="Preços" title="Um preço justo por aluno. Quanto mais tempo, mais você ganha." sub="Todos os planos incluem o mesmo conjunto de recursos. A diferença está na duração e no cashback da esteira de produtos." center />
        <div className="reveal" style={{ marginBottom: 48, padding: '28px 32px', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.14em', marginBottom: 8 }}>INCLUSO EM TODOS OS PLANOS</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Tudo que seu aluno precisa para estudar com estrutura.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(200px, 1fr))', gap: '8px 24px', flex: '1 1 420px' }}>
              {FEATURES_INCLUDED.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(59,130,246,0.18)', color: 'var(--accent-halo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, alignItems: 'stretch' }}>
          {PLANS.map((p, i) => <PlanCard key={p.id} p={p} i={i} />)}
        </div>
        <ROICalc />
      </div>
    </section>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { Btn, WaIcon, Avatar, GlowBG, GridLines, Eyebrow } from './primitives';

/* ─── MiniDashboard ──────────────────────────────────────────────── */
function MiniDashboard({ tick }: { tick: number }) {
  const roiValues = [1.0, 1.6, 2.4, 3.3, 4.2, 5.0];
  const approvals = [18, 24, 29, 33, 37, 42];
  const months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
  const maxRoi = 5.2;
  const W = 100, H = 100;
  const pts = roiValues.map((v, i) => [
    (i / (roiValues.length - 1)) * W,
    H - (v / maxRoi) * H,
  ]);
  const linePath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--line-strong)', borderRadius: 20, padding: 24, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="l-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>RESULTADOS · 6 MESES</div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 600, marginTop: 4 }}>ROI + alunos aprovados</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
          ao vivo
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 22 }}>
        {[
          { l: 'ROI', v: '5x', d: 'em 6 meses', accent: false },
          { l: 'Aprovados', v: '+40%', d: 'vs. ano anterior', accent: true },
          { l: 'Receita', v: '+312%', d: 'crescimento', accent: true },
        ].map((x, i) => (
          <div key={i} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{x.l}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 600, marginTop: 4, color: x.accent ? 'var(--accent-halo)' : 'var(--ink)' }}>{x.v}</div>
            <div style={{ fontSize: 12, color: 'var(--success)' }}>{x.d}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: 140, padding: '0 4px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {approvals.map((a, i) => {
            const x = (i / (approvals.length - 1)) * W;
            const bw = 6, bh = (a / 50) * H;
            const active = i === tick % approvals.length;
            return <rect key={i} x={x - bw / 2} y={H - bh} width={bw} height={bh} fill={active ? 'var(--accent-halo)' : 'rgba(255,255,255,0.12)'} rx="1" style={{ transition: 'fill .5s' }} />;
          })}
          <path d={areaPath} fill="url(#roiFill)" />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {pts.map((p, i) => {
            const active = i === pts.length - 1;
            return (
              <g key={i}>
                {active && <circle cx={p[0]} cy={p[1]} r="4" fill="var(--accent)" opacity="0.25" />}
                <circle cx={p[0]} cy={p[1]} r={active ? 2.2 : 1.4} fill={active ? '#fff' : 'var(--accent-halo)'} stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', right: 0, top: -2, padding: '4px 8px', background: 'var(--accent)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, borderRadius: 6, boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>5x ROI</div>
        <div style={{ position: 'absolute', left: 0, top: -4, display: 'flex', gap: 12, fontSize: 10, color: 'var(--ink-dim)', fontFamily: 'JetBrains Mono' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 2, background: 'var(--accent)' }} />ROI</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 10, background: 'var(--accent-halo)' }} />Aprovados</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono' }}>
        {months.map((d) => <span key={d}>{d}</span>)}
      </div>
    </div>
  );
}

/* ─── Variant 1: Editorial ───────────────────────────────────────── */
function HeroVariant1() {
  return (
    <div style={{ position: 'relative', maxWidth: 1360, margin: '0 auto', width: '100%' }}>
      <GlowBG color="var(--accent)" size={800} opacity={0.18} top={-100} left={-200} />
      <GlowBG color="var(--accent-halo)" size={500} opacity={0.1} bottom={-100} right={-100} />
      <div className="reveal" style={{ marginBottom: 32 }}>
        <Eyebrow>Feito para concursos públicos</Eyebrow>
      </div>
      <h1 className="l-display reveal" data-delay="1" style={{ fontSize: 'clamp(40px, 8.5vw, 128px)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 600, margin: 0, maxWidth: 1200 }}>
        O sistema que faz seu aluno{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--accent-halo)' }}>estudar mais</em> e você{' '}
        <u style={{ textDecorationColor: 'var(--accent)', textDecorationThickness: 4, textUnderlineOffset: 12 }}>vender mais.</u>
      </h1>
      <p className="reveal" data-delay="2" style={{ fontSize: 'clamp(16px,1.5vw,22px)', lineHeight: 1.5, maxWidth: 680, marginTop: 32, color: 'var(--ink-dim)' }}>
        Você não precisa de mais uma área de membros. Você precisa de uma infraestrutura que aumenta retenção, valor percebido e receita, com dados de verdade.
      </p>
      <div className="reveal" data-delay="3" style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
        <Btn variant="primary" big>Quero essa infraestrutura</Btn>
        <Btn variant="ghost" big icon={false}><WaIcon /> WhatsApp</Btn>
      </div>
      <div className="reveal" data-delay="4" style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 48, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          {[{ i: 'JF', c: '#3B82F6' }, { i: 'CA', c: '#A855F7' }, { i: 'RM', c: '#22C55E' }, { i: 'PS', c: '#F59E0B' }].map((a, i) => (
            <div key={i} style={{ marginLeft: i ? -12 : 0 }}>
              <Avatar initials={a.i} color={a.c} size={40} />
            </div>
          ))}
          <div style={{ marginLeft: -12, width: 40, height: 40, borderRadius: 999, background: 'var(--bg-card)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-dim)' }}>+12</div>
        </div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>+15 infoprodutores já usam a Launcher</div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>Retenção média +40% · Setup &lt; 24h</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Variant 2: Dashboard split ─────────────────────────────────── */
function HeroVariant2() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="l-hero-split" style={{ maxWidth: 1360, margin: '0 auto', width: '100%' }}>
      <GlowBG color="var(--accent)" size={700} opacity={0.16} top={-150} right={0} />
      <div>
        <div className="reveal" style={{ marginBottom: 26 }}>
          <Eyebrow>Leve seu negócio para o próximo nível</Eyebrow>
        </div>
        <h1 className="l-display reveal" data-delay="1" style={{ fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 600, margin: 0 }}>
          O sistema feito para você vender mais e aprovar mais alunos.
        </h1>
        <p className="reveal" data-delay="2" style={{ fontSize: 'clamp(15px, 1.2vw, 18px)', lineHeight: 1.55, color: 'var(--ink-dim)', marginTop: 24, maxWidth: 520 }}>
          Você não precisa de mais uma área de membros. Você precisa de um mecanismo que faça seu aluno estudar mais, permanecer mais e te dar clareza sobre o que está funcionando.
        </p>
        <div className="reveal" data-delay="3" style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <Btn variant="primary" big>Quero essa infraestrutura</Btn>
          <Btn variant="ghost" big icon={false}><WaIcon /> WhatsApp</Btn>
        </div>
      </div>
      <div className="reveal" data-delay="2"><MiniDashboard tick={tick} /></div>
    </div>
  );
}

/* ─── Variant 3: Terminal ─────────────────────────────────────────── */
function HeroVariant3() {
  const lines = [
    { t: '$ launcher --check', c: 'var(--ink-mute)' },
    { t: '✓ retenção   +40%', c: 'var(--success)' },
    { t: '✓ churn       -5%', c: 'var(--success)' },
    { t: '✓ receita    +28%', c: 'var(--success)' },
    { t: '> infraestrutura: online', c: 'var(--accent-halo)' },
  ];
  return (
    <div className="l-hero-terminal" style={{ maxWidth: 1360, margin: '0 auto', width: '100%' }}>
      <GlowBG color="var(--accent)" size={700} opacity={0.14} bottom={-100} left={-100} />
      <div>
        <div className="reveal" style={{ marginBottom: 26 }}><Eyebrow>Concursos · v4.0</Eyebrow></div>
        <h1 className="l-display reveal" data-delay="1" style={{ fontSize: 'clamp(32px,6vw,90px)', lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 600, margin: 0 }}>
          O sistema que faz seu aluno <span style={{ color: 'var(--accent-halo)' }}>estudar mais</span> e você vender mais.
        </h1>
        <p className="reveal" data-delay="2" style={{ marginTop: 24, color: 'var(--ink-dim)', fontSize: 18, lineHeight: 1.55, maxWidth: 460 }}>
          A infraestrutura que transforma seus alunos em aprovados e seu negócio em máquina de receita recorrente.
        </p>
        <div className="reveal" data-delay="3" style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <Btn variant="primary" big>Quero essa infraestrutura</Btn>
          <Btn variant="ghost" big icon={false}><WaIcon /> WhatsApp</Btn>
        </div>
      </div>
      <div className="reveal" data-delay="2" style={{ background: '#05070B', border: '1px solid var(--line-strong)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', fontFamily: 'JetBrains Mono' }}>
        <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: '1px solid var(--line)', background: '#080A10' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />)}
          <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--ink-mute)' }}>~/launcher/status</span>
        </div>
        <div style={{ padding: '28px 24px', fontSize: 14, lineHeight: 1.9, color: '#E6E9F0' }}>
          {lines.map((l, i) => <div key={i} style={{ color: l.c }}>{l.t}</div>)}
          <div style={{ color: 'var(--ink)', marginTop: 14 }}>
            $ _<span style={{ display: 'inline-block', width: 8, height: 16, background: 'var(--accent)', marginLeft: 2, verticalAlign: 'middle', animation: 'l-blink 1s steps(1) infinite' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
export function Hero({ heroVariant }: { heroVariant: string }) {
  return (
    <section className="l-hero" style={{
      position: 'relative', minHeight: '100vh',
      paddingTop: 180, paddingBottom: 100, paddingInline: '7vw',
      overflow: 'hidden', display: 'flex', alignItems: 'center',
    }}>
      <GridLines />
      {heroVariant === '1' && <HeroVariant1 />}
      {heroVariant === '2' && <HeroVariant2 />}
      {heroVariant === '3' && <HeroVariant3 />}
    </section>
  );
}

'use client';
import { ReactNode } from 'react';
import { launcherStyles, SectionHeader } from './primitives';

const FEATURES = [
  { idx: '01', icon: 'calendar', title: 'Cronograma Estruturado', what: 'Cada aluno segue o cronograma montado por você, organizado em blocos de estudo, revisão e prática. Tudo acontece dentro da plataforma, no ritmo que você definiu.', impact: 'O caminho claro que seu aluno precisa para não se perder.', stat: '100%', statLabel: 'do seu método' },
  { idx: '02', icon: 'brain', title: 'Banco de Questões Completo', what: 'Milhares de questões organizadas por banca e concurso. Correção detalhada de todas as alternativas, dicas que direcionam o raciocínio e revisão espaçada automática.', impact: 'Cada erro vira uma lição. Cada acerto vira confiança.', stat: '+50k', statLabel: 'questões' },
  { idx: '03', icon: 'target', title: 'Simulados Realistas', what: 'Simulados cronometrados que replicam o dia da prova. Gere simulados personalizados em segundos seguindo seu objetivo.', impact: 'Quem já fez 50 simulados não treme na hora da prova.', stat: '100%', statLabel: 'personalizável' },
  { idx: '04', icon: 'chart', title: 'Dashboard de Performance', what: 'Leitura completa do desempenho sintetizada em dados claros. Taxa de acerto por disciplina, tempo de estudo, evolução semanal. Tudo em um só lugar.', impact: 'Os dados que você queria ter, mas nunca teve.', stat: 'Direção', statLabel: 'métricas-chave' },
  { idx: '05', icon: 'trophy', title: 'Motor de Retenção', what: 'Patentes, badges, ranking, pontos. O que faz seu aluno abrir a plataforma na segunda de manhã mesmo quando a rotina aperta.', impact: 'Gamificação não é brincadeira. É o que faz seu aluno voltar amanhã.', stat: 'Uso diário', statLabel: '+retenção média' },
  { idx: '06', icon: 'card', title: 'Cápsula de Estudos', what: 'Todo mês cada aluno recebe um card visual compartilhável nas Redes Sociais com seu desempenho, ranking e resultados. Com sua marca e seu estilo.', impact: 'Seu aluno compartilha. Sua marca se espalha. Custo zero pra você.', stat: 'R$ 0', statLabel: 'de CAC' },
];

const UPSELLS = [
  { title: 'Mentor Inteligente', desc: 'Seu aluno sempre sabe qual é o próximo passo, com direcionamento automático baseado no seu avanço, além de insights sobre pontos fortes e fracos.', tag: 'Acompanhamento individual', icon: 'bot', pairStart: true },
  { title: 'Cronograma Personalizado pelo Mentor', desc: 'Adapta a rotina dos seus alunos e se reorganiza automaticamente com base na performance, garantindo um estudo mais direcionado e contínuo.', tag: 'Plano personalizado', icon: 'calendar-ai', pairEnd: true },
  { title: 'Esteira de evolução contínua', desc: 'Uma esteira de produtos que impulsiona a performance do aluno ao longo da jornada, com recursos como revisão turbo e novas camadas de aceleração.', tag: 'Novos produtos na esteira', icon: 'stack' },
];

function FeatureIcon({ kind, size = 28 }: { kind: string; size?: number }) {
  const s = { width: size, height: size };
  const stroke = 'var(--accent-halo)';
  const c = { fill: 'none' as const, stroke, strokeWidth: 1.5 as number, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const icons: Record<string, ReactNode> = {
    calendar: <svg {...s} viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="8" cy="15" r="1" fill={stroke} /><circle cx="13" cy="15" r="1" fill={stroke} /></svg>,
    brain: <svg {...s} viewBox="0 0 24 24" {...c}><path d="M12 4a3 3 0 00-3 3v1a3 3 0 00-3 3v2a3 3 0 003 3v1a3 3 0 003 3M12 4a3 3 0 013 3v1a3 3 0 013 3v2a3 3 0 01-3 3v1a3 3 0 01-3 3M12 4v16" /></svg>,
    target: <svg {...s} viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill={stroke} /></svg>,
    chart: <svg {...s} viewBox="0 0 24 24" {...c}><path d="M3 20h18M6 16v-4M10 16V9M14 16v-7M18 16V6" /></svg>,
    trophy: <svg {...s} viewBox="0 0 24 24" {...c}><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 01-12 0V4zM6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3" /></svg>,
    bot: <svg {...s} viewBox="0 0 24 24" {...c}><rect x="4" y="7" width="16" height="13" rx="3" /><circle cx="9" cy="13" r="1" fill={stroke} /><circle cx="15" cy="13" r="1" fill={stroke} /><path d="M12 7V3M9 3h6" /></svg>,
    card: <svg {...s} viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h5M7 14h8" /></svg>,
    'calendar-ai': <svg {...s} viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M10 15l2 -3l2 3" /><path d="M12 18v-1" /></svg>,
    stack: <svg {...s} viewBox="0 0 24 24" {...c}><path d="M12 4l9 5l-9 5l-9 -5z" /><path d="M3 14l9 5l9 -5" /><path d="M3 19l9 5l9 -5" opacity="0.5" /></svg>,
  };
  return <>{icons[kind] || null}</>;
}

function FeatureCard({ f, i }: { f: typeof FEATURES[0]; i: number }) {
  return (
    <div className="reveal" data-delay={`${i % 3}`} style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 360, transition: 'all .3s', cursor: 'default', overflow: 'hidden' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'none'; }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(59,130,246,0.14), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FeatureIcon kind={f.icon} />
        </div>
        <div className="l-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.12em' }}>{f.idx}</div>
      </div>
      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 600, margin: 0 }}>{f.title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ink-dim)', flex: 1 }}>{f.what}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', maxWidth: '60%', lineHeight: 1.4 }}>"{f.impact}"</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 600, color: 'var(--accent-halo)' }}>{f.stat}</div>
          <div className="l-mono" style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.statLabel}</div>
        </div>
      </div>
    </div>
  );
}

function UpsellCard({ u }: { u: typeof UPSELLS[0] }) {
  return (
    <div className="reveal" style={{ position: 'relative', background: (u.pairStart || u.pairEnd) ? 'linear-gradient(180deg, rgba(59,130,246,0.14), rgba(59,130,246,0.04))' : 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))', border: (u.pairStart || u.pairEnd) ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(59,130,246,0.25)', borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'visible' }}>
      {u.pairStart && (
        <div style={{ position: 'absolute', right: -22, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 999, background: 'radial-gradient(circle, #3B82F6, #1D4ED8)', border: '3px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, boxShadow: '0 0 24px rgba(59,130,246,0.7)', color: '#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </div>
      )}
      {(u.pairStart || u.pairEnd) && (
        <div className="l-mono" style={{ position: 'absolute', top: -11, left: 20, fontSize: 9, letterSpacing: '0.12em', padding: '3px 8px', borderRadius: 4, background: 'linear-gradient(90deg, #3B82F6, #1D4ED8)', color: '#fff', fontWeight: 700, boxShadow: '0 0 12px rgba(59,130,246,0.5)' }}>
          {u.pairStart ? 'EXECUÇÃO • 1/2' : 'DIRECIONAMENTO • 2/2'}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FeatureIcon kind={u.icon} size={20} />
        </div>
        <div className="l-mono" style={{ fontSize: 10, color: 'var(--accent-halo)', letterSpacing: '0.12em', padding: '3px 8px', background: 'rgba(59,130,246,0.12)', borderRadius: 4, border: '1px solid rgba(59,130,246,0.3)' }}>DESBLOQUEÁVEL</div>
      </div>
      <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>{u.title}</h4>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-dim)', flex: 1 }}>{u.desc}</p>
      <div style={{ fontSize: 11, color: 'var(--ink-mute)', paddingTop: 10, borderTop: '1px solid rgba(59,130,246,0.15)', fontFamily: 'JetBrains Mono' }}>{u.tag}</div>
    </div>
  );
}

export function Features() {
  return (
    <section id="funcionalidades" style={launcherStyles.section}>
      <div style={launcherStyles.container}>
        <SectionHeader
          eyebrow="O que seu aluno tem acesso"
          title="Uma base sólida para o aluno organizar, executar e evoluir."
          sub="Tudo que o seu aluno precisa para seguir o seu método com estrutura. E conforme ele avança, desbloqueia camadas mais avançadas de orientação, e você participa da receita."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => <FeatureCard key={f.idx} f={f} i={i} />)}
        </div>
        <div className="reveal" style={{ marginTop: 80, padding: '48px 44px', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, background: 'radial-gradient(circle, rgba(59,130,246,0.10), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center', marginBottom: 36, position: 'relative' }}>
            <div>
              <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.14em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-halo)', boxShadow: '0 0 10px var(--accent-halo)' }} />
                ESTEIRA DE PRODUTOS · CASHBACK
              </div>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0 }}>Seu aluno evolui. Você ganha junto.</h3>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-dim)', margin: 0 }}>
              Conforme o aluno avança, a Launcher oferece camadas mais avançadas de preparação. Cada upgrade que ele faz gera <strong style={{ color: 'var(--ink)' }}>cashback para você</strong>, sem esforço de venda e sem quebra de jornada.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, position: 'relative' }}>
            {UPSELLS.map((u) => <UpsellCard key={u.title} u={u} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

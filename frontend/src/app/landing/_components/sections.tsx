'use client';
import { useState } from 'react';
import { launcherStyles, SectionHeader, Btn, WaIcon, Avatar, GlowBG, GridLines, LogoWordmark } from './primitives';

/* ════════════════════════════════════════════════════════════════════
   VSL
   ════════════════════════════════════════════════════════════════════ */
export function VSL() {
  const [playing, setPlaying] = useState(false);
  return (
    <section style={{ ...launcherStyles.section, paddingBlock: '120px' }}>
      <div style={launcherStyles.container}>
        <div style={{ textAlign: 'center', maxWidth: 1200, margin: '0 auto 60px' }}>
          <div className="reveal">
            <div style={launcherStyles.eyebrow} className="l-mono">
              <span style={launcherStyles.eyebrowDot} />Somos o que você precisa hoje
            </div>
          </div>
          <h2 className="l-display reveal" data-delay="1" style={{ fontFamily: 'Space Grotesk', fontSize: 42, lineHeight: 1.15, letterSpacing: '-0.025em', fontWeight: 600, margin: '20px auto 0', maxWidth: 1100 }}>
            "Muito mais que uma plataforma. Somos a infraestrutura de aumento de receita e desempenho do infoprodutor."
          </h2>
          <p className="reveal" data-delay="2" style={{ fontSize: 'clamp(16px, 1.35vw, 20px)', lineHeight: 1.55, color: 'var(--ink-dim)', margin: '20px auto 0' }}>
            Aumente retenção, valor percebido e receita com uma operação orientada por dados.
          </p>
        </div>

        <div className="reveal" data-delay="2" style={{ position: 'relative', aspectRatio: '16/9', maxWidth: 1100, margin: '0 auto', borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(135deg, #0B0D12 0%, #1A1F2E 100%)', border: '1px solid var(--line-strong)', cursor: 'pointer', boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.15)' }} onClick={() => setPlaying(!playing)}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.25), transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: 40, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 3, opacity: 0.4 }}>
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: `${20 + Math.sin(i * 0.8) * 18 + Math.cos(i * 0.3) * 10}px`, background: 'var(--accent-halo)', borderRadius: 2 }} />
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 120, height: 120, borderRadius: 999, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(59,130,246,0.2), 0 0 80px rgba(59,130,246,0.5)', transition: 'all .3s', transform: playing ? 'scale(0.9)' : 'scale(1)' }}>
              {playing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 8, height: 32, background: '#fff', borderRadius: 2 }} />
                  <div style={{ width: 8, height: 32, background: '#fff', borderRadius: 2 }} />
                </div>
              ) : (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 6 }}><path d="M8 5v14l11-7z" /></svg>
              )}
            </div>
          </div>
          <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--danger)', boxShadow: '0 0 10px var(--danger)', animation: 'l-pulse 2s infinite' }} />
            <span className="l-mono" style={{ fontSize: 12, color: 'var(--ink-dim)', letterSpacing: '0.1em' }}>VSL · 2:47</span>
          </div>
          <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-mute)' }}>
            <span style={{ padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6 }}>HD</span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6 }}>CC</span>
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: 40, right: 40, display: 'flex', gap: 4 }}>
            {[18, 22, 28, 20, 12].map((w, i) => (
              <div key={i} style={{ flex: w, height: 3, background: i === 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
            ))}
          </div>
        </div>

        <div className="reveal" data-delay="3" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, maxWidth: 1100, margin: '20px auto 0', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-mute)' }}>
          {['01 · Gancho', '02 · Problema', '03 · Solução', '04 · Prova', '05 · Oferta'].map((x) => (
            <div key={x} style={{ textAlign: 'center' }}>{x}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   COMPARISON
   ════════════════════════════════════════════════════════════════════ */
export function Comparison() {
  return (
    <section style={{ ...launcherStyles.section, position: 'relative', overflow: 'hidden' }}>
      <div style={launcherStyles.container}>
        <SectionHeader
          eyebrow="Seu sucesso está aqui"
          title="Na maioria das plataformas seu aluno estuda. Na Launcher, ele é aprovado e você vende mais."
          sub="A diferença entre hospedar conteúdo e construir uma operação de verdade."
          center
        />
        <div className="reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 40 }}>
          {/* OTHERS */}
          <div style={{ background: 'color-mix(in srgb, #EF4444 8%, var(--bg-card))', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: 36, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(239,68,68,0.25), transparent 70%)', filter: 'blur(30px)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <span className="l-mono" style={{ fontSize: 11, padding: '5px 10px', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#FCA5A5', letterSpacing: '0.1em' }}>OUTRAS PLATAFORMAS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { p: 'Área de membros comum', c: 'Aluno esquece que comprou' },
                { p: 'Plataforma genérica', c: 'Zero diferenciação da concorrência' },
                { p: 'Sem gamificação', c: 'Desistência em 30 dias' },
                { p: 'Analytics básico', c: 'Você não sabe o que funciona' },
                { p: 'Só hospeda vídeo', c: 'Não direciona o estudo' },
                { p: 'Sem mentor', c: 'Aluno fica perdido e desiste' },
              ].map((x, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
                  <span style={{ color: '#EF4444', fontSize: 18, lineHeight: 1 }}>✕</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{x.p}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 2 }}>{x.c}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* LAUNCHER */}
          <div style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-card))', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 20, padding: 36, position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(59,130,246,0.2)' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)', filter: 'blur(30px)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <img src="/assets/favicon-launcher.png" alt="Launcher" style={{ width: 16, height: 16 }} />
              <span className="l-mono" style={{ fontSize: 11, padding: '5px 10px', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 6, color: 'var(--accent-halo)', letterSpacing: '0.1em' }}>COM A LAUNCHER</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['Aumentar ticket médio', 'Melhorar taxa de conversão', 'Order bump e upsell com eficiência', 'Decisões baseadas em dados reais', 'Profissionalizar sua operação', 'Reduzir churn e aumentar LTV'].map((x, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(59,130,246,0.15)' : 'none' }}>
                  <span style={{ color: 'var(--accent-halo)', fontSize: 18, lineHeight: 1 }}>✓</span>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{x}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="reveal" style={{ textAlign: 'center', marginTop: 64, maxWidth: 900, marginInline: 'auto' }}>
          <div className="l-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.12em', marginBottom: 16 }}>E O MAIS IMPORTANTE</div>
          <p className="l-display" style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px,3vw,44px)', fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.02em', margin: 0 }}>
            Fazer seu aluno <span style={{ color: 'var(--accent-halo)' }}>performar melhor</span>. E isso sustenta todo o resto.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TESTIMONIALS
   ════════════════════════════════════════════════════════════════════ */
const TESTIMONIALS = [
  { quote: 'Antes eu perdia aluno porque ele esquecia de estudar. Agora ele abre a plataforma todo dia porque quer subir de patente. A retenção da minha turma subiu 40%.', name: 'João Figueiredo', role: 'Carreiras Policiais · PM/PC/PRF', initials: 'JF', color: '#3B82F6', stat: '+40%', statLabel: 'retenção' },
  { quote: 'A Cápsula de Estudos foi genial. Todo mês meus alunos postam no Instagram e me marcam. É marketing zero custo e parece que foi minha equipe que criou.', name: 'Carla Azevedo', role: 'Fiscal de Rendas · SEFAZ/AFRFB', initials: 'CA', color: '#A855F7' },
  { quote: 'Finalmente consigo ver quem está estudando de verdade e quem está só pagando. Os dados mudaram como eu estruturo minhas turmas.', name: 'Rafael Mendes', role: 'Tribunal Regional · TRT/TRF/TJ', initials: 'RM', color: '#22C55E' },
  { quote: 'O Mentor Inteligente faz o trabalho que minha equipe não conseguia fazer: acompanhar cada aluno individualmente. Mudou completamente minha operação.', name: 'Paula Santos', role: 'Carreiras Federais · INSS/Correios', initials: 'PS', color: '#F59E0B' },
];

export function Testimonials() {
  const featured = TESTIMONIALS[0];
  const rest = TESTIMONIALS.slice(1);
  return (
    <section style={launcherStyles.section}>
      <div style={launcherStyles.container}>
        <SectionHeader eyebrow="Depoimentos" title="Quem usa, recomenda." />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          <div className="reveal" style={{ position: 'relative', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--bg-card)), var(--bg-card))', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 24, padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', minHeight: 480 }}>
            <GlowBG color="var(--accent)" size={400} opacity={0.2} top={-100} right={-100} />
            <div>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="var(--accent-halo)" style={{ opacity: 0.3, marginBottom: 16 }}><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" /></svg>
              <p style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(24px,2.4vw,34px)', lineHeight: 1.25, letterSpacing: '-0.015em', fontWeight: 500, margin: 0 }}>"{featured.quote}"</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40, paddingTop: 28, borderTop: '1px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar initials={featured.initials} color={featured.color} size={52} />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{featured.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 2 }}>{featured.role}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 44, fontWeight: 600, color: 'var(--accent-halo)', lineHeight: 1 }}>{featured.stat}</div>
                <div className="l-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{featured.statLabel}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {rest.map((t, i) => (
              <div key={i} className="reveal" data-delay={`${i + 1}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ink)' }}>"{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <Avatar initials={t.initials} color={t.color} size={38} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   INTEGRATIONS
   ════════════════════════════════════════════════════════════════════ */
const INTEGRATIONS = [
  { name: 'Hotmart', type: 'Checkout/Membros', logo: '/assets/logos/hotmart.png', bg: '#FFF5F0' },
  { name: 'Kiwify', type: 'Checkout/Membros', logo: '/assets/logos/kiwify.png', bg: '#F0FBF4' },
  { name: 'Eduzz', type: 'Checkout/Membros', logo: '/assets/logos/eduzz.png', bg: '#FFFBEB' },
  { name: 'Pagar.me', type: 'Gateway', logo: '/assets/logos/pagarme.png', bg: '#65A300' },
  { name: 'TMB', type: 'Checkout', logo: '/assets/logos/tmb.png', bg: '#0A0A0A' },
  { name: 'Curseduca', type: 'Plataforma de Membros', logo: '/assets/logos/curseduca.png', bg: '#1E5FC3' },
];

export function Integrations() {
  return (
    <section style={launcherStyles.section}>
      <div style={launcherStyles.container}>
        <SectionHeader eyebrow="Integrações" title="Desbloqueie o potencial máximo do seu negócio." sub="Integramos com os maiores provedores do mercado digital. Fácil e rápido." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {INTEGRATIONS.map((x, i) => (
            <div key={x.name} className="reveal" data-delay={`${i % 4}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 16, padding: 22, display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color .2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}>
              <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: x.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src={x.logo} alt={x.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{x.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{x.type}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            ['01', 'Aluno comprou → já está na plataforma automaticamente'],
            ['02', 'Cancelou → acesso removido na hora'],
            ['03', 'Tudo sincronizado sem você mover um dedo'],
            ['04', 'Webhooks em tempo real'],
          ].map(([idx, t]) => (
            <div key={idx} style={{ padding: '18px 20px', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 12 }}>
              <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.12em' }}>{idx}</div>
              <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   FAQ
   ════════════════════════════════════════════════════════════════════ */
const FAQ_ITEMS: [string, string][] = [
  ['Como funciona o cashback da esteira de valor?', 'Dependendo do plano que você contrata, recebe de volta um percentual sobre o faturamento da esteira de valor, ou seja, sobre as vendas extras (mentor inteligente, comunidades, produtos complementares) feitas aos seus alunos ativos dentro da Launcher. Quanto maior o seu compromisso com a plataforma (semestral, anual ou 2 anos), maior o cashback.'],
  ['Posso repassar o custo da Launcher para o meu aluno?', 'Sim, e muitos infoprodutores fazem isso. Você paga um valor por aluno ativo e decide quanto quer repassar no seu ticket. Tudo acima do custo vira margem direta no seu bolso, sem esforço extra de venda.'],
  ['Os alunos vão perceber que é a Launcher por trás?', 'Não. A plataforma é 100% white-label. Seu domínio, sua logo, sua identidade visual. Seus alunos só veem a sua marca, a Launcher é infraestrutura invisível.'],
  ['Preciso ter equipe técnica para operar?', 'Não. A Launcher foi feita para infoprodutores que focam em ensinar e vender, não em código. Você configura tudo pelo painel. Se precisar, nosso time te ajuda na implantação e no dia a dia.'],
  ['Em quanto tempo consigo migrar meus alunos atuais?', 'Normalmente em menos de 24 horas. Fazemos a importação da sua base e você já opera. Seu aluno não percebe a troca, só percebe que a experiência ficou melhor.'],
  ['Com quais checkouts e plataformas a Launcher integra?', 'Integramos nativamente com Hotmart, Kiwify, Eduzz, Pagar.me, TMB e Curseduca. Aluno compra → entra automático. Cancelou → sai automático. Tudo por webhook em tempo real, sem planilha no meio.'],
  ['A Launcher serve para qualquer nicho de infoproduto?', 'A Launcher é especialista em Provas, Concursos, Vestibulares e outros preparatórios de provas. Se o seu aluno tem uma jornada de estudo longa, com banca, edital e ciclos de revisão, a plataforma foi feita para você.'],
  ['Tem fidelidade? E se eu quiser sair?', 'Os planos com cashback têm o compromisso do período contratado. Fora disso, zero burocracia: sem multa oculta, sem taxa de saída. Seus dados e sua base são sempre seus.'],
  ['Como funciona o suporte?', 'Suporte humano, direto, no WhatsApp. Sem ticket, sem robô, sem SLA de 48 horas. Nos planos maiores você tem gerente de conta dedicado acompanhando o crescimento da sua operação.'],
  ['Vale a pena mesmo? Como sei qual plano escolher?', 'Use a calculadora de ROI logo acima da seção de preços. Em 30 segundos você simula com seus próprios números e vê exatamente quanto volta de cashback e em quantos meses o investimento se paga.'],
];

function FAQItem({ q, a, open, onClick, idx }: { q: string; a: string; open: boolean; onClick: () => void; idx: number }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${open ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}>
      <button onClick={onClick} style={{ width: '100%', padding: '22px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span className="l-mono" style={{ fontSize: 12, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>{String(idx).padStart(2, '0')}</span>
          <span style={{ fontSize: 17, fontWeight: 500 }}>{q}</span>
        </div>
        <span style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .3s', color: open ? 'var(--accent-halo)' : 'var(--ink-dim)', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
      </button>
      <div style={{ maxHeight: open ? 600 : 0, opacity: open ? 1 : 0, transition: 'all .4s cubic-bezier(.2,.7,.2,1)', overflow: 'hidden' }}>
        <div style={{ padding: '0 26px 24px 64px', fontSize: 15, lineHeight: 1.65, color: 'var(--ink-dim)', maxWidth: 820 }}>{a}</div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={launcherStyles.section}>
      <div style={{ ...launcherStyles.container, maxWidth: 1000 }}>
        <SectionHeader eyebrow="Perguntas Frequentes" title="Dúvidas? A gente responde." center />
        <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ_ITEMS.map(([q, a], i) => (
            <FAQItem key={i} q={q} a={a} open={open === i} onClick={() => setOpen(open === i ? -1 : i)} idx={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CTA FINAL + FOOTER
   ════════════════════════════════════════════════════════════════════ */
export function CTAFinal() {
  return (
    <section style={{ ...launcherStyles.section, position: 'relative', overflow: 'hidden', paddingBlock: '160px' }}>
      <GlowBG color="var(--accent)" size={900} opacity={0.2} top={-200} left="50%" />
      <GridLines />
      <div style={{ ...launcherStyles.container, textAlign: 'center', position: 'relative' }}>
        <div className="reveal" style={{ marginBottom: 24 }}>
          <div style={launcherStyles.eyebrow} className="l-mono"><span style={launcherStyles.eyebrowDot} />Pronto pra começar</div>
        </div>
        <h2 className="l-display reveal" data-delay="1" style={{ fontFamily: 'Space Grotesk', lineHeight: 1.05, letterSpacing: '-0.035em', fontWeight: 600, margin: 0, maxWidth: 1000, marginInline: 'auto', fontSize: 'clamp(36px, 5vw, 72px)' }}>
          Pronto para transformar<br /><span style={{ color: 'var(--accent-halo)' }}>seu negócio?</span>
        </h2>
        <p className="reveal" data-delay="2" style={{ fontSize: 'clamp(16px,1.4vw,20px)', lineHeight: 1.55, color: 'var(--ink-dim)', maxWidth: 640, marginInline: 'auto', marginTop: 24 }}>
          Pare de perder alunos para plataformas genéricas. Comece a vender mais com uma infraestrutura que realmente funciona.
        </p>
        <div className="reveal" data-delay="3" style={{ display: 'flex', gap: 14, marginTop: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" big>Quero essa infraestrutura</Btn>
          <Btn variant="ghost" big icon={false}><WaIcon /> Falar no WhatsApp</Btn>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ padding: '80px 7vw 40px', borderTop: '1px solid var(--line)', background: 'var(--bg-elev)' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 60 }}>
        <div>
          <LogoWordmark height={34} />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.5, maxWidth: 320 }}>
            A infraestrutura de aumento de receita para infoprodutores de concursos públicos.
          </p>
        </div>
        {([['Produto', ['Funcionalidades', 'Personalização', 'Integrações', 'Preços']], ['Empresa', ['Sobre', 'Blog', 'Cases', 'Contato']], ['Legal', ['Termos', 'Privacidade', 'Cookies', 'LGPD']]] as [string, string[]][]).map(([title, items]) => (
          <div key={title}>
            <div className="l-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.12em', marginBottom: 14 }}>{title.toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((x) => <a key={x} href="#" style={{ fontSize: 14, color: 'var(--ink-dim)' }}>{x}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ paddingTop: 24, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono' }}>
        <span>© 2026 Launcher · Todos os direitos reservados</span>
        <span>v4.0 · Infraestrutura operacional</span>
      </div>
    </footer>
  );
}

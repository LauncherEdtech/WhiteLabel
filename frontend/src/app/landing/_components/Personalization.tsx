'use client';
import { useState, ReactNode } from 'react';
import { launcherStyles, SectionHeader, GlowBG } from './primitives';

/* ─── Data ──────────────────────────────────────────────────────── */
const BRAND_COLORS = [
  { name: 'Indigo', c: '#4F46E5' }, { name: 'Roxo', c: '#7C3AED' },
  { name: 'Vermelho', c: '#DC2626' }, { name: 'Laranja', c: '#EA580C' },
  { name: 'Verde', c: '#16A34A' }, { name: 'Teal', c: '#0D9488' },
  { name: 'Rosa', c: '#DB2777' }, { name: 'Grafite', c: '#475569' },
  { name: 'Azul', c: '#2563EB' }, { name: 'Ocre', c: '#B45309' },
  { name: 'Esmeralda', c: '#047857' }, { name: 'Ametista', c: '#7E22CE' },
];

const PALETTES = [
  { id: 'meia-noite', name: 'Meia-Noite', mode: 'Dark', dots: ['#0B0D12', '#111A2E', '#3B82F6'] },
  { id: 'tatico', name: 'Tático', mode: 'Dark', dots: ['#0B0D12', '#1F2B1E', '#16A34A'] },
  { id: 'carbono', name: 'Carbono', mode: 'Dark', dots: ['#0B0D12', '#1A1515', '#DC2626'] },
  { id: 'slate', name: 'Slate Dark', mode: 'Dark', dots: ['#0B0D12', '#161A24', '#7C3AED'] },
  { id: 'classico', name: 'Clássico', mode: 'Light', dots: ['#FFFFFF', '#F1F5F9', '#4F46E5'] },
  { id: 'esmeralda', name: 'Esmeralda', mode: 'Light', dots: ['#FFFFFF', '#F0FDF4', '#16A34A'] },
  { id: 'ambar', name: 'Âmbar', mode: 'Light', dots: ['#FFFDF7', '#FEF3C7', '#D97706'] },
];

const LAYOUTS = [
  { id: 'sidebar', name: 'Sidebar Lateral', desc: 'Menu fixo na esquerda, clássico' },
  { id: 'topbar', name: 'Barra Superior', desc: 'Menu no topo, mais espaço' },
  { id: 'dock', name: 'Dock Minimal', desc: 'Dock flutuante, moderno' },
];

const LOGIN_STYLES = [
  { id: 'split', name: 'Split Screen', desc: 'Painel da marca + formulário' },
  { id: 'centralizado', name: 'Centralizado', desc: 'Card elegante no centro' },
  { id: 'fundo', name: 'Fundo Total', desc: 'Imagem ou cor cobrindo tudo' },
  { id: 'minimal', name: 'Minimal', desc: 'Ultra limpo, sem distrações' },
];

const CAPSULE_DESIGNS = [
  { id: 'operativo', name: 'Operativo', tag: 'Tático · Monospace · Dourado' },
  { id: 'campeao', name: 'Campeão', tag: 'Bold · Verde Vibrante' },
  { id: 'relatorio', name: 'Relatório', tag: 'Editorial · Clean · Premium' },
];

const HIERARCHIES = [
  { id: 'militar', name: 'Militar', icon: '⚔', color: '#D97706', ranks: ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Tenente', 'Capitão', 'Major', 'Coronel', 'General'], pts: [0, 100, 300, 600, 1000, 1600, 2500, 4000, 6000] },
  { id: 'policial', name: 'Policial', icon: '🛡', color: '#2563EB', ranks: ['Aspirante', 'Agente', 'Escrivão', 'Inspetor', 'Delegado', 'Delegado-Geral'], pts: [0, 150, 400, 900, 1800, 3500] },
  { id: 'juridico', name: 'Jurídico', icon: '⚖', color: '#7C3AED', ranks: ['Bacharel', 'Advogado', 'Promotor', 'Juiz', 'Desembargador', 'Ministro'], pts: [0, 300, 800, 1800, 3500, 6000] },
  { id: 'fiscal', name: 'Fiscal', icon: '📊', color: '#16A34A', ranks: ['Trainee', 'Analista', 'Auditor Jr', 'Auditor Pleno', 'Auditor Sênior', 'Auditor-Fiscal'], pts: [0, 200, 600, 1400, 2800, 5000] },
  { id: 'admin', name: 'Administrativo', icon: '📋', color: '#7C3AED', ranks: ['Assistente', 'Técnico', 'Analista', 'Especialista', 'Gestor', 'Diretor'], pts: [0, 150, 400, 900, 1800, 3500] },
  { id: 'saude', name: 'Saúde', icon: '❤', color: '#DB2777', ranks: ['Estudante', 'Técnico', 'Enfermeiro', 'Residente', 'Especialista', 'Preceptor'], pts: [0, 200, 500, 1200, 2400, 4500] },
];

const INSIGHT_LANGS = [
  { id: 'militar', name: 'Militar', tags: ['EsPCEx', 'IME'], color: '#D97706', icon: '⚔', insights: [{ kind: 'ok', title: 'Missão em andamento', body: 'Soldado, você completou 73% da missão semanal.' }, { kind: 'warn', title: 'Vulnerabilidade tática', body: 'Direito Penal com 38% de acerto. Reforce essa posição.' }, { kind: 'next', title: 'Próxima ordem', body: 'Execute 15 questões de Direito Constitucional hoje.' }] },
  { id: 'policial', name: 'Policial', tags: ['PC', 'PF'], color: '#2563EB', icon: '🛡', insights: [{ kind: 'ok', title: 'Caso em andamento', body: 'Investigador, sua taxa de 71% coloca você entre os 30% mais eficientes.' }, { kind: 'warn', title: 'Pista não elucidada', body: 'Processo Penal com 41% de acerto. Essa lacuna compromete o caso.' }, { kind: 'next', title: 'Próxima diligência', body: 'Revise os últimos 3 erros de Direito Administrativo.' }] },
  { id: 'juridico', name: 'Jurídico', tags: ['Magistratura', 'MP'], color: '#7C3AED', icon: '⚖', insights: [{ kind: 'ok', title: 'Jurisprudência firmada', body: 'Bacharel, você acertou 68% esta semana.' }, { kind: 'warn', title: 'Tese não consolidada', body: 'Direito Constitucional com 44%. Precisa de reforço.' }, { kind: 'next', title: 'Próximo fundamento', body: 'Revise os últimos acórdãos de Direito Administrativo.' }] },
  { id: 'fiscal', name: 'Fiscal', tags: ['RFB', 'SEFAZ'], color: '#16A34A', icon: '📊', insights: [{ kind: 'ok', title: 'Conformidade fiscal', body: 'Analista, seu desempenho de 71% indica conformidade crescente.' }, { kind: 'warn', title: 'Inconsistência detectada', body: 'Direito Tributário com 39% de acerto.' }, { kind: 'next', title: 'Próximo lançamento', body: 'Execute 20 questões de Contabilidade Pública hoje.' }] },
  { id: 'admin', name: 'Administrativo', tags: ['INSS', 'BB'], color: '#7C3AED', icon: '📋', insights: [{ kind: 'ok', title: 'Meta atingida', body: 'Analista, você entregou 73% da meta semanal.' }, { kind: 'warn', title: 'Gap identificado', body: 'Administração Pública com 41% de acerto.' }, { kind: 'next', title: 'Próxima entrega', body: 'Resolva 15 questões de Português hoje.' }] },
  { id: 'saude', name: 'Saúde', tags: ['ANVISA', 'ANS'], color: '#DB2777', icon: '❤', insights: [{ kind: 'ok', title: 'Protocolo cumprido', body: 'Especialista, você cumpriu 73% do protocolo semanal.' }, { kind: 'warn', title: 'Indicador abaixo', body: 'Epidemiologia com 38% de acerto.' }, { kind: 'next', title: 'Próxima prescrição', body: 'Prescrição: 15 questões de Saúde Pública.' }] },
];

const INSIGHT_META: Record<string, { icon: string; color: string }> = {
  ok: { icon: '🎯', color: '#10B981' },
  warn: { icon: '⚠', color: '#F59E0B' },
  next: { icon: '📌', color: '#3B82F6' },
};

/* ─── Module Shell ───────────────────────────────────────────────── */
function ModuleCard({ tag, title, subtitle, children }: { tag: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="reveal" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.14em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          {tag}
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginTop: 6, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

/* ─── 1. Branding ────────────────────────────────────────────────── */
function BrandingModule() {
  const [name, setName] = useState('Seu Curso');
  const [primary, setPrimary] = useState('#2563EB');
  return (
    <ModuleCard tag="01 · Branding" title="Sua logo, suas cores." subtitle="Seu aluno vê sua marca. Nunca a nossa.">
      <div style={{ background: '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 55%, #000))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)', fontFamily: 'JetBrains Mono', fontSize: 8, fontWeight: 600, textAlign: 'center', lineHeight: 1.15, padding: 4, boxShadow: `0 0 20px ${primary}55` }}>sua<br />logo<br />aqui</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>seuaplicativo.com.br</div>
        </div>
        <button style={{ padding: '8px 14px', borderRadius: 8, background: primary, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none' }}>Entrar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>NOME DA PLATAFORMA</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 13, fontFamily: 'Space Grotesk' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>COR PRIMÁRIA</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 10 }}>
            {BRAND_COLORS.map((c) => (
              <button key={c.c} onClick={() => setPrimary(c.c)} title={c.name} style={{ aspectRatio: '1', borderRadius: 8, background: c.c, border: primary === c.c ? '2px solid var(--ink)' : '2px solid transparent', boxShadow: primary === c.c ? `0 0 12px ${c.c}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                {primary === c.c && <span style={{ color: '#fff', fontSize: 14 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}

/* ─── 2. Aparência ───────────────────────────────────────────────── */
function AppearanceModule() {
  const [pal, setPal] = useState(PALETTES[0]);
  const [layout, setLayout] = useState(LAYOUTS[0]);
  return (
    <ModuleCard tag="02 · Aparência" title="Paleta e layout do aluno." subtitle="Escolha o tema e onde fica a navegação.">
      <div style={{ background: pal.mode === 'Light' ? '#F8FAFC' : '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, height: 130, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {layout.id === 'sidebar' && (
          <>
            <div style={{ width: 52, background: pal.dots[1], padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: pal.dots[2] }} />
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ width: '100%', height: 4, background: pal.dots[2], opacity: i === 0 ? 1 : 0.3, borderRadius: 2 }} />)}
            </div>
            <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: '40%', height: 8, background: pal.dots[2], borderRadius: 2 }} />
              <div style={{ flex: 1, background: pal.dots[1], borderRadius: 6, marginTop: 4, opacity: 0.6 }} />
            </div>
          </>
        )}
        {layout.id === 'topbar' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 32, background: pal.dots[1], padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: pal.dots[2] }} />
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ width: 32, height: 4, background: pal.dots[2], opacity: i === 0 ? 1 : 0.3, borderRadius: 2 }} />)}
            </div>
            <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: '40%', height: 8, background: pal.dots[2], borderRadius: 2 }} />
              <div style={{ flex: 1, background: pal.dots[1], borderRadius: 6, marginTop: 4, opacity: 0.6 }} />
            </div>
          </div>
        )}
        {layout.id === 'dock' && (
          <div style={{ flex: 1, position: 'relative', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: '40%', height: 8, background: pal.dots[2], borderRadius: 2 }} />
            <div style={{ flex: 1, background: pal.dots[1], borderRadius: 6, marginTop: 4, opacity: 0.6 }} />
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: pal.dots[1], padding: '6px 10px', borderRadius: 999, display: 'flex', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: pal.dots[2], opacity: i === 0 ? 1 : 0.35 }} />)}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>PALETA, {pal.name}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8 }}>
          {PALETTES.map((p) => (
            <button key={p.id} onClick={() => setPal(p)} style={{ padding: '8px 6px', borderRadius: 8, background: pal.id === p.id ? 'var(--bg-elev)' : 'transparent', border: pal.id === p.id ? `1px solid ${p.dots[2]}` : '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                {p.dots.map((d, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 999, background: d, border: '1px solid rgba(255,255,255,0.1)' }} />)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>LAYOUT, {layout.name}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
          {LAYOUTS.map((l) => (
            <button key={l.id} onClick={() => setLayout(l)} style={{ padding: '10px 8px', borderRadius: 8, background: layout.id === l.id ? 'var(--bg-elev)' : 'transparent', border: layout.id === l.id ? '1px solid var(--accent)' : '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{l.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2, lineHeight: 1.3 }}>{l.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}

/* ─── 3. Login ───────────────────────────────────────────────────── */
function LoginModule() {
  const [style, setStyle] = useState(LOGIN_STYLES[0]);
  const [headline, setHeadline] = useState('Sua aprovação começa aqui.');
  const [badge, setBadge] = useState('Rumo à Aprovação');
  const accent = '#2563EB';
  return (
    <ModuleCard tag="03 · Tela de Login" title="A primeira impressão é sua." subtitle="Layout, copy e mensagem editáveis.">
      <div style={{ background: '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, height: 170, display: 'flex', overflow: 'hidden' }}>
        {style.id === 'split' && (
          <>
            <div style={{ flex: 1, background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 40%, #000))`, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: '#fff', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: 999, alignSelf: 'flex-start' }}>{badge.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk', lineHeight: 1.15 }}>{headline}</div>
            </div>
            <div style={{ flex: 1, background: '#0B0D12', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600 }}>Entrar</div>
              <div style={{ width: '100%', height: 20, background: '#1A1F2B', borderRadius: 4 }} />
              <div style={{ width: '100%', height: 20, background: '#1A1F2B', borderRadius: 4 }} />
              <div style={{ width: '100%', height: 22, background: accent, borderRadius: 4, marginTop: 4 }} />
            </div>
          </>
        )}
        {style.id === 'centralizado' && (
          <div style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #111827, #06070B)' }}>
            <div style={{ width: '65%', padding: 14, background: '#0B0D12', border: `1px solid ${accent}40`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: accent, margin: '0 auto' }} />
              <div style={{ fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{headline}</div>
              <div style={{ width: '100%', height: 16, background: '#1A1F2B', borderRadius: 4 }} />
              <div style={{ width: '100%', height: 16, background: accent, borderRadius: 4 }} />
            </div>
          </div>
        )}
        {style.id === 'fundo' && (
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${accent}, #1E1B4B)`, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '60%', padding: 14, background: 'rgba(11,13,18,0.85)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{headline}</div>
              <div style={{ width: '100%', height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }} />
              <div style={{ width: '100%', height: 16, background: '#fff', borderRadius: 4 }} />
            </div>
          </div>
        )}
        {style.id === 'minimal' && (
          <div style={{ flex: 1, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, background: '#0B0D12' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: accent }} />
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{headline}</div>
            <div style={{ width: '70%', height: 14, background: '#1A1F2B', borderRadius: 3, marginTop: 4 }} />
            <div style={{ width: '40%', height: 14, background: accent, borderRadius: 3 }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>ESTILO</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8 }}>
          {LOGIN_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s)} style={{ padding: '8px 6px', borderRadius: 8, background: style.id === s.id ? 'var(--bg-elev)' : 'transparent', border: style.id === s.id ? '1px solid var(--accent)' : '1px solid var(--line)', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        {[{ label: 'BADGE', val: badge, set: setBadge }, { label: 'HEADLINE', val: headline, set: setHeadline }].map((f) => (
          <div key={f.label}>
            <label style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono' }}>{f.label}</label>
            <input value={f.val} onChange={(e) => f.set(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 12 }} />
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

/* ─── 4. Cápsula ─────────────────────────────────────────────────── */
function CapsuleModule() {
  const [design, setDesign] = useState(CAPSULE_DESIGNS[0]);
  return (
    <ModuleCard tag="04 · Cápsula de Estudos" title="O card viral do seu aluno." subtitle="Gerado todo mês. Compartilhado nas redes. Com sua marca.">
      <div style={{ background: '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        {design.id === 'operativo' && (
          <div style={{ width: 180, aspectRatio: '3/4', padding: 14, background: 'linear-gradient(180deg, #0A0B10, #000)', border: '1px solid #D97706', borderRadius: 8, fontFamily: 'JetBrains Mono', color: '#D97706', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7 }}><span>SEU CURSO</span><span>ABR.2026</span></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk', lineHeight: 1 }}>Missão</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', fontFamily: 'Space Grotesk', lineHeight: 1, marginTop: -2 }}>cumprida.</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk', lineHeight: 1 }}>2341</div>
            <div style={{ height: 1, background: '#D9770660', marginTop: 4 }} />
            <div style={{ fontSize: 7, display: 'flex', justifyContent: 'space-between' }}><span>DIR. CONST.</span><span>81%</span></div>
          </div>
        )}
        {design.id === 'campeao' && (
          <div style={{ width: 180, aspectRatio: '3/4', padding: 14, background: '#0A0C11', border: '1px solid #16A34A', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9, color: '#16A34A', fontWeight: 700, marginTop: 8 }}>TEMPO ESTUDADO</div>
            <div style={{ fontSize: 36, color: '#fff', fontWeight: 800, fontFamily: 'Space Grotesk', lineHeight: 1 }}>2341</div>
            <div style={{ fontSize: 6, color: '#64748B' }}>MINUTOS EM ABRIL</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, padding: 6, background: '#06070B', borderRadius: 6 }}>
              <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>487</div><div style={{ fontSize: 5, color: '#64748B' }}>QUESTÕES</div></div>
              <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>73%</div><div style={{ fontSize: 5, color: '#64748B' }}>ACERTO</div></div>
            </div>
          </div>
        )}
        {design.id === 'relatorio' && (
          <div style={{ width: 180, aspectRatio: '3/4', padding: 14, background: '#0F1014', border: '1px solid #2D3341', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'Space Grotesk' }}>
            <div style={{ fontSize: 18, color: '#fff', fontWeight: 700, marginTop: 4, lineHeight: 1 }}>Cápsula</div>
            <div style={{ fontSize: 18, color: '#64748B', fontWeight: 700, fontStyle: 'italic', lineHeight: 1, marginTop: -2 }}>de estudos</div>
            <div style={{ fontSize: 28, color: '#fff', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 8 }}>2.341</div>
            <div style={{ fontSize: 6, color: '#64748B' }}>MINUTOS</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>DESIGN</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
          {CAPSULE_DESIGNS.map((d) => (
            <button key={d.id} onClick={() => setDesign(d)} style={{ padding: '10px 8px', borderRadius: 8, background: design.id === d.id ? 'var(--bg-elev)' : 'transparent', border: design.id === d.id ? '1px solid var(--accent)' : '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</div>
              <div style={{ fontSize: 9, color: 'var(--ink-mute)', marginTop: 2 }}>{d.tag}</div>
            </button>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}

/* ─── 5. Mentor Tone ─────────────────────────────────────────────── */
function MentorToneModule() {
  const [lang, setLang] = useState(INSIGHT_LANGS[0]);
  return (
    <ModuleCard tag="05 · Linguagem do Mentor" title="Insights na linguagem do seu nicho." subtitle="O Mentor gera mensagens no vocabulário do seu aluno.">
      <div style={{ background: '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lang.insights.map((ins, i) => {
          const m = INSIGHT_META[ins.kind];
          return (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: `color-mix(in srgb, ${m.color} 8%, #0B0D12)`, borderLeft: `3px solid ${m.color}`, borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `color-mix(in srgb, ${m.color} 18%, #0B0D12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{ins.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.45 }}>{ins.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>NICHO</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
          {INSIGHT_LANGS.map((x) => (
            <button key={x.id} onClick={() => setLang(x)} style={{ padding: '10px 10px', borderRadius: 10, background: lang.id === x.id ? 'var(--bg-elev)' : 'transparent', border: lang.id === x.id ? `1px solid ${x.color}` : '1px solid var(--line)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ width: 26, height: 26, borderRadius: 6, background: `color-mix(in srgb, ${x.color} 18%, transparent)`, color: x.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{x.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{x.name}</span>
            </button>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}

/* ─── 6. Gamification ───────────────────────────────────────────── */
function GamificationModule() {
  const [h, setH] = useState(HIERARCHIES[0]);
  return (
    <ModuleCard tag="06 · Gamificação" title="A hierarquia do seu nicho." subtitle="Escolha a progressão que faz sentido para seu produto.">
      <div style={{ background: '#06070B', border: '1px solid var(--line-strong)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 200, justifyContent: 'center' }}>
        {h.ranks.slice(0, 6).map((r, i) => {
          const isTop = i === h.ranks.length - 1 && h.ranks.length <= 6;
          return (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: isTop ? `color-mix(in srgb, ${h.color} 18%, transparent)` : 'transparent', color: isTop ? h.color : 'var(--ink)' }}>
              <div className="l-mono" style={{ fontSize: 10, color: isTop ? h.color : 'var(--ink-mute)' }}>{i + 1}</div>
              <div style={{ fontSize: 13, fontWeight: isTop ? 700 : 500 }}>{r}</div>
              <div className="l-mono" style={{ fontSize: 10, color: isTop ? h.color : 'var(--ink-mute)' }}>{h.pts[i].toLocaleString()} pts {isTop ? '👑' : ''}</div>
            </div>
          );
        })}
        {h.ranks.length > 6 && (
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: `color-mix(in srgb, ${h.color} 22%, transparent)`, color: h.color }}>
            <div className="l-mono" style={{ fontSize: 10 }}>{h.ranks.length}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{h.ranks[h.ranks.length - 1]}</div>
            <div className="l-mono" style={{ fontSize: 10 }}>{h.pts[h.pts.length - 1].toLocaleString()} pts 👑</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>NICHO</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
          {HIERARCHIES.map((x) => (
            <button key={x.id} onClick={() => setH(x)} style={{ padding: '10px 8px', borderRadius: 8, background: h.id === x.id ? 'var(--bg-elev)' : 'transparent', border: h.id === x.id ? `1px solid ${x.color}` : '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: `color-mix(in srgb, ${x.color} 20%, transparent)`, color: x.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{x.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{x.name}</span>
            </button>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function Personalization() {
  return (
    <section id="personalização" style={{ ...launcherStyles.section, position: 'relative', overflow: 'hidden' }}>
      <GlowBG color="var(--accent)" size={600} opacity={0.08} top={-100} right={-100} />
      <div style={launcherStyles.container}>
        <SectionHeader
          eyebrow="100% personalizado para sua marca"
          title="Um sistema inteligente do seu jeito."
          sub="Sua marca na frente. A Launcher nos bastidores. Você edita tudo: logo, cores, layout, login, cápsulas, o jeito do Mentor falar e a hierarquia de patentes do seu nicho."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          <BrandingModule />
          <AppearanceModule />
          <LoginModule />
          <CapsuleModule />
          <MentorToneModule />
          <GamificationModule />
        </div>
        <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginTop: 40 }}>
          {['Logo, cores e nome 100% seus', 'Paleta + layout do portal editáveis', 'Tela de login com sua copy e estilo', 'Cápsula de Estudos em 3 designs', 'Tom de voz do Mentor customizável', 'Hierarquia de patentes por nicho', 'Domínio personalizado (seunome.com.br)', 'Seus alunos nunca veem "Launcher"'].map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14 }}>
              <span style={{ color: 'var(--success)', fontSize: 16 }}>✓</span> {x}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

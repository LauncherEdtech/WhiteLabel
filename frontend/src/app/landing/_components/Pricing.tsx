'use client';
import { useState } from 'react';
import { launcherStyles, SectionHeader, Btn, GlowBG } from './primitives';

const FEATURES_INCLUDED = [
    'Cronograma estruturado',
    'Banco de questões completo',
    'Simulados realistas',
    'Dashboard de performance',
    'Motor de retenção',
    'Cápsula de estudos',
];

const PLANS = [
    { id: 'semestral', name: 'Semestral', duration: '6 meses', totalPerStudent: 89.40, monthlyEquivalent: 14.90, cashback: 20, popular: false, desc: 'Para começar com flexibilidade', setupFee: 997 },
    { id: 'anual', name: 'Anual', duration: '12 meses', totalPerStudent: 118.80, monthlyEquivalent: 9.90, cashback: 25, popular: false, highlightDiscount: true, desc: 'O melhor custo-benefício', discount: '-34%' },
    { id: 'bianual', name: '2 anos', duration: '24 meses', totalPerStudent: 237.60, monthlyEquivalent: 9.90, cashback: 30, popular: true, highlightCashback: true, desc: 'Para quem pensa em escala', discount: '-34%' },
] as const;

type Plan = typeof PLANS[number];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PlanCard({ p, i }: { p: Plan; i: number }) {
    const popular = p.popular;
    const hDiscount = 'highlightDiscount' in p && (p as any).highlightDiscount;
    const hCashback = 'highlightCashback' in p && (p as any).highlightCashback;
    const setupFee = 'setupFee' in p ? (p as any).setupFee as number : undefined;
    const discount = 'discount' in p ? (p as any).discount as string : undefined;

    return (
        <div className="reveal" data-delay={`${i}`} style={{
            position: 'relative',
            background: popular ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--bg-card)), var(--bg-card))' : 'var(--bg-card)',
            border: popular ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--line)',
            borderRadius: 24, padding: 32,
            display: 'flex', flexDirection: 'column', gap: 20,
            boxShadow: popular ? '0 30px 60px rgba(59,130,246,0.2)' : 'none',
        }}>
            {popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 999, fontFamily: 'JetBrains Mono', boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}>
                    MAIOR CASHBACK
                </div>
            )}

            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{p.name}</div>
                    {discount && (
                        <span className="l-mono" style={{
                            fontSize: hDiscount ? 12 : 10,
                            padding: hDiscount ? '5px 12px' : '3px 8px',
                            borderRadius: 6,
                            background: hDiscount ? 'linear-gradient(135deg, rgba(34,197,94,0.28), rgba(34,197,94,0.12))' : 'rgba(34,197,94,0.15)',
                            color: 'var(--success)',
                            border: hDiscount ? '1px solid rgba(34,197,94,0.55)' : '1px solid rgba(34,197,94,0.35)',
                            letterSpacing: '0.08em', fontWeight: 700,
                            boxShadow: hDiscount ? '0 0 16px rgba(34,197,94,0.25)' : 'none',
                        }}>{discount}</span>
                    )}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginTop: 4 }}>{p.desc}</div>
            </div>

            <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>R$</span>
                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 56, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtBRL(p.monthlyEquivalent)}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>/mês por aluno</span>
                </div>
                <div className="l-mono" style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 8 }}>
                    R$ {fmtBRL(p.totalPerStudent)} por aluno · cobrado em parcela única · sem mensalidade
                </div>
                {setupFee && (
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6, padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#EAB308' }}>⚡</span>
                        <span>+ taxa de implantação de <strong style={{ color: 'var(--ink)' }}>R$ {fmtBRL(setupFee)}</strong></span>
                    </div>
                )}
            </div>

            <div style={{
                padding: hCashback ? '20px 18px' : '14px 16px',
                background: hCashback
                    ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(59,130,246,0.12))'
                    : popular
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.08))'
                        : 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.04))',
                border: hCashback ? '1.5px solid rgba(59,130,246,0.6)' : '1px solid rgba(59,130,246,0.35)',
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: hCashback ? '0 0 24px rgba(59,130,246,0.3)' : 'none',
                position: 'relative',
            }}>
                <div style={{ width: hCashback ? 46 : 38, height: hCashback ? 46 : 38, borderRadius: 10, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-halo)' }}>
                    <svg width={hCashback ? 22 : 18} height={hCashback ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: hCashback ? 28 : 20, fontWeight: 700, color: hCashback ? 'var(--accent-halo)' : 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1 }}>
                        {p.cashback}% <span style={{ fontSize: hCashback ? 14 : 13, color: 'var(--ink-dim)', fontWeight: 500 }}>de cashback</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 3 }}>
                        {hCashback ? 'o maior percentual · ganho contínuo' : 'da esteira de produtos'}
                    </div>
                </div>
            </div>

            <Btn variant={popular ? 'primary' : 'ghost'} style={{ width: '100%', justifyContent: 'center' }}>
                Começar com {p.name}
            </Btn>

            <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div className="l-mono" style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', marginBottom: 10 }}>INCLUSO</div>
                {FEATURES_INCLUDED.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13, color: 'var(--ink)' }}>
                        <span style={{ color: 'var(--success)' }}>✓</span>
                        <span>{t}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── ROI Metric ─────────────────────────────────────────────────── */
function ROIMetric({ label, value, hint, accent, subtle }: { label: string; value: string; hint?: string; accent?: boolean; subtle?: boolean }) {
    return (
        <div style={{
            padding: '16px 20px',
            background: accent ? 'linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.04))' : subtle ? 'transparent' : 'var(--bg-elev)',
            border: accent ? '1px solid rgba(59,130,246,0.35)' : subtle ? '1px dashed var(--line-strong)' : '1px solid var(--line)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="l-mono" style={{ fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 3, lineHeight: 1.35, fontFamily: 'JetBrains Mono' }}>{hint}</div>}
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, color: accent ? 'var(--accent-halo)' : 'var(--ink)', letterSpacing: '-0.02em', flexShrink: 0 }}>
                {value}
            </div>
        </div>
    );
}

/* ─── Slider ─────────────────────────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{label}</span>
                <span className="l-mono" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{fmt(value)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
    );
}

/* ─── ROI Calculator ─────────────────────────────────────────────── */
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
    const [cashbackMonthly, setCashbackMonthly] = useState(30);

    const meta = PLAN_META[plan];

    const launcherCostPerStudent = meta.perStudentMonth * meta.months;
    const launcherCost = students * launcherCostPerStudent + meta.setup;
    const repassRevenue = students * repassRate * meta.months;
    const repassMargin = repassRevenue - students * launcherCostPerStudent;
    const upsellStudents = Math.round(students * (upsellRate / 100));
    const cashbackTotal = Math.round(upsellStudents * cashbackMonthly * (meta.cashback / 100) * meta.months);
    const netGain = repassMargin + cashbackTotal - meta.setup;
    const roiPct = launcherCost > 0 ? Math.round((netGain / launcherCost) * 100) : 0;

    const fmt = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

    return (
        <div className="reveal" style={{ marginTop: 64, background: 'var(--bg-card)', border: '1px solid var(--line-strong)', borderRadius: 24, padding: 36, position: 'relative', overflow: 'hidden' }}>
            <GlowBG color="var(--accent)" size={500} opacity={0.15} top={-120} right={-120} />

            <div style={{ position: 'relative', marginBottom: 28 }}>
                <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-halo)', boxShadow: '0 0 10px var(--accent-halo)' }} />
                    CALCULADORA DE ROI
                </div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1, maxWidth: 720 }}>
                    A Launcher pode virar uma nova linha de receita.
                </h3>
                <p style={{ fontSize: 15, color: 'var(--ink-dim)', marginTop: 10, maxWidth: 760, lineHeight: 1.55 }}>
                    Você paga <strong style={{ color: 'var(--ink)' }}>R$ {meta.perStudentMonth.toString().replace('.', ',')}/mês por aluno</strong> no plano {meta.label.toLowerCase()}. Pode repassar esse valor como parte da sua oferta, cobrando a partir de R$ 9,90/mês. Tudo que for acima é <strong style={{ color: 'var(--accent-halo)' }}>margem sua</strong>.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, position: 'relative' }}>
                {/* Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div>
                        <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 10 }}>1. Qual plano você contrata?</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                            {(Object.entries(PLAN_META) as [keyof typeof PLAN_META, typeof PLAN_META[keyof typeof PLAN_META]][]).map(([k, m]) => (
                                <button key={k} onClick={() => setPlan(k)} style={{ padding: '12px 8px', borderRadius: 10, background: plan === k ? 'rgba(59,130,246,0.2)' : 'var(--bg-elev)', border: plan === k ? '1px solid rgba(59,130,246,0.55)' : '1px solid var(--line)', color: plan === k ? 'var(--ink)' : 'var(--ink-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 14 }}>{m.label}</span>
                                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>R$ {m.perStudentMonth.toString().replace('.', ',')}/mês·aluno</span>
                                    <span className="l-mono" style={{ fontSize: 10, color: 'var(--accent-halo)' }}>{m.cashback}% cashback</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Slider label="2. Quantos alunos ativos você tem?" value={students} min={20} max={2000} step={10} onChange={setStudents} fmt={(v) => `${v} alunos`} />

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
                            <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>3. Quanto você repassa ao aluno?</span>
                            <span className="l-mono" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>R$ {repassRate}/mês</span>
                        </div>
                        <input type="range" min={Math.ceil(meta.perStudentMonth)} max={197} step={1} value={repassRate}
                            onChange={(e) => setRepassRate(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono' }}>
                            <span>mín. R$ {meta.perStudentMonth.toString().replace('.', ',')} (repasse puro)</span>
                            <span>margem sua: <strong style={{ color: 'var(--success)' }}>R$ {(repassRate - meta.perStudentMonth).toFixed(2).replace('.', ',')}/mês</strong></span>
                        </div>
                    </div>

                    <Slider label="4. % dos alunos que sobem na esteira" value={upsellRate} min={5} max={60} step={1} onChange={setUpsellRate} fmt={(v) => `${v}%`} />
                    <Slider label="5. Ticket mensal da esteira (por aluno)" value={cashbackMonthly} min={10} max={300} step={5} onChange={setCashbackMonthly} fmt={(v) => `R$ ${v}`} />
                </div>

                {/* Resultados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: '24px 24px', background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.06))', border: '1.5px solid rgba(59,130,246,0.55)', borderRadius: 16, boxShadow: '0 0 28px rgba(59,130,246,0.22)', position: 'relative', overflow: 'hidden' }}>
                        <div className="l-mono" style={{ fontSize: 10, color: 'var(--accent-halo)', letterSpacing: '0.14em', marginBottom: 6 }}>
                            SEU LUCRO LÍQUIDO · {meta.months} MESES
                        </div>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 44, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                            {fmt(netGain)}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.18)', color: 'var(--success)', fontSize: 12, fontWeight: 700 }}>+{roiPct}% ROI</span>
                            <span>margem do repasse + cashback da esteira</span>
                        </div>
                    </div>

                    <ROIMetric label="Margem do repasse" value={fmt(repassMargin)} hint={`${students} alunos × R$ ${(repassRate - meta.perStudentMonth).toFixed(2).replace('.', ',')} × ${meta.months} meses`} accent />
                    <ROIMetric label="Cashback da esteira" value={fmt(cashbackTotal)} hint={`${upsellStudents} alunos × R$${cashbackMonthly} × ${meta.cashback}% × ${meta.months} meses`} accent />
                    <ROIMetric label="Investimento na Launcher" value={fmt(launcherCost)} hint={meta.setup > 0 ? `${students} × R$${launcherCostPerStudent.toFixed(2).replace('.', ',')} + R$${meta.setup} implantação` : `${students} × R$${launcherCostPerStudent.toFixed(2).replace('.', ',')} · parcela única`} subtle />

                    <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontStyle: 'italic', marginTop: 6, lineHeight: 1.5 }}>
                        * Exemplo de cálculo. Valores reais dependem da sua oferta e base. O repasse ao aluno é opcional.
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export function Pricing() {
    return (
        <section id="preços" style={launcherStyles.section}>
            <div style={launcherStyles.container}>
                <SectionHeader
                    eyebrow="Preços"
                    title="Um preço justo por aluno. Quanto mais tempo, mais você ganha."
                    sub="Todos os planos incluem o mesmo conjunto de recursos. A diferença está na duração e no cashback da esteira de produtos."
                    center
                />

                <div className="reveal" style={{ marginBottom: 48, padding: '28px 32px', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                        <div>
                            <div className="l-mono" style={{ fontSize: 11, color: 'var(--accent-halo)', letterSpacing: '0.14em', marginBottom: 8 }}>INCLUSO EM TODOS OS PLANOS</div>
                            <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Tudo que seu aluno precisa para estudar com estrutura.</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: '8px 16px', flex: '1 1 280px' }}>
                            {FEATURES_INCLUDED.map((f) => (
                                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(59,130,246,0.18)', color: 'var(--accent-halo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✓</span>
                                    {f}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, alignItems: 'stretch' }}>
                    {PLANS.map((p, i) => <PlanCard key={p.id} p={p} i={i} />)}
                </div>

                <div className="reveal" style={{ marginTop: 28, padding: '18px 22px', background: 'linear-gradient(180deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02))', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14, fontSize: 13.5, color: 'var(--ink-dim)' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: 'var(--accent-halo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    </span>
                    <div>
                        <strong style={{ color: 'var(--ink)' }}>Cashback da esteira de produtos.</strong> Conforme seus alunos desbloqueiam camadas avançadas (Mentor Inteligente, Cronograma Personalizado e outros), você recebe um percentual de volta, sem esforço de venda.
                    </div>
                </div>

                <ROICalc />
            </div>
        </section>
    );
}
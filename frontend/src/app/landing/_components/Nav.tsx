'use client';
import { Btn, LogoWordmark } from './primitives';

export function Nav() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
      padding: '18px 7vw',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoWordmark height={32} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {['Funcionalidades', 'Personalização', 'Preços', 'FAQ'].map((x) => (
          <a key={x} href={`#${x.toLowerCase()}`}
            style={{ color: 'var(--ink-dim)', fontSize: 14, fontWeight: 500 }}>
            {x}
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" icon={false}>Entrar</Btn>
        <Btn variant="primary">Começar</Btn>
      </div>
    </nav>
  );
}

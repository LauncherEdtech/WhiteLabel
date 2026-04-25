'use client';
import { useState } from 'react';
import { Btn, LogoWordmark } from './primitives';

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
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

        {/* Desktop links */}
        <div className="l-nav-links">
          {['Funcionalidades', 'Personalização', 'Preços', 'FAQ'].map((x) => (
            <a key={x} href={`#${x.toLowerCase()}`}
              style={{ color: 'var(--ink-dim)', fontSize: 14, fontWeight: 500 }}>
              {x}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="l-nav-actions">
          <Btn variant="ghost" icon={false}>Entrar</Btn>
          <Btn variant="primary">Começar</Btn>
        </div>

        {/* Mobile burger */}
        <button
          className="l-nav-burger"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'none',
            alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10,
            border: '1px solid var(--line-strong)',
            background: 'transparent', color: 'var(--ink)',
            flexShrink: 0,
          }}
          aria-label="Menu"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      <div className={`l-mobile-menu${open ? ' open' : ''}`}>
        {['Funcionalidades', 'Personalização', 'Preços', 'FAQ'].map((x) => (
          <a key={x} href={`#${x.toLowerCase()}`}
            onClick={() => setOpen(false)}
            style={{ color: 'var(--ink)', fontSize: 17, fontWeight: 500, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
            {x}
          </a>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" icon={false} style={{ flex: 1, justifyContent: 'center' }}>Entrar</Btn>
          <Btn variant="primary" style={{ flex: 1, justifyContent: 'center' }}>Começar</Btn>
        </div>
      </div>
    </>
  );
}

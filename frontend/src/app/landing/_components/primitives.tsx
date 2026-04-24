'use client';
import { useState, CSSProperties, ReactNode } from 'react';

/* ─── Shared style objects ──────────────────────────────────────── */
export const launcherStyles = {
  section: {
    position: 'relative',
    paddingBlock: '140px',
    paddingInline: '7vw',
    borderBottom: '1px solid var(--line)',
  } as CSSProperties,
  container: {
    maxWidth: 1360,
    margin: '0 auto',
  } as CSSProperties,
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid var(--line-strong)',
    background: 'color-mix(in srgb, var(--bg-elev) 70%, transparent)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--ink-dim)',
  } as CSSProperties,
  eyebrowDot: {
    width: 6, height: 6, borderRadius: 999,
    background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)',
    flexShrink: 0,
  } as CSSProperties,
  h2: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: 50,
    lineHeight: 1.02,
    letterSpacing: '-0.025em',
    fontWeight: 600,
    margin: '20px 0 0',
  } as CSSProperties,
  sub: {
    fontSize: 'clamp(16px, 1.35vw, 20px)',
    lineHeight: 1.55,
    color: 'var(--ink-dim)',
    maxWidth: 680,
    marginTop: 20,
  } as CSSProperties,
};

/* ─── Eyebrow ────────────────────────────────────────────────────── */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={launcherStyles.eyebrow} className="l-mono">
      <span style={launcherStyles.eyebrowDot} />
      {children}
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────── */
interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  sub?: string;
  center?: boolean;
}

export function SectionHeader({ eyebrow, title, sub, center }: SectionHeaderProps) {
  return (
    <div style={{
      textAlign: center ? 'center' : 'left',
      marginBottom: 72,
      maxWidth: center ? 900 : '100%',
      marginInline: center ? 'auto' : 0,
    }}>
      <div className="reveal"><Eyebrow>{eyebrow}</Eyebrow></div>
      <h2 style={{ ...launcherStyles.h2, marginInline: center ? 'auto' : 0 }}
        className="reveal l-display" data-delay="1">
        {title}
      </h2>
      {sub && (
        <p style={{ ...launcherStyles.sub, marginInline: center ? 'auto' : 0 }}
          className="reveal" data-delay="2">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Button ─────────────────────────────────────────────────────── */
interface BtnProps {
  variant?: 'primary' | 'ghost' | 'solid';
  children: ReactNode;
  onClick?: () => void;
  icon?: false;
  big?: boolean;
  style?: CSSProperties;
}

export function Btn({ variant = 'primary', children, onClick, icon, big, style }: BtnProps) {
  const [hover, setHover] = useState(false);

  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: big ? '18px 26px' : '14px 22px',
    borderRadius: 12,
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: big ? 16 : 15,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    border: '1px solid transparent',
    transition: 'background-color .25s, color .25s, border-color .25s, box-shadow .25s, transform .2s',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transform: hover ? 'translateY(-1px)' : 'translateY(0)',
  };

  const variants: Record<string, CSSProperties> = {
    primary: hover
      ? { background: '#fff', color: 'var(--accent)', border: '1px solid var(--accent)', boxShadow: '0 0 0 4px rgba(59,130,246,0.15), 0 10px 24px rgba(59,130,246,0.25)' }
      : { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 10px 30px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' },
    ghost: hover
      ? { background: 'rgba(59,130,246,0.08)', color: 'var(--accent-halo)', border: '1px solid var(--accent)', boxShadow: '0 0 0 3px rgba(59,130,246,0.12)' }
      : { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
    solid: hover
      ? { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink)' }
      : { background: 'var(--ink)', color: 'var(--bg)', border: '1px solid var(--ink)' },
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
      {icon !== false && <ArrowIcon />}
    </button>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */
export function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10m0 0L9 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.2-.5-2.3-1.4-.9-.7-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2.1-.4 0-.5 0-.2-.7-1.6-.9-2.1-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.1 3c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.5.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────── */
export function Avatar({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: `linear-gradient(135deg, ${color}, ${color}aa)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: size * 0.36,
      color: '#fff', border: '2px solid var(--bg)', flexShrink: 0,
    }}>{initials}</div>
  );
}

/* ─── GlowBG ─────────────────────────────────────────────────────── */
interface GlowBGProps {
  color?: string; size?: number; opacity?: number;
  top?: number | string; left?: number | string;
  right?: number | string; bottom?: number | string;
}

export function GlowBG({ color = 'var(--accent)', size = 600, opacity = 0.15, top, left, right, bottom }: GlowBGProps) {
  return (
    <div style={{
      position: 'absolute', top, left, right, bottom,
      width: size, height: size,
      background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
      opacity, pointerEvents: 'none', filter: 'blur(40px)',
    }} />
  );
}

/* ─── GridLines ──────────────────────────────────────────────────── */
export function GridLines() {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: 'linear-gradient(to right, var(--line) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
      maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
      opacity: 0.5,
    }} />
  );
}

/* ─── Logo ───────────────────────────────────────────────────────── */
export function LogoWordmark({ height = 36 }: { height?: number }) {
  return (
    <img
      src="/assets/logo-launcher-transparent.png"
      alt="Launcher"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

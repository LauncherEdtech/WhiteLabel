'use client';
import { useEffect } from 'react';

export function useReveal(rootSelector = '.landing-root') {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.remove('pending');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    );

    const attach = () => {
      root.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top > window.innerHeight - 50) {
          el.classList.add('pending');
          io.observe(el);
        }
      });
    };

    attach();
    requestAnimationFrame(attach);

    // Fallback: ensure nothing stays pending after 3s
    const fallback = setTimeout(() => {
      root.querySelectorAll('.reveal.pending').forEach((el) =>
        el.classList.remove('pending')
      );
    }, 3000);

    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [rootSelector]);
}

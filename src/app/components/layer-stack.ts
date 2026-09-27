'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const FOCUSABLE = 'button:not(:disabled), input, textarea, select, [tabindex="0"]';

interface LayerEntry {
  el: HTMLElement;
  opener: HTMLElement | null;
}

/**
 * Port of the prototype's layer stack: body scroll lock, Escape closes the
 * topmost layer, Tab is trapped inside it, and focus returns to the opener.
 */
export function useLayerStack() {
  const stack = useRef<LayerEntry[]>([]);
  const closers = useRef(new WeakMap<HTMLElement, () => void>());

  const register = useCallback((el: HTMLElement, close: () => void) => {
    closers.current.set(el, close);
    stack.current.push({ el, opener: (document.activeElement as HTMLElement) ?? null });
    document.body.classList.add('locked');
  }, []);

  const unregister = useCallback((el: HTMLElement) => {
    const index = stack.current.findIndex(entry => entry.el === el);
    if (index < 0) return;
    const [entry] = stack.current.splice(index, 1);
    if (!stack.current.length) document.body.classList.remove('locked');

    const opener = entry.opener;
    if (opener && document.contains(opener) && opener.offsetParent !== null) {
      opener.focus();
    } else {
      stack.current.at(-1)?.el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
  }, []);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      const top = stack.current.at(-1);
      if (!top) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closers.current.get(top.el)?.();
        return;
      }

      if (event.key === 'Tab') {
        const focusables = [...top.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          el => el.offsetParent !== null
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!top.el.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, []);

  return { register, unregister };
}

/** Registers an always-mounted overlay while `open` is true and moves focus in. */
export function useLayer(
  open: boolean,
  close: () => void,
  register: (el: HTMLElement, close: () => void) => void,
  unregister: (el: HTMLElement) => void
) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    register(el, () => closeRef.current());
    const frame = requestAnimationFrame(() => {
      const target =
        el.querySelector<HTMLElement>('[data-first]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      unregister(el);
    };
  }, [open, register, unregister]);

  return ref;
}

/** Minimal matchMedia hook: false during SSR, correct after mount. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return matches;
}

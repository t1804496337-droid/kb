"use client";

import * as React from "react";

/**
 * Spring stagger entrance (polish batch 2): when a list is on screen,
 * its `[data-spring-item]` children play one spring entrance
 * (translateY + settle, see .spring-in-item in globals.css), staggered
 * 55ms apart. Each DOM node plays at most once (tracked in a WeakSet),
 * and only inside a short window after the list first becomes visible
 * — so re-renders, filtering, drawer re-opens, reorderings and items
 * added later never replay it. The lists on this site render
 * conditionally (per section) and fill from state right after mount,
 * so the hook re-checks after every render and also plays straight
 * from the IntersectionObserver callback when a list scrolls in.
 * Reduced-motion: nothing ever plays, items simply appear.
 */
export function useSpringStagger<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const seenRef = React.useRef(new WeakSet<Element>());
  const visibleRef = React.useRef(false);
  const firstVisibleAtRef = React.useRef(0);
  const observedRef = React.useRef<Element | null>(null);
  const ioRef = React.useRef<IntersectionObserver | null>(null);

  const play = React.useCallback((root: HTMLElement) => {
    const items = Array.from(
      root.querySelectorAll<HTMLElement>("[data-spring-item]"),
    );
    const fresh = items.filter((el) => !seenRef.current.has(el));
    if (fresh.length === 0) return;
    const now = performance.now();
    if (!firstVisibleAtRef.current) firstVisibleAtRef.current = now;
    const inWindow = now - firstVisibleAtRef.current <= 4000;
    fresh.forEach((el, k) => {
      seenRef.current.add(el);
      if (inWindow) {
        el.style.animationDelay = `${Math.min(k, 16) * 55}ms`;
        el.classList.add("spring-in-item");
      }
    });
  }, []);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Mark everything seen so the entrance can never fire later.
      root
        .querySelectorAll("[data-spring-item]")
        .forEach((el) => seenRef.current.add(el));
      return;
    }
    if (!("IntersectionObserver" in window)) {
      visibleRef.current = true;
    } else {
      if (!ioRef.current) {
        ioRef.current = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              visibleRef.current = true;
              if (ref.current) play(ref.current);
            }
          },
          { threshold: 0.04 },
        );
      }
      if (observedRef.current !== root) {
        if (observedRef.current) ioRef.current.unobserve(observedRef.current);
        ioRef.current.observe(root);
        observedRef.current = root;
      }
    }
    if (visibleRef.current) play(root);
  });

  React.useEffect(
    () => () => {
      ioRef.current?.disconnect();
    },
    [],
  );

  return ref;
}

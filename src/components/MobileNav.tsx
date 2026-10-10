"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

/**
 * Small-screen menu (hidden from 900px up, where the inline nav shows).
 * Solid panel, transform/opacity transition only, no 3D dependency.
 */
export default function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const restoreFocus = useRef(true);
  const scrimRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      wasOpen.current = true;
      restoreFocus.current = true;
      const prev = root.style.overflow;
      root.style.overflow = "hidden";
      panelRef.current?.querySelector<HTMLElement>("a")?.focus();

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          return;
        }
        if (e.key !== "Tab" || !panelRef.current || !buttonRef.current) return;
        // keep focus inside the button + panel while open
        const focusables = [buttonRef.current, ...panelRef.current.querySelectorAll<HTMLElement>("a")];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      // a click on the header outside the menu (brand, CTA) closes it without stealing focus from what was clicked;
      // the scrim handles the rest of the page and hands focus back to the button
      const onClick = (e: MouseEvent) => {
        const t = e.target as Node;
        if (panelRef.current?.contains(t) || buttonRef.current?.contains(t) || scrimRef.current?.contains(t)) return;
        restoreFocus.current = false;
        setOpen(false);
      };
      // close if the viewport grows past the breakpoint
      const mq = window.matchMedia("(min-width: 900px)");
      const onMq = () => mq.matches && setOpen(false);

      document.addEventListener("keydown", onKey);
      document.addEventListener("click", onClick, true);
      mq.addEventListener("change", onMq);
      return () => {
        root.style.overflow = prev;
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("click", onClick, true);
        mq.removeEventListener("change", onMq);
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      // a link click scrolls to its section; keep that position when returning focus
      if (restoreFocus.current) buttonRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <div className="mnav">
      <button
        ref={buttonRef}
        type="button"
        className="mnav__button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mnav__icon" aria-hidden="true" data-open={open || undefined}>
          <span />
          <span />
        </span>
        {open ? "Close" : "Menu"}
      </button>
      <div
        ref={panelRef}
        id="mobile-menu"
        className="mnav__panel"
        data-open={open || undefined}
        inert={!open}
      >
        <nav aria-label="Main">
          <ul className="mnav__list">
            {items.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={close}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="btn btn--primary mnav__cta" href="#book" onClick={close}>
          Book a consultation
        </a>
      </div>
      {open && <div ref={scrimRef} className="mnav__scrim" aria-hidden="true" onClick={close} />}
    </div>
  );
}

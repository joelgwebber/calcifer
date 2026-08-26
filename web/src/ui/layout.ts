/**
 * Responsive layout primitives (calcifer-633d / web overhaul A1).
 *
 * One breakpoint hook + one persisted nav-visibility store, rendered differently
 * per mode by the shell (A1 scaffold): desktop/tablet show the nav inline and
 * collapsible; mobile shows it as an overlay drawer. A2 fills that single nav
 * surface with Apps + Conversations; A3 refines the mobile drawer.
 */
import { useEffect, useSyncExternalStore, type RefObject } from 'react';
import { create } from 'zustand';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';

/** Breakpoints (px). Below MOBILE → single-column + drawer; below DESKTOP → tablet. */
const MOBILE_MAX = 600;
const DESKTOP_MIN = 1024;

function computeMode(width: number): LayoutMode {
  if (width < MOBILE_MAX) return 'mobile';
  if (width < DESKTOP_MIN) return 'tablet';
  return 'desktop';
}

/** The current layout mode, tracking viewport width. */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('resize', onChange);
      return () => window.removeEventListener('resize', onChange);
    },
    () => computeMode(window.innerWidth),
    () => 'desktop',
  );
}

const COLLAPSE_KEY = 'calcifer.nav.collapsed';

interface NavState {
  /** Desktop/tablet: nav collapsed out of the way (persisted). */
  collapsed: boolean;
  /** Mobile: overlay drawer open. Ephemeral — never persisted. */
  drawerOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useNav = create<NavState>((set) => ({
  collapsed: localStorage.getItem(COLLAPSE_KEY) === '1',
  drawerOpen: false,
  toggleCollapsed: () =>
    set((s) => {
      const collapsed = !s.collapsed;
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
      return { collapsed };
    }),
  setCollapsed: (collapsed) => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    set({ collapsed });
  },
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
}));

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal-drawer accessibility (calcifer-4f71 / web overhaul A3). While `open`,
 * the overlay drawer in `ref` behaves like a modal dialog: Escape closes it,
 * Tab is trapped within it, background page scroll is locked, focus moves into
 * the drawer on open, and returns to the previously-focused element (the
 * hamburger) on close. Inert when closed — the whole effect is a no-op.
 */
export function useDrawerA11y(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const restoreFocusTo = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] =>
      el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null) : [];
    // Move focus into the drawer once it has actually slid in. A focus() during
    // the same commit lands on a node the browser still computes as hidden (the
    // drawer flips visibility:hidden→visible mid-transition) and silently fails,
    // so defer past the open window; the focusin guard below then holds it.
    const focusTimer = window.setTimeout(() => (focusables()[0] ?? el)?.focus(), 80);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Guard: if focus escapes the open drawer (e.g. the chat composer's own
    // autoFocus grabbing it back on the opening render), pull it in. This is
    // what makes the trap robust against a one-shot external steal.
    function onFocusIn(e: FocusEvent) {
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        (focusables()[0] ?? el).focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = prevOverflow;
      restoreFocusTo?.focus?.();
    };
  }, [open, onClose, ref]);
}

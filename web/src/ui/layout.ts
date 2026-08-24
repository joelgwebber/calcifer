/**
 * Responsive layout primitives (calcifer-633d / web overhaul A1).
 *
 * One breakpoint hook + one persisted nav-visibility store, rendered differently
 * per mode by the shell (A1 scaffold): desktop/tablet show the nav inline and
 * collapsible; mobile shows it as an overlay drawer. A2 fills that single nav
 * surface with Apps + Conversations; A3 refines the mobile drawer.
 */
import { useSyncExternalStore } from 'react';
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

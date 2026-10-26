/**
 * Lightweight spatial navigation for TV remotes / D-pads / keyboards.
 *
 * - Any element with [data-focusable] (or a button/input/a inside [data-nav-root]) can receive focus.
 * - Arrow keys move to the nearest element in that direction.
 * - Elements inside a [data-nav-region="name"] remember the last focused child, so going
 *   back into a region (e.g. from the sidebar to the grid) lands where you left off.
 * - Text inputs keep left/right for the caret until the caret hits the edge.
 */

type Dir = 'left' | 'right' | 'up' | 'down';

const SELECTOR = '[data-focusable]:not([disabled]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), a[href]';

const regionMemory = new Map<string, HTMLElement>();

function scope(): ParentNode {
  // Modals / the player trap focus by adding [data-nav-trap]
  const traps = document.querySelectorAll<HTMLElement>('[data-nav-trap]');
  return traps.length ? traps[traps.length - 1] : document;
}

function visible(el: HTMLElement): boolean {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function focusables(root: ParentNode = scope()): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    (el) => !el.closest('[data-nav-skip]') && visible(el),
  );
}

function regionOf(el: Element | null): string | null {
  const r = el?.closest<HTMLElement>('[data-nav-region]');
  return r ? r.dataset.navRegion || null : null;
}

export function rememberFocus(el: HTMLElement): void {
  const region = regionOf(el);
  if (region) regionMemory.set(region, el);
}

function centre(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function best(from: HTMLElement, dir: Dir): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ca = centre(a);
  let bestEl: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of focusables()) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const cb = centre(b);
    let primary: number;
    let secondary: number;
    let overlap: number;

    switch (dir) {
      case 'right':
        primary = b.left - a.right;
        if (cb.x <= ca.x + 1) continue;
        secondary = Math.abs(cb.y - ca.y);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        break;
      case 'left':
        primary = a.left - b.right;
        if (cb.x >= ca.x - 1) continue;
        secondary = Math.abs(cb.y - ca.y);
        overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        break;
      case 'down':
        primary = b.top - a.bottom;
        if (cb.y <= ca.y + 1) continue;
        secondary = Math.abs(cb.x - ca.x);
        overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        break;
      default:
        primary = a.top - b.bottom;
        if (cb.y >= ca.y - 1) continue;
        secondary = Math.abs(cb.x - ca.x);
        overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    }
    primary = Math.max(primary, 0);
    // Strongly prefer things in the same row/column (overlapping), then nearest.
    const score = primary + secondary * (overlap > 0 ? 0.3 : 2.5) + (overlap > 0 ? 0 : 400);
    if (score < bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  // Entering a different region? jump to that region's remembered element if it's still there.
  if (bestEl) {
    const target = regionOf(bestEl);
    if (target && target !== regionOf(from)) {
      const mem = regionMemory.get(target);
      if (mem && mem.isConnected && visible(mem) && scope().contains(mem)) return mem;
    }
  }
  return bestEl;
}

export function focusEl(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  rememberFocus(el);
}

export function focusFirst(root?: ParentNode): void {
  const r = root ?? scope();
  const preferred = (r as Element).querySelector?.<HTMLElement>('[data-autofocus]');
  focusEl(preferred && visible(preferred) ? preferred : focusables(r)[0]);
}

const DIRS: Record<string, Dir> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Left: 'left', Right: 'right', Up: 'up', Down: 'down',
};
const CODES: Record<number, Dir> = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

/** Returns true if the event was handled. */
export function handleArrow(e: KeyboardEvent): boolean {
  const dir = DIRS[e.key] ?? CODES[e.keyCode];
  if (!dir) return false;

  const active = document.activeElement as HTMLElement | null;
  const s = scope();

  if (active && active.tagName === 'INPUT') {
    const input = active as HTMLInputElement;
    const types = ['text', 'search', 'url', 'password', 'email', 'number', ''];
    if (types.includes(input.type)) {
      const pos = input.selectionStart ?? 0;
      const len = input.value.length;
      if (dir === 'left' && pos > 0) return false;
      if (dir === 'right' && pos < len) return false;
    }
  }
  if (active && active.tagName === 'SELECT' && (dir === 'up' || dir === 'down')) return false;

  if (!active || active === document.body || !s.contains(active) || !visible(active)) {
    e.preventDefault();
    focusFirst();
    return true;
  }

  const next = best(active, dir);
  if (next) {
    e.preventDefault();
    focusEl(next);
    return true;
  }
  return false;
}

/** Track the last focused element per region even when focus moves by mouse/touch/tab. */
export function installFocusMemory(): () => void {
  const onFocus = (e: FocusEvent) => {
    if (e.target instanceof HTMLElement) rememberFocus(e.target);
  };
  document.addEventListener('focusin', onFocus);
  return () => document.removeEventListener('focusin', onFocus);
}

import type { LayoutMode } from '../types';

declare global {
  interface Window {
    tizen?: {
      tvinputdevice?: { registerKey: (k: string) => void };
      application?: { getCurrentApplication: () => { exit: () => void } };
    };
    webOS?: { platformBack?: () => void };
    PalmSystem?: unknown;
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    electronApp?: { isElectron: boolean; toggleFullscreen?: () => void; quit?: () => void };
  }
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const platform = {
  isTizen: /Tizen/i.test(ua) || typeof window.tizen !== 'undefined',
  isWebOS: /Web0S|webOS|NetCast/i.test(ua) || typeof window.PalmSystem !== 'undefined',
  isFireTV: /AFT[A-Z]/.test(ua),
  isAndroidTV: /Android TV|GoogleTV|BRAVIA|SmartTV|SMART-TV|HbbTV|CrKey|Philips|Hisense|VIDAA|Roku|AFT[A-Z]/i.test(ua),
  isNative: !!window.Capacitor?.isNativePlatform?.(),
  isElectron: !!window.electronApp?.isElectron,
  isIOS: /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
};

/** Best guess whether we're on a TV (10-foot UI, remote control, no touch). */
export function detectTV(): boolean {
  try {
    if (new URLSearchParams(location.search).has('tv')) return true;
  } catch {
    /* ignore */
  }
  if (platform.isTizen || platform.isWebOS || platform.isFireTV || platform.isAndroidTV) return true;
  // Android TV WebViews often don't say "TV": no touch + no hover-capable pointer + big screen
  const noPointer = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: none)').matches;
  return noPointer && Math.max(screen.width, screen.height) >= 1280;
}

export function resolveTV(mode: LayoutMode): boolean {
  if (mode === 'tv') return true;
  if (mode === 'standard') return false;
  return detectTV();
}

/** Samsung requires registering the remote's media/colour keys before they reach the app. */
export function registerTVKeys(): void {
  const keys = [
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
    'ChannelUp', 'ChannelDown', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ];
  try {
    keys.forEach((k) => window.tizen?.tvinputdevice?.registerKey(k));
  } catch {
    /* not Tizen */
  }
}

/** Key codes used by TV remotes, normalised into a few actions. */
export type RemoteAction =
  | 'back' | 'playpause' | 'chup' | 'chdown' | 'red' | 'green' | 'yellow' | 'blue' | 'digit' | null;

export function remoteAction(e: KeyboardEvent): RemoteAction {
  const k = e.key;
  const c = e.keyCode;
  // Back: Samsung 10009, LG 461, browsers/Android Escape/Backspace/GoBack
  if (c === 10009 || c === 461 || k === 'GoBack' || k === 'BrowserBack' || k === 'Escape') return 'back';
  if (k === 'Backspace') {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return null;
    return 'back';
  }
  if (c === 10252 || c === 415 || c === 19 || k === 'MediaPlayPause' || k === 'MediaPlay' || k === 'MediaPause' || k === ' ') {
    const t = e.target as HTMLElement | null;
    if (k === ' ' && t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON')) return null;
    return 'playpause';
  }
  if (c === 427 || k === 'ChannelUp' || k === 'PageUp' || c === 33) return 'chup';
  if (c === 428 || k === 'ChannelDown' || k === 'PageDown' || c === 34) return 'chdown';
  if (c === 403 || k === 'ColorF0Red') return 'red';
  if (c === 404 || k === 'ColorF1Green') return 'green';
  if (c === 405 || k === 'ColorF2Yellow') return 'yellow';
  if (c === 406 || k === 'ColorF3Blue') return 'blue';
  return null;
}

export function exitApp(): void {
  try {
    if (platform.isTizen) return window.tizen?.application?.getCurrentApplication().exit();
    if (platform.isWebOS && window.webOS?.platformBack) return window.webOS.platformBack();
    if (platform.isElectron) return window.electronApp?.quit?.();
  } catch {
    /* ignore */
  }
}

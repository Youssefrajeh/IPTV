/**
 * Network helpers. On Capacitor (iOS/Android) fetch is routed through native HTTP
 * (see capacitor.config.ts), so provider URLs work without CORS. In a plain browser,
 * the provider must send CORS headers, or the app must be packaged (Electron/Tizen/webOS).
 */

export class NetworkError extends Error {
  /** true when the request never got a response (offline, DNS, or blocked by CORS) */
  blocked = false;
}

const PROXY = '/__proxy?url=';

/** In a browser served by `npm run dev` / `npm run preview`, blocked requests are retried through the local proxy. */
function canUseDevProxy(): boolean {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean }; electronApp?: unknown };
  return /^https?:$/.test(location.protocol) && !w.Capacitor?.isNativePlatform?.() && !w.electronApp;
}

async function doFetch(url: string, timeoutMs: number): Promise<Response> {
  try {
    return await rawFetch(url, timeoutMs);
  } catch (e) {
    if (!(e instanceof NetworkError) || !(e as NetworkError).blocked || !canUseDevProxy()) throw e;
    try {
      return await rawFetch(PROXY + encodeURIComponent(url), timeoutMs);
    } catch {
      throw e;
    }
  }
}

async function rawFetch(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal, cache: 'no-store' });
    if (!res.ok) throw new NetworkError(`Server replied ${res.status} ${res.statusText}`.trim());
    return res;
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new NetworkError('The server took too long to respond.');
    const err = new NetworkError(
      'Could not reach the server. Check the address. In a web browser the provider may also be blocking cross-site requests (CORS); the installed apps are not affected.',
    );
    err.blocked = true;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchText(url: string, timeoutMs = 60000): Promise<string> {
  const res = await doFetch(url, timeoutMs);
  return res.text();
}

export async function fetchJson<T>(url: string, timeoutMs = 45000): Promise<T> {
  const res = await doFetch(url, timeoutMs);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NetworkError('The server did not return valid data.');
  }
}

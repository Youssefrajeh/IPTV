/**
 * Vercel function: /__proxy?url=<http(s) url>  (rewritten to /api/proxy in vercel.json)
 *
 * Lets the hosted web app load playlists and provider APIs that don't send CORS headers.
 * Only used for playlist/API requests, never for video streams.
 */

const MAX_BYTES = 60 * 1024 * 1024; // 60 MB, large M3U playlists

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function reply(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url') ?? '';
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return reply(400, 'Missing or invalid url');
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) {
    return reply(400, 'URL not allowed');
  }

  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (IPTV Player)', accept: '*/*' },
      signal: AbortSignal.timeout(50_000),
    });
    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return reply(413, 'Playlist too large');

    const headers = new Headers({
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    const type = upstream.headers.get('content-type');
    if (type) headers.set('content-type', type);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return reply(502, 'Could not reach the server: ' + (e as Error).message);
  }
}

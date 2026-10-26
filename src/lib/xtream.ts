import type { Channel, ChannelData, EpgEntry } from '../types';
import { UNGROUPED } from './m3u';
import { fetchJson } from './http';

export interface XtreamCreds {
  server: string;
  username: string;
  password: string;
}

/** Normalises user input like "example.com:8080/" into "http://example.com:8080". */
export function normaliseServer(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  s = s.replace(/\/(player_api\.php|get\.php).*$/i, '');
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s;
}

function api(c: XtreamCreds, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ username: c.username, password: c.password, ...params });
  return `${normaliseServer(c.server)}/player_api.php?${q.toString()}`;
}

interface XUserInfo {
  auth?: number;
  status?: string;
  exp_date?: string | null;
  max_connections?: string;
  active_cons?: string;
  message?: string;
}

export async function xtreamLogin(c: XtreamCreds): Promise<XUserInfo> {
  const data = await fetchJson<{ user_info?: XUserInfo }>(api(c));
  const info = data?.user_info;
  if (!info || Number(info.auth) !== 1) {
    throw new Error(info?.message || 'Login failed. Check the server URL, username and password.');
  }
  if (info.status && info.status.toLowerCase() !== 'active') {
    throw new Error(`Account status: ${info.status}`);
  }
  return info;
}

interface XCategory {
  category_id: string;
  category_name: string;
}
interface XStream {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string | null;
}

export async function xtreamLive(c: XtreamCreds, format: 'm3u8' | 'ts'): Promise<ChannelData> {
  const [cats, streams] = await Promise.all([
    fetchJson<XCategory[]>(api(c, { action: 'get_live_categories' })),
    fetchJson<XStream[]>(api(c, { action: 'get_live_streams' })),
  ]);
  const catName = new Map<string, string>();
  (cats || []).forEach((x) => catName.set(String(x.category_id), x.category_name));

  const base = normaliseServer(c.server);
  const u = encodeURIComponent(c.username);
  const p = encodeURIComponent(c.password);
  const other = format === 'm3u8' ? 'ts' : 'm3u8';

  const groupOrder: string[] = [];
  const seenGroups = new Set<string>();
  // keep provider's category order
  (cats || []).forEach((x) => {
    if (!seenGroups.has(x.category_name)) {
      seenGroups.add(x.category_name);
      groupOrder.push(x.category_name);
    }
  });

  const channels: Channel[] = (streams || []).map((s) => {
    const group = (s.category_id && catName.get(String(s.category_id))) || UNGROUPED;
    if (!seenGroups.has(group)) {
      seenGroups.add(group);
      groupOrder.push(group);
    }
    return {
      id: String(s.stream_id),
      streamId: s.stream_id,
      name: s.name,
      logo: s.stream_icon || undefined,
      group,
      tvgId: s.epg_channel_id || undefined,
      url: `${base}/live/${u}/${p}/${s.stream_id}.${format}`,
      altUrls: [`${base}/live/${u}/${p}/${s.stream_id}.${other}`],
    };
  });

  // Hide empty categories
  const used = new Set(channels.map((ch) => ch.group));
  return { channels, groups: groupOrder.filter((g) => used.has(g)) };
}

function b64(s: string | undefined): string {
  if (!s) return '';
  try {
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return s;
  }
}

export async function xtreamShortEpg(c: XtreamCreds, streamId: number, limit = 4): Promise<EpgEntry[]> {
  const data = await fetchJson<{ epg_listings?: Array<Record<string, string>> }>(
    api(c, { action: 'get_short_epg', stream_id: String(streamId), limit: String(limit) }),
  );
  return (data?.epg_listings || [])
    .map((e) => ({
      title: b64(e.title),
      description: b64(e.description),
      start: Number(e.start_timestamp) * 1000,
      end: Number(e.stop_timestamp) * 1000,
    }))
    .filter((e) => e.title && e.end > Date.now());
}

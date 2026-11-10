import type { Channel, ChannelData } from '../types';
import { parseM3U, sortGroups } from './m3u';

/**
 * Built-in free playlists from /playlists. Each file becomes its own lazy chunk, so it is
 * only downloaded when picked, and it loads from file://, TVs and native apps alike.
 */
const files = import.meta.glob('../../playlists/*.m3u', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

export interface FreePlaylist {
  id: string;
  label: string;
}

function idOf(path: string): string {
  return path.split('/').pop()!.replace(/\.m3u$/, '');
}

function labelOf(id: string): string {
  const word = id.replace(/^popular-/, '').replace(/-iptv$/, '').replace(/-/g, ' ');
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export const FREE_PLAYLISTS: FreePlaylist[] = Object.keys(files)
  .map((p) => ({ id: idOf(p), label: labelOf(idOf(p)) }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const ARABIC = 'Arabic';

// Arab League countries, as used in tvg-id suffixes like "AlArabiya.ae@SD"
const ARAB_COUNTRIES = new Set('ae sa eg qa kw bh om jo lb sy iq ps ye ly tn dz ma sd mr so dj km'.split(' '));

/** Arabic-language channels: from an Arab country, or clearly Arabic by name (BBC Arabic, MBC USA, …). */
export function isArabic(c: Pick<Channel, 'name' | 'tvgId'>): boolean {
  // English-language and Kurdish-language channels from the region are not Arabic
  if (/\bEnglish\b|Kurd|Rudaw|Welat|Payam/i.test(c.name)) return false;
  const country = c.tvgId?.match(/\.([a-z]{2})(?:@|$)/i)?.[1]?.toLowerCase();
  if (country && ARAB_COUNTRIES.has(country)) return true;
  return /\bArabi(c|ya)?\b|\bAl ?Jazeera\b|^MBC (\d|Masr|Drama|Action|Max|Iraq)|[؀-ۿ]/i.test(c.name);
}

/** Id of the combined playlist holding every category. */
export const FREE_ALL = 'all';

/** Every category in one list, filed under the category name (Business, Comedy, …). */
async function allFreeChannels(): Promise<ChannelData> {
  const parts = await Promise.all(FREE_PLAYLISTS.map(async (p) => ({ p, data: await freeChannels(p.id) })));
  const seen = new Set<string>();
  const channels: Channel[] = [];
  for (const { p, data } of parts) {
    for (const c of data.channels) {
      if (seen.has(c.url)) continue; // same stream listed in two categories: keep the first
      seen.add(c.url);
      channels.push({ ...c, group: p.label, extraGroups: isArabic(c) ? [ARABIC] : undefined });
    }
  }
  const groups = sortGroups(new Set(channels.map((c) => c.group)));
  // Arabic goes at the top of the sidebar
  return { channels, groups: channels.some((c) => c.extraGroups) ? [ARABIC, ...groups] : groups };
}

export async function freeChannels(id: string): Promise<ChannelData> {
  if (id === FREE_ALL) return allFreeChannels();
  const path = Object.keys(files).find((p) => idOf(p) === id);
  if (!path) throw new Error('That free playlist is no longer included in the app.');
  const data = parseM3U(await files[path]());
  if (!data.channels.length) throw new Error('The playlist is empty.');
  return data;
}

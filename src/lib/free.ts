import type { Channel, ChannelData } from '../types';
import { parseM3U, sortGroups } from './m3u';
import { COUNTRY_NAMES } from './countries';

/**
 * Built-in free playlists from /playlists. Each file becomes its own lazy chunk, so it is
 * only downloaded when picked, and it loads from file://, TVs and native apps alike.
 */
const files = import.meta.glob('../../playlists/*.m3u', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

/** Per-country stream files from /streams: "us.m3u" plus provider extras like "us_pluto.m3u". */
const streamFiles = import.meta.glob('../../streams/*.m3u', { query: '?raw', import: 'default' }) as Record<
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

/** Id prefix of a country playlist, e.g. "country-us". */
const COUNTRY = 'country-';

/** Country code → its stream files, the main "xx.m3u" first. */
const countryFiles = new Map<string, string[]>();
for (const path of Object.keys(streamFiles).sort()) {
  const code = idOf(path).split('_')[0];
  const list = countryFiles.get(code) ?? [];
  if (!idOf(path).includes('_')) list.unshift(path);
  else list.push(path);
  countryFiles.set(code, list);
}

export const FREE_COUNTRIES: FreePlaylist[] = Array.from(countryFiles.keys())
  .map((code) => ({ id: COUNTRY + code, label: COUNTRY_NAMES[code] ?? code.toUpperCase() }))
  .sort((a, b) => a.label.localeCompare(b.label));

const PROVIDERS: Record<string, string> = {
  pluto: 'Pluto TV',
  samsung: 'Samsung TV Plus',
  rakuten: 'Rakuten TV',
  bbc: 'BBC',
  cctv: 'CCTV',
  cgtn: 'CGTN',
  rt: 'RT',
  ntv: 'NTV',
  pbs: 'PBS',
  cbsn: 'CBS News',
  abcnews: 'ABC News',
  firetv: 'Fire TV',
  tcl: 'TCL',
  bfm: 'BFM',
  groupem6: 'Groupe M6',
  groupecanalplus: 'Groupe Canal+',
  fashiontv: 'Fashion TV',
  traceplus: 'Trace+',
};

/** Sidebar group for a stream file: "Live TV" for the main file, the provider name for extras. */
function providerOf(path: string): string {
  const key = idOf(path).split('_')[1];
  if (!key) return 'Live TV';
  return PROVIDERS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Every stream of one country, filed by provider. The same channel listed twice becomes one channel with backup urls. */
async function countryChannels(code: string): Promise<ChannelData> {
  const paths = countryFiles.get(code);
  if (!paths) throw new Error('That country is no longer included in the app.');
  const texts = await Promise.all(paths.map((p) => streamFiles[p]()));
  const seenUrls = new Set<string>();
  const byKey = new Map<string, Channel>();
  const channels: Channel[] = [];
  texts.forEach((text, i) => {
    const group = providerOf(paths[i]);
    for (const c of parseM3U(text).channels) {
      if (seenUrls.has(c.url)) continue;
      seenUrls.add(c.url);
      const key = group + '|' + c.name + '|' + (c.tvgId ?? '');
      const twin = byKey.get(key);
      if (twin) {
        (twin.altUrls ??= []).push(c.url);
        continue;
      }
      const ch = { ...c, group };
      byKey.set(key, ch);
      channels.push(ch);
    }
  });
  if (!channels.length) throw new Error('The playlist is empty.');
  const groups = sortGroups(new Set(channels.map((c) => c.group)));
  // The main list first, then the providers A to Z
  return { channels, groups: groups.includes('Live TV') ? ['Live TV', ...groups.filter((g) => g !== 'Live TV')] : groups };
}

export function freeLabel(id: string): string | undefined {
  return [...FREE_PLAYLISTS, ...FREE_COUNTRIES].find((p) => p.id === id)?.label;
}

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
  const [parts, arab] = await Promise.all([
    Promise.all(FREE_PLAYLISTS.map(async (p) => ({ p, data: await freeChannels(p.id) }))),
    // Arab countries' own stream lists fill out the Arabic group (a country failing must not break Free TV)
    Promise.all(
      Array.from(ARAB_COUNTRIES)
        .filter((code) => countryFiles.has(code))
        .map((code) => countryChannels(code).catch(() => null)),
    ),
  ]);
  const seen = new Set<string>();
  const channels: Channel[] = [];
  for (const { p, data } of parts) {
    for (const c of data.channels) {
      if (seen.has(c.url)) continue; // same stream listed in two categories: keep the first
      seen.add(c.url);
      channels.push({ ...c, group: p.label, extraGroups: isArabic(c) ? [ARABIC] : undefined });
    }
  }
  for (const data of arab) {
    for (const c of data?.channels ?? []) {
      if (seen.has(c.url) || !isArabic(c)) continue;
      seen.add(c.url);
      channels.push({ ...c, group: ARABIC });
    }
  }
  const groups = sortGroups(new Set(channels.map((c) => c.group).filter((g) => g !== ARABIC)));
  // Arabic goes at the top of the sidebar
  const hasArabic = channels.some((c) => c.group === ARABIC || c.extraGroups);
  return { channels, groups: hasArabic ? [ARABIC, ...groups] : groups };
}

export async function freeChannels(id: string): Promise<ChannelData> {
  if (id === FREE_ALL) return allFreeChannels();
  if (id.startsWith(COUNTRY)) return countryChannels(id.slice(COUNTRY.length));
  const path = Object.keys(files).find((p) => idOf(p) === id);
  if (!path) throw new Error('That free playlist is no longer included in the app.');
  const data = parseM3U(await files[path]());
  if (!data.channels.length) throw new Error('The playlist is empty.');
  return data;
}

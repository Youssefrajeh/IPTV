import type { Channel, ChannelData } from '../types';

/** Small, fast string hash so channels get stable ids across reloads. */
export function hash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(s))) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** Find the comma that separates EXTINF attributes from the title (ignores commas inside quotes). */
function titleSplit(line: string): number {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ',' && !inQuote) return i;
  }
  return -1;
}

export const UNGROUPED = 'Uncategorized';

/** Parses an M3U / M3U8 (extended) playlist into channels. Handles CRLF, BOM, EXTGRP and missing headers. */
export function parseM3U(text: string): ChannelData {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const channels: Channel[] = [];
  const groupSet = new Set<string>();
  const seen = new Set<string>();
  let epgUrl: string | undefined;

  let pending: { name: string; attrs: Record<string, string>; group?: string } | null = null;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const a = parseAttrs(line);
      epgUrl = a['url-tvg'] || a['x-tvg-url'] || undefined;
      if (epgUrl && epgUrl.includes(',')) epgUrl = epgUrl.split(',')[0];
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      const comma = titleSplit(line);
      const head = comma >= 0 ? line.slice(0, comma) : line;
      const title = comma >= 0 ? line.slice(comma + 1).trim() : '';
      const attrs = parseAttrs(head);
      pending = { name: title || attrs['tvg-name'] || 'Unknown', attrs };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      if (pending) pending.group = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#')) continue; // EXTVLCOPT, KODIPROP, etc.

    // A url line
    const url = line;
    const attrs = pending?.attrs ?? {};
    const name = pending?.name ?? url.split('/').pop() ?? 'Stream';
    const group = (attrs['group-title'] || pending?.group || UNGROUPED).trim() || UNGROUPED;
    let id = hash(url);
    if (seen.has(id)) id = hash(url + name + channels.length);
    seen.add(id);

    channels.push({
      id,
      name,
      url,
      logo: attrs['tvg-logo'] || attrs['logo'] || undefined,
      group,
      tvgId: attrs['tvg-id'] || undefined,
    });
    groupSet.add(group);
    pending = null;
  }

  return { channels, groups: sortGroups(groupSet), epgUrl };
}

export function sortGroups(set: Iterable<string>): string[] {
  return Array.from(set).sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return a.localeCompare(b);
  });
}

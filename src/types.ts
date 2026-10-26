export type PlaylistSource =
  | { kind: 'm3u-url'; url: string; epgUrl?: string }
  | { kind: 'm3u-file'; fileName: string }
  | { kind: 'xtream'; server: string; username: string; password: string }
  | { kind: 'demo' };

export interface Playlist {
  id: string;
  name: string;
  source: PlaylistSource;
  addedAt: number;
  updatedAt?: number;
  channelCount?: number;
}

export interface Channel {
  /** Stable id inside its playlist (Xtream stream_id or hash of url) */
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  tvgId?: string;
  /** Xtream only, used for short EPG */
  streamId?: number;
  /** Fallback stream urls tried in order if `url` fails */
  altUrls?: string[];
}

export interface ChannelData {
  channels: Channel[];
  groups: string[];
  epgUrl?: string;
}

export interface EpgEntry {
  title: string;
  description?: string;
  start: number; // ms
  end: number; // ms
}

export type LayoutMode = 'auto' | 'tv' | 'standard';

export interface Settings {
  layout: LayoutMode;
  xtreamFormat: 'm3u8' | 'ts';
  autoplayLast: boolean;
}

export type Section = 'live' | 'favorites' | 'recent' | 'settings';

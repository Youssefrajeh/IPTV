import type { ChannelData, PlaylistSource, Settings } from '../types';
import { demoChannels } from './demo';
import { fetchText } from './http';
import { parseM3U } from './m3u';
import { xtreamLive, xtreamLogin } from './xtream';

/** Downloads + parses a playlist source. M3U files can't be refreshed (no remote copy). */
export async function loadSource(source: PlaylistSource, settings: Settings): Promise<ChannelData> {
  switch (source.kind) {
    case 'demo':
      return demoChannels();
    case 'm3u-url': {
      const text = await fetchText(source.url);
      if (!/#EXTINF|#EXTM3U/i.test(text.slice(0, 5000))) {
        throw new Error('That link did not return an M3U playlist.');
      }
      const data = parseM3U(text);
      if (!data.channels.length) throw new Error('The playlist is empty.');
      if (source.epgUrl) data.epgUrl = source.epgUrl;
      return data;
    }
    case 'xtream': {
      await xtreamLogin(source);
      const data = await xtreamLive(source, settings.xtreamFormat);
      if (!data.channels.length) throw new Error('This account has no live channels.');
      return data;
    }
    case 'm3u-file':
      throw new Error('Files can’t be refreshed. Remove the playlist and add the file again.');
  }
}

export function describeSource(source: PlaylistSource): string {
  switch (source.kind) {
    case 'demo':
      return 'Demo test streams';
    case 'm3u-url':
      try {
        return 'M3U · ' + new URL(source.url).host;
      } catch {
        return 'M3U link';
      }
    case 'm3u-file':
      return 'M3U file · ' + source.fileName;
    case 'xtream':
      return 'Xtream · ' + source.server.replace(/^https?:\/\//, '');
  }
}

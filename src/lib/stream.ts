/**
 * Attaches a stream to a <video> element, picking the right engine per platform:
 *   HLS (.m3u8): native (Safari/iOS/tvOS/Tizen/webOS) -> hls.js (MSE)
 *   MPEG-TS (.ts / extension-less live): mpegts.js (MSE) -> native
 *   MP4/WebM/other: native
 * If one URL fails, the next alternative URL is tried (e.g. Xtream .m3u8 -> .ts).
 */

type Kind = 'hls' | 'ts' | 'file';

export interface StreamHandle {
  destroy: () => void;
}

export interface StreamCallbacks {
  onError: (message: string) => void;
  onPlaying: () => void;
  onEngine?: (name: string) => void;
}

function kindOf(url: string): Kind {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8') || path.endsWith('.m3u') || /\/hls\//.test(path) || /format=m3u8/i.test(url)) return 'hls';
  if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mkv') || path.endsWith('.mov') || path.endsWith('.mp3') || path.endsWith('.aac')) return 'file';
  // .ts and extension-less IPTV live links are almost always MPEG-TS
  return 'ts';
}

function nativeHls(video: HTMLVideoElement): boolean {
  return !!video.canPlayType('application/vnd.apple.mpegurl') || !!video.canPlayType('application/x-mpegURL');
}

function hasMSE(): boolean {
  const w = window as unknown as { MediaSource?: unknown; ManagedMediaSource?: unknown };
  return !!(w.MediaSource || w.ManagedMediaSource);
}

type Engine = 'native' | 'hlsjs' | 'mpegts';

// Apple devices (Safari, iOS, iPadOS) play HLS natively and best; some Chromium builds claim
// native HLS support but fail, so everywhere else hls.js goes first.
const isApple = (() => {
  const ua = navigator.userAgent;
  return (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Safari/.test(ua))) && !/Chrome|Chromium|CriOS|Edg|Electron|Android/.test(ua);
})();

/** Every url x engine combination worth trying, best first. */
function planAttempts(video: HTMLVideoElement, urls: string[]): Array<{ url: string; engine: Engine }> {
  const out: Array<{ url: string; engine: Engine }> = [];
  const mse = hasMSE();
  for (const url of urls) {
    const kind = kindOf(url);
    let engines: Engine[];
    if (kind === 'hls') {
      engines = isApple || !mse ? ['native', 'hlsjs'] : ['hlsjs', 'native'];
      if (!nativeHls(video) && mse) engines = ['hlsjs', 'native'];
    } else if (kind === 'ts') {
      engines = mse ? ['mpegts', 'native'] : ['native'];
    } else {
      engines = ['native'];
    }
    if (!mse) engines = engines.filter((e) => e === 'native');
    engines.forEach((engine) => out.push({ url, engine }));
  }
  return out;
}

export function attachStream(video: HTMLVideoElement, urls: string[], cb: StreamCallbacks): StreamHandle {
  let destroyed = false;
  let cleanup: (() => void) | null = null;
  let index = 0;
  const attempts = planAttempts(video, urls);
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const clearStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
  };

  const resetVideo = () => {
    clearStall();
    cleanup?.();
    cleanup = null;
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      /* ignore */
    }
  };

  const fail = (msg: string) => {
    if (destroyed) return;
    index++;
    if (index < attempts.length) {
      resetVideo();
      start();
    } else {
      cb.onError(msg);
    }
  };

  const playNative = (url: string, label: string) => {
    cb.onEngine?.(label);
    const onErr = () => fail('This stream format is not supported on this device, or the stream is offline.');
    video.addEventListener('error', onErr);
    video.src = url;
    video.play().catch(() => {
      /* autoplay may need a user gesture; controls remain usable */
    });
    cleanup = () => video.removeEventListener('error', onErr);
  };

  const playHlsJs = async (url: string) => {
    const { default: Hls } = await import('hls.js');
    if (destroyed) return;
    if (!Hls.isSupported()) return fail('HLS is not supported here.');
    cb.onEngine?.('hls.js');
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
      maxBufferLength: 30,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 3,
    });
    let mediaRecoveries = 0;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
        mediaRecoveries++;
        hls.recoverMediaError();
        return;
      }
      fail(
        data.type === Hls.ErrorTypes.NETWORK_ERROR
          ? 'The stream could not be loaded. It may be offline, geo-blocked, or need a different format.'
          : 'This stream could not be decoded on this device.',
      );
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => undefined);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    cleanup = () => hls.destroy();
  };

  const playMpegts = async (url: string) => {
    const { default: mpegts } = await import('mpegts.js');
    if (destroyed) return;
    if (!mpegts.isSupported() || !mpegts.getFeatureList().mseLivePlayback) return fail('MPEG-TS is not supported here.');
    cb.onEngine?.('mpegts.js');
    const player = mpegts.createPlayer(
      { type: 'mpegts', isLive: true, url },
      {
        enableWorker: true,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 6,
        liveBufferLatencyMinRemain: 1,
        lazyLoad: false,
      },
    );
    player.on(mpegts.Events.ERROR, (type: string) => {
      fail(
        type === mpegts.ErrorTypes.NETWORK_ERROR
          ? 'The stream could not be loaded. It may be offline or the link has expired.'
          : 'This stream could not be decoded on this device.',
      );
    });
    player.attachMediaElement(video);
    player.load();
    Promise.resolve(player.play()).catch(() => undefined);
    cleanup = () => {
      try {
        player.pause();
        player.unload();
        player.detachMediaElement();
        player.destroy();
      } catch {
        /* ignore */
      }
    };
  };

  const start = () => {
    if (destroyed) return;
    const { url, engine } = attempts[index];
    // Give each attempt a deadline so dead links move on to the fallback
    clearStall();
    stallTimer = setTimeout(() => {
      if (video.readyState < 2) fail('The stream did not start. It may be offline.');
    }, 20000);

    try {
      if (engine === 'hlsjs') void playHlsJs(url).catch(() => fail('Could not start the HLS player.'));
      else if (engine === 'mpegts') void playMpegts(url).catch(() => fail('Could not start the MPEG-TS player.'));
      else playNative(url, kindOf(url) === 'hls' ? 'native HLS' : 'native');
    } catch {
      fail('Could not start playback.');
    }
  };

  const onPlaying = () => {
    clearStall();
    cb.onPlaying();
  };
  video.addEventListener('playing', onPlaying);

  if (!attempts.length) cb.onError('This channel has no stream address.');
  else start();

  return {
    destroy: () => {
      destroyed = true;
      video.removeEventListener('playing', onPlaying);
      resetVideo();
    },
  };
}

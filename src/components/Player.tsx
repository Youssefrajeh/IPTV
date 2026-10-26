import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, EpgEntry } from '../types';
import { attachStream } from '../lib/stream';
import { xtreamShortEpg, type XtreamCreds } from '../lib/xtream';
import { focusEl, focusFirst, handleArrow } from '../lib/spatialNav';
import { remoteAction } from '../lib/platform';
import { ChannelLogo } from './ChannelLogo';
import { Icon } from './Icon';

interface Props {
  channel: Channel;
  list: Channel[];
  isTV: boolean;
  isFavorite: (id: string) => boolean;
  xtream?: XtreamCreds;
  onToggleFavorite: (ch: Channel) => void;
  onChange: (ch: Channel) => void;
  onClose: () => void;
}

const HIDE_AFTER = 5000;

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

export function Player({ channel, list, isTV, isFavorite, xtream, onToggleFavorite, onChange, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [panel, setPanel] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [engine, setEngine] = useState('');
  const [epg, setEpg] = useState<EpgEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const index = list.findIndex((c) => c.id === channel.id);
  const step = useCallback(
    (delta: number) => {
      if (list.length < 2) return;
      const i = index < 0 ? 0 : index;
      onChange(list[(i + delta + list.length) % list.length]);
    },
    [index, list, onChange],
  );

  /* ---------- overlay visibility ---------- */
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setOverlay(false);
      setPanel(false);
    }, HIDE_AFTER);
  }, []);

  const show = useCallback(
    (focus = false) => {
      setOverlay(true);
      scheduleHide();
      if (focus) setTimeout(() => focusEl(root.current?.querySelector<HTMLElement>('[data-autofocus]')), 0);
    },
    [scheduleHide],
  );

  useEffect(() => {
    if (status !== 'playing' || panel) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setOverlay(true);
      return;
    }
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [status, panel, scheduleHide]);

  /* ---------- stream ---------- */
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    setStatus('loading');
    setError('');
    setEngine('');
    const handle = attachStream(v, [channel.url, ...(channel.altUrls ?? [])], {
      onError: (msg) => {
        setStatus('error');
        setError(msg);
      },
      onPlaying: () => setStatus('playing'),
      onEngine: setEngine,
    });
    return () => handle.destroy();
  }, [channel, attempt]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onPause = () => setPaused(true);
    const onPlay = () => setPaused(false);
    const onVol = () => setMuted(v.muted);
    v.addEventListener('pause', onPause);
    v.addEventListener('play', onPlay);
    v.addEventListener('volumechange', onVol);
    return () => {
      v.removeEventListener('pause', onPause);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('volumechange', onVol);
    };
  }, []);

  /* ---------- EPG (Xtream) ---------- */
  useEffect(() => {
    setEpg([]);
    if (!xtream || channel.streamId == null) return;
    let cancelled = false;
    const t = setTimeout(() => {
      xtreamShortEpg(xtream, channel.streamId!)
        .then((e) => !cancelled && setEpg(e))
        .catch(() => undefined);
    }, 400); // don't hammer the API while zapping
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [channel, xtream]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ---------- controls ---------- */
  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };
  const toggleMute = () => {
    const v = video.current;
    if (v) v.muted = !v.muted;
  };
  const toggleFullscreen = () => {
    const el = root.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      v?.webkitEnterFullscreen?.(); // iPhone
    }
  };

  /* ---------- keys (capture phase: player owns the remote while open) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = remoteAction(e);
      const isArrow = /^(Arrow)?(Up|Down|Left|Right)$/.test(e.key) || [37, 38, 39, 40].includes(e.keyCode);
      const isOk = e.key === 'Enter' || e.keyCode === 13;

      if (action === 'back') {
        e.preventDefault();
        e.stopPropagation();
        if (panel) {
          setPanel(false);
          show(true);
        } else if (overlay && status === 'playing') setOverlay(false);
        else onClose();
        return;
      }
      if (action === 'playpause') {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        show();
        return;
      }
      if (action === 'chup' || action === 'chdown') {
        e.preventDefault();
        e.stopPropagation();
        step(action === 'chup' ? -1 : 1);
        show();
        return;
      }
      if (action === 'yellow' || e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(channel);
        show();
        return;
      }
      if (e.key === 'm') {
        toggleMute();
        return;
      }

      if (!overlay) {
        // Overlay hidden: Up/Down zap, OK/Left/Right open controls
        if (isArrow || isOk) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'ArrowUp' || e.keyCode === 38) step(-1);
          else if (e.key === 'ArrowDown' || e.keyCode === 40) step(1);
          show(true);
        }
        return;
      }

      if (isArrow) {
        e.stopPropagation();
        handleArrow(e);
        scheduleHide();
      } else if (isOk) {
        scheduleHide();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [overlay, panel, status, step, channel, onClose, onToggleFavorite, show, scheduleHide]);

  // Focus controls when opened / after errors
  useEffect(() => {
    const t = setTimeout(() => root.current && focusFirst(root.current), 30);
    return () => clearTimeout(t);
  }, [status === 'error']);

  useEffect(() => {
    if (!panel) return;
    const t = setTimeout(() => {
      const cur = root.current?.querySelector<HTMLElement>('.zap__item.is-current');
      focusEl(cur ?? null);
    }, 30);
    return () => clearTimeout(t);
  }, [panel]);

  const current = epg.find((e) => e.start <= now && e.end > now) ?? epg[0];
  const nextProg = current ? epg[epg.indexOf(current) + 1] : undefined;
  const progress = current ? Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100)) : 0;
  const fav = isFavorite(channel.id);

  // Window of channels for the side panel (keeps DOM small on huge lists)
  const from = Math.max(0, index - 40);
  const zapList = list.slice(from, from + 120);

  return (
    <div
      className={'player' + (overlay ? ' show-ui' : '') + (isTV ? ' is-tv' : '')}
      ref={root}
      data-nav-trap
      onMouseMove={() => show()}
      onClick={(e) => {
        if (e.target === video.current || e.target === e.currentTarget) {
          if (overlay && status === 'playing' && !panel) setOverlay(false);
          else show();
        }
      }}
    >
      <video ref={video} className="player__video" playsInline autoPlay preload="auto" />

      {status === 'loading' && (
        <div className="player__center">
          <span className="spinner spinner--lg" />
        </div>
      )}

      {status === 'error' && (
        <div className="player__center">
          <div className="player__error" role="alert">
            <strong>Can’t play this channel</strong>
            <p>{error}</p>
            <div className="row">
              <button className="btn btn--primary" data-focusable data-autofocus onClick={() => setAttempt((a) => a + 1)}>
                <Icon name="refresh" /> Retry
              </button>
              {list.length > 1 && (
                <button className="btn" data-focusable onClick={() => step(1)}>
                  Next channel <Icon name="next" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="player__ui" aria-hidden={!overlay}>
        <div className="player__top">
          <button className="icon-btn icon-btn--glass" data-focusable onClick={onClose} aria-label="Back">
            <Icon name="back" />
          </button>
          <ChannelLogo name={channel.name} logo={channel.logo} />
          <div className="player__title">
            <strong>{channel.name}</strong>
            <span className="muted small">
              {channel.group}
              {index >= 0 && list.length > 1 && ` · ${index + 1}/${list.length}`}
            </span>
          </div>
          {engine && <span className="pill pill--glass small">{engine}</span>}
        </div>

        <div className="player__bottom">
          {current && (
            <div className="epg">
              <div className="epg__now">
                <span className="epg__time">{fmtTime(current.start)} – {fmtTime(current.end)}</span>
                <strong>{current.title}</strong>
              </div>
              <div className="epg__bar"><span style={{ width: progress + '%' }} /></div>
              {nextProg && (
                <div className="epg__next muted small">
                  Next {fmtTime(nextProg.start)} · {nextProg.title}
                </div>
              )}
            </div>
          )}
          <div className="controls">
            <button className="icon-btn icon-btn--glass" data-focusable onClick={() => step(-1)} aria-label="Previous channel" disabled={list.length < 2}>
              <Icon name="prev" />
            </button>
            <button className="icon-btn icon-btn--glass icon-btn--lg" data-focusable data-autofocus={status !== 'error' ? '' : undefined} onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
              <Icon name={paused ? 'play' : 'pause'} />
            </button>
            <button className="icon-btn icon-btn--glass" data-focusable onClick={() => step(1)} aria-label="Next channel" disabled={list.length < 2}>
              <Icon name="next" />
            </button>
            <span className="controls__spacer" />
            <button className="icon-btn icon-btn--glass" data-focusable onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              <Icon name={muted ? 'mute' : 'volume'} />
            </button>
            <button className={'icon-btn icon-btn--glass' + (fav ? ' is-on' : '')} data-focusable onClick={() => onToggleFavorite(channel)} aria-label={fav ? 'Remove favourite' : 'Add favourite'}>
              <Icon name="star" fill={fav} />
            </button>
            {list.length > 1 && (
              <button className={'icon-btn icon-btn--glass' + (panel ? ' is-on' : '')} data-focusable onClick={() => setPanel((p) => !p)} aria-label="Channel list">
                <Icon name="list" />
              </button>
            )}
            {!isTV && (
              <button className="icon-btn icon-btn--glass" data-focusable onClick={toggleFullscreen} aria-label="Fullscreen">
                <Icon name="fullscreen" />
              </button>
            )}
          </div>
        </div>
      </div>

      {panel && (
        <aside className="zap" data-nav-region="zap" aria-label="Channels">
          <h3 className="zap__title">{channel.group}</h3>
          <div className="zap__list">
            {zapList.map((c) => (
              <button
                key={c.id}
                className={'zap__item' + (c.id === channel.id ? ' is-current' : '')}
                data-focusable
                onClick={() => {
                  onChange(c);
                  scheduleHide();
                }}
              >
                <ChannelLogo name={c.name} logo={c.logo} />
                <span className="zap__name">{c.name}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

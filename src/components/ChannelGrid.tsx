import { useEffect, useRef, useState } from 'react';
import type { Channel } from '../types';
import { ChannelLogo } from './ChannelLogo';
import { Icon } from './Icon';

const PAGE = 120;

interface Props {
  channels: Channel[];
  favorites: Set<string>;
  showGroup?: boolean;
  emptyText: string;
  onPlay: (ch: Channel, list: Channel[]) => void;
  onToggleFavorite: (ch: Channel) => void;
  resetKey: string;
}

/**
 * Renders big lists in pages so TVs with weak CPUs stay responsive.
 * More cards are added when you scroll (or D-pad) near the end.
 */
export function ChannelGrid({ channels, favorites, showGroup, emptyText, onPlay, onToggleFavorite, resetKey }: Props) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });

  useEffect(() => setLimit(PAGE), [resetKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => Math.min(l + PAGE, channels.length));
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [channels.length, limit]);

  if (!channels.length) {
    return (
      <div className="empty">
        <Icon name="live" size="2.5rem" />
        <p>{emptyText}</p>
      </div>
    );
  }

  const visible = channels.slice(0, limit);

  const startPress = (ch: Channel) => {
    press.current.fired = false;
    press.current.timer = setTimeout(() => {
      press.current.fired = true;
      onToggleFavorite(ch);
      if (navigator.vibrate) navigator.vibrate(20);
    }, 550);
  };
  const endPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };

  return (
    <div className="grid" data-nav-region="grid" role="list">
      {visible.map((ch, i) => {
        const fav = favorites.has(ch.id);
        return (
          <button
            key={ch.id + i}
            role="listitem"
            className="card"
            data-focusable
            data-channel-id={ch.id}
            onClick={() => {
              if (press.current.fired) return;
              onPlay(ch, channels);
            }}
            onFocus={() => {
              if (i > limit - 12 && limit < channels.length) setLimit((l) => Math.min(l + PAGE, channels.length));
            }}
            onKeyDown={(e) => {
              // Yellow key, F or * toggles favourite
              if (e.keyCode === 405 || e.key === 'ColorF2Yellow' || e.key === 'f' || e.key === '*') {
                e.preventDefault();
                onToggleFavorite(ch);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onToggleFavorite(ch);
            }}
            onTouchStart={() => startPress(ch)}
            onTouchEnd={endPress}
            onTouchMove={endPress}
            title={ch.name}
          >
            <ChannelLogo name={ch.name} logo={ch.logo} />
            <span className="card__text">
              <span className="card__name">{ch.name}</span>
              {showGroup && <span className="card__group">{ch.group}</span>}
            </span>
            {fav && (
              <span className="card__fav" aria-label="Favourite">
                <Icon name="star" fill size="1em" />
              </span>
            )}
          </button>
        );
      })}
      {limit < channels.length && <div ref={sentinel} className="grid__sentinel" />}
    </div>
  );
}

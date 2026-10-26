import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, ChannelData, Playlist, PlaylistSource, Section, Settings } from './types';
import { defaultSettings, deleteChannels, keys, load, loadChannels, loadPlaylists, save, saveChannels, uid } from './lib/storage';
import { loadSource } from './lib/loader';
import { exitApp, platform, registerTVKeys, remoteAction, resolveTV } from './lib/platform';
import { focusFirst, handleArrow, installFocusMemory } from './lib/spatialNav';
import { AddPlaylist } from './components/AddPlaylist';
import { ALL, CategoryList } from './components/CategoryList';
import { ChannelGrid } from './components/ChannelGrid';
import { Icon } from './components/Icon';
import { Player } from './components/Player';
import { SettingsView } from './components/SettingsView';

const NAV: Array<{ key: Section; label: string; icon: string }> = [
  { key: 'live', label: 'Live TV', icon: 'live' },
  { key: 'favorites', label: 'Favourites', icon: 'star' },
  { key: 'recent', label: 'Recent', icon: 'clock' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaultSettings, ...load<Partial<Settings>>(keys.settings, {}) }));
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists);
  const [activeId, setActiveId] = useState<string | null>(() => load<string | null>(keys.activePlaylist, null));
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('live');
  const [group, setGroup] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [playing, setPlaying] = useState<{ channel: Channel; list: Channel[] } | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumed = useRef(false);

  const isTV = resolveTV(settings.layout);
  const active = playlists.find((p) => p.id === activeId) ?? playlists[0] ?? null;

  /* ---------- platform setup ---------- */
  // Set during render (idempotent) so child components can read it in their first effects
  document.documentElement.classList.toggle('tv', isTV);
  document.documentElement.classList.toggle('touch', !isTV && matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    registerTVKeys();
    return installFocusMemory();
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  /* ---------- persistence ---------- */
  useEffect(() => save(keys.settings, settings), [settings]);
  useEffect(() => save(keys.playlists, playlists), [playlists]);
  useEffect(() => save(keys.activePlaylist, active?.id ?? null), [active?.id]);

  useEffect(() => {
    if (!active) return;
    setFavorites(load<string[]>(keys.favorites(active.id), []));
    setRecent(load<string[]>(keys.recent(active.id), []));
  }, [active?.id]);

  /* ---------- load channels for the active playlist ---------- */
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setGroup(ALL);
    setQuery('');
    setLoadError('');
    if (!active) return;
    (async () => {
      setLoading(true);
      try {
        let d = await loadChannels(active.id);
        if (!d) {
          d = await loadSource(active.source, settings);
          await saveChannels(active.id, d);
        }
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const byId = useMemo(() => {
    const m = new Map<string, Channel>();
    data?.channels.forEach((c) => m.set(c.id, c));
    return m;
  }, [data]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    data?.channels.forEach((c) => m.set(c.group, (m.get(c.group) ?? 0) + 1));
    return m;
  }, [data]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const list = useMemo(() => {
    if (!data) return [];
    let base: Channel[];
    if (section === 'favorites') base = favorites.map((id) => byId.get(id)).filter(Boolean) as Channel[];
    else if (section === 'recent') base = recent.map((id) => byId.get(id)).filter(Boolean) as Channel[];
    else base = group === ALL ? data.channels : data.channels.filter((c) => c.group === group);
    const q = query.trim().toLowerCase();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [data, section, group, query, favorites, recent, byId]);

  /* ---------- actions ---------- */
  const play = useCallback(
    (channel: Channel, inList: Channel[]) => {
      setPlaying({ channel, list: inList });
      if (!active) return;
      save(keys.lastChannel(active.id), channel.id);
      setRecent((r) => {
        const next = [channel.id, ...r.filter((id) => id !== channel.id)].slice(0, 30);
        save(keys.recent(active.id), next);
        return next;
      });
    },
    [active],
  );

  const toggleFavorite = useCallback(
    (ch: Channel) => {
      if (!active) return;
      setFavorites((f) => {
        const has = f.includes(ch.id);
        const next = has ? f.filter((id) => id !== ch.id) : [...f, ch.id];
        save(keys.favorites(active.id), next);
        notify(has ? `Removed ${ch.name} from favourites` : `Added ${ch.name} to favourites`);
        return next;
      });
    },
    [active, notify],
  );

  // Resume last channel on startup
  useEffect(() => {
    if (resumed.current || !data || !active || !settings.autoplayLast) return;
    resumed.current = true;
    const last = byId.get(load<string>(keys.lastChannel(active.id), ''));
    if (last) setPlaying({ channel: last, list: data.channels.filter((c) => c.group === last.group) });
  }, [data, active, byId, settings.autoplayLast]);

  const addPlaylist = async (name: string, source: PlaylistSource, preloaded?: ChannelData) => {
    const d = preloaded ?? (await loadSource(source, settings));
    const p: Playlist = { id: uid(), name, source, addedAt: Date.now(), updatedAt: Date.now(), channelCount: d.channels.length };
    await saveChannels(p.id, d);
    setPlaylists((ps) => [...ps, p]);
    setActiveId(p.id);
    setAdding(false);
    setSection('live');
    notify(`${d.channels.length.toLocaleString()} channels loaded`);
  };

  const refreshPlaylist = async (id: string) => {
    const p = playlists.find((x) => x.id === id);
    if (!p) return;
    setRefreshing(id);
    try {
      const d = await loadSource(p.source, settings);
      await saveChannels(id, d);
      setPlaylists((ps) => ps.map((x) => (x.id === id ? { ...x, updatedAt: Date.now(), channelCount: d.channels.length } : x)));
      if (id === active?.id) setData(d);
      notify('Playlist updated');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(null);
    }
  };

  const deletePlaylist = async (id: string) => {
    const p = playlists.find((x) => x.id === id);
    if (!p) return;
    if (!isTV && !confirm(`Remove “${p.name}”?`)) return;
    await deleteChannels(id);
    setPlaylists((ps) => ps.filter((x) => x.id !== id));
    if (id === activeId) setActiveId(null);
    notify(`Removed ${p.name}`);
  };

  /* ---------- global remote / keyboard handling ---------- */
  const stateRef = useRef({ adding, query, section, playlists });
  stateRef.current = { adding, query, section, playlists };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = remoteAction(e);
      if (action === 'back') {
        const s = stateRef.current;
        e.preventDefault();
        if (s.adding && s.playlists.length) setAdding(false);
        else if (s.query) setQuery('');
        else if (s.section !== 'live') setSection('live');
        else exitApp();
        return;
      }
      if (action === 'red') return setSection('live');
      if (action === 'green') return setSection('favorites');
      if (action === 'blue') return setSection('settings');
      handleArrow(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Android hardware back button (phones, tablets, Android TV, Fire TV)
  useEffect(() => {
    if (!platform.isNative) return;
    let remove: (() => void) | undefined;
    import('@capacitor/app')
      .then(({ App: CapApp }) =>
        CapApp.addListener('backButton', () => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }).then((h) => (remove = () => h.remove())),
      )
      .catch(() => undefined);
    return () => remove?.();
  }, []);

  // Put focus somewhere sensible on TVs when the view changes
  useEffect(() => {
    if (!isTV || playing) return;
    const t = setTimeout(() => {
      const a = document.activeElement;
      if (!a || a === document.body) focusFirst();
    }, 60);
    return () => clearTimeout(t);
  }, [isTV, section, data, playing, adding]);

  // Return focus to the card that was playing
  const lastPlayed = useRef<string | null>(null);
  useEffect(() => {
    if (playing) {
      lastPlayed.current = playing.channel.id;
      return;
    }
    if (!lastPlayed.current) return;
    const id = lastPlayed.current;
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-channel-id="${CSS.escape ? CSS.escape(id) : id}"]`);
      if (el) el.focus();
      else focusFirst();
    }, 30);
  }, [playing]);

  /* ---------- render ---------- */
  if (!playlists.length) {
    return (
      <div className="app app--setup">
        <AddPlaylist firstRun onAdd={addPlaylist} />
        <Toast text={toast} />
      </div>
    );
  }

  const title = section === 'live' ? (group === ALL ? 'All channels' : group) : NAV.find((n) => n.key === section)!.label;
  const showSearch = section !== 'settings';

  return (
    <div className="app">
      <nav className="rail" data-nav-region="rail" aria-label="Main">
        <div className="rail__brand" aria-hidden="true">
          <Icon name="tv" size="1.5rem" />
        </div>
        {NAV.map((n) => (
          <button key={n.key} className={'rail__item' + (section === n.key ? ' is-active' : '')} data-focusable aria-current={section === n.key ? 'page' : undefined} onClick={() => setSection(n.key)}>
            <Icon name={n.icon} fill={n.icon === 'star' && section === n.key} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <main className={'main main--' + section}>
        <header className="top">
          <div className="top__title">
            <h1>{title}</h1>
            {active && <span className="muted small">{active.name}{section !== 'settings' && data ? ` · ${list.length.toLocaleString()} channels` : ''}</span>}
          </div>
          {showSearch && (
            <label className="search">
              <Icon name="search" />
              <input type="search" placeholder="Search channels" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search channels" enterKeyHint="search" />
              {query && (
                <button className="search__clear" data-focusable onClick={() => setQuery('')} aria-label="Clear search">
                  <Icon name="close" size="1em" />
                </button>
              )}
            </label>
          )}
        </header>

        {section === 'settings' ? (
          <SettingsView
            playlists={playlists}
            activeId={active?.id ?? null}
            settings={settings}
            refreshing={refreshing}
            isTV={isTV}
            onUse={(id) => {
              setActiveId(id);
              setSection('live');
            }}
            onRefresh={refreshPlaylist}
            onDelete={deletePlaylist}
            onAdd={() => setAdding(true)}
            onSettings={setSettings}
          />
        ) : loading ? (
          <div className="empty"><span className="spinner spinner--lg" /><p>Loading channels…</p></div>
        ) : loadError ? (
          <div className="empty">
            <p className="error">{loadError}</p>
            <div className="row">
              {active && active.source.kind !== 'm3u-file' && (
                <button className="btn btn--primary" data-focusable onClick={() => refreshPlaylist(active.id)}>
                  <Icon name="refresh" /> Try again
                </button>
              )}
              <button className="btn" data-focusable onClick={() => setSection('settings')}>Playlists</button>
            </div>
          </div>
        ) : data ? (
          <div className="browse">
            {section === 'live' && <CategoryList groups={data.groups} counts={counts} total={data.channels.length} active={group} onSelect={setGroup} />}
            <ChannelGrid
              channels={list}
              favorites={favSet}
              showGroup={section !== 'live' || group === ALL || !!query}
              resetKey={section + group + query + (active?.id ?? '')}
              emptyText={
                query ? `No channels match “${query}”.` : section === 'favorites' ? 'No favourites yet. Long-press a channel, right-click it, or press the yellow button / F.' : section === 'recent' ? 'Channels you watch show up here.' : 'No channels in this category.'
              }
              onPlay={play}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        ) : null}
      </main>

      {adding && (
        <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setAdding(false)}>
          <AddPlaylist onAdd={addPlaylist} onCancel={() => setAdding(false)} />
        </div>
      )}

      {playing && (
        <Player
          channel={playing.channel}
          list={playing.list}
          isTV={isTV}
          isFavorite={(id) => favSet.has(id)}
          xtream={active?.source.kind === 'xtream' ? active.source : undefined}
          onToggleFavorite={toggleFavorite}
          onChange={(ch) => play(ch, playing.list)}
          onClose={() => setPlaying(null)}
        />
      )}

      <Toast text={toast} />
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div className={'toast' + (text ? ' is-on' : '')} role="status" aria-live="polite">
      {text}
    </div>
  );
}

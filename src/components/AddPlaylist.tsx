import { useEffect, useRef, useState } from 'react';
import type { ChannelData, PlaylistSource } from '../types';
import { parseM3U } from '../lib/m3u';
import { normaliseServer } from '../lib/xtream';
import { focusFirst } from '../lib/spatialNav';
import { Icon } from './Icon';

function readFile(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsText(f);
  });
}

type Tab = 'xtream' | 'm3u-url' | 'm3u-file' | 'demo';

interface Props {
  onAdd: (name: string, source: PlaylistSource, preloaded?: ChannelData) => Promise<void>;
  onCancel?: () => void;
  firstRun?: boolean;
}

export function AddPlaylist({ onAdd, onCancel, firstRun }: Props) {
  const [tab, setTab] = useState<Tab>('xtream');
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // On TVs, focus the first control so the remote works immediately
    if (!document.documentElement.classList.contains('tv')) return;
    const t = setTimeout(() => root.current && focusFirst(root.current), 50);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    try {
      setBusy(true);
      if (tab === 'xtream') {
        if (!server || !username || !password) throw new Error('Enter the server, username and password.');
        const s = normaliseServer(server);
        await onAdd(name || s.replace(/^https?:\/\//, ''), { kind: 'xtream', server: s, username: username.trim(), password: password.trim() });
      } else if (tab === 'm3u-url') {
        if (!/^https?:\/\//i.test(url.trim())) throw new Error('Enter a full link starting with http:// or https://');
        let host = 'M3U playlist';
        try {
          host = new URL(url.trim()).host;
        } catch {
          /* keep default */
        }
        await onAdd(name || host, { kind: 'm3u-url', url: url.trim() });
      } else if (tab === 'm3u-file') {
        if (!file) throw new Error('Choose an .m3u or .m3u8 file.');
        const text = await readFile(file);
        const data = parseM3U(text);
        if (!data.channels.length) throw new Error('No channels found in that file.');
        await onAdd(name || file.name.replace(/\.(m3u8?|txt)$/i, ''), { kind: 'm3u-file', fileName: file.name }, data);
      } else {
        await onAdd('Demo streams', { kind: 'demo' });
      }
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'xtream', label: 'Xtream Codes' },
    { key: 'm3u-url', label: 'M3U link' },
    { key: 'm3u-file', label: 'M3U file' },
    { key: 'demo', label: 'Demo' },
  ];

  return (
    <form className="add" ref={root} onSubmit={submit} data-nav-trap>
      <header className="add__head">
        {firstRun ? (
          <div className="brand">
            <span className="brand__mark"><Icon name="tv" /></span>
            <div>
              <h1>Welcome</h1>
              <p className="muted">Add your IPTV subscription to start watching.</p>
            </div>
          </div>
        ) : (
          <>
            <h2>Add playlist</h2>
            {onCancel && (
              <button type="button" className="icon-btn" data-focusable onClick={onCancel} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
          </>
        )}
      </header>

      <div className="seg" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={'seg__btn' + (tab === t.key ? ' is-active' : '')}
            data-focusable
            data-autofocus={t.key === 'xtream' ? '' : undefined}
            onClick={() => {
              setTab(t.key);
              setError('');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="add__body">
        {tab !== 'demo' && (
          <label className="field">
            <span>Name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My TV" autoComplete="off" />
          </label>
        )}

        {tab === 'xtream' && (
          <>
            <label className="field">
              <span>Server URL</span>
              <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://provider.com:8080" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </label>
            </div>
          </>
        )}

        {tab === 'm3u-url' && (
            <label className="field">
              <span>Playlist link (.m3u / .m3u8)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/playlist.m3u" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </label>
        )}

        {tab === 'm3u-file' && (
          <label className="field file">
            <span>Playlist file</span>
            <input type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl,application/vnd.apple.mpegurl" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span className="muted small">{file ? file.name : 'Not available on most TVs. Use a link there instead.'}</span>
          </label>
        )}

        {tab === 'demo' && (
          <p className="muted">
            Loads a few public test streams so you can try the player on this screen. No subscription needed.
          </p>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <footer className="add__foot">
        {onCancel && !firstRun && (
          <button type="button" className="btn btn--ghost" data-focusable onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" data-focusable disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name={tab === 'demo' ? 'play' : 'plus'} />}
          {busy ? 'Loading channels…' : tab === 'demo' ? 'Load demo' : 'Add playlist'}
        </button>
      </footer>
      <p className="legal small muted">This app is a player only and includes no channels. Use streams you have the rights to watch.</p>
    </form>
  );
}

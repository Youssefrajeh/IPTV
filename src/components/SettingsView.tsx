import type { LayoutMode, Playlist, Settings } from '../types';
import { describeSource } from '../lib/loader';
import { platform } from '../lib/platform';
import { Icon } from './Icon';

interface Props {
  playlists: Playlist[];
  activeId: string | null;
  settings: Settings;
  refreshing: string | null;
  isTV: boolean;
  onUse: (id: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onSettings: (s: Settings) => void;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={'seg__btn' + (v === value ? ' is-active' : '')} aria-pressed={v === value} data-focusable onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function deviceName(isTV: boolean): string {
  if (platform.isTizen) return 'Samsung TV (Tizen)';
  if (platform.isWebOS) return 'LG TV (webOS)';
  if (platform.isFireTV) return 'Amazon Fire TV';
  if (platform.isElectron) return 'Desktop app';
  if (platform.isNative) return isTV ? 'Android TV app' : platform.isIOS ? 'iOS / iPadOS app' : 'Android app';
  return isTV ? 'TV browser' : 'Web browser';
}

export function SettingsView({ playlists, activeId, settings, refreshing, isTV, onUse, onRefresh, onDelete, onAdd, onSettings }: Props) {
  return (
    <div className="settings" data-nav-region="settings">
      <section className="panel">
        <div className="panel__head">
          <h2>Playlists</h2>
          <button className="btn btn--primary" data-focusable data-autofocus onClick={onAdd}>
            <Icon name="plus" /> Add
          </button>
        </div>
        {playlists.length === 0 && <p className="muted">No playlists yet.</p>}
        <ul className="plist">
          {playlists.map((p) => (
            <li key={p.id} className={'plist__item' + (p.id === activeId ? ' is-active' : '')}>
              <div className="plist__info">
                <strong>{p.name}</strong>
                <span className="muted small">
                  {describeSource(p.source)}
                  {p.channelCount != null && ` · ${p.channelCount.toLocaleString()} channels`}
                </span>
              </div>
              <div className="plist__actions">
                {p.id === activeId ? (
                  <span className="pill"><Icon name="check" size="1em" /> In use</span>
                ) : (
                  <button className="btn" data-focusable onClick={() => onUse(p.id)}>Use</button>
                )}
                {p.source.kind !== 'm3u-file' && (
                  <button className="icon-btn" data-focusable onClick={() => onRefresh(p.id)} aria-label={`Refresh ${p.name}`} disabled={refreshing === p.id}>
                    {refreshing === p.id ? <span className="spinner" /> : <Icon name="refresh" />}
                  </button>
                )}
                <button className="icon-btn icon-btn--danger" data-focusable onClick={() => onDelete(p.id)} aria-label={`Remove ${p.name}`}>
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Display</h2>
        <div className="setting">
          <div>
            <strong>Layout</strong>
            <p className="muted small">Auto picks the TV layout on Smart TVs and Android TV.</p>
          </div>
          <Seg<LayoutMode> value={settings.layout} options={[['auto', 'Auto'], ['standard', 'Standard'], ['tv', 'TV']]} onChange={(layout) => onSettings({ ...settings, layout })} />
        </div>
      </section>

      <section className="panel">
        <h2>Playback</h2>
        <div className="setting">
          <div>
            <strong>Xtream stream format</strong>
            <p className="muted small">HLS works on every device. MPEG-TS can start faster on Android and desktop. Refresh the playlist after changing.</p>
          </div>
          <Seg<'m3u8' | 'ts'> value={settings.xtreamFormat} options={[['m3u8', 'HLS'], ['ts', 'MPEG-TS']]} onChange={(xtreamFormat) => onSettings({ ...settings, xtreamFormat })} />
        </div>
        <div className="setting">
          <div>
            <strong>Resume last channel on start</strong>
          </div>
          <Seg<'on' | 'off'> value={settings.autoplayLast ? 'on' : 'off'} options={[['off', 'Off'], ['on', 'On']]} onChange={(v) => onSettings({ ...settings, autoplayLast: v === 'on' })} />
        </div>
      </section>

      <section className="panel">
        <h2>About</h2>
        <p>
          Created by <strong>Youssef Rajeh</strong> ·{' '}
          <a className="link" href="https://youssefrajeh.com" target="_blank" rel="noopener noreferrer" data-focusable>
            youssefrajeh.com
          </a>
        </p>
        <p className="muted small">
          Running as: {deviceName(isTV)} · Layout: {isTV ? 'TV' : 'Standard'}
        </p>
        <p className="muted small">Remote: arrows to move, OK to select, Back to go back. In the player, Up/Down or CH+/CH− change channel. Yellow key (or F) adds a favourite.</p>
      </section>
    </div>
  );
}

const paths: Record<string, string> = {
  live: 'M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm4-4 4 4 4-4',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4.5l3 2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3',
  back: 'M15 5l-7 7 7 7',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M7 4h3.5v16H7zm6.5 0H17v16h-3.5z',
  prev: 'M18 6l-8 6 8 6zM6 6v12',
  next: 'M6 6l8 6-8 6zM18 6v12',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zm12 -1a5 5 0 0 1 0 7m2.5-10a8.5 8.5 0 0 1 0 13',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zm12 0 5 5m0-5-5 5',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  tv: 'M3 5h18v12H3zM8 21h8',
};

const filled = new Set(['play', 'pause', 'prev', 'next']);

export function Icon({ name, size = '1.25em', fill }: { name: keyof typeof paths | string; size?: string; fill?: boolean }) {
  const isFilled = fill ?? filled.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={isFilled ? 'currentColor' : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={paths[name] ?? ''} />
    </svg>
  );
}

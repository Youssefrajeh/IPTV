import { useState } from 'react';

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9À-￿ ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '?').toUpperCase() + (words[1]?.[0] ?? '').toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function ChannelLogo({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <span className="logo">
        <img src={logo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="logo logo--fallback" style={{ ['--h' as string]: hue(name) }}>
      {initials(name)}
    </span>
  );
}

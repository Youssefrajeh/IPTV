import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yrajeh.iptvplayer',
  appName: 'IPTV Player',
  webDir: 'dist',
  android: {
    // Many IPTV providers serve plain http streams
    allowMixedContent: true,
  },
  plugins: {
    // Routes fetch() through native HTTP so provider playlists aren't blocked by CORS
    CapacitorHttp: { enabled: true },
  },
};

export default config;

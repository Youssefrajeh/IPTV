import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

/**
 * Development-only CORS proxy: /__proxy?url=<http(s) url>.
 * Lets you test provider playlists/APIs in a normal browser during `npm run dev` / `npm run preview`.
 * It is not part of the built app (installed apps don't need it).
 */
function devCorsProxy(): Plugin {
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/__proxy?')) return next();
    const target = new URL(req.url, 'http://local').searchParams.get('url') ?? '';
    if (req.method !== 'GET' || !/^https?:\/\//i.test(target)) {
      res.statusCode = 400;
      return res.end('Bad proxy request');
    }
    try {
      const r = await fetch(target, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (IPTV Player dev)' } });
      res.statusCode = r.status;
      const type = r.headers.get('content-type');
      if (type) res.setHeader('content-type', type);
      res.setHeader('access-control-allow-origin', '*');
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.statusCode = 502;
      res.end('Proxy error: ' + (e as Error).message);
    }
  };
  return {
    name: 'dev-cors-proxy',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

// base: './' so the built app works from file:// and inside TV/desktop packages.
// The legacy plugin adds a second, ES5 bundle for older Smart TVs
// (Samsung Tizen 2017+ ~Chromium 47-56, LG webOS 3/4 ~Chromium 38-53) that can't run ES modules.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    devCorsProxy(),
    legacy({
      targets: ['chrome >= 38', 'safari >= 11', 'samsung >= 5', 'defaults'],
      modernPolyfills: false,
    }),
  ],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
});

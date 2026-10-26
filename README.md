# IPTV Player

One app for **phones, tablets/iPad, laptops/desktops and TVs**. It's a React + TypeScript web app with a responsive layout and full TV remote (D-pad) support, packaged natively for each platform.

The app is a **player only**. It ships with no channels. Users add their own **Xtream Codes** login, **M3U link** or **M3U file**. (App stores reject IPTV apps that bundle channels.) A **Demo** option loads public test streams so you can try it.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (also on your network for phones/TVs)
```

- Open `http://localhost:5173/?tv` to force the **TV layout** in a browser, then use the arrow keys, Enter and Esc.
- Resize the window to see phone (< 700px), tablet (700–1099px) and laptop (≥ 1100px) layouts.

## Where it runs

| Device | How | Command |
|---|---|---|
| iPhone, iPad | Capacitor (iOS) | `npm run ios:add` once, then `npm run ios:open` (Xcode, Mac only) |
| Android phones & tablets | Capacitor (Android) | `npm run android:add` once, then `npm run android:open` |
| **Android TV, Google TV, Fire TV**, Sony/TCL/Philips/Xiaomi Android TVs | Same Android app (TV launcher, banner and remote support are added by `patch-android.mjs`) | same as Android |
| **Samsung TV** (Tizen 2017+) | Tizen web app | `npm run tizen:prepare`, then open `platforms/tizen/app` in Tizen Studio and build the `.wgt` |
| **LG TV** (webOS 3+) | webOS web app | `npm run webos:prepare`, then `ares-package platforms/webos/app` and `ares-install` |
| Windows, macOS, Linux | Electron | `npm run electron:prepare`, then `cd platforms/electron && npm install && npm start` (`npm run dist` makes installers) |
| Any browser / Chromebook | Web / installable PWA | `npm run build`, then host `dist/` |

**Not covered by this codebase:**
- **Apple TV (tvOS)** has no web view, so it needs a native Swift/SwiftUI app. The player logic (`src/lib/m3u.ts`, `xtream.ts`) ports easily.
- **Roku** apps must be written in BrightScript.
- Hisense VIDAA and Vizio also run web apps, but publishing there requires their partner programs. The Tizen/webOS build is the starting point.

## Project layout

```
src/
  App.tsx                 screens, state, remote/back handling
  components/
    AddPlaylist.tsx       Xtream / M3U link / M3U file / Demo
    CategoryList.tsx      sidebar on wide screens, chips on phone/tablet
    ChannelGrid.tsx       cards (grid) or rows (phone), renders in pages for big lists
    Player.tsx            video, auto-hiding controls, channel zapping, side channel list, EPG
    SettingsView.tsx      playlists, layout (Auto/Standard/TV), stream format
  lib/
    m3u.ts                M3U/M3U8 parser
    xtream.ts             Xtream Codes API (login, live categories/streams, short EPG)
    stream.ts             picks native HLS / hls.js / mpegts.js per device, with fallbacks
    spatialNav.ts         arrow-key focus navigation for TV remotes
    platform.ts           TV detection, Samsung/LG key codes, app exit
    storage.ts            settings in localStorage, channel lists in IndexedDB
platforms/                tizen, webos, electron packaging files
scripts/                  prepare/patch scripts for each platform
```

## Remote control

| Key | Browse | Player |
|---|---|---|
| Arrows | move focus | Up/Down change channel (when controls are hidden), otherwise move between buttons |
| OK / Enter | open | show controls |
| Back (Samsung 10009, LG 461, Android back, Esc) | clear search, go to Live TV, exit | close side list, hide controls, close player |
| CH+ / CH− / Page Up / Down | – | previous / next channel |
| Play/Pause | – | play / pause |
| Yellow / F | add favourite | add favourite |
| Red / Green / Blue | Live TV / Favourites / Settings | – |

Touch: long-press a channel to add it to favourites. Mouse: right-click.

## Streams and CORS

- Inside the **installed apps** (Capacitor, Electron, Tizen, webOS), provider playlists and APIs load normally.
- In a **plain web browser**, many providers block cross-site requests (CORS), and browsers block `http://` streams on `https://` pages. Use the installed apps, or run your own small proxy if you need a hosted web version.
- Xtream accounts default to **HLS (.m3u8)**, which plays everywhere including iPhone/iPad. MPEG-TS (.ts) is available in Settings. If one format fails, the player tries the other automatically.

## Before publishing

- Change the ids: `capacitor.config.ts` (`appId`), `platforms/tizen/config.xml`, `platforms/webos/appinfo.json`, `platforms/electron/package.json`.
- Replace the icons in `public/`, `platforms/*/` and `scripts/assets/tv-banner.png`.
- Decide whether to keep the Demo option (`src/lib/demo.ts`) in store builds.
- Store listings should say the app contains no content and needs the user's own subscription.

## Ideas for next steps

- Full TV guide (XMLTV) parsed in a Web Worker
- Movies and Series for Xtream (`get_vod_streams`, `get_series`)
- Catch-up / timeshift for channels with `tv_archive`
- Parental PIN for selected categories
- Number keys to jump to a channel

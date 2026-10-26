import type { ChannelData } from '../types';
import { parseM3U } from './m3u';

/**
 * Public test streams (published by Apple, Mux and others for player testing) so the app
 * can be tried without a provider. Remove or keep it out of store builds if you prefer.
 */
const DEMO = `#EXTM3U
#EXTINF:-1 tvg-id="demo.bipbop" group-title="Test Streams",Apple BipBop (HLS, adaptive)
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 tvg-id="demo.mux" group-title="Test Streams",Mux Big Buck Bunny (HLS)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="demo.tears" group-title="Test Streams",Tears of Steel (HLS)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
#EXTINF:-1 tvg-id="demo.sintel" group-title="Movies (Blender)",Sintel (HLS)
https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8
#EXTINF:-1 tvg-id="demo.bbb" group-title="Movies (Blender)",Big Buck Bunny (MP4)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
#EXTINF:-1 tvg-id="demo.ed" group-title="Movies (Blender)",Elephants Dream (MP4)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4
`;

export function demoChannels(): ChannelData {
  return parseM3U(DEMO);
}

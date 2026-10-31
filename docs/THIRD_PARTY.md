# Third-party components

Music Video Studio source code is MIT licensed. Packaged components retain their own licenses.

- Electron: MIT, Chromium and other bundled components: see LICENSE and LICENSES.chromium.html in the portable folder. https://www.electronjs.org/
- React / React DOM: MIT. https://github.com/facebook/react
- Lucide: ISC. https://github.com/lucide-icons/lucide
- Windows FFmpeg: @ffmpeg-installer/win32-x64 4.1.0, a third-party static build. See resources/tools/package.json and README.md for its binary version, upstream build and licensing information. https://www.npmjs.com/package/@ffmpeg-installer/win32-x64
- FFmpeg: LGPL/GPL depending on enabled components. This binary includes libx264 and is GPL. https://ffmpeg.org/legal.html — https://ffmpeg.org/download.html
- x264: GPL. https://www.videolan.org/developers/x264.html

The FFmpeg executable runs as a separate process. This repository's MIT license does not relicense FFmpeg. Before redistributing binaries, provide corresponding FFmpeg/x264 source and build information as required by the binary's license; this prototype ZIP is a development artifact, not a completed public release. The installer package references the third-party build in its metadata. A future public release should use a maintained FFmpeg build with archived corresponding source and build scripts.

The included demo audio is synthesized by scripts/generate-demo.mjs and is covered by this repository's MIT license.

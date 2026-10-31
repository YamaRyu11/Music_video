# Music Video Studio

WAV / MP3 から、音に反応するフルHD動画をつくるWindows向けデスクトップアプリ。
**ZIPを展開してEXEを起動する、インストール不要のフォルダ型ポータブル版**です。

## 初版の機能

- 音源のドラッグ＆ドロップ・ファイル選択・オリジナルのサンプル音源
- 音量（RMS）・アタック（スペクトルの立ち上がり）・48帯域の周波数解析
- Neon Orbit / Spectrum / Particle Flow の3スタイル
- 横1920×1080 / 縦1080×1920、30fps
- 色・反応の強さ・滑らかさ・曲名・アーティスト名の調整
- 音声付きMP4（H.264 / yuv420p / AAC）出力、進捗・キャンセル
- オフラインで動作。音源は外部に送信しません

音源は250 MB以下・10分以内。ジャケット画像、GPUエンコード、60fps、設定の保存は初版には含みません。

## 開発

Node.js 22.12以降（この環境では24）とnpmを使用します。

```sh
npm ci
npm run dev
```

`npm run dev` はViteとElectronを起動します。デスクトップの起動にはGUIセッションが必要です。
メインプロセス・preloadの変更後は再起動してください。React画面の変更は自動反映されます。

GUIのない環境で画面だけを確認する場合:

```sh
npm run dev:web
```

ブラウザ版は音源解析・プレビュー専用です。MP4出力はElectron版で利用できます。

プロキシ環境でElectronの取得に失敗する場合は、既存のプロキシを維持して
`ELECTRON_GET_USE_PROXY=1 npm ci` を使用します。TLS・チェックサム検証を無効にしないでください。

## 検証

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

- ユニットテスト: FFTの周波数検出、無音、音量差、アタック、位相反転ステレオ、IPC入力検証。
- エンコードテスト: 同梱FFmpegで実際に生成したMP4を`ffprobe`で検査します。開発機には`ffprobe`を用意してください。
- ブラウザ操作テスト: 音源読み込み・再生・シーク・3スタイル・縦横切替・不正ファイルの処理。
- Chromiumは標準で`/usr/bin/chromium`を使用します。別の環境では`CHROMIUM_PATH`に実行ファイルを指定してください。

## Windows x64 のZIPを作る

```sh
npm run dist:win
```

成果物: `release/MusicVideoStudio-0.1.0-Windows-x64.zip`

ElectronとWindows用FFmpegを含めてパッケージングします。Linux上でのクロスビルドにも対応し、
Windows用FFmpegの取得時にはロックファイルのSHA-512を照合します。ビルドは公開・アップロードを行いません。
ZIPを**すべて展開**し、`Music Video Studio.exe`を起動します。アプリフォルダは書き込み可能な場所に置いてください。
設定・キャッシュ用の`data/`がEXEの隣に作られます。

初版は未署名です。Windows実機での起動・日本語パス・WAV/MP3・両方向の出力確認は配布前に必要です。
公開配布向けのFFmpegソース同梱・ライセンス対応は[第三者コンポーネント](docs/THIRD_PARTY.md)を参照してください。

## 構成

- `src/audio/`: Web Workerでオフライン解析（Hann窓、2048点FFT、60Hz特徴量）。ステレオは各チャンネルのエネルギーを保持。
- `src/visuals/`: Canvas 2Dによる描画。時間とシードから決まるため、シーク・プレビュー・出力で再現可能。
- `src/render-worker.ts`: 非表示のElectronウィンドウで、各フレームを正確な時刻に描画。
- `electron/`: ファイル選択、制限付きIPC、FFmpegへのバックプレッシャー付きフレーム送信、出力管理。
- `scripts/`: 開発起動、ビルド、サンプル音源生成、Windows依存ファイル準備。

WebGLではなくCanvas 2Dを初版で採用しています。フレームはJPEG品質97%でFFmpegへ渡すため、
中間処理は非可逆です。プレビューは縮小描画、出力はフルHD。描画負荷が高くても映像の時刻は音源に同期します。
書き出しは一時ファイルへ行い、正常完了後に保存先へ移動します。キャンセル時は一時ファイルを削除します。

## Git

通常は`main`から`feat/...`や`fix/...`を切り、検証後にコミット・マージします。
生成物・依存ファイル・テスト出力はGitの対象外です。ZIPはGitにコミットしません。
クラウドタスクは既に分離された環境なので、通常は既存チェックアウトで作業し、worktreeは作成しません。

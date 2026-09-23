禁欲タイマー v1

収録ファイル:
- index.html: 画面の骨組み
- styles.css: 見た目
- app.js: タイマー・記録・保存・バックアップの処理
- manifest.webmanifest: ホーム画面アプリとしての設定
- sw.js: オフライン用キャッシュ
- icons/: ホーム画面アイコン

公開先として GitHub Pages 等の HTTPS 静的ホスティングを想定しています。
記録データは localStorage に保存し、サーバーへ送信しません。

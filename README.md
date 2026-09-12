# Libdoc — 図書館ダッシュボード

豊島区・新宿区・中野区の区立図書館について、複数アカウントの予約・貸出状況を自動取得し、1画面のダッシュボードにまとめて表示します。

また、指定した図書館の休館日情報も表示します。

詳細な仕様は [`要件.md`](要件.md) を参照してください。

## 対応図書館

| 区 | システム | アカウント数 |
|---|---|---|
| 豊島区 | 独自サイト（CLIS系） | 2（本人 / 家族） |
| 新宿区 | WINJ系 | 2（本人 / 家族） |
| 中野区 | LiCS-Re SaaS | 1（本人） |

## セットアップ

```bash
npm install
npx playwright install chromium
```

## 認証情報

ローカル実行時はプロジェクト直下の `.env`（Git 管理外）に `LIBRARY_ACCOUNTS` を設定します。

```env
LIBRARY_ACCOUNTS="[
  {\"library\":\"toshima\",\"user\":\"本人\",\"id\":\"利用者ID\",\"pw\":\"パスワード\"},
  {\"library\":\"shinjuku\",\"user\":\"本人\",\"id\":\"利用者ID\",\"pw\":\"パスワード\"},
  {\"library\":\"nakano\",\"user\":\"本人\",\"id\":\"利用者ID\",\"pw\":\"パスワード\"}
]"
```

- `user` の値（本人 / 家族）がダッシュボード上の表示名になります。実名は使用しません。
- GitHub Actions では同じ内容を Secrets の `LIBRARY_ACCOUNTS` に登録します。

## 実行

```bash
npm run fetch-and-build
```

- 各区にログインして予約・貸出情報を取得
- 正規化・重複予約検知を実行
- 指定した図書館の休館日情報を計算
- `docs/index.html`（ダッシュボード）と `docs/data.json`（取得データ）を生成

### ローカル確認

ダッシュボードは `data.json` を `fetch` で読み込むため、`docs/index.html` をエクスプローラーやエディタから直接開くと（`file://`）データ取得に失敗します。HTTP サーバー経由で開いてください。

```bash
npx --yes serve docs
```

表示された URL（例: `http://localhost:3000`）をブラウザで開きます。

### 休館日情報

デフォルトで以下の図書館の休館日を表示します：

- **千早図書館臨時窓口（豊島区）**: 改築工事により、旧千早児童館跡地に臨時窓口を設置。第1火曜、第4金曜が休館日
- **西落合図書館（新宿区）**: 毎週月曜、第3木曜（館内整理日）
- **中野東図書館（中野区）**: 第2木曜、最終金曜（館内整理日）

休館日は各図書館の公式カレンダーページから自動取得し、祝日による変更も含めて正確に表示します。次の休館日がダッシュボードに表示されます。

対象図書館を変更する場合は、`src/index.ts`の`targetLibraries`配列を編集してください。

## 定期実行 / 公開

`.github/workflows/fetch.yml` により GitHub Actions で次のタイミングに実行し、生成した `docs/` を GitHub Pages へデプロイします。

- `main` への push（PR マージ含む）
- おおよそ日本時間 6時 / 12時 / 15時 / 18時に実行されるよう調整したスケジュール
- Actions タブからの手動実行

公開リポジトリでは GitHub 側の混雑で `schedule` が遅れるため、cron は目標より早め（JST 4 / 9 / 11 / 13 時 = UTC 19 / 0 / 2 / 4）に設定しています。遅れ幅は日によって変わるので、実測がずれたら再度調整してください。

`docs/index.html` と `docs/data.json` は `.gitignore` 対象のためリポジトリには含めず、毎回ワークフローが生成してデプロイします。

GitHub Pages の Source は **GitHub Actions** にしてください（Deploy from a branch だと、マージ時に空の `docs/` だけで再公開されてサイトが消えます）。

60日間リポジトリへの push（コミット）がないと、GitHub 側でスケジュール実行が自動停止します。停止した場合は、Actions タブからワークフローを再有効化するか、何らかの push を行ってください。

## 構成

```
src/
├── adapters/
│   ├── toshima.ts / toshima-list.ts   豊島区（CLIS系）
│   ├── shinjuku.ts / winj-list.ts     新宿区（WINJ系）
│   ├── nakano.ts / nakano-list.ts     中野区（LiCS-Re）
│   └── index.ts                       アダプター振り分け
├── config.ts    LIBRARY_ACCOUNTS の読み込み
├── merge.ts     正規化・重複検知
├── build.ts     HTML / JSON 生成
├── types.ts     共通型
└── index.ts     エントリポイント
docs/            GitHub Pages 公開フォルダ（生成物）
```

## メンテナンス

各区のサイト構造が変わった場合は、対応するアダプター（`src/adapters/`）のセレクタのみ修正します。取得ロジックは区ごとに分離されているため、影響範囲は局所的です。

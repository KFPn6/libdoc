# Libdoc — 図書館ダッシュボード

豊島区・新宿区・中野区の区立図書館について、複数アカウントの予約・貸出状況を自動取得し、1画面のダッシュボードにまとめて表示します。

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
- `docs/index.html`（ダッシュボード）と `docs/data.json`（取得データ）を生成

## 定期実行 / 公開

`.github/workflows/fetch.yml` により GitHub Actions で 1日1回（および手動）実行し、`docs/` を GitHub Pages へデプロイします。

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

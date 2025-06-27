# Notion to Slack Notifications

NotionデータベースでチェックされたページをSlackに通知するCloud Functions。

## 機能

- ✅ Notionの「通知する」チェックボックス検出
- ✅ 「お知らせ」プロパティの内容をタイトルとして使用
- ✅ @channelメンション付きSlack通知
- ✅ インタラクティブボタン（既読・Open in Notion）
- ✅ Google Cloud Secret Manager連携
- ✅ Docker開発環境

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

```bash
cp .env.example .env
# .envを編集して実際の値を設定
```

### 3. Secret Manager登録

```bash
./register-secrets.sh
```

### 4. Cloud Functions デプロイ

```bash
gcloud functions deploy notion-slack-notify \
  --runtime nodejs20 \
  --trigger-http \
  --entry-point notifySlack \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=your-project-id
```

### 5. Slack App設定

詳細は `SLACK_APP_SETUP.md` を参照してください。

## 開発

### ローカル開発

```bash
docker-compose up --build
```

### テスト

```bash
curl http://localhost:8080/
```

## ファイル構成

```
├── src/
│   ├── index.js       # Cloud Functions エントリポイント
│   ├── notion.js      # Notion API 処理
│   ├── slack.js       # Slack 通知処理
│   └── interactive.js # インタラクティブ要素処理
├── Dockerfile         # Docker設定
├── docker-compose.yml # 開発環境
└── package.json       # 依存関係
```

## 必要な権限・設定

- Notion Integration Token
- Notion Database ID
- Slack Webhook URL
- Slack Signing Secret
- Google Cloud Secret Manager権限

## ライセンス

MIT
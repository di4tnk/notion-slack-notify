# Slack App設定手順

インタラクティブ要素（ボタン）を有効にするには、Slack Appの設定が必要です。

## 1. Slack Appの作成

1. [Slack API](https://api.slack.com/apps)にアクセス
2. 「Create New App」→「From scratch」を選択
3. App名とワークスペースを設定

## 2. Incoming Webhooksの設定

1. 左メニューから「Incoming Webhooks」を選択
2. 「Activate Incoming Webhooks」をONに設定
3. 「Add New Webhook to Workspace」で通知チャンネルを選択
4. Webhook URLを `.env` の `SLACK_WEBHOOK_URL` に設定

## 3. Interactive Components（重要）

1. 左メニューから「Interactivity & Shortcuts」を選択
2. 「Interactivity」をONに設定
3. **Request URL**に以下を設定：
   ```
   https://your-cloud-function-url/
   ```
   例: `https://us-central1-your-project.cloudfunctions.net/notion-slack-notify`

## 4. Event Subscriptions（必要に応じて）

1. 左メニューから「Event Subscriptions」を選択
2. 「Enable Events」をONに設定
3. Request URLを同じURLに設定

## 5. OAuth & Permissions

1. 左メニューから「OAuth & Permissions」を選択
2. 以下のBot Token Scopesを追加：
   - `chat:write`
   - `chat:write.public`
   - `incoming-webhook`

## 6. Signing Secret

1. 左メニューから「Basic Information」を選択
2. 「App Credentials」の「Signing Secret」をコピー
3. Secret Managerまたは環境変数 `SLACK_SIGNING_SECRET` に設定

## 7. アプリのインストール

1. 「OAuth & Permissions」ページで「Install to Workspace」
2. 権限を承認

## 8. 環境変数設定

```bash
# Secret Manager設定
gcloud secrets create SLACK_SIGNING_SECRET --data-file=- <<< "your_signing_secret"

# または .env ファイル
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## インタラクティブ機能

設定完了後、以下の機能が利用可能：

- **既読ボタン**: クリックすると「○○が既読マークしました」に変更
- **Open in Notionボタン**: Notionページへ直接リンク
- **@channelメンション**: チャンネル全体への通知

## テスト

```bash
curl -X POST http://localhost:8080/
```

ボタンをクリックして応答を確認してください。
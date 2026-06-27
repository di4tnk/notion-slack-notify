# デプロイ手順

## 目次

1. [前提条件](#1-前提条件)
2. [Notion 設定](#2-notion-設定)
3. [Slack App 設定](#3-slack-app-設定)
4. [Secret Manager へのシークレット登録](#4-secret-manager-へのシークレット登録)
5. [Cloud Functions デプロイ](#5-cloud-functions-デプロイ)
6. [Slack Interactivity URL の設定](#6-slack-interactivity-url-の設定)
7. [Notion オートメーション設定](#7-notion-オートメーション設定)
8. [テストから本番への切り替え](#8-テストから本番への切り替え)
9. [ローカル開発での検証](#9-ローカル開発での検証)

---

## 1. 前提条件

### ツール
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) がインストール済み
- Node.js 20 以上（ローカル開発時）
- Docker / Docker Compose（ローカル開発時）

### GCP の準備

```bash
# ログインとプロジェクト設定
gcloud auth login
gcloud config set project YOUR_PROJECT_ID  # 例: studiokaren

# 課金が有効になっていることを確認
gcloud billing projects describe YOUR_PROJECT_ID

# 必要な API を有効化
gcloud services enable \
  cloudfunctions.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Cloud Functions サービスアカウントに Secret Manager 権限を付与

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 2. Notion 設定

### 2-1. Notion Integration の作成

1. [Notion Integrations](https://www.notion.so/my-integrations) を開く
2. **「+ 新しいインテグレーション」** をクリック
3. 名前（例: `GCF Notion Notify`）、ワークスペースを設定して作成
4. 表示された **「内部インテグレーションシークレット（`secret_...`）」** をコピー → `.env` の `NOTION_TOKEN` に設定

### 2-2. データベースにインテグレーションを接続

1. お知らせデータベースを開く
2. 右上「**…**」→「**接続**」→ 作成したインテグレーションを追加

### 2-3. データベースのプロパティ確認・追加

以下のプロパティがデータベースに存在することを確認してください（なければ追加）：

| プロパティ名 | 型 | 用途 |
|-------------|-----|------|
| `通知する` | チェックボックス | 通知トリガー |
| `最終通知日時` | 日付 | 重複送信防止（空＝未通知） |
| `既読者` | テキスト（リッチテキスト） | 既読ボタンを押したユーザー名を追記 |
| `既読数` | 数値 | 既読した人数（自動インクリメント） |

> プロパティ名を変更している場合は `.env` の `NOTION_NOTIFY_PROPERTY` 等で対応してください。

### 2-4. データベース ID の取得

データベースを Web ブラウザで開いたときの URL：
```
https://www.notion.so/YOUR_WORKSPACE/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                     これがデータベースID
```
この値を `.env` の `NOTION_DATABASE_ID` に設定。

---

## 3. Slack App 設定

詳細は `SLACK_APP_SETUP.md` を参照。要点：

1. [Slack API](https://api.slack.com/apps) で App を作成
2. **OAuth & Permissions** → Bot Token Scopes に `chat:write` と `chat:write.public` を追加
3. **Install to Workspace** → **Bot User OAuth Token（`xoxb-...`）** を `.env` の `SLACK_BOT_TOKEN` に設定
4. **Basic Information** → **Signing Secret** を `.env` の `SLACK_SIGNING_SECRET` に設定
5. Interactivity の Request URL はデプロイ後に設定（手順 6）

---

## 4. Secret Manager へのシークレット登録

```bash
cd ~/dev/gcp/gcf-notion-slack-notify

# .env.example をコピーして実際の値を入力
cp .env.example .env
# エディタで .env を編集

# Secret Manager に一括登録（create / update 両対応）
./register-secrets.sh
```

登録されるシークレット：
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`

> **注意**: `.env` ファイルは `.gitignore` に含まれています。絶対にコミットしないでください。

---

## 5. Cloud Functions デプロイ

### テスト環境（#development-test チャンネル）

```bash
gcloud functions deploy notion-slack-notify \
  --gen2 \
  --runtime nodejs20 \
  --region asia-northeast1 \
  --trigger-http \
  --entry-point notifySlack \
  --source . \
  --allow-unauthenticated \
  --timeout 60s \
  --memory 256Mi \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project),SLACK_CHANNEL=development-test"
```

### デプロイ後に Function URL を確認

```bash
gcloud functions describe notion-slack-notify \
  --region asia-northeast1 \
  --format='value(serviceConfig.uri)'
```

例: `https://asia-northeast1-studiokaren.cloudfunctions.net/notion-slack-notify`

### 動作確認

```bash
FUNCTION_URL=$(gcloud functions describe notion-slack-notify \
  --region asia-northeast1 \
  --format='value(serviceConfig.uri)')

curl -X POST "$FUNCTION_URL"
```

---

## 6. Slack Interactivity URL の設定

デプロイ後、既読ボタンが機能するよう Slack App に URL を設定します。

1. [Slack API](https://api.slack.com/apps) → 対象 App を選択
2. 左メニュー「**Interactivity & Shortcuts**」
3. **Interactivity** を **ON**
4. **Request URL** に Function URL を設定：
   ```
   https://asia-northeast1-studiokaren.cloudfunctions.net/notion-slack-notify
   ```
5. 「**Save Changes**」

---

## 7. Notion オートメーション設定

お知らせ DB の「通知する」チェックがONになったとき、自動的に Cloud Function を呼び出すよう設定します。

### Notion オートメーション（Notion 標準機能）

1. お知らせデータベースを開く
2. 右上「**…**」→「**オートメーションを追加**」
3. トリガー設定：
   - **トリガー**: 「プロパティが編集されたとき」
   - **プロパティ**: 「通知する」
   - **条件**: 「チェックマークがオンのとき」
4. アクション設定：
   - **アクション**: 「HTTPリクエストを送信」
   - **URL**: Cloud Functions の URL
   - **メソッド**: `POST`
   - **ヘッダー**: `Content-Type: application/json`
   - **ボディ**: `{}` （空でもOK、Function 側はクエリ不要）

> **既存オートメーションとの競合に注意**:  
> Notion の標準オートメーションで Slack に直接投稿している場合は、それを **停止または削除** してください。二重通知になります。

---

## 8. テストから本番への切り替え

`#development-test` で十分な動作確認が取れたら、本番チャンネルに切り替えます。

```bash
# 本番環境へ再デプロイ（チャンネルのみ変更）
gcloud functions deploy notion-slack-notify \
  --gen2 \
  --runtime nodejs20 \
  --region asia-northeast1 \
  --trigger-http \
  --entry-point notifySlack \
  --source . \
  --allow-unauthenticated \
  --timeout 60s \
  --memory 256Mi \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project),SLACK_CHANNEL=general-announcements"
```

### 切り替えチェックリスト

- [ ] `#development-test` でボタン（既読・Open in Notion）が正常に動作することを確認
- [ ] Notion の「最終通知日時」が通知後に更新されることを確認
- [ ] Notion の「既読者」「既読数」が既読ボタン後に更新されることを確認
- [ ] 既存の Notion → Slack 直接投稿オートメーションを停止（二重通知防止）
- [ ] `SLACK_CHANNEL=general-announcements` で再デプロイ
- [ ] テスト用お知らせを1件 `#general-announcements` に通知して確認

---

## 9. ローカル開発での検証

```bash
cd ~/dev/gcp/gcf-notion-slack-notify
cp .env.example .env
# .env に実際の値を入力

# Docker で起動
docker-compose up --build

# 別ターミナルでテストリクエスト
# 通常の通知処理（Notionから未通知ページを取得してSlackに送信）
curl -X POST http://localhost:8080/

# 既読インタラクションのシミュレーション（SLACK_SIGNING_SECRET 未設定時は dev mode でスキップ）
curl -X POST http://localhost:8080/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode 'payload={"type":"block_actions","actions":[{"action_id":"mark_read","value":"YOUR_NOTION_PAGE_ID"}],"user":{"id":"U123","name":"testuser","real_name":"テストユーザー"}}'
```

> ローカルでは `NODE_ENV=development` かつ `SLACK_SIGNING_SECRET` が未設定の場合、署名検証をスキップします。

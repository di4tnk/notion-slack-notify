const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { updateLastNotifiedAt } = require('./notion');

let secretManagerClient = null;

async function getSecret(secretName) {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'studiokaren';
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await secretManagerClient.accessSecretVersion({ name });
  return version.payload.data.toString();
}

async function getSlackBotToken() {
  return process.env.SLACK_BOT_TOKEN || await getSecret('SLACK_BOT_TOKEN');
}

// チャンネルは SLACK_CHANNEL 環境変数で切り替え可能
// テスト: development-test / 本番: general-announcements
function getSlackChannel() {
  return process.env.SLACK_CHANNEL || 'development-test';
}

async function sendSlackMessage(botToken, channel, page) {
  const payload = {
    channel,
    text: `<!channel> *システム*が*:bulb: お知らせ*へ追加`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<!channel> *システム*が*:bulb: お知らせ*へ追加`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📢 *${page.title}*\n\n問題なければ既読ボタンを押してください。`
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in Notion', emoji: true },
          value: page.id,
          url: page.url,
          action_id: 'open_notion'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ 既読', emoji: true },
            // value にNotionページIDを入れてインタラクション時にNotionを更新できるようにする
            value: page.id,
            action_id: 'mark_read',
            style: 'primary'
          }
        ]
      }
    ]
  };

  const response = await axios.post('https://slack.com/api/chat.postMessage', payload, {
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });

  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }

  return { success: true, ts: response.data.ts, channel: response.data.channel };
}

async function sendSlackNotifications(pages) {
  const botToken = await getSlackBotToken();
  const channel = getSlackChannel();
  console.log(`Sending to channel: ${channel}`);
  const results = [];

  for (const page of pages) {
    console.log(`Sending notification for: ${page.title}`);
    try {
      const result = await sendSlackMessage(botToken, channel, page);

      // 送信成功後に最終通知日時を書き込む（重複送信ガード）
      try {
        await updateLastNotifiedAt(page.id);
      } catch (notionError) {
        console.error(`Failed to update 最終通知日時 for ${page.id}:`, notionError.message);
      }

      results.push({ pageId: page.id, title: page.title, ...result });
      console.log(`Successfully sent notification for: ${page.title}`);
    } catch (error) {
      console.error(`Failed to send notification for: ${page.title} — ${error.message}`);
      results.push({ pageId: page.id, title: page.title, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = { sendSlackNotifications };

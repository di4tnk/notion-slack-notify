const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

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

async function sendSlackMessage(webhookUrl, page) {
  try {
    const payload = {
      text: `<!channel> *システム*が*:bulb: お知らせ*へ追加`,
      username: 'Notion Bot',
      icon_emoji: ':memo:',
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<!channel> *システム*が*:bulb: お知らせ*へ追加`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📢 *${page.title}*\n\n問題なければ既読ボタンを押してください。`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open in Notion",
              emoji: true
            },
            value: "open_notion",
            url: page.url,
            action_id: "open_notion"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ 既読",
                emoji: true
              },
              value: "mark_read",
              action_id: "mark_read",
              style: "primary"
            }
          ]
        }
      ]
    };

    const response = await axios.post(webhookUrl, payload);
    
    return { success: true, status: response.status };
  } catch (error) {
    console.error('Error sending Slack message:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendSlackNotifications(pages) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || await getSecret('SLACK_WEBHOOK_URL');
  const results = [];
  
  for (const page of pages) {
    console.log(`Sending notification for: ${page.title}`);
    
    const result = await sendSlackMessage(webhookUrl, page);
    results.push({
      pageId: page.id,
      title: page.title,
      ...result
    });
    
    if (result.success) {
      console.log(`Successfully sent notification for: ${page.title}`);
    } else {
      console.error(`Failed to send notification for: ${page.title} - ${result.error}`);
    }
  }
  
  return results;
}

module.exports = {
  sendSlackNotifications
};
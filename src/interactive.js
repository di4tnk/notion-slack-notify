const crypto = require('crypto');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

let secretManagerClient = null;

async function getSecret(secretName) {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  
  const [version] = await secretManagerClient.accessSecretVersion({ name });
  return version.payload.data.toString();
}

function verifySlackRequest(body, timestamp, signature) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const computedSignature = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

async function handleSlackInteraction(payload) {
  console.log('Received interaction:', JSON.stringify(payload, null, 2));

  const { type, actions, user, response_url } = payload;

  if (type === 'block_actions' && actions) {
    const action = actions[0];
    
    switch (action.action_id) {
      case 'mark_read':
        return {
          response_type: 'in_channel',
          replace_original: true,
          text: `✅ ${user.name}が既読マークしました`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *${user.name}*が既読マークしました`
              }
            }
          ]
        };
        
      case 'open_notion':
        // Notion リンクのクリックは自動的に処理される
        return {
          response_type: 'ephemeral',
          text: 'Notionページを開いています...'
        };
        
      default:
        return {
          response_type: 'ephemeral',
          text: '不明なアクションです'
        };
    }
  }

  return {
    response_type: 'ephemeral',
    text: 'サポートされていないインタラクションです'
  };
}

module.exports = {
  verifySlackRequest,
  handleSlackInteraction
};
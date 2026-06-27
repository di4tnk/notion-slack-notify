const crypto = require('crypto');
const { markPageAsRead } = require('./notion');

// Slack署名検証。GCFはreq.rawBodyを提供するのでrawBodyStringを渡すこと
function verifySlackRequest(rawBodyString, timestamp, signature) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('SLACK_SIGNING_SECRET not set — skipping verification in dev mode');
      return true;
    }
    console.error('SLACK_SIGNING_SECRET is not configured');
    return false;
  }

  if (!timestamp || !signature) return false;

  const baseString = `v0:${timestamp}:${rawBodyString}`;
  const computedSignature = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(computedSignature, 'utf8')
    );
  } catch {
    return false;
  }
}

async function handleSlackInteraction(payload) {
  console.log('Received interaction:', JSON.stringify(payload, null, 2));

  const { type, actions, user } = payload;

  if (type === 'block_actions' && actions && actions.length > 0) {
    const action = actions[0];

    switch (action.action_id) {
      case 'mark_read': {
        // action.value にNotionページIDが入っている（slack.jsで設定）
        const pageId = action.value;
        const userName = user.real_name || user.name || user.id;

        try {
          await markPageAsRead(pageId, userName);
        } catch (err) {
          // Notionの更新失敗はSlack側の応答に影響させない
          console.error('Failed to update Notion read status:', err.message);
        }

        return {
          response_type: 'in_channel',
          replace_original: true,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *${userName}* が既読マークしました`
              }
            }
          ]
        };
      }

      case 'open_notion':
        // URLボタンのクリックはSlack側で処理される
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

module.exports = { verifySlackRequest, handleSlackInteraction };

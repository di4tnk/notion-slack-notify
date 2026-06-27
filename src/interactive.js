const crypto = require('crypto');
const axios = require('axios');
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

// Slackインタラクションを処理し、response_url 経由でメッセージを更新する。
// index.js が res.status(200).send('') で即座にSlackへ応答した後に呼ばれる想定。
async function handleSlackInteraction(payload) {
  const { type, actions, user, message, response_url } = payload;

  if (type !== 'block_actions' || !actions?.length) return;

  const action = actions[0];

  // block_actions ペイロードの user オブジェクトには id / username / name / team_id しか含まれない。
  // real_name（例: 田中 大輔）はペイロードに存在しないため、現状は user.name（ハンドル名）を使用。
  // 表示名を取得するには users.info API を呼ぶ必要があるが、users:read スコープの追加と
  // Slack App 再インストールが必要になる。スコープを追加できる場合は以下のように取得できる:
  //   const info = await axios.get('https://slack.com/api/users.info', {
  //     headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  //     params: { user: user.id }
  //   });
  //   const displayName = info.data.user?.profile?.display_name || info.data.user?.real_name;
  const userName = user.real_name || user.name || user.username || user.id;

  if (action.action_id === 'mark_read') {
    const pageId = action.value;

    // Notionの既読者・既読数を更新
    let readerCount = 0;
    try {
      const result = await markPageAsRead(pageId, userName);
      readerCount = result.readerCount;
    } catch (err) {
      console.error('Failed to update Notion read status:', err.message);
    }

    // 元のブロックから actions を除去し、context フィードバックを末尾に追加
    const originalBlocks = message?.blocks ?? [];
    const updatedBlocks = [
      ...originalBlocks.filter(b => b.type !== 'actions'),
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `✅ *${userName}* が既読マークしました（既読 ${readerCount}人）`
        }]
      }
    ];

    // response_url に POST してSlackメッセージを更新
    // (HTTPレスポンスボディではなくこちらが確実に反映される)
    if (!response_url) {
      console.warn('No response_url in payload — cannot update Slack message');
      return;
    }

    try {
      await axios.post(response_url, {
        response_type: 'in_channel',
        replace_original: true,
        text: `✅ ${userName} が既読マークしました（既読 ${readerCount}人）`,
        blocks: updatedBlocks
      });
      console.log(`Slack message updated via response_url (page: ${pageId}, count: ${readerCount})`);
    } catch (err) {
      console.error('Failed to update Slack message via response_url:', err.message);
    }
  }

  // open_notion はURLボタンのためSlack側で自動処理、応答不要
}

module.exports = { verifySlackRequest, handleSlackInteraction };

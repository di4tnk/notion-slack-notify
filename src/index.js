const functions = require('@google-cloud/functions-framework');
const { getNotionPages } = require('./notion');
const { sendSlackNotifications } = require('./slack');
const { verifySlackRequest, handleSlackInteraction } = require('./interactive');

functions.http('notifySlack', async (req, res) => {
  // Slackインタラクティブ要素の処理（ボタンクリック時）
  if (req.method === 'POST' && req.body && req.body.payload) {
    try {
      const timestamp = req.headers['x-slack-request-timestamp'];
      const signature = req.headers['x-slack-signature'];

      // Slackの署名検証にはHTTPリクエストの生のbody文字列が必要。
      // GCFはreq.rawBodyを提供する。ローカルdevではurlencoded形式に再構築する。
      let rawBody;
      if (req.rawBody) {
        rawBody = req.rawBody.toString('utf8');
      } else {
        rawBody = new URLSearchParams(req.body).toString();
      }

      if (!verifySlackRequest(rawBody, timestamp, signature)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = JSON.parse(req.body.payload);
      const response = await handleSlackInteraction(payload);

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error handling Slack interaction:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // 通常の通知処理（Notionオートメーション or 手動HTTPトリガー）
  try {
    console.log('Starting Notion to Slack notification process...');

    const checkedPages = await getNotionPages();

    if (checkedPages.length === 0) {
      console.log('No pages to notify');
      return res.status(200).json({ message: '通知対象なし', count: 0 });
    }

    console.log(`Found ${checkedPages.length} pages to notify`);
    const results = await sendSlackNotifications(checkedPages);

    console.log('Notification process completed');
    return res.status(200).json({
      message: `${checkedPages.length}件の通知を送信しました`,
      count: checkedPages.length,
      results
    });

  } catch (error) {
    console.error('Error in notification process:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

const functions = require('@google-cloud/functions-framework');
const { getNotionPages } = require('./notion');
const { sendSlackNotifications } = require('./slack');
const { verifySlackRequest, handleSlackInteraction } = require('./interactive');

functions.http('notifySlack', async (req, res) => {
  // Slackからのインタラクティブ要素の処理
  if (req.method === 'POST' && req.body && req.body.payload) {
    try {
      // Slack署名検証
      const timestamp = req.headers['x-slack-request-timestamp'];
      const signature = req.headers['x-slack-signature'];
      const body = JSON.stringify(req.body);
      
      if (!verifySlackRequest(body, timestamp, signature)) {
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
  
  // 通常の通知処理
  try {
    console.log('Starting Notion to Slack notification process...');
    
    const checkedPages = await getNotionPages();
    
    if (checkedPages.length === 0) {
      console.log('No pages to notify');
      res.status(200).json({
        message: '通知対象なし',
        count: 0
      });
      return;
    }

    console.log(`Found ${checkedPages.length} pages to notify`);
    
    const results = await sendSlackNotifications(checkedPages);
    
    console.log('Notification process completed');
    res.status(200).json({
      message: `${checkedPages.length}件の通知を送信しました`,
      count: checkedPages.length,
      results: results
    });
    
  } catch (error) {
    console.error('Error in notification process:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
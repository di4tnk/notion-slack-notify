const { Client } = require('@notionhq/client');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

let notionClient = null;
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

async function initializeNotionClient() {
  if (!notionClient) {
    const notionToken = process.env.NOTION_TOKEN || await getSecret('NOTION_TOKEN');
    notionClient = new Client({
      auth: notionToken,
    });
  }
  return notionClient;
}

async function getNotionPages() {
  try {
    const notion = await initializeNotionClient();
    
    // 環境変数から直接取得（デバッグ用）
    let databaseId = process.env.NOTION_DATABASE_ID;
    
    console.log('Environment check:');
    console.log('NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID);
    console.log('GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT);
    
    if (!databaseId) {
      console.log('Trying to get from Secret Manager...');
      try {
        databaseId = await getSecret('NOTION_DATABASE_ID');
        console.log('Retrieved from Secret Manager:', databaseId);
      } catch (secretError) {
        console.error('Secret Manager error:', secretError.message);
        throw new Error('NOTION_DATABASE_ID not found in environment variables or Secret Manager');
      }
    }
    
    console.log('Using database ID:', databaseId);
    
    // まずデータベースの構造を取得してプロパティを確認
    const databaseInfo = await notion.databases.retrieve({ database_id: databaseId });
    console.log('Database properties:', Object.keys(databaseInfo.properties));
    
    // チェックボックスプロパティを探す
    let checkboxProperty = null;
    for (const [propName, propConfig] of Object.entries(databaseInfo.properties)) {
      if (propConfig.type === 'checkbox') {
        console.log(`Found checkbox property: ${propName}`);
        checkboxProperty = propName;
        break;
      }
    }
    
    if (!checkboxProperty) {
      throw new Error('No checkbox property found in the database. Please add a checkbox property for notifications.');
    }
    
    console.log('Querying Notion database...');
    
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: checkboxProperty,
        checkbox: {
          equals: true
        }
      }
    });

    console.log(`Found ${response.results.length} checked pages`);

    const pages = response.results.map(page => {
      // 「お知らせ」プロパティをタイトルとして使用
      const noticeProperty = page.properties['お知らせ'];
      let title = 'Untitled';
      
      if (noticeProperty) {
        if (noticeProperty.type === 'title' && noticeProperty.title.length > 0) {
          title = noticeProperty.title.map(text => text.plain_text).join('');
        } else if (noticeProperty.type === 'rich_text' && noticeProperty.rich_text.length > 0) {
          title = noticeProperty.rich_text.map(text => text.plain_text).join('');
        } else if (noticeProperty.type === 'text' && noticeProperty.text.length > 0) {
          title = noticeProperty.text.map(text => text.plain_text).join('');
        }
      }
      
      // フォールバック: 「お知らせ」がない場合は従来のタイトルプロパティを使用
      if (title === 'Untitled') {
        const titleProperty = page.properties['Name'] || page.properties['Title'] || page.properties['タイトル'];
        if (titleProperty) {
          if (titleProperty.type === 'title' && titleProperty.title.length > 0) {
            title = titleProperty.title.map(text => text.plain_text).join('');
          } else if (titleProperty.type === 'rich_text' && titleProperty.rich_text.length > 0) {
            title = titleProperty.rich_text.map(text => text.plain_text).join('');
          }
        }
      }

      return {
        id: page.id,
        title: title,
        url: page.url,
        lastEditedTime: page.last_edited_time
      };
    });

    return pages;
    
  } catch (error) {
    console.error('Error fetching Notion pages:', error);
    throw new Error(`Failed to fetch Notion pages: ${error.message}`);
  }
}

module.exports = {
  getNotionPages
};
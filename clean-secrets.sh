#!/bin/bash

echo "Cleaning up secrets to remove newlines..."

# 必要なシークレットをクリーンアップ
for secret in NOTION_TOKEN NOTION_DATABASE_ID SLACK_WEBHOOK_URL SLACK_SIGNING_SECRET; do
    if grep -q "^${secret}=" .env; then
        echo "Cleaning $secret..."
        VALUE=$(grep "^${secret}=" .env | cut -d '=' -f2 | tr -d '\n\r' | sed 's/^"//;s/"$//')
        echo -n "$VALUE" | gcloud secrets versions add "$secret" --data-file=-
        if [ $? -eq 0 ]; then
            echo "✅ $secret updated successfully"
        else
            echo "❌ Failed to update $secret"
        fi
    fi
done

echo "Cleanup completed!"
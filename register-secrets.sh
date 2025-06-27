#!/bin/bash

# .envファイルからSecret Managerにシークレットを登録するスクリプト

echo "Starting secret registration from .env file..."

# .envファイルの存在確認
if [ ! -f ".env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi

# 各行を読み取り
while IFS='=' read -r key value; do
  # コメント行と空行をスキップ
  if [[ $key =~ ^#.*$ ]] || [[ -z "$key" ]]; then
    continue
  fi
  
  # 値から引用符を削除（もしあれば）
  value=$(echo "$value" | sed 's/^"//;s/"$//')
  
  # 必要なシークレットのみ登録
  case $key in
    NOTION_TOKEN)
      echo "Registering $key..."
      echo "$value" | gcloud secrets create "$key" --data-file=-
      if [ $? -eq 0 ]; then
        echo "✅ $key registered successfully"
      else
        echo "❌ Failed to register $key"
      fi
      ;;
    NOTION_DATABASE_ID)
      echo "Registering $key..."
      echo "$value" | gcloud secrets create "$key" --data-file=-
      if [ $? -eq 0 ]; then
        echo "✅ $key registered successfully"
      else
        echo "❌ Failed to register $key"
      fi
      ;;
    SLACK_WEBHOOK_URL)
      echo "Registering $key..."
      echo "$value" | gcloud secrets create "$key" --data-file=-
      if [ $? -eq 0 ]; then
        echo "✅ $key registered successfully"
      else
        echo "❌ Failed to register $key"
      fi
      ;;
    SLACK_SIGNING_SECRET)
      echo "Registering $key..."
      echo "$value" | gcloud secrets create "$key" --data-file=-
      if [ $? -eq 0 ]; then
        echo "✅ $key registered successfully"
      else
        echo "❌ Failed to register $key"
      fi
      ;;
  esac
done < .env

echo ""
echo "Registration completed. Listing all secrets:"
gcloud secrets list
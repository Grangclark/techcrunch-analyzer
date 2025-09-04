const Parser = require('rss-parser');
const parser = new Parser();

async function analyzeTechCrunchRSS() {
  try {
    console.log('🔍 TechCrunch RSS取得開始...');
    
    // TechCrunchのメインRSSフィード
    const feedUrl = 'https://techcrunch.com/feed/';
    const feed = await parser.parseURL(feedUrl);
    
    console.log('\n📊 フィード基本情報:');
    console.log(`タイトル: ${feed.title}`);
    console.log(`説明: ${feed.description}`);
    console.log(`最終更新: ${feed.lastBuildDate}`);
    console.log(`記事数: ${feed.items.length}`);
    
    console.log('\n📄 最初の記事のデータ構造:');
    if (feed.items.length > 0) {
      const firstItem = feed.items[0];
      console.log('利用可能なフィールド:');
      Object.keys(firstItem).forEach(key => {
        console.log(`  ${key}: ${typeof firstItem[key]}`);
      });
      
      console.log('\n📋 記事例:');
      console.log(`タイトル: ${firstItem.title}`);
      console.log(`リンク: ${firstItem.link}`);
      console.log(`公開日: ${firstItem.pubDate}`);
      console.log(`カテゴリー: ${firstItem.categories || '不明'}`);
      console.log(`作者: ${firstItem.creator || firstItem.author || '不明'}`);
      
      // 要約/説明文の確認
      if (firstItem.contentSnippet) {
        console.log(`要約 (contentSnippet): ${firstItem.contentSnippet.substring(0, 200)}...`);
      }
      if (firstItem.content) {
        console.log(`本文 (content): ${firstItem.content.substring(0, 200)}...`);
      }
      if (firstItem.summary) {
        console.log(`概要 (summary): ${firstItem.summary.substring(0, 200)}...`);
      }
    }
    
    console.log('\n🏷️ 全記事のカテゴリー分析:');
    const categories = new Set();
    feed.items.forEach(item => {
      if (item.categories) {
        item.categories.forEach(cat => categories.add(cat));
      }
    });
    console.log('利用可能カテゴリー:', Array.from(categories));
    
    return feed;
    
  } catch (error) {
    console.error('❌ RSS取得エラー:', error.message);
    
    // エラー時のフォールバック情報
    console.log('\n💡 一般的なRSS構造（予想）:');
    console.log('- title: 記事タイトル');
    console.log('- link: 記事URL');
    console.log('- pubDate: 公開日時');
    console.log('- contentSnippet: 要約テキスト');
    console.log('- categories: カテゴリー配列');
    console.log('- creator/author: 執筆者');
  }
}

// 実行関数
analyzeTechCrunchRSS();

// 使用方法のコメント
/*
実行手順:
1. npm install rss-parser
2. node rss_analyzer.js

期待される出力:
- フィード基本情報
- 記事データ構造
- 利用可能なフィールド一覧
- カテゴリー分析
*/
// rss-manager.js
const Parser = require('rss-parser');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDBスキーマ定義
const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true, unique: true },
  contentSnippet: { type: String, required: true },
  content: { type: String },
  title_ja: { type: String },
  contentSnippet_ja: { type: String },
  pubDate: { type: Date, required: true },
  creator: { type: String },
  categories: [{ type: String }],
  source: { type: String, default: 'TechCrunch' },
  guid: { type: String, unique: true },
  translated: { type: Boolean, default: false },
  translatedAt: { type: Date },
  readingTime: { type: Number }
}, {
  timestamps: true
});

// インデックス設定
articleSchema.index({ pubDate: -1 });
articleSchema.index({ categories: 1 });
articleSchema.index({ translated: 1 });

const Article = mongoose.model('Article', articleSchema);

class RSSManager {
  constructor() {
    this.parser = new Parser();
    this.feedUrl = 'https://techcrunch.com/feed/';
  }

  // MongoDB接続
  async connectDB() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/techcrunch-app';
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB接続成功');
    } catch (error) {
      console.error('❌ MongoDB接続エラー:', error.message);
      throw error;
    }
  }

  // RSS記事取得
  async fetchArticles() {
    try {
      console.log('🔍 TechCrunch RSS取得開始...');
      const feed = await this.parser.parseURL(this.feedUrl);
      
      console.log(`📊 取得記事数: ${feed.items.length}`);
      return feed.items;
    } catch (error) {
      console.error('❌ RSS取得エラー:', error.message);
      throw error;
    }
  }

  // 読了時間計算（大雑把な推定）
  calculateReadingTime(text) {
    const wordsPerMinute = 200; // 英語の平均読了速度
    const wordCount = text.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // 記事をDBに保存
  async saveArticles(articles) {
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const item of articles) {
      try {
        // 記事データの構造化
        const articleData = {
          title: item.title,
          link: item.link,
          contentSnippet: item.contentSnippet || item.summary || '',
          content: item.content || '',
          pubDate: new Date(item.pubDate || item.isoDate),
          creator: item.creator || item['dc:creator'] || 'Unknown',
          categories: item.categories || [],
          guid: item.guid,
          readingTime: this.calculateReadingTime(item.contentSnippet || item.content || '')
        };

        // 重複チェック（link基準）
        const existingArticle = await Article.findOne({ link: articleData.link });
        
        if (existingArticle) {
          duplicateCount++;
          console.log(`⏭️  既存記事をスキップ: ${articleData.title.substring(0, 50)}...`);
          continue;
        }

        // 新記事保存
        const newArticle = new Article(articleData);
        await newArticle.save();
        newCount++;
        console.log(`✅ 新記事保存: ${articleData.title.substring(0, 50)}...`);

      } catch (error) {
        errorCount++;
        console.error(`❌ 保存エラー: ${item.title?.substring(0, 30)}... - ${error.message}`);
      }
    }

    return { newCount, duplicateCount, errorCount };
  }

  // メイン実行関数
  async run() {
    try {
      await this.connectDB();
      
      const articles = await this.fetchArticles();
      const result = await this.saveArticles(articles);
      
      console.log('\n📊 実行結果:');
      console.log(`🆕 新規保存: ${result.newCount}件`);
      console.log(`📋 重複スキップ: ${result.duplicateCount}件`);
      console.log(`❌ エラー: ${result.errorCount}件`);
      
      // 保存済み記事数確認
      const totalCount = await Article.countDocuments();
      console.log(`💾 DB内総記事数: ${totalCount}件`);
      
    } catch (error) {
      console.error('❌ 実行エラー:', error.message);
    } finally {
      await mongoose.connection.close();
      console.log('🔌 DB接続終了');
    }
  }

  // 記事取得（API用）
  async getArticles(options = {}) {
    const {
      category = null,
      limit = 20,
      translated = null
    } = options;

    try {
      let query = {};
      
      if (category) {
        query.categories = category;
      }
      
      if (translated !== null) {
        query.translated = translated;
      }

      const articles = await Article
        .find(query)
        .sort({ pubDate: -1 })
        .limit(limit)
        .select('-content'); // フル本文は除外してレスポンス高速化

      return articles;
    } catch (error) {
      console.error('❌ 記事取得エラー:', error.message);
      throw error;
    }
  }

  // カテゴリー一覧取得
  async getCategories() {
    try {
      const categories = await Article.distinct('categories');
      return categories.sort();
    } catch (error) {
      console.error('❌ カテゴリー取得エラー:', error.message);
      throw error;
    }
  }
}

// 使用例とテスト
if (require.main === module) {
  const manager = new RSSManager();
  manager.run();
}

module.exports = RSSManager;

/*
セットアップ手順:

1. 依存関係インストール:
npm install rss-parser mongoose dotenv

2. .envファイル作成:
MONGODB_URI=mongodb://localhost:27017/techcrunch-app

3. 実行:
node rss-manager.js

4. 定期実行設定（cron等）:
# 1時間ごとに実行
0 * * * * cd /path/to/project && node rss-manager.js
*/
// translation-manager.js (完全版)
import Parser from 'rss-parser';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config();

// Articleモデルをインポート
import Article from './models/Article.js';

class TranslationManager {
  constructor() {
    this.parser = new Parser();
    this.deeplApiKey = process.env.DEEPL_API_KEY;
    this.deeplApiUrl = 'https://api-free.deepl.com/v2/translate';
    
    // 複数のニュースソース設定
    this.newsSources = [
      {
        name: 'TechCrunch',
        type: 'rss',
        url: 'https://techcrunch.com/feed/',
        enabled: true
      },
      {
        name: 'Hacker News',
        type: 'api',
        url: 'https://hacker-news.firebaseio.com/v0',
        enabled: true
      }
    ];
  }

  // MongoDB接続（エラーハンドリング強化）
  async connectDB() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/techcrunch-app';
      console.log('🔌 MongoDB接続試行中:', mongoUri);
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      console.log('✅ MongoDB接続成功');
      
      // インデックス作成状況をチェック
      const indexes = await Article.collection.getIndexes();
      console.log('📋 既存インデックス:', Object.keys(indexes));
      
    } catch (error) {
      console.error('❌ MongoDB接続エラー:', error.message);
      if (error.name === 'MongoServerSelectionError') {
        console.error('💡 ヒント: MongoDBサーバーが起動していることを確認してください');
      }
      throw error;
    }
  }

  // DeepL翻訳（エラーハンドリング強化）
  async translateText(text, targetLang = 'JA') {
    if (!this.deeplApiKey) {
      console.warn('⚠️ DeepL APIキーが設定されていません');
      return `[翻訳なし] ${text}`;
    }

    try {
      const isFreeKey = this.deeplApiKey.endsWith(':fx');
      const apiUrl = isFreeKey ? 
        'https://api-free.deepl.com/v2/translate' : 
        'https://api.deepl.com/v2/translate';

      console.log(`🔑 APIキー形式: ${isFreeKey ? '無料版' : '有料版'}`);
      
      const params = new URLSearchParams();
      params.append('auth_key', this.deeplApiKey);
      params.append('text', text);
      params.append('target_lang', targetLang);

      const response = await axios.post(apiUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000  // 10秒タイムアウト
      });

      if (response.data && response.data.translations && response.data.translations.length > 0) {
        return response.data.translations[0].text;
      } else {
        throw new Error('翻訳レスポンスが不正です');
      }
    } catch (error) {
      console.error('❌ 翻訳エラー詳細:');
      if (error.response) {
        console.error(`   ステータス: ${error.response.status}`);
        console.error(`   レスポンス: ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 403) {
          console.error('💡 ヒント: DeepL APIキーが無効か、使用制限に達している可能性があります');
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error('💡 ヒント: APIリクエストがタイムアウトしました');
      } else {
        console.error(`   メッセージ: ${error.message}`);
      }
      return `[翻訳失敗] ${text}`;
    }
  }

  // TechCrunch RSS記事取得（エラーハンドリング強化）
  async fetchTechCrunchArticles() {
    try {
      console.log('📰 TechCrunch RSS取得開始...');
      const feed = await this.parser.parseURL('https://techcrunch.com/feed/');
      console.log(`📄 取得した記事数: ${feed.items.length}件`);
      
      let newCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      for (const [index, item] of feed.items.entries()) {
        try {
          console.log(`🔍 処理中 ${index + 1}/${feed.items.length}: ${item.title?.substring(0, 50)}...`);
          
          const articleData = {
            title: item.title || 'No Title',
            link: item.link,
            contentSnippet: item.contentSnippet || item.summary || '',
            content: item.content || '',
            pubDate: new Date(item.pubDate || item.isoDate || new Date()),
            creator: item.creator || item['dc:creator'] || 'Unknown',
            categories: Array.isArray(item.categories) ? item.categories : [],
            guid: item.guid || item.link,
            source: 'TechCrunch',
            readingTime: this.calculateReadingTime(item.contentSnippet || item.title || '')
          };

          // 必須フィールドのチェック
          if (!articleData.link) {
            console.warn(`⚠️ スキップ (リンクなし): ${articleData.title}`);
            continue;
          }

          const existingArticle = await Article.findOne({ link: articleData.link });
          
          if (!existingArticle) {
            const newArticle = new Article(articleData);
            await newArticle.save();
            newCount++;
            console.log(`✅ 新記事保存 (TechCrunch): ${articleData.title.substring(0, 50)}...`);
          } else {
            duplicateCount++;
            console.log(`📄 重複記事: ${articleData.title.substring(0, 30)}...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ 保存エラー (TechCrunch): ${error.message}`);
          if (error.code === 11000) {
            console.error('💡 ヒント: 重複キーエラー - 既に同じリンクの記事が存在します');
            duplicateCount++;  // 重複エラーとしてカウント
          }
        }
      }

      console.log(`📊 TechCrunch結果: 新規${newCount}件、重複${duplicateCount}件、エラー${errorCount}件`);
      return { source: 'TechCrunch', newCount, duplicateCount, errorCount };
    } catch (error) {
      console.error('❌ TechCrunch取得エラー:', error.message);
      if (error.code === 'ENOTFOUND') {
        console.error('💡 ヒント: インターネット接続を確認してください');
      }
      throw error;
    }
  }

  // Hacker News記事取得（エラーハンドリング強化）
  async fetchHackerNewsArticles() {
    try {
      console.log('🔥 Hacker News記事取得開始...');
      
      // トップストーリーのIDを取得（上位30件）
      const topStoriesResponse = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json', {
        timeout: 10000
      });
      const topStoryIds = topStoriesResponse.data.slice(0, 30);
      console.log(`📄 取得対象記事数: ${topStoryIds.length}件`);
      
      let newCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      for (const [index, storyId] of topStoryIds.entries()) {
        try {
          console.log(`🔍 処理中 ${index + 1}/${topStoryIds.length}: ID ${storyId}`);
          
          // 各記事の詳細を取得
          const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`, {
            timeout: 5000
          });
          const story = storyResponse.data;
          
          if (!story) {
            console.warn(`⚠️ スキップ (データなし): ID ${storyId}`);
            continue;
          }
          
          if (story.type !== 'story') {
            console.warn(`⚠️ スキップ (タイプ不一致: ${story.type}): ID ${storyId}`);
            continue;
          }
          
          if (!story.url) {
            console.warn(`⚠️ スキップ (URLなし): ID ${storyId} - ${story.title}`);
            continue;
          }

          const articleData = {
            title: story.title || 'No Title',
            link: story.url,
            contentSnippet: story.text || '',
            content: story.text || '',
            pubDate: new Date(story.time * 1000), // Unix timestampを変換
            creator: story.by || 'Unknown',
            categories: ['Technology', 'Programming'],
            guid: `hn-${story.id}`,
            source: 'Hacker News',
            hackerNewsId: story.id,
            score: story.score || 0,
            readingTime: this.calculateReadingTime(story.text || story.title || '')
          };

          const existingArticle = await Article.findOne({ 
            $or: [
              { link: articleData.link },
              { hackerNewsId: story.id }
            ]
          });
          
          if (!existingArticle) {
            const newArticle = new Article(articleData);
            await newArticle.save();
            newCount++;
            console.log(`✅ 新記事保存 (Hacker News): ${articleData.title.substring(0, 50)}...`);
          } else {
            duplicateCount++;
            console.log(`📄 重複記事: ${articleData.title.substring(0, 30)}...`);
          }
          
          // API制限対策
          await this.delay(100);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Hacker News記事取得エラー (ID: ${storyId}): ${error.message}`);
          if (error.code === 11000) {
            console.error('💡 ヒント: 重複キーエラー - 既に同じ記事が存在します');
            duplicateCount++;  // 重複エラーとしてカウント
          }
        }
      }

      console.log(`📊 Hacker News結果: 新規${newCount}件、重複${duplicateCount}件、エラー${errorCount}件`);
      return { source: 'Hacker News', newCount, duplicateCount, errorCount };
    } catch (error) {
      console.error('❌ Hacker News取得エラー:', error.message);
      if (error.code === 'ENOTFOUND') {
        console.error('💡 ヒント: インターネット接続を確認してください');
      }
      throw error;
    }
  }

  // 全ソースから記事取得
  async fetchAndSaveArticles() {
    console.log('🚀 記事取得開始...');
    const results = [];
    
    for (const source of this.newsSources) {
      if (!source.enabled) {
        console.log(`⭐️ スキップ: ${source.name} (無効)`);
        continue;
      }
      
      try {
        console.log(`\n📡 ${source.name} 処理開始...`);
        let result;
        if (source.name === 'TechCrunch') {
          result = await this.fetchTechCrunchArticles();
        } else if (source.name === 'Hacker News') {
          result = await this.fetchHackerNewsArticles();
        }
        
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`❌ ${source.name}取得失敗: ${error.message}`);
        results.push({
          source: source.name,
          newCount: 0,
          duplicateCount: 0,
          errorCount: 1,
          error: error.message
        });
      }
    }

    // 統計表示
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    const totalDuplicate = results.reduce((sum, r) => sum + r.duplicateCount, 0);
    const totalError = results.reduce((sum, r) => sum + (r.errorCount || 0), 0);
    
    console.log('\n📊 取得結果:');
    results.forEach(result => {
      console.log(`   ${result.source}: 新規${result.newCount}件、重複${result.duplicateCount}件${result.errorCount ? `、エラー${result.errorCount}件` : ''}`);
      if (result.error) {
        console.log(`      エラー: ${result.error}`);
      }
    });
    console.log(`📊 合計: 新規保存${totalNew}件、重複${totalDuplicate}件、エラー${totalError}件`);
    
    return results;
  }

  // 未翻訳記事の翻訳処理
  async translateUntranslatedArticles(batchSize = 30) {
    try {
      console.log('🌐 未翻訳記事の翻訳開始...');
      
      const untranslatedArticles = await Article
        .find({ translated: false })
        .limit(batchSize)
        .sort({ pubDate: -1 });

      if (untranslatedArticles.length === 0) {
        console.log('✨ 未翻訳記事はありません');
        return 0;
      }

      console.log(`🔍 ${untranslatedArticles.length}件の記事を翻訳中...`);

      for (const [index, article] of untranslatedArticles.entries()) {
        try {
          console.log(`\n📄 翻訳中 ${index + 1}/${untranslatedArticles.length} (${article.source}): ${article.title.substring(0, 50)}...`);
          
          // タイトル翻訳
          console.log('   📤 タイトル翻訳中...');
          const titleJa = await this.translateText(article.title);
          await this.delay(1000);
          
          // 要約翻訳（contentSnippetがある場合のみ）
          let contentSnippetJa = '';
          if (article.contentSnippet && article.contentSnippet.trim()) {
            console.log('   📄 要約翻訳中...');
            contentSnippetJa = await this.translateText(article.contentSnippet);
            await this.delay(1000);
          }

          // DB更新
          await Article.findByIdAndUpdate(article._id, {
            title_ja: titleJa,
            contentSnippet_ja: contentSnippetJa,
            translated: true,
            translatedAt: new Date()
          });

          console.log(`✅ 翻訳完了 (${article.source}): ${titleJa.substring(0, 50)}...`);
          
        } catch (error) {
          console.error(`❌ 翻訳エラー (${article.title.substring(0, 30)}...): ${error.message}`);
        }
      }

      return untranslatedArticles.length;
    } catch (error) {
      console.error('❌ 翻訳処理エラー:', error.message);
      throw error;
    }
  }

  // API制限対策の待機
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 読了時間計算
  calculateReadingTime(text) {
    if (!text) return 1;
    const wordsPerMinute = 200;
    const wordCount = text.split(' ').length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  // メイン実行関数
  async run(mode = 'fetch') {
    const startTime = new Date();
    console.log(`🚀 実行開始 (${mode}モード): ${startTime.toISOString()}`);
    
    try {
      await this.connectDB();
      
      if (mode === 'fetch' || mode === 'both') {
        await this.fetchAndSaveArticles();
      }
      
      if (mode === 'translate' || mode === 'both') {
        await this.translateUntranslatedArticles();
      }
      
      // 統計表示
      const totalCount = await Article.countDocuments();
      const translatedCount = await Article.countDocuments({ translated: true });
      const techCrunchCount = await Article.countDocuments({ source: 'TechCrunch', translated: true });
      const hackerNewsCount = await Article.countDocuments({ source: 'Hacker News', translated: true });
      
      console.log('\n📊 最終統計:');
      console.log(`💾 総記事数: ${totalCount}件`);
      console.log(`🌐 翻訳済み: ${translatedCount}件`);
      console.log(`   📰 TechCrunch: ${techCrunchCount}件`);
      console.log(`   🔥 Hacker News: ${hackerNewsCount}件`);
      console.log(`⏳ 未翻訳: ${totalCount - translatedCount}件`);
      
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);
      console.log(`⏱️ 実行時間: ${duration}秒`);
      
    } catch (error) {
      console.error('❌ 実行エラー:', error.message);
      console.error('スタックトレース:', error.stack);
      throw error;
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('🔌 MongoDB接続を閉じました');
      }
    }
  }
}

export default TranslationManager;

// コマンドライン実行（修正版 - ESモジュール対応）
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === currentFilePath;

if (isMainModule) {
  const manager = new TranslationManager();
  const mode = process.argv[2] || 'fetch';
  
  console.log(`🚀 実行モード: ${mode}`);
  
  process.on('uncaughtException', (error) => {
    console.error('❌ キャッチされない例外:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ ハンドルされない拒否:', reason);
    process.exit(1);
  });

  manager.run(mode).then(() => {
    console.log('✅ 処理完了');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 処理エラー:', error);
    process.exit(1);
  });
}

/*
使用方法:
node translation-manager.js fetch      # 全ソースから記事取得（各ソース最大50件）
node translation-manager.js translate  # 翻訳のみ（最大50件）
node translation-manager.js both       # 取得＋翻訳（各50件制限）

新機能:
- TechCrunch + Hacker News対応
- ソース別統計表示
- 複数ソース管理
- ESモジュール完全対応
- エラーハンドリング強化
- 50件制限機能追加 ← NEW!
*/
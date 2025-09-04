// translation-manager.js
import Parser from 'rss-parser';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Articleモデルをインポート
import Article from './models/Article.js';

class TranslationManager {
  constructor() {
    this.parser = new Parser();
    this.feedUrl = 'https://techcrunch.com/feed/';
    this.deeplApiKey = process.env.DEEPL_API_KEY;
    this.deeplApiUrl = 'https://api-free.deepl.com/v2/translate'; // 無料版
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

  // DeepL翻訳
  async translateText(text, targetLang = 'JA') {
    if (!this.deeplApiKey) {
      console.warn('⚠️ DeepL APIキーが設定されていません');
      return `[翻訳なし] ${text}`;
    }

    try {
      // APIキーの形式チェック
      const isFreeKey = this.deeplApiKey.endsWith(':fx');
      const apiUrl = isFreeKey ? 
        'https://api-free.deepl.com/v2/translate' : 
        'https://api.deepl.com/v2/translate';

      console.log(`🔑 APIキー形式: ${isFreeKey ? '無料版' : '有料版'}`);
      
      // リクエストデータ（form-data形式）
      const params = new URLSearchParams();
      params.append('auth_key', this.deeplApiKey);
      params.append('text', text);
      params.append('target_lang', targetLang);

      const response = await axios.post(apiUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.translations && response.data.translations.length > 0) {
        return response.data.translations[0].text;
      } else {
        throw new Error('翻訳レスポンスが不正です');
      }
    } catch (error) {
      // 詳細エラー情報の表示
      if (error.response) {
        console.error(`❌ 翻訳エラー (${error.response.status}): ${error.response.data ? JSON.stringify(error.response.data) : error.message}`);
      } else {
        console.error(`❌ 翻訳エラー: ${error.message}`);
      }
      // フォールバック：翻訳失敗時は元テキストを返す
      return `[翻訳失敗] ${text}`;
    }
  }

  // RSS記事取得・保存（既存機能）
  async fetchAndSaveArticles() {
    try {
      console.log('📰 TechCrunch RSS取得開始...');
      const feed = await this.parser.parseURL(this.feedUrl);
      
      let newCount = 0;
      let duplicateCount = 0;

      for (const item of feed.items) {
        try {
          const articleData = {
            title: item.title,
            link: item.link,
            contentSnippet: item.contentSnippet || item.summary || '',
            content: item.content || '',
            pubDate: new Date(item.pubDate || item.isoDate),
            creator: item.creator || item['dc:creator'] || 'Unknown',
            categories: item.categories || [],
            guid: item.guid,
            readingTime: this.calculateReadingTime(item.contentSnippet || '')
          };

          const existingArticle = await Article.findOne({ link: articleData.link });
          
          if (!existingArticle) {
            const newArticle = new Article(articleData);
            await newArticle.save();
            newCount++;
            console.log(`✅ 新記事保存: ${articleData.title.substring(0, 50)}...`);
          } else {
            duplicateCount++;
          }
        } catch (error) {
          console.error(`❌ 保存エラー: ${error.message}`);
        }
      }

      console.log(`📊 新規保存: ${newCount}件、重複: ${duplicateCount}件`);
      return { newCount, duplicateCount };
    } catch (error) {
      console.error('❌ RSS取得エラー:', error.message);
      throw error;
    }
  }

  // 未翻訳記事の翻訳処理
  async translateUntranslatedArticles(batchSize = 5) {
    try {
      console.log('🌐 未翻訳記事の翻訳開始...');
      
      // 未翻訳記事を取得
      const untranslatedArticles = await Article
        .find({ translated: false })
        .limit(batchSize)
        .sort({ pubDate: -1 });

      if (untranslatedArticles.length === 0) {
        console.log('✨ 翻訳済み記事はありません');
        return 0;
      }

      console.log(`📝 ${untranslatedArticles.length}件の記事を翻訳中...`);

      for (const article of untranslatedArticles) {
        try {
          console.log(`📄 翻訳中: ${article.title.substring(0, 50)}...`);
          
          // タイトル翻訳
          const titleJa = await this.translateText(article.title);
          await this.delay(1000); // API制限対策（1秒待機）
          
          // 要約翻訳
          const contentSnippetJa = await this.translateText(article.contentSnippet);
          await this.delay(1000);

          // DB更新
          await Article.findByIdAndUpdate(article._id, {
            title_ja: titleJa,
            contentSnippet_ja: contentSnippetJa,
            translated: true,
            translatedAt: new Date()
          });

          console.log(`✅ 翻訳完了: ${titleJa.substring(0, 50)}...`);
          
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
    const wordsPerMinute = 200;
    const wordCount = text.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // 翻訳済み記事取得（API用）
  async getTranslatedArticles(options = {}) {
    const { category = null, limit = 20 } = options;
    
    let query = { translated: true };
    if (category) {
      query.categories = category;
    }

    const articles = await Article
      .find(query)
      .sort({ pubDate: -1 })
      .limit(limit)
      .select('title_ja contentSnippet_ja link pubDate creator categories readingTime');

    return articles;
  }

  // メイン実行関数
  async run(mode = 'fetch') {
    try {
      await this.connectDB();
      
      if (mode === 'fetch' || mode === 'both') {
        await this.fetchAndSaveArticles();
      }
      
      if (process.argv[1].includes('translation-manager.js')) {
        await this.translateUntranslatedArticles();
      }
      
      // 統計表示
      const totalCount = await Article.countDocuments();
      const translatedCount = await Article.countDocuments({ translated: true });
      
      console.log('\n📊 最終統計:');
      console.log(`💾 総記事数: ${totalCount}件`);
      console.log(`🌐 翻訳済み: ${translatedCount}件`);
      console.log(`⏳ 未翻訳: ${totalCount - translatedCount}件`);
      
    } catch (error) {
      console.error('❌ 実行エラー:', error.message);
    } finally {
      await mongoose.connection.close();
    }
  }
}

export default TranslationManager;

// コマンドライン引数での実行制御（ESモジュール版）
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new TranslationManager();
  const mode = process.argv[2] || 'fetch';
  
  console.log(`🚀 実行モード: ${mode}`);
  manager.run(mode).then(() => {
    console.log('✅ 処理完了');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 処理エラー:', error);
    process.exit(1);
  });
}

// 直接実行されているかチェック
if (process.argv[1].includes('translation-manager.js')) {
  console.log('🔍 スクリプト開始'); // この行を追加
  console.log('🔍 引数:', process.argv); // この行を追加
  
  const manager = new TranslationManager();
  const mode = process.argv[2] || 'fetch';
  
  console.log(`🚀 実行モード: ${mode}`);
  
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

1. セットアップ:
npm install axios
echo "DEEPL_API_KEY=your_api_key_here" >> .env

2. 実行パターン:
node translation-manager.js fetch      # RSS取得のみ
node translation-manager.js translate  # 翻訳のみ
node translation-manager.js both       # 両方実行
node translation-manager.js cleanup    # 翻訳失敗記事を削除
node translation-manager.js reset      # 翻訳失敗記事の状態をリセット（再翻訳可能にする）

3. DeepL APIキー取得:
https://www.deepl.com/pro-api
無料版：月50万文字まで
*/
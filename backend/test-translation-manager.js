// translation-manager.js (修正版)
import Parser from 'rss-parser';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

console.log('Step 1: dotenv.config() 開始');
dotenv.config();
console.log('Step 2: dotenv.config() 完了');

// Articleモデルをインポート
console.log('Step 3: Article import 開始');
import Article from './models/Article.js';
console.log('Step 4: Article import 完了');

class TranslationManager {
  constructor() {
    console.log('Step 5: constructor 開始');
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
    console.log('Step 6: constructor 完了');
  }

  // MongoDB接続
  async connectDB() {
    console.log('Step 7: connectDB 開始');
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/techcrunch-app';
      console.log('Step 8: MongoDB接続試行中:', mongoUri);
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      console.log('Step 9: MongoDB接続成功');
      
      // インデックス作成状況をチェック
      console.log('Step 10: インデックス確認開始');
      const indexes = await Article.collection.getIndexes();
      console.log('Step 11: インデックス確認完了:', Object.keys(indexes));
      
      console.log('Step 12: connectDB 完了');
    } catch (error) {
      console.error('connectDB エラー:', error.message);
      throw error;
    }
  }

  // TechCrunch RSS記事取得
  async fetchTechCrunchArticles() {
    console.log('Step 13: fetchTechCrunchArticles 開始');
    try {
      console.log('Step 14: RSS解析開始');
      const feed = await this.parser.parseURL('https://techcrunch.com/feed/');
      console.log('Step 15: RSS解析完了, 記事数:', feed.items.length);
      
      let newCount = 0;
      let duplicateCount = 0;

      for (const [index, item] of feed.items.entries()) {
        if (index >= 5) break; // 最初の5件のみテスト
        
        console.log(`Step 16-${index}: 記事処理中 ${index + 1}/5`);
        
        try {
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

          if (!articleData.link) {
            console.log(`Step 17-${index}: リンクなしでスキップ`);
            continue;
          }

          console.log(`Step 18-${index}: DB検索開始`);
          const existingArticle = await Article.findOne({ link: articleData.link });
          console.log(`Step 19-${index}: DB検索完了`);
          
          if (!existingArticle) {
            console.log(`Step 20-${index}: 新記事保存開始`);
            const newArticle = new Article(articleData);
            await newArticle.save();
            newCount++;
            console.log(`Step 21-${index}: 新記事保存完了`);
          } else {
            duplicateCount++;
            console.log(`Step 22-${index}: 重複記事`);
          }
        } catch (error) {
          console.error(`Step Error-${index}:`, error.message);
        }
      }

      console.log('Step 23: fetchTechCrunchArticles 完了');
      return { source: 'TechCrunch', newCount, duplicateCount };
    } catch (error) {
      console.error('fetchTechCrunchArticles エラー:', error.message);
      throw error;
    }
  }

  // 全ソースから記事取得
  async fetchAndSaveArticles() {
    console.log('Step 24: fetchAndSaveArticles 開始');
    const results = [];
    
    // テスト用にTechCrunchのみ
    try {
      console.log('Step 25: TechCrunch処理開始');
      const result = await this.fetchTechCrunchArticles();
      results.push(result);
      console.log('Step 26: TechCrunch処理完了');
    } catch (error) {
      console.error('fetchAndSaveArticles エラー:', error.message);
    }
    
    console.log('Step 27: fetchAndSaveArticles 完了');
    return results;
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
    console.log('Step 28: run 開始');
    
    try {
      console.log('Step 29: connectDB 呼び出し');
      await this.connectDB();
      
      if (mode === 'fetch' || mode === 'both') {
        console.log('Step 30: fetchAndSaveArticles 呼び出し');
        await this.fetchAndSaveArticles();
      }
      
      console.log('Step 31: 統計表示');
      const totalCount = await Article.countDocuments();
      const translatedCount = await Article.countDocuments({ translated: true });
      
      console.log('総記事数:', totalCount);
      console.log('翻訳済み:', translatedCount);
      
      console.log('Step 32: run 完了');
    } catch (error) {
      console.error('run エラー:', error.message);
      throw error;
    } finally {
      console.log('Step 33: DB切断開始');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      console.log('Step 34: DB切断完了');
    }
  }
}

export default TranslationManager;

// コマンドライン実行（修正版）
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === currentFilePath;

if (isMainModule) {
  console.log('Step 35: コマンドライン実行開始');
  const manager = new TranslationManager();
  const mode = process.argv[2] || 'fetch';
  
  console.log('Step 36: run 呼び出し');
  manager.run(mode).then(() => {
    console.log('Step 37: 処理完了');
    process.exit(0);
  }).catch((error) => {
    console.error('Step Error: 処理エラー:', error);
    process.exit(1);
  });
}
// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import TranslationManager from './translation-manager.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Articleモデルをインポート
import Article from './models/Article.js';

// MongoDB接続
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/techcrunch-app';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB接続成功');
  } catch (error) {
    console.error('❌ MongoDB接続エラー:', error.message);
    process.exit(1);
  }
}

// API Routes

// 📄 記事一覧取得
app.get('/api/articles', async (req, res) => {
  try {
    const { 
      category, 
      limit = 20, 
      translated = 'true',
      offset = 0,  // offsetパラメータを追加
      page = 1 
    } = req.query;

    // クエリ構築
    let query = {};
    if (translated === 'true') {
      query.translated = true;
    }
    if (category && category !== 'all') {
      query.categories = { $in: [category] };
    }

    // offsetが指定されている場合はoffsetを使用、そうでなければpageを使用
    const skip = offset ? parseInt(offset) : (parseInt(page) - 1) * parseInt(limit);
    
    const articles = await Article
      .find(query)
      .sort({ pubDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title_ja contentSnippet_ja link pubDate creator categories readingTime source')
      .lean();

    // 総件数取得
    const totalCount = await Article.countDocuments(query);
    
    res.json({
      success: true,
      data: articles,
      total: totalCount,  // フロントエンドで使用するため追加
      pagination: {
        currentPage: Math.floor(skip / parseInt(limit)) + 1,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + articles.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🏷️ カテゴリー一覧取得
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Article.distinct('categories', { translated: true });
    
    // カテゴリー別記事数も取得
    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        const count = await Article.countDocuments({ 
          categories: category, 
          translated: true 
        });
        return { name: category, count };
      })
    );

    // 記事数順でソート
    categoryStats.sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: categoryStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 📊 統計情報取得
app.get('/api/stats', async (req, res) => {
  try {
    const totalArticles = await Article.countDocuments();
    const translatedArticles = await Article.countDocuments({ translated: true });
    const todayArticles = await Article.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    // 最新記事の公開日
    const latestArticle = await Article.findOne().sort({ pubDate: -1 });
    
    res.json({
      success: true,
      data: {
        totalArticles,
        translatedArticles,
        untranslatedArticles: totalArticles - translatedArticles,
        todayArticles,
        lastUpdate: latestArticle?.pubDate || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔄 記事更新トリガー（管理者用）
app.post('/api/admin/fetch', async (req, res) => {
  try {
    const manager = new TranslationManager();
    await manager.connectDB();
    
    const result = await manager.fetchAndSaveArticles();
    
    res.json({
      success: true,
      message: '記事取得完了',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🌐 翻訳実行トリガー（管理者用）
app.post('/api/admin/translate', async (req, res) => {
  try {
    const { batchSize = 5 } = req.body;
    
    const manager = new TranslationManager();
    await manager.connectDB();
    
    const translatedCount = await manager.translateUntranslatedArticles(batchSize);
    
    res.json({
      success: true,
      message: '翻訳処理完了',
      data: { translatedCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔍 記事検索
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: '検索キーワードが必要です'
      });
    }

    const articles = await Article
      .find({
        translated: true,
        $or: [
          { title_ja: { $regex: q, $options: 'i' } },
          { contentSnippet_ja: { $regex: q, $options: 'i' } },
          { categories: { $regex: q, $options: 'i' } }
        ]
      })
      .sort({ pubDate: -1 })
      .limit(parseInt(limit))
      .select('title_ja contentSnippet_ja link pubDate creator categories readingTime')
      .lean();
    
    res.json({
      success: true,
      data: articles,
      count: articles.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// サーバー起動
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 APIサーバー起動: http://localhost:${PORT}`);
    console.log(`📖 利用可能エンドポイント:`);
    console.log(`   GET /api/articles?category=AI&limit=10`);
    console.log(`   GET /api/categories`);
    console.log(`   GET /api/stats`);
    console.log(`   GET /api/search?q=AI`);
    console.log(`   POST /api/admin/fetch`);
    console.log(`   POST /api/admin/translate`);
  });
}

startServer().catch(console.error);

export default app;
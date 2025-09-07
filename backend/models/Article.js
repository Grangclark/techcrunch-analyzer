// models/Article.js (Ars Technica対応版)
import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  title_ja: {
    type: String,
    trim: true
  },
  link: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  contentSnippet: {
    type: String,
    trim: true
  },
  contentSnippet_ja: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    trim: true
  },
  pubDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  creator: {
    type: String,
    trim: true,
    default: 'Unknown'
  },
  categories: [{
    type: String,
    trim: true
  }],
  guid: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    required: true,
    enum: {
      values: ['TechCrunch', 'Hacker News', 'Ars Technica'], // ← Ars Technica追加
      message: 'Source must be one of: TechCrunch, Hacker News, Ars Technica'
    }
  },
  // Hacker News用の追加フィールド
  hackerNewsId: {
    type: Number,
    sparse: true  // 一意性制約だが、nullは許可
  },
  score: {
    type: Number,
    default: 0
  },
  // 翻訳関連フィールド
  translated: {
    type: Boolean,
    default: false
  },
  translatedAt: {
    type: Date
  },
  // 読了時間（分）
  readingTime: {
    type: Number,
    default: 1,
    min: 1
  },
  // 作成・更新日時
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,  // createdAt, updatedAtの自動管理
  collection: 'articles'
});

// インデックス設定
articleSchema.index({ link: 1 }, { unique: true });
articleSchema.index({ pubDate: -1 });
articleSchema.index({ source: 1, pubDate: -1 });
articleSchema.index({ translated: 1 });
articleSchema.index({ hackerNewsId: 1 }, { sparse: true });

// 仮想フィールド（日本語タイトルの優先表示）
articleSchema.virtual('displayTitle').get(function() {
  return this.title_ja || this.title;
});

// 仮想フィールド（日本語要約の優先表示）
articleSchema.virtual('displaySnippet').get(function() {
  return this.contentSnippet_ja || this.contentSnippet;
});

// 更新時のupdatedAt自動設定
articleSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

// findOneAndUpdate時のupdatedAt自動設定
articleSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const Article = mongoose.model('Article', articleSchema);

export default Article;
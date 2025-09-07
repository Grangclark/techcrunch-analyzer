// models/Article.js
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
    unique: true
  },
  contentSnippet: {
    type: String,
    default: ''
  },
  contentSnippet_ja: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  pubDate: {
    type: Date,
    required: true
  },
  creator: {
    type: String,
    default: 'Unknown'
  },
  categories: [{
    type: String
  }],
  guid: {
    type: String
  },
  source: {
    type: String,
    required: true,
    enum: ['TechCrunch', 'Hacker News'],
    default: 'TechCrunch'
  },
  // Hacker News固有のフィールド
  hackerNewsId: {
    type: Number
  },
  score: {
    type: Number,
    default: 0
  },
  // 翻訳管理
  translated: {
    type: Boolean,
    default: false
  },
  translatedAt: {
    type: Date
  },
  readingTime: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// インデックス設定（重複を避けるため統合）
articleSchema.index({ pubDate: -1 });
articleSchema.index({ translated: 1 });
articleSchema.index({ source: 1, translated: 1 });
articleSchema.index({ categories: 1 });
// hackerNewsIdのスパースインデックス（重複削除）
articleSchema.index({ hackerNewsId: 1 }, { sparse: true, unique: true });

// 仮想フィールド
articleSchema.virtual('displayTitle').get(function() {
  return this.title_ja || this.title;
});

articleSchema.virtual('displayContent').get(function() {
  return this.contentSnippet_ja || this.contentSnippet;
});

// ソース別のアイコン取得
articleSchema.virtual('sourceIcon').get(function() {
  const icons = {
    'TechCrunch': '📰',
    'Hacker News': '🔥'
  };
  return icons[this.source] || '📄';
});

export default mongoose.model('Article', articleSchema);
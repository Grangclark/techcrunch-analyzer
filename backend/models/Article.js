// models/Article.js
import mongoose from 'mongoose';

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

// インデックス設定（unique指定したフィールドは除く）
articleSchema.index({ pubDate: -1 });
articleSchema.index({ categories: 1 });
articleSchema.index({ translated: 1 });

// モデルの重複定義を防ぐ
const Article = mongoose.models.Article || mongoose.model('Article', articleSchema);

export default Article;
// connection-test.js - MongoDB接続テスト用
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('環境変数チェック:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('DEEPL_API_KEY:', process.env.DEEPL_API_KEY ? '設定済み' : '未設定');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/techcrunch-app';
console.log('\n接続URI:', mongoUri);

console.log('\nMongoDB接続テスト開始...');

// タイムアウト設定
const timeoutId = setTimeout(() => {
  console.log('タイムアウト: 10秒以内に接続できませんでした');
  process.exit(1);
}, 10000);

try {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  
  clearTimeout(timeoutId);
  console.log('✅ MongoDB接続成功!');
  
  // 簡単なクエリテスト
  console.log('データベース一覧取得中...');
  const admin = mongoose.connection.db.admin();
  const result = await admin.listDatabases();
  console.log('利用可能なデータベース:', result.databases.map(db => db.name));
  
  await mongoose.connection.close();
  console.log('接続を閉じました');
  process.exit(0);
  
} catch (error) {
  clearTimeout(timeoutId);
  console.error('❌ 接続エラー:', error.message);
  
  if (error.name === 'MongoServerSelectionError') {
    console.error('\n考えられる原因:');
    console.error('1. MongoDBサーバーが停止している');
    console.error('2. ポート27017が使用できない');
    console.error('3. ファイアウォールがブロックしている');
    console.error('4. MongoDB設定に問題がある');
  }
  
  process.exit(1);
}
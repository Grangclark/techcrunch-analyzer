// test.js - 簡単な動作確認
import TranslationManager from './translation-manager.js';
import Article from './models/Article.js';

async function test() {
  console.log('🔍 テスト開始...');
  
  const manager = new TranslationManager();
  
  try {
    await manager.connectDB();
    console.log('✅ DB接続成功');
    
    // 簡単な統計取得
    const totalCount = await Article.countDocuments();
    console.log(`📊 総記事数: ${totalCount}件`);
    
    // 翻訳失敗記事数をチェック
    const failedQuery = {
      $or: [
        { title_ja: /^\[翻訳失敗\]/ },
        { contentSnippet_ja: /^\[翻訳失敗\]/ },
        { title_ja: /^\[翻訳なし\]/ },
        { contentSnippet_ja: /^\[翻訳なし\]/ }
      ]
    };
    
    const failedCount = await Article.countDocuments(failedQuery);
    console.log(`⚠️  翻訳失敗記事数: ${failedCount}件`);
    
    if (failedCount > 0) {
      console.log('🔄 翻訳失敗記事のリセットを実行中...');
      
      const result = await Article.updateMany(failedQuery, {
        $unset: { 
          title_ja: "",
          contentSnippet_ja: "",
          translatedAt: ""
        },
        $set: { 
          translated: false 
        }
      });
      
      console.log(`✅ ${result.modifiedCount}件の記事状態をリセットしました`);
    } else {
      console.log('✨ 翻訳失敗記事は見つかりませんでした');
    }
    
    console.log('✅ テスト完了');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('詳細:', error);
    process.exit(1);
  }
}

test();
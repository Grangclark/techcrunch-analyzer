import React, { useState, useEffect } from 'react';
import { Clock, ExternalLink, Tag, Search, RefreshCw, TrendingUp, Filter, Sparkles, ChevronDown, Globe, Zap, Shield } from 'lucide-react';

const TechCrunchReader = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]); // ソース一覧追加
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all'); // ソース選択追加
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0); // 現在の読み込み位置
  const [hasMore, setHasMore] = useState(true); // まだ記事があるかどうか
  const [totalArticles, setTotalArticles] = useState(0); // 総記事数

  const API_BASE = 'http://localhost:3001/api';
  const ARTICLES_PER_PAGE = 20;

  // ソース別のアイコンとグラデーション
  const getSourceIcon = (source) => {
    switch (source) {
      case 'TechCrunch':
        return <Globe size={14} />;
      case 'Hacker News':
        return <Zap size={14} />;
      case 'Ars Technica':
        return <Shield size={14} />;
      default:
        return <Globe size={14} />;
    }
  };

  const getSourceGradient = (source) => {
    switch (source) {
      case 'TechCrunch':
        return 'linear-gradient(45deg, #10b981, #34d399)'; // 緑系
      case 'Hacker News':
        return 'linear-gradient(45deg, #f59e0b, #fbbf24)'; // オレンジ系
      case 'Ars Technica':
        return 'linear-gradient(45deg, #8b5cf6, #a78bfa)'; // 紫系
      default:
        return 'linear-gradient(45deg, #6b7280, #9ca3af)'; // グレー系
    }
  };

  // 初期データ取得
  useEffect(() => {
    fetchInitialData();
  }, []);

  // カテゴリー変更時
  useEffect(() => {
    if (selectedCategory) {
      resetAndFetchArticles(selectedCategory, selectedSource);
    }
  }, [selectedCategory, selectedSource]);

  // データ取得関数
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [articlesRes, categoriesRes, sourcesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/articles?limit=${ARTICLES_PER_PAGE}&offset=0`),
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/sources`), // ソース一覧API追加
        fetch(`${API_BASE}/stats`)
      ]);

      const articlesData = await articlesRes.json();
      const categoriesData = await categoriesRes.json();
      const sourcesData = await sourcesRes.json();
      const statsData = await statsRes.json();

      setArticles(articlesData.data || []);
      setCategories(categoriesData.data || []);
      setSources(sourcesData.data || []);
      setStats(statsData.data || {});
      setCurrentOffset(ARTICLES_PER_PAGE);
      setTotalArticles(articlesData.total || 0);
      setHasMore((articlesData.data || []).length === ARTICLES_PER_PAGE);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // カテゴリー・ソース変更時のリセット＆再取得
  const resetAndFetchArticles = async (category, source) => {
    try {
      setLoading(true);
      let url = `${API_BASE}/articles?limit=${ARTICLES_PER_PAGE}&offset=0`;
      
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      if (source !== 'all') params.append('source', source);
      
      if (params.toString()) {
        url += '&' + params.toString();
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      setArticles(data.data || []);
      setCurrentOffset(ARTICLES_PER_PAGE);
      setTotalArticles(data.total || 0);
      setHasMore((data.data || []).length === ARTICLES_PER_PAGE);
    } catch (error) {
      console.error('記事取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 追加記事読み込み
  const loadMoreArticles = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      let url = `${API_BASE}/articles?limit=${ARTICLES_PER_PAGE}&offset=${currentOffset}`;
      
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedSource !== 'all') params.append('source', selectedSource);
      
      if (params.toString()) {
        url += '&' + params.toString();
      }
      
      const response = await fetch(url);
      const data = await response.json();
      const newArticles = data.data || [];
      
      setArticles(prevArticles => [...prevArticles, ...newArticles]);
      setCurrentOffset(prev => prev + ARTICLES_PER_PAGE);
      setHasMore(newArticles.length === ARTICLES_PER_PAGE);
      
      // 記事追加読み込み後にカテゴリー一覧を更新
      await updateCategories();
    } catch (error) {
      console.error('追加記事取得エラー:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // カテゴリー更新関数（追加）
  const updateCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/categories`);
      const data = await response.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('カテゴリー更新エラー:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      console.error('検索エラー:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSearchQuery('');
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}時間前`;
    return `${Math.floor(diffInMinutes / 1440)}日前`;
  };

  const ArticleCard = ({ article }) => (
    <div className="card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 className="text-lg font-bold text-gray-900" style={{ flex: 1, lineHeight: '1.4' }}>
            {article.title_ja || article.title}
          </h2>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              marginLeft: '1rem',
              padding: '0.5rem',
              color: '#3b82f6',
              borderRadius: '50%',
              transition: 'all 0.2s ease'
            }}
          >
            <ExternalLink size={18} />
          </a>
        </div>

        <p className="text-sm text-gray-600" style={{ lineHeight: '1.6' }}>
          {article.contentSnippet_ja || article.contentSnippet}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
          {/* ソース表示 */}
          {article.source && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              background: getSourceGradient(article.source), 
              padding: '0.25rem 0.5rem', 
              borderRadius: '12px',
              fontWeight: '600',
              color: 'white'
            }}>
              {getSourceIcon(article.source)}
              <span>{article.source}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(45deg, #dbeafe, #e0e7ff)', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
            <Clock size={14} />
            <span>{formatTimeAgo(article.pubDate)}</span>
          </div>
          
          {article.readingTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(45deg, #d1fae5, #dcfce7)', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
              <TrendingUp size={14} />
              <span>{article.readingTime}分で読了</span>
            </div>
          )}
          
          {article.creator && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(45deg, #fed7aa, #fecaca)', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
              <Sparkles size={14} />
              <span>by {article.creator}</span>
            </div>
          )}
        </div>

        {article.categories && article.categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {article.categories.slice(0, 3).map((category, categoryIndex) => (
              <span key={categoryIndex} className="tag">
                <Tag size={12} />
                {category}
              </span>
            ))}
            {article.categories.length > 3 && (
              <span className="text-xs" style={{ color: '#9ca3af', background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '12px' }}>
                +{article.categories.length - 3}個
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const LoadingSpinner = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
      <RefreshCw className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
    </div>
  );

  // 「もっと見る」ボタンコンポーネント
  const LoadMoreButton = () => {
    if (searchResults.length > 0 || !hasMore) return null;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
        <button
          onClick={loadMoreArticles}
          disabled={loadingMore}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: loadingMore 
              ? 'linear-gradient(45deg, #f3f4f6, #e5e7eb)' 
              : 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
            color: loadingMore ? '#6b7280' : 'white',
            border: 'none',
            borderRadius: '25px',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: loadingMore ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: loadingMore ? 'none' : '0 4px 15px rgba(59, 130, 246, 0.3)'
          }}
          onMouseOver={(e) => {
            if (!loadingMore) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (!loadingMore) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
            }
          }}
        >
          {loadingMore ? (
            <>
              <RefreshCw className="animate-spin" size={16} />
              読み込み中...
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              もっと見る ({articles.length}/{totalArticles}件)
            </>
          )}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  const displayArticles = searchResults.length > 0 ? searchResults : articles;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ヘッダー */}
      <header className="header">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h1 style={{ 
              fontSize: '1.875rem', 
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              📰 TechCrunch日本語リーダー
            </h1>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              background: 'linear-gradient(45deg, #d1fae5, #dcfce7)',
              padding: '0.5rem 0.75rem',
              borderRadius: '20px'
            }}>
              <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065f46' }}>
                翻訳済み: {stats.translatedArticles}件
              </span>
            </div>
          </div>

          {/* 検索バー */}
          <div className="flex gap-3 mb-6">
            <div style={{ flex: 1, position: 'relative' }}>
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} 
              />
              <input
                type="text"
                placeholder="記事を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="search-input"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="btn-primary"
            >
              {isSearching ? <RefreshCw className="animate-spin" size={18} /> : '検索'}
            </button>
          </div>

          {/* ソースフィルター */}
          <div className="flex items-center gap-3 mb-4" style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <Filter size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', flexShrink: 0 }}>ソース:</span>
            <button
              onClick={() => setSelectedSource('all')}
              className={`btn-category ${selectedSource === 'all' ? 'active' : ''}`}
              style={{ flexShrink: 0 }}
            >
              すべて
            </button>
            {sources.map((source) => (
              <button
                key={source.name}
                onClick={() => setSelectedSource(source.name)}
                className={`btn-category ${selectedSource === source.name ? 'active' : ''}`}
                style={{ flexShrink: 0 }}
              >
                {getSourceIcon(source.name)} {source.name} ({source.count})
              </button>
            ))}
          </div>

          {/* カテゴリーフィルター */}
          <div className="flex items-center gap-3" style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', flexShrink: 0 }}>カテゴリ:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`btn-category ${selectedCategory === 'all' ? 'active' : ''}`}
              style={{ flexShrink: 0 }}
            >
              すべて
            </button>
            {categories.slice(0, 8).map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`btn-category ${selectedCategory === category.name ? 'active' : ''}`}
                style={{ flexShrink: 0 }}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container" style={{ padding: '2rem 1rem' }}>
        {searchResults.length > 0 && (
          <div className="mb-6 p-4" style={{
            background: 'linear-gradient(45deg, #dbeafe, #e0e7ff)',
            borderRadius: '12px',
            border: '1px solid #bfdbfe'
          }}>
            <p style={{ color: '#1e40af', fontWeight: '500' }}>
              「{searchQuery}」の検索結果: {searchResults.length}件
              <button
                onClick={clearSearch}
                style={{
                  marginLeft: '1rem',
                  color: '#2563eb',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                クリア
              </button>
            </p>
          </div>
        )}

        <div className="space-y-6">
          {displayArticles.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>

        {/* もっと見るボタン */}
        <LoadMoreButton />

        {displayArticles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="card" style={{ display: 'inline-block' }}>
              <p className="text-lg text-gray-600">
                {searchResults.length === 0 && searchQuery 
                  ? '検索結果が見つかりませんでした' 
                  : '記事がありません'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TechCrunchReader;
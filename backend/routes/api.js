// ソース一覧取得API
router.get('/sources', async (req, res) => {
  try {
    const sources = await Article.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $project: { name: '$_id', count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);
    
    res.json({ success: true, data: sources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 記事取得APIにソースフィルター対応
router.get('/articles', async (req, res) => {
  try {
    const { category, source, limit = 20, offset = 0 } = req.query;
    
    let query = {};
    if (category && category !== 'all') query.categories = category;
    if (source && source !== 'all') query.source = source;
    
    const articles = await Article
      .find(query)
      .sort({ pubDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await Article.countDocuments(query);
    
    res.json({ success: true, data: articles, total });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
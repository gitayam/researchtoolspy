-- ========================================
-- Social Media Extractions Table
-- ========================================
-- Stores specialized social media content extraction results
-- Supports: YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit

CREATE TABLE IF NOT EXISTS social_media_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  saved_link_id INTEGER,
  content_analysis_id INTEGER,

  -- Source
  url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'reddit')),
  post_type TEXT, -- video, image, carousel, story, tweet, reel

  -- Media URLs (JSON)
  media_urls TEXT, -- { video: 'url', audio: 'url', thumbnail: 'url', images: ['url1', 'url2'] }

  -- Download options (JSON array)
  download_options TEXT, -- [{ quality: '1080p', format: 'mp4', url: '...', size: 1024, hasAudio: true, hasVideo: true }]

  -- Streaming & Embedding
  stream_url TEXT, -- Direct stream URL or embed URL
  embed_code TEXT, -- HTML embed code

  -- Metadata (JSON)
  metadata TEXT, -- Platform-specific metadata (views, likes, comments, author, etc.)

  -- Content
  transcript TEXT, -- For videos: transcript or subtitles

  -- Processing metadata
  extraction_mode TEXT DEFAULT 'full' CHECK(extraction_mode IN ('metadata', 'download', 'stream', 'transcript', 'full')),
  extraction_duration_ms INTEGER,

  -- Caching
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cache_expires_at TIMESTAMP DEFAULT (datetime('now', '+24 hours')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (saved_link_id) REFERENCES saved_links(id) ON DELETE SET NULL,
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_extractions_url ON social_media_extractions(url);
CREATE INDEX IF NOT EXISTS idx_social_extractions_platform ON social_media_extractions(platform);
CREATE INDEX IF NOT EXISTS idx_social_extractions_user ON social_media_extractions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_extractions_cache ON social_media_extractions(cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_social_extractions_saved_link ON social_media_extractions(saved_link_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS social_extractions_updated_at
AFTER UPDATE ON social_media_extractions
FOR EACH ROW
BEGIN
  UPDATE social_media_extractions
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

-- ========================================
-- Sample Data (Optional, for testing)
-- ========================================
-- Uncomment to insert sample data for testing

/*
INSERT INTO social_media_extractions (
  user_id, url, platform, post_type,
  media_urls, download_options, stream_url, embed_code,
  metadata, extraction_mode
) VALUES (
  1,
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'youtube',
  'video',
  '{"video":"https://example.com/video.mp4","thumbnail":"https://example.com/thumb.jpg"}',
  '[{"quality":"1080p","format":"mp4","url":"https://example.com/video.mp4","hasAudio":true,"hasVideo":true}]',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
  '{"title":"Example Video","viewCount":1000000,"likeCount":50000}',
  'full'
);
*/

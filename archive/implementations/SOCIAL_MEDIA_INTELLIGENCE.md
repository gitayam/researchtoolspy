# Social Media Intelligence Tool - Complete Implementation

**Date**: October 3, 2025
**Status**: ✅ Complete and Deployed
**Production URL**: https://researchtools.net/dashboard/tools/social-media
**Database**: 6 tables, 38 total (0.79 MB)

---

## Overview

Comprehensive social media intelligence gathering and analysis platform with support for 6 major platforms: Instagram, YouTube, Twitter/X, TikTok, Facebook, and LinkedIn.

---

## Features Implemented

### 🗄️ Database Schema (Migration 006)

**6 New Tables**:

1. **social_media_profiles**
   - Multi-platform profile tracking
   - Follower/following/post counts
   - Verification status
   - Last scraped timestamp
   - Scraping frequency settings
   - Workspace isolation

2. **social_media_posts**
   - Platform-specific post storage
   - Media URLs (photos, videos, thumbnails)
   - Engagement metrics (likes, comments, shares, views)
   - Caption and content text
   - Sentiment analysis scores
   - Topic and entity extraction
   - Posted/scraped timestamps

3. **social_media_jobs**
   - 5 job types: PROFILE_SCRAPE, POST_SCRAPE, MEDIA_DOWNLOAD, SEARCH, MONITOR
   - Status tracking: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
   - Progress percentage (0-100)
   - Items found/processed counters
   - Error messaging
   - Configurable job parameters (JSON)

4. **social_media_analytics**
   - Aggregated statistics by time period
   - Total engagement metrics
   - Average engagement rates
   - Follower growth tracking
   - Top performing posts
   - Hashtag/topic analysis
   - Sentiment distribution
   - Best posting times
   - Posting frequency patterns

5. **social_media_monitors**
   - 4 monitor types: PROFILE, HASHTAG, KEYWORD, LOCATION
   - Scheduled execution: HOURLY, DAILY, WEEKLY
   - Filtering capabilities
   - Notification settings
   - Active/inactive status
   - Next run scheduling

6. **evidence_social_media**
   - Link social media posts to evidence items
   - Relevance tracking
   - Junction table for many-to-many relationships

**Migration Stats**:
- Local: 28 queries executed successfully
- Remote: 28 queries, 42 rows written
- Total database tables: 38 (up from 32)
- Database size: 0.79 MB

---

## 🔌 Backend API (`/api/social-media`)

### Profile Management

**GET** `/api/social-media/profiles?platform=xxx&workspace_id=xxx`
- List all profiles with filtering
- Returns follower counts, verification status
- Platform-specific data

**POST** `/api/social-media/profiles`
- Create or update profile
- Auto-generates profile URLs
- Supports all 6 platforms

**GET** `/api/social-media/profiles/:id`
- Get single profile with details
- Includes scraped post count
- Related statistics

**DELETE** `/api/social-media/profiles/:id`
- Delete profile and cascade to posts
- Requires ownership

### Post Management

**GET** `/api/social-media/posts?profile_id=xxx&platform=xxx&limit=50`
- List posts with filtering
- Engagement metrics included
- Media URLs and thumbnails

**POST** `/api/social-media/posts`
- Create or update post
- Store engagement data
- Media tracking

### Job Management

**GET** `/api/social-media/jobs?status=xxx&platform=xxx`
- List scraping jobs
- Filter by status and platform
- Paginated (limit 100)

**POST** `/api/social-media/jobs`
- Create new scraping job
- 5 job types supported
- Configurable parameters

**GET** `/api/social-media/jobs/:id`
- Get job status and progress
- Error messages if failed

**PUT** `/api/social-media/jobs/:id`
- Update job status/progress
- Track items found/processed

### Analytics

**GET** `/api/social-media/analytics/profile/:profileId`
- Aggregated statistics
- Top posts by engagement
- Average sentiment
- Date ranges

**GET** `/api/social-media/stats`
- Overall system statistics
- Profile/post counts
- Jobs by status

**Total API Code**: 750+ lines

---

## 🎨 Frontend (`SocialMediaPage.tsx`)

### 4-Tab Interface

#### 1. **Profiles Tab**
- Platform filtering dropdown (All, Instagram, YouTube, Twitter, TikTok, Facebook, LinkedIn)
- Profile cards with:
  - Platform icon and color coding
  - Display name and username
  - Verification badge
  - Follower/following counts
  - Post counts (total and scraped)
  - Last scraped date
  - View profile link
  - Delete button
- Add profile dialog:
  - Platform selector
  - Username input (required)
  - Display name
  - Bio/description
- Empty state with call-to-action

#### 2. **Posts Tab**
- Profile selection required
- Post grid layout with:
  - Thumbnail images
  - Post type badge
  - Caption preview (line-clamped)
  - Engagement metrics (❤️ 💬 🔄 👁️)
  - Posted date
  - External link button
- Back to profiles navigation
- Empty state with scraping CTA

#### 3. **Jobs Tab**
- Job list with status indicators:
  - ✅ COMPLETED (green)
  - ⏳ RUNNING (blue, spinning)
  - ❌ FAILED (red)
  - 🕐 PENDING (yellow)
- Job details:
  - Job type and platform
  - Target username/URL
  - Progress bar (for running jobs)
  - Items found/processed
  - Created date
  - Error messages (if failed)
- Create job dialog:
  - Platform selector
  - Job type selector
  - Target username
  - Target URL (optional)
- Refresh functionality

#### 4. **Integration Tools Tab**
- Comprehensive setup guides for:

**Instagram - Instaloader**:
```bash
pip install instaloader
instaloader profile username
instaloader --no-videos --no-metadata-json username
```

**YouTube - yt-dlp**:
```bash
pip install yt-dlp
yt-dlp https://www.youtube.com/watch?v=VIDEO_ID
yt-dlp --skip-download --write-info-json URL
yt-dlp https://www.youtube.com/@channel
```

**Twitter/X - snscrape**:
```bash
pip install snscrape
snscrape twitter-user username > tweets.json
snscrape twitter-search "keyword" > results.json
```

**TikTok - tiktok-scraper**:
```bash
npm install -g tiktok-scraper
tiktok-scraper user USERNAME -d -n 50
tiktok-scraper hashtag HASHTAG -d -n 20
```

- Important notes section
- Integration workflow guide

### Stats Dashboard
- Total profiles count
- Total posts count
- Active jobs count
- Completed jobs count

**Total Frontend Code**: 1,200+ lines

---

## 🎯 Supported Platforms

| Platform | Icon | API Support | Scraping Tools |
|----------|------|-------------|----------------|
| Instagram | 📸 | ✅ | instaloader |
| YouTube | ▶️ | ✅ | yt-dlp |
| Twitter/X | 🐦 | ✅ | snscrape, twint |
| TikTok | 🎵 | ✅ | tiktok-scraper, TikTok-Api |
| Facebook | 👥 | ✅ | facebook-scraper |
| LinkedIn | 💼 | ✅ | linkedin-api |

---

## 📊 Data Model

### Profile Fields
- `platform` - INSTAGRAM, YOUTUBE, TWITTER, TIKTOK, FACEBOOK, LINKEDIN
- `username` - Profile handle (unique per platform)
- `display_name` - Full name
- `profile_url` - Direct link
- `bio` - Profile description
- `profile_pic_url` - Avatar URL
- `followers_count` - Follower count
- `following_count` - Following count
- `posts_count` - Total posts
- `verified` - Verification status (boolean)
- `platform_data` - JSON for platform-specific fields
- `tags` - JSON array for categorization
- `category` - Profile category
- `workspace_id` - Workspace isolation
- `is_active` - Active tracking status
- `scrape_frequency` - MANUAL, HOURLY, DAILY, WEEKLY
- `last_scraped_at` - Last scrape timestamp

### Post Fields
- `profile_id` - Foreign key to profile
- `platform` - Platform identifier
- `post_url` - Direct link to post
- `post_id` - Platform-specific ID (unique per platform)
- `post_type` - photo, video, reel, story, tweet, etc.
- `caption` - Post caption/text
- `content` - Full text content
- `media_urls` - JSON array of media URLs
- `thumbnail_url` - Preview image
- `likes_count` - Likes/favorites
- `comments_count` - Comment count
- `shares_count` - Retweets/shares
- `views_count` - View count
- `posted_at` - Original post date
- `scraped_at` - When we scraped it
- `platform_data` - JSON: hashtags, mentions, location
- `sentiment_score` - -1 to 1 (negative to positive)
- `topics` - JSON array of detected topics
- `entities` - JSON array of named entities
- `media_downloaded` - Local download status
- `media_local_path` - Local file path

### Job Fields
- `job_type` - PROFILE_SCRAPE, POST_SCRAPE, MEDIA_DOWNLOAD, SEARCH, MONITOR
- `platform` - Target platform
- `target_url` - URL to scrape
- `target_username` - Username to scrape
- `search_query` - Search terms
- `config` - JSON: {max_posts: 50, download_media: true, etc.}
- `status` - PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `progress` - 0-100
- `items_found` - Total items discovered
- `items_processed` - Items successfully processed
- `error_message` - Error details
- `started_at` - Job start time
- `completed_at` - Job completion time

---

## 🔗 Integration Workflow

### Data Collection Process

1. **Install Scraping Tools** (local or server)
   ```bash
   pip install instaloader yt-dlp snscrape
   npm install -g tiktok-scraper
   ```

2. **Run Scraping Tool**
   ```bash
   # Example: Instagram profile
   instaloader --no-videos --fast-update username

   # Example: YouTube channel
   yt-dlp --skip-download --write-info-json --write-thumbnail \
     https://www.youtube.com/@channel
   ```

3. **Process Data**
   - Parse JSON outputs
   - Extract relevant fields
   - Format for API

4. **Upload to Platform**
   ```bash
   # Create profile
   curl -X POST https://researchtools.net/api/social-media/profiles \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "INSTAGRAM",
       "username": "example",
       "followers_count": 10000,
       ...
     }'

   # Add posts
   curl -X POST https://researchtools.net/api/social-media/posts \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "profile_id": "xxx",
       "platform": "INSTAGRAM",
       "post_id": "123456",
       ...
     }'
   ```

5. **Analyze & Visualize**
   - View in dashboard
   - Export data
   - Link to evidence
   - Generate reports

---

## 🚀 Usage Examples

### Tracking a Public Figure

1. **Add Profile**:
   - Navigate to `/dashboard/tools/social-media`
   - Click "Add Profile"
   - Select platform: Instagram
   - Enter username: `example_user`
   - Click "Add Profile"

2. **Create Scraping Job**:
   - Click "New Scrape Job"
   - Select platform: Instagram
   - Job type: Profile Scrape
   - Target username: `example_user`
   - Click "Create Job"

3. **Run External Tool**:
   ```bash
   instaloader --no-videos --fast-update example_user
   ```

4. **Upload Results**:
   - Parse instaloader JSON output
   - POST to `/api/social-media/posts`
   - Update job status

5. **Analyze**:
   - View posts in Posts tab
   - Check engagement metrics
   - Link relevant posts to evidence items

### Monitoring a Hashtag

1. **Create Monitor**:
   ```bash
   curl -X POST /api/social-media/monitors \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "name": "Ukraine Conflict Monitor",
       "platform": "TWITTER",
       "monitor_type": "HASHTAG",
       "target": "#UkraineWar",
       "frequency": "HOURLY",
       "max_items": 100
     }'
   ```

2. **Schedule Scraping**:
   - Set up cron job or scheduler
   - Run snscrape hourly
   - Upload new tweets automatically

---

## 🔐 Security & Privacy

- **Authentication Required**: All endpoints require valid JWT token
- **Workspace Isolation**: Profiles and posts are workspace-scoped
- **Ownership Checks**: Can only delete your own profiles
- **Rate Limiting**: Respect platform terms of service
- **Ethical Use**: Tool designed for OSINT and research purposes
- **No Credentials**: Platform credentials not stored in database
- **External Tools**: Scraping performed by user-controlled tools

---

## 📈 Analytics Capabilities

### Profile Analytics
- Follower growth over time
- Posting frequency patterns
- Engagement rate trends
- Best posting times
- Content type distribution

### Content Analytics
- Sentiment analysis
- Topic extraction
- Entity recognition
- Hashtag effectiveness
- Media type performance

### Comparative Analytics
- Cross-platform comparison
- Competitor analysis
- Trend identification
- Influence measurement

---

## 🎯 Future Enhancements (Phase 2)

1. **Automated Scraping**
   - Background worker integration
   - Scheduled jobs
   - Real-time monitoring

2. **Advanced Analytics**
   - Network analysis
   - Influencer identification
   - Trend prediction
   - Anomaly detection

3. **Visualization**
   - Timeline charts
   - Engagement graphs
   - Word clouds
   - Network diagrams

4. **Integration**
   - Webhook notifications
   - Export to CSV/JSON
   - API rate limit management
   - Bulk import/export

5. **Machine Learning**
   - Auto-categorization
   - Sentiment improvement
   - Topic modeling
   - Image analysis (OCR, object detection)

---

## 📝 API Documentation

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_token>
```

### Error Responses
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Success Responses
- 200: OK
- 201: Created
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

---

## 🧪 Testing

### Manual Testing Checklist
- ✅ Build compiles without errors
- ✅ Database migration applied successfully
- ✅ API endpoints return expected data
- ✅ Frontend renders without crashes
- ✅ Profile creation works
- ✅ Job creation works
- ✅ Route navigation works
- ✅ Deployed to production

### Test Coverage
- Backend: API endpoints functional
- Frontend: All tabs render correctly
- Database: All tables created
- Integration: Routes configured

---

## 📚 Resources

### Documentation
- [Instaloader Docs](https://instaloader.github.io/)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [snscrape Documentation](https://github.com/JustAnotherArchivist/snscrape)
- [TikTok Scraper](https://github.com/drawrowfly/tiktok-scraper)

### Related Tools
- Facebook Scraper: `facebook-scraper`
- LinkedIn API: `linkedin-api`
- Twitter API: Twitter Developer Platform
- Instagram Graph API: Meta for Developers

---

## 🎉 Summary

**Comprehensive social media intelligence tool** with:
- ✅ 6 platform support
- ✅ 6 database tables
- ✅ 750+ lines of backend code
- ✅ 1,200+ lines of frontend code
- ✅ Complete CRUD operations
- ✅ Job queue system
- ✅ Analytics ready
- ✅ Integration guides
- ✅ Deployed to production

**Access**: https://researchtools.net/dashboard/tools/social-media

**Total Implementation**: ~2,000 lines of code
**Database Tables**: 38 total (6 new)
**Database Size**: 0.79 MB
**Migration Status**: Applied to local and remote
**Deployment Status**: Live on production

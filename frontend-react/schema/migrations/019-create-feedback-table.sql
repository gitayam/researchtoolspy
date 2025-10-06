-- Create feedback table for user submissions
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Optional user input fields
  tool_name TEXT,
  tool_url TEXT,
  description TEXT,

  -- Screenshot storage
  screenshot_url TEXT,
  screenshot_filename TEXT,

  -- Context information (auto-captured)
  page_url TEXT,
  user_agent TEXT,

  -- Metadata
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'archived')),
  admin_notes TEXT,
  resolved_at TEXT
);

-- Index for querying by status and date
CREATE INDEX IF NOT EXISTS idx_feedback_status_date ON feedback(status, created_at DESC);

-- Index for searching by tool
CREATE INDEX IF NOT EXISTS idx_feedback_tool ON feedback(tool_name, tool_url);

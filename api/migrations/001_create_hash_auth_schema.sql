-- Hash-based Authentication System Schema
-- Implements Mullvad-style hash authentication for ResearchTools

-- Main accounts table - stores hash-based accounts
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_hash VARCHAR(16) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes for performance
    CONSTRAINT accounts_hash_format CHECK (account_hash ~ '^[a-zA-Z0-9]{16}$')
);

CREATE INDEX IF NOT EXISTS idx_accounts_hash ON accounts(account_hash);
CREATE INDEX IF NOT EXISTS idx_accounts_last_accessed ON accounts(last_accessed);

-- Account projects - stores user's analysis sessions and projects
CREATE TABLE IF NOT EXISTS account_projects (
    id SERIAL PRIMARY KEY,
    account_hash VARCHAR(16) NOT NULL REFERENCES accounts(account_hash) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL,
    project_type VARCHAR(50) NOT NULL, -- 'ach', 'swot', 'deception', 'starbursting', etc.
    project_name VARCHAR(255),
    project_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Ensure uniqueness of project_id per account
    CONSTRAINT unique_account_project UNIQUE (account_hash, project_id)
);

CREATE INDEX IF NOT EXISTS idx_account_projects_hash ON account_projects(account_hash);
CREATE INDEX IF NOT EXISTS idx_account_projects_type ON account_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_account_projects_updated ON account_projects(updated_at);

-- Account collaborations - enables hash sharing and team features
CREATE TABLE IF NOT EXISTS account_collaborations (
    id SERIAL PRIMARY KEY,
    owner_hash VARCHAR(16) NOT NULL REFERENCES accounts(account_hash) ON DELETE CASCADE,
    collaborator_hash VARCHAR(16) NOT NULL REFERENCES accounts(account_hash) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL,
    permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('read', 'write', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NULL, -- NULL means never expires
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Prevent self-collaboration and duplicate collaborations
    CONSTRAINT no_self_collaboration CHECK (owner_hash != collaborator_hash),
    CONSTRAINT unique_collaboration UNIQUE (owner_hash, collaborator_hash, project_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborations_owner ON account_collaborations(owner_hash);
CREATE INDEX IF NOT EXISTS idx_collaborations_collaborator ON account_collaborations(collaborator_hash);
CREATE INDEX IF NOT EXISTS idx_collaborations_project ON account_collaborations(project_id);

-- Account sessions - tracks active sessions for security and analytics
CREATE TABLE IF NOT EXISTS account_sessions (
    id SERIAL PRIMARY KEY,
    account_hash VARCHAR(16) NOT NULL REFERENCES accounts(account_hash) ON DELETE CASCADE,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_hash ON account_sessions(account_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON account_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON account_sessions(expires_at);

-- Account activity log - for security monitoring and usage analytics
CREATE TABLE IF NOT EXISTS account_activity (
    id SERIAL PRIMARY KEY,
    account_hash VARCHAR(16) NOT NULL REFERENCES accounts(account_hash) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'project_create', 'project_update', 'collaboration_invite', etc.
    activity_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_hash ON account_activity(account_hash);
CREATE INDEX IF NOT EXISTS idx_activity_type ON account_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON account_activity(created_at);

-- Function to generate unique 16-character hash (Mullvad-style)
CREATE OR REPLACE FUNCTION generate_account_hash() 
RETURNS VARCHAR(16) AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..16 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM accounts WHERE account_hash = result) LOOP
        result := '';
        FOR i IN 1..16 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
        END LOOP;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_accessed when account is used
CREATE OR REPLACE FUNCTION update_account_access(hash VARCHAR(16))
RETURNS VOID AS $$
BEGIN
    UPDATE accounts 
    SET last_accessed = CURRENT_TIMESTAMP,
        access_count = access_count + 1
    WHERE account_hash = hash;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM account_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on account_projects
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_account_projects_timestamp 
    BEFORE UPDATE ON account_projects
    FOR EACH ROW EXECUTE FUNCTION update_project_timestamp();

-- Create some sample data for testing (optional)
-- INSERT INTO accounts (account_hash) VALUES 
--     ('4d2f8a9b3e7c1s6x'),  -- Example Mullvad-style hash
--     ('k8m2p9q4r7t3w5y1');

COMMENT ON TABLE accounts IS 'Hash-based user accounts for anonymous authentication';
COMMENT ON TABLE account_projects IS 'Analysis projects and sessions associated with hash accounts';
COMMENT ON TABLE account_collaborations IS 'Team collaboration and hash sharing features';
COMMENT ON TABLE account_sessions IS 'Active sessions for security and session management';
COMMENT ON TABLE account_activity IS 'Activity logging for security monitoring and analytics';
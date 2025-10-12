-- Create terminal_sessions table
CREATE TABLE IF NOT EXISTS terminal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, session_id)
);

-- Create index for faster lookups
CREATE INDEX idx_terminal_sessions_user_id ON terminal_sessions(user_id);

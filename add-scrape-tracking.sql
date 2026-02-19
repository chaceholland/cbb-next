-- Add scrape tracking columns to games table
ALTER TABLE cbb_games
ADD COLUMN IF NOT EXISTS last_scrape_attempt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scrape_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrape_status TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_games_scrape_status ON cbb_games(scrape_status);
CREATE INDEX IF NOT EXISTS idx_games_last_scrape ON cbb_games(last_scrape_attempt);

-- Update existing games
UPDATE cbb_games
SET scrape_status = 'not_attempted'
WHERE scrape_status IS NULL;

-- Comment on columns
COMMENT ON COLUMN cbb_games.last_scrape_attempt IS 'Timestamp of last attempt to scrape participation data from ESPN';
COMMENT ON COLUMN cbb_games.scrape_attempts IS 'Number of times we have attempted to scrape this game';
COMMENT ON COLUMN cbb_games.scrape_status IS 'Status: not_attempted, no_data_available, has_data, error';

-- =============================================================================
-- POSTGRESQL EXTENSIONS - Performance Monitoring
-- =============================================================================
-- This script runs automatically on FIRST container start
-- (via /docker-entrypoint-initdb.d/)
--
-- pg_stat_statements: Query performance tracking
-- - Tracks which queries run and how long they take
-- - Essential for identifying slow queries and N+1 problems
-- - Minimal overhead (~1-2% CPU)
--
-- Reference: https://www.postgresql.org/docs/17/pgstatstatements.html
-- =============================================================================

-- Create pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify installation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RAISE NOTICE 'pg_stat_statements extension installed successfully';
    ELSE
        RAISE WARNING 'pg_stat_statements extension failed to install';
    END IF;
END
$$;

-- Grant access to app_user (read-only for query stats)
GRANT SELECT ON pg_stat_statements TO app_user;

-- =============================================================================
-- USAGE EXAMPLES (run these manually when needed):
-- =============================================================================
--
-- Top 10 slowest queries (by total time):
-- SELECT
--     query,
--     calls,
--     round(total_exec_time::numeric, 2) as total_ms,
--     round(mean_exec_time::numeric, 2) as avg_ms,
--     rows
-- FROM pg_stat_statements
-- ORDER BY total_exec_time DESC
-- LIMIT 10;
--
-- Most frequently called queries:
-- SELECT query, calls, rows
-- FROM pg_stat_statements
-- ORDER BY calls DESC
-- LIMIT 10;
--
-- Reset statistics (only when needed):
-- SELECT pg_stat_statements_reset();
--
-- =============================================================================

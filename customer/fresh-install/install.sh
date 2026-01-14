#!/bin/bash
# =====================================================
# Assixx Fresh Database Installation Script
# Version: 1.2.0
# Date: 2026-01-14
# =====================================================
#
# This script creates a fresh Assixx database with:
# - Application user (app_user) for RLS enforcement
# - Complete schema (109 tables, 108 sequences, 474 indexes)
# - RLS policies (89 policies for multi-tenant isolation)
# - Foreign keys (260 constraints)
# - Triggers (68 triggers)
# - Seed data (plans, features, plan_features, kvp_categories, machine_categories)
# - PostgreSQL extensions (pg_stat_statements for performance monitoring)
#
# REQUIREMENTS:
# - PostgreSQL container running (assixx-postgres)
# - Database 'assixx' must exist (created by Docker Compose)
# - User 'assixx_user' must exist with superuser privileges
#
# USAGE:
#   ./install.sh                    # Full install (interactive password prompt)
#   ./install.sh --schema-only      # Only schema, no seed data
#   ./install.sh --seed-only        # Only seed data (schema must exist)
#   ./install.sh --users-only       # Only create/update app_user
#
# ENVIRONMENT VARIABLES:
#   APP_USER_PASSWORD  - Password for app_user (if not set, will prompt)
#
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER="assixx-postgres"
DB_NAME="assixx"
DB_USER="assixx_user"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        log_error "Container '${CONTAINER}' is not running!"
        log_info "Start with: cd docker && docker-compose up -d"
        exit 1
    fi
    log_info "Container '${CONTAINER}' is running ✓"
}

check_database() {
    if ! docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to database '${DB_NAME}'!"
        exit 1
    fi
    log_info "Database '${DB_NAME}' is accessible ✓"
}

prompt_app_user_password() {
    # Check if password is already set via environment variable
    if [ -n "${APP_USER_PASSWORD}" ]; then
        log_info "Using APP_USER_PASSWORD from environment"
        return
    fi

    echo ""
    echo "=========================================="
    echo "  App User Password Setup"
    echo "=========================================="
    echo ""
    echo "The app_user is used by the backend application."
    echo "It enforces Row Level Security (RLS) for multi-tenant isolation."
    echo ""
    echo "Password requirements:"
    echo "  - Minimum 16 characters"
    echo "  - Alphanumeric recommended (avoid special chars for shell compatibility)"
    echo ""

    while true; do
        read -s -p "Enter password for app_user: " APP_USER_PASSWORD
        echo ""
        read -s -p "Confirm password: " APP_USER_PASSWORD_CONFIRM
        echo ""

        if [ "${APP_USER_PASSWORD}" != "${APP_USER_PASSWORD_CONFIRM}" ]; then
            log_error "Passwords do not match. Try again."
            continue
        fi

        if [ ${#APP_USER_PASSWORD} -lt 16 ]; then
            log_error "Password must be at least 16 characters."
            continue
        fi

        break
    done

    export APP_USER_PASSWORD
    log_info "Password set successfully"
}

install_users() {
    log_info "Installing app_user..."

    # Create SQL with password substituted
    local USERS_SQL="${SCRIPT_DIR}/000_users.sql"

    if [ ! -f "${USERS_SQL}" ]; then
        log_error "Users SQL file not found: ${USERS_SQL}"
        exit 1
    fi

    # Substitute password and execute
    sed "s/\${APP_USER_PASSWORD}/${APP_USER_PASSWORD}/g" "${USERS_SQL}" | \
        docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} > /dev/null 2>&1

    # Verify user exists
    USER_EXISTS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT 1 FROM pg_roles WHERE rolname = 'app_user';" | tr -d ' ')

    if [ "${USER_EXISTS}" = "1" ]; then
        log_info "app_user created/updated successfully ✓"
    else
        log_error "Failed to create app_user!"
        exit 1
    fi
}

install_schema() {
    log_info "Installing schema..."

    # Copy schema file to container
    docker cp "${SCRIPT_DIR}/001_schema.sql" ${CONTAINER}:/tmp/001_schema.sql

    # Execute schema
    docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f /tmp/001_schema.sql > /dev/null 2>&1

    # Verify
    TABLE_COUNT=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')

    if [ "${TABLE_COUNT}" -eq 109 ]; then
        log_info "Schema installed successfully: ${TABLE_COUNT} tables ✓"
    else
        log_warn "Expected 109 tables, got ${TABLE_COUNT}"
    fi
}

install_seed_data() {
    log_info "Installing seed data..."

    # Copy seed data file to container
    docker cp "${SCRIPT_DIR}/002_seed_data.sql" ${CONTAINER}:/tmp/002_seed_data.sql

    # Execute seed data
    docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f /tmp/002_seed_data.sql > /dev/null 2>&1

    # Verify
    PLANS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM plans;" | tr -d ' ')
    FEATURES=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT COUNT(*) FROM features;" | tr -d ' ')

    log_info "Seed data installed: plans=${PLANS}, features=${FEATURES} ✓"
}

install_extensions() {
    log_info "Installing PostgreSQL extensions..."

    # Check if 003_extensions.sql exists
    if [ ! -f "${SCRIPT_DIR}/003_extensions.sql" ]; then
        log_warn "Extensions file not found: ${SCRIPT_DIR}/003_extensions.sql - skipping"
        return
    fi

    # Copy extensions file to container
    docker cp "${SCRIPT_DIR}/003_extensions.sql" ${CONTAINER}:/tmp/003_extensions.sql

    # Execute extensions (may warn if shared_preload_libraries not set)
    docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f /tmp/003_extensions.sql 2>&1 | grep -v "^$" || true

    # Verify pg_stat_statements
    EXT_EXISTS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" | tr -d ' ')

    if [ "${EXT_EXISTS}" = "1" ]; then
        log_info "pg_stat_statements extension installed ✓"
    else
        log_warn "pg_stat_statements not available - ensure shared_preload_libraries is set in docker-compose.yml"
    fi
}

reset_sequences() {
    log_info "Resetting sequences to 1 for tenant tables..."

    # Reset all sequences except seed table sequences (handled by seed data)
    docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
    DO \$\$
    DECLARE
        seq RECORD;
    BEGIN
        FOR seq IN
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
            AND sequencename NOT IN (
                'plans_id_seq',
                'features_id_seq',
                'plan_features_id_seq',
                'kvp_categories_id_seq',
                'machine_categories_id_seq'
            )
        LOOP
            EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq.sequencename);
        END LOOP;
    END \$\$;
    " > /dev/null 2>&1

    log_info "Sequences reset ✓"
}

verify_installation() {
    log_info "Verifying installation..."

    echo ""
    echo "=== INSTALLATION SUMMARY ==="
    docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
    SELECT 'Tables' as component, COUNT(*)::text as count FROM pg_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Sequences', COUNT(*)::text FROM pg_sequences WHERE schemaname = 'public'
    UNION ALL
    SELECT 'RLS Policies', COUNT(*)::text FROM pg_policies WHERE schemaname = 'public'
    UNION ALL
    SELECT 'Foreign Keys', COUNT(*)::text FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    UNION ALL
    SELECT 'Plans (seed)', COUNT(*)::text FROM plans
    UNION ALL
    SELECT 'Features (seed)', COUNT(*)::text FROM features
    ORDER BY component;
    "
    echo ""
}

# Main
main() {
    echo ""
    echo "=========================================="
    echo "  Assixx Fresh Database Installation"
    echo "=========================================="
    echo ""

    # Parse arguments
    SCHEMA_ONLY=false
    SEED_ONLY=false
    USERS_ONLY=false

    for arg in "$@"; do
        case $arg in
            --schema-only)
                SCHEMA_ONLY=true
                ;;
            --seed-only)
                SEED_ONLY=true
                ;;
            --users-only)
                USERS_ONLY=true
                ;;
        esac
    done

    # Pre-flight checks
    check_container
    check_database

    # Install based on mode
    if [ "$USERS_ONLY" = true ]; then
        prompt_app_user_password
        install_users
    elif [ "$SEED_ONLY" = true ]; then
        install_seed_data
    elif [ "$SCHEMA_ONLY" = true ]; then
        install_schema
        reset_sequences
    else
        # Full install: users + schema + seed + extensions
        prompt_app_user_password
        install_users
        install_schema
        install_seed_data
        install_extensions
        reset_sequences
    fi

    # Verify
    verify_installation

    log_info "Installation complete!"
    echo ""

    # Reminder for app_user password
    if [ "$USERS_ONLY" = true ] || [ "$SCHEMA_ONLY" = false ] && [ "$SEED_ONLY" = false ]; then
        echo "=========================================="
        echo "  IMPORTANT: Save the app_user password!"
        echo "=========================================="
        echo ""
        echo "Update these files with the app_user password:"
        echo "  - docker/.env (DB_PASSWORD=...)"
        echo "  - Doppler secrets (if using Doppler)"
        echo ""
    fi
}

main "$@"

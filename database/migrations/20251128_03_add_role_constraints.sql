-- =====================================================
-- Migration: Add Role-Enforcement Triggers
-- Date: 2025-11-28
-- Author: Claude Code
-- Part of: Permission System Refactoring
-- =====================================================
-- These triggers enforce the business logic:
-- - user_teams: Only employees can be assigned
-- - admin_area_permissions: Only admins can have area permissions
-- - admin_department_permissions: Only admins can have department permissions
-- - teams.team_lead_id: Only root or admin can be team lead
-- =====================================================

DELIMITER //

-- =====================================================
-- Trigger 1: user_teams - Only employees allowed
-- =====================================================
DROP TRIGGER IF EXISTS trg_user_teams_role_check//

CREATE TRIGGER trg_user_teams_role_check
BEFORE INSERT ON user_teams
FOR EACH ROW
BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'user_teams: User not found';
  ELSEIF user_role != 'employee' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'user_teams: Only employees can be assigned to teams via user_teams';
  END IF;
END//

-- =====================================================
-- Trigger 2: admin_area_permissions - Only admins allowed
-- =====================================================
DROP TRIGGER IF EXISTS trg_admin_area_permissions_role_check//

CREATE TRIGGER trg_admin_area_permissions_role_check
BEFORE INSERT ON admin_area_permissions
FOR EACH ROW
BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.admin_user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_area_permissions: User not found';
  ELSEIF user_role != 'admin' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_area_permissions: Only admins can have area permissions';
  END IF;
END//

-- =====================================================
-- Trigger 3: admin_department_permissions - Only admins allowed
-- =====================================================
DROP TRIGGER IF EXISTS trg_admin_dept_permissions_role_check//

CREATE TRIGGER trg_admin_dept_permissions_role_check
BEFORE INSERT ON admin_department_permissions
FOR EACH ROW
BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.admin_user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_department_permissions: User not found';
  ELSEIF user_role != 'admin' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_department_permissions: Only admins can have department permissions';
  END IF;
END//

-- =====================================================
-- Trigger 4: teams.team_lead_id - Only root/admin allowed (INSERT)
-- =====================================================
DROP TRIGGER IF EXISTS trg_teams_lead_role_check//

CREATE TRIGGER trg_teams_lead_role_check
BEFORE INSERT ON teams
FOR EACH ROW
BEGIN
  DECLARE user_role VARCHAR(20);
  IF NEW.team_lead_id IS NOT NULL THEN
    SELECT role INTO user_role FROM users WHERE id = NEW.team_lead_id;
    IF user_role IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: User not found';
    ELSEIF user_role NOT IN ('root', 'admin') THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: Only root or admin can be team lead';
    END IF;
  END IF;
END//

-- =====================================================
-- Trigger 5: teams.team_lead_id - Only root/admin allowed (UPDATE)
-- =====================================================
DROP TRIGGER IF EXISTS trg_teams_lead_role_check_update//

CREATE TRIGGER trg_teams_lead_role_check_update
BEFORE UPDATE ON teams
FOR EACH ROW
BEGIN
  DECLARE user_role VARCHAR(20);
  IF NEW.team_lead_id IS NOT NULL AND (OLD.team_lead_id IS NULL OR NEW.team_lead_id != OLD.team_lead_id) THEN
    SELECT role INTO user_role FROM users WHERE id = NEW.team_lead_id;
    IF user_role IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: User not found';
    ELSEIF user_role NOT IN ('root', 'admin') THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: Only root or admin can be team lead';
    END IF;
  END IF;
END//

DELIMITER ;

-- =====================================================
-- Verification
-- =====================================================
SELECT 'Migration 20251128_03 completed: Role enforcement triggers created' AS status;
SHOW TRIGGERS WHERE `Trigger` LIKE 'trg_%';

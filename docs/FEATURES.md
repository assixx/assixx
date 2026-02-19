# Assixx Features & Overview

> **Last Updated:** 2026-02-19
> **Version:** 1.3.0
> **Status:** Production Ready (11 of 12 main features live)

## Table of Contents

1. [Current Features](#current-features)
2. [Feature Status Matrix](#feature-status-matrix)
3. [Pricing Plans](#pricing-plans)
4. [Feature Details](#feature-details)
5. [Planned Features](#planned-features)

## Current Features

### Live Features (Production Ready)

#### 1. **User Management**

- Multi-Tenant Architecture with Subdomain Isolation
- Three User Roles: Root, Admin, Employee
- JWT-based Authentication
- Profile Picture Upload
- Password Reset Functionality

#### 2. **Document Management**

- Upload/Download for PDF Documents
- Categorization (Payroll, Contracts, etc.)
- Access Control Management
- Version Control
- Search Functionality

#### 3. **Bulletin Board (Blackboard)**

- Company-wide Announcements
- Categories and Tags
- Color Coding for Priorities
- Read Confirmations
- Attachments (Images, PDFs)
- Organization Level Filters

#### 4. **Calendar**

- Event Management
- All-Day and Time-Based Events
- Drag & Drop Functionality
- Organization Levels (Company/Department/Team)
- iCal Export/Import
- Color Coding by Event Type

#### 5. **CIP System (Continuous Improvement Process)**

- Submit Improvement Proposals
- Status Tracking (Submitted -> Under Review -> Implemented)
- Points/Rewards System
- Categorization
- File Attachments
- Comment Functionality

#### 6. **Shift Planning**

- Weekly View with Drag & Drop
- Three Shift Types (Early/Late/Night)
- Employee Availability
- Department and Machine Filters
- Shift Information and Notes
- Excel Export

#### 7. **Chat System**

- Real-Time Messaging (WebSocket)
- Individual and Group Chats
- File Attachments
- Typing Indicators
- Unread Messages Badge
- Tenant-Isolated Communication

#### 8. **Automatic Backup System**

- Daily Automatic Backups
- 30-Day Retention
- Easy Restoration
- Manual Quick Backups
- Backup Rotation (Daily/Weekly/Monthly)

#### 9. **Vacation Management** (NEW)

- Vacation Request Workflow (create, edit, respond, withdraw, cancel)
- Pre-Approval Capacity Analysis (team headcount, machine staffing, blackout conflicts, entitlement check)
- Multi-Level Approver Chain (team lead → deputy → area lead → admin)
- Half-Day Support (morning/afternoon at start/end of range)
- 7 Vacation Types (regular, doctor, bereavement, birth, wedding, move, unpaid)
- Entitlement Management (per-employee, per-year, carry-over, additional days)
- Blackout Periods (global, department, team, area scoped)
- Machine Staffing Rules (minimum headcount per machine)
- Holiday Management (recurring + one-time, per-tenant)
- Team Calendar Overview (approved vacations per member per day)
- Tenant-Wide Settings (default days, carry-over limits, notice period)
- Real-Time Notifications via SSE
- Status Audit Trail (append-only log with notes)
- 5 Admin Pages: Anträge, Regeln, Urlaubsansprüche, Feiertage, Übersicht

#### 10. **Feature-Gating System** (NEW — System Feature)

- Per-Tenant Feature Activation/Deactivation
- Backend: `TenantFeatureGuard` (APP_GUARD) on all Feature-Controllers
- Frontend: Sidebar-Filterung (SSR, kein Flash), Page-Level Guards, api-client 403-Handling
- Admin-Seite `/features` für Feature-Verwaltung (modernisiert mit Design System)
- Separate `/feature-unavailable` Fehlerseite (vs. `/permission-denied` für Rollen)
- Rekursive Submenu-Filterung (leere Container werden entfernt)
- 57 Unit Tests (navigation-config 31 + feature-guard 26)
- Core-Features (Dashboard, Profil, Settings) werden NIE gefiltert
- Architektur: ADR-024

#### 11. **TPM — Total Productive Maintenance** (NEW)

- Kamishibai Board (visual card management per machine per interval)
- Plan Management (create/edit/delete maintenance plans with intervals)
- 8 Interval Types (daily, weekly, monthly, quarterly, semi-annual, annual, long-runner, custom)
- 4-State Card Status Machine (green → red → yellow → overdue)
- Execution Workflow (employee marks card as done, optional photo upload)
- Approval Workflow (team lead approves/rejects, card transitions accordingly)
- Escalation System (cron-based overdue detection with configurable threshold)
- Slot Availability Assistant (optimal maintenance time slot suggestions)
- Real-Time Notifications via SSE (due, overdue, approval required/result)
- Shift Grid Integration (TPM maintenance dates as overlay toggle)
- Machine History Bridge (approved executions → maintenance history)
- Configuration UI (escalation settings, card colors, card templates)
- Per-Tenant Color Customization (green/yellow/red/overdue colors)
- Card Templates with JSONB Custom Fields
- Time Estimates per Interval Type
- 364 Tests (278 unit + 86 API)
- Architecture: ADR-026

### In Development

#### 12. **Survey Tool** (80% complete)

- Admin can Create Surveys
- Multiple Choice and Free Text
- Anonymous/Non-Anonymous Options
- Real-Time Results
- Export Functions

## Feature Status Matrix

| Feature             | Basic    | Premium   | Enterprise   | Status          |
| ------------------- | -------- | --------- | ------------ | --------------- |
| User Management     | 50 Users | 200 Users | Unlimited    | Live            |
| Document Management | 10GB     | 100GB     | 1TB          | Live            |
| Bulletin Board      | Yes      | Yes       | Yes          | Live            |
| Calendar            | Yes      | Yes       | Yes          | Live            |
| CIP System          | No       | Yes       | Yes          | Live            |
| Shift Planning      | No       | Yes       | Yes          | Live            |
| Chat System         | Basic    | Extended  | Full Version | Live            |
| Backup System       | Yes      | Yes       | Yes          | Live            |
| Vacation Management | No       | Yes       | Yes          | Live            |
| Feature-Gating      | Yes      | Yes       | Yes          | Live            |
| TPM Wartung         | No       | Yes       | Yes          | Live            |
| Survey Tool         | No       | Yes       | Yes          | In Development  |
| Mobile App          | No       | No        | Yes          | Planned Q2/2025 |

## Pricing Plans

### Basic Plan — 49/month

- Up to 50 Users
- 10GB Storage
- Basic Features
- Email Support

### Premium Plan — 149/month

- Up to 200 Users
- 100GB Storage
- All Features except Enterprise
- Priority Support
- Monthly Training Sessions

### Enterprise Plan — Custom Pricing

- Unlimited Users
- 1TB+ Storage
- All Features + Customization
- 24/7 Phone Support
- Dedicated Account Manager
- On-Premise Option

## Feature Details

### User Management in Detail

**Roles & Permissions:**

- **Root**: Full Access, Tenant Management, Billing
- **Admin**: Employee Management, Feature Configuration
- **Employee**: Access to Enabled Features

**Security:**

- Bcrypt Password Hashing
- JWT with 24h Expiration
- Tenant Isolation at DB Level
- Session Management

### Document Management in Detail

**Supported Formats:**

- PDF (primary)
- Images (JPG, PNG)
- Office Documents (planned)

**Categories:**

- Payroll
- Employment Contracts
- Certificates
- Training Materials
- Miscellaneous

### Chat System in Detail

**Technology:**

- WebSocket
- PostgreSQL Message Storage
- File Upload up to 10MB
- Emoji Support

**Features:**

- Real-Time Synchronization
- Offline Message Queue
- Read Receipts (Backend ready)
- Typing Indicators

## Planned Features

### Q1 2025

- [ ] Survey Tool (Completion)
- [ ] Email Notifications
- [ ] Extended Search Functionality

### Q2 2025

- [x] Leave Management → **Live als "Vacation Management" (2026-02-13, ADR-023)**
- [ ] Mobile PWA
- [ ] Stripe Payment Integration
- [ ] Multi-Language Support (EN, TR, PL)

### Q3 2025

- [x] TPM Calendar → **Live als "TPM Wartung" (2026-02-19, ADR-026)**
- [ ] QA Checklists
- [ ] Extended Analytics
- [ ] API v2

### Q4 2025

- [ ] AI Integration
- [ ] Extended Automation
- [ ] Enterprise SSO
- [ ] Audit Compliance Module

## Technical Specifications

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical information.

## Further Documentation

- [Setup Guide](./SETUP-QUICKSTART.md)
- [API Documentation](./server/API-TEST-README.md)
- [Security Concept](./server/SECURITY-IMPROVEMENTS.md)
- [Deployment Guide](./DEPLOYMENT.md)

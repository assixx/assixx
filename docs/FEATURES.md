# Assixx Features & Overview

> **Last Updated:** 2025-05-26
> **Version:** 1.0.0
> **Status:** Production Ready (8 of 11 main features live)

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

### In Development

#### 9. **Survey Tool** (80% complete)

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
| Survey Tool         | No       | Yes       | Yes          | In Development  |
| Leave Management    | No       | Yes       | Yes          | Planned Q2/2025 |
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

- [ ] Leave Management
- [ ] Mobile PWA
- [ ] Stripe Payment Integration
- [ ] Multi-Language Support (EN, TR, PL)

### Q3 2025

- [ ] TPM Calendar
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

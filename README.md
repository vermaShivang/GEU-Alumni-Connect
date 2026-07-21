# GEU Alumni Connect

An enterprise-grade, full-stack alumni networking and community engagement platform built for **Graphic Era University (GEU)**. GEU Alumni Connect connects graduates, current students, faculty, and university administrators in a secure, verified environment.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Core Features & Workflows](#2-core-features--workflows)
3. [Repository Structure](#3-repository-structure)
4. [REST API Reference](#4-rest-api-reference)
5. [Automated Testing Suite](#5-automated-testing-suite)
6. [Quick Start & Execution Steps](#6-quick-start--execution-steps)
7. [Detailed Setup Guide](#7-detailed-setup-guide)

---

## 1. System Architecture

```
   ┌────────────────────────────────────────────────────────┐
   │             GEU Alumni Connect Frontend                │
   │   React 18 • TypeScript • Vite • Tailwind • shadcn/ui  │
   └───────────────────────────┬────────────────────────────┘
                               │ HTTP REST / JSON (Axios/Fetch)
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │              GEU Alumni Connect Backend                │
   │      Node.js • Express 4 • JWT • Multer • Nodemailer   │
   └───────────────┬───────────────────────────┬────────────┘
                   │ SQL (node-postgres)       │ SMTP / Console
                   ▼                           ▼
   ┌──────────────────────────────┐    ┌────────────────────┐
   │     PostgreSQL Database      │    │ Email Notification │
   │   Users • Profiles • Jobs    │    │  Gmail SMTP or     │
   │  Communities • Connections   │    │  Dev Console Log   │
   └──────────────────────────────┘    └────────────────────┘
```

### Technology Stack
- **Frontend (`Frontend/`)**: Built on **React 18** and **TypeScript** powered by **Vite**. Styling uses **Tailwind CSS** combined with **shadcn/ui** and **Radix UI** primitives for accessible, responsive components. State and API caching are managed using **TanStack React Query**.
- **Backend (`backend/`)**: Built on **Node.js** and **Express 4**, following modular route-controller patterns. Uses **JSON Web Tokens (JWT)** for stateless authentication, **bcryptjs** for secure password hashing, and **Multer** for file handling.
- **Database**: Relational data persisted in **PostgreSQL 14+**, featuring declarative schemas (`schema.sql`) and idempotent incremental migrations (`migrations.sql`).

---

## 2. Core Features & Workflows

### 🛡️ Admin-Verified Sign-Up Flow
- Applicants submit registration applications via `/signup`, uploading credentials (PDF/PNG/JPG ≤ 10MB) such as degree certificates or student IDs.
- Applications sit in `pending_registrations` until reviewed by an administrator.
- Upon approval, the backend automatically generates a URL-safe username and a cryptographically secure temporary password, emails them to the user, and flags the account with `must_change_password = true`.

### 🔐 Two-Factor OTP Password Security
- When a user logs in for the first time (or after an admin password reset), they are forced to `/dashboard/change-password`.
- Changing the password requires entering their current password to generate a 6-digit verification OTP emailed to their address (valid for 10 minutes, max 5 attempts), followed by their new password.

### 📊 Platform Intelligence & Interactive Analytics Dashboard (`/dashboard/admin`)
- **Executive KPI Summary**: Live monitoring of Verified Alumni Accounts, Pending Review Queue, 24h Active Users, and Searchable Resumes.
- **Interactive Visualizations (Powered by Recharts)**:
  - **Graduation Batches Bar Chart**: Dynamic distribution of alumni across graduating classes (`Class of 2021`, `2022`, `2023`, `2024`, etc.).
  - **Academic Programs Donut Chart**: Interactive multi-colored breakdown of alumni across degree programs (`B.Tech CSE`, `MBA`, `MCA`, etc.).
- **Job & Application Pipeline Breakdown**: Complete visibility into job opportunity types (`full-time`, `internship`, `contract`) and signup review states.

### 🩺 Real-Time System Diagnostics & User Activity Audit Log
- **System Health Engine (`GET /api/admin/health-report`)**:
  - Live PostgreSQL query latency monitoring (`ms`), Node.js runtime footprint (`Heap Used / Heap Total / RSS in MB`), server uptime duration, and active email delivery mode (`SMTP` vs `Console`).
- **API Microservices Latency Grid**: Real-time status (`ONLINE`) and response latency across all 7 core REST API sub-routers (`/api/auth`, `/api/profiles`, `/api/jobs`, `/api/communities`, `/api/connections`, `/api/messages`, `/api/admin`).
- **Live User Directory & IP Activity Audit**:
  - Live green online presence indicator (`pulsing dot`) for users active within the last 5 minutes (`last_seen`).
  - Automatic IP Address capture (`last_ip`) stored securely on every authenticated request.
  - Searchable directory allowing instant filtering by Alumnus Name, Email, Academic Program, or **IP Address**.

---

## 3. Repository Structure

```
GEU-Alumni-Connect/
├── backend/                  # Express + PostgreSQL backend service
│   ├── scripts/
│   │   └── create-admin.js   # CLI utility to instantly create/promote Super-Admins
│   ├── src/
│   │   ├── app.js            # Express application configuration & middleware
│   │   ├── index.js          # HTTP server bootstrap entry point
│   │   ├── config/           # Cloudinary & environment configuration
│   │   ├── middleware/       # JWT authentication, IP capture & admin gatekeepers
│   │   ├── routes/           # REST API route handlers (auth, admin, jobs, communities, etc.)
│   │   └── services/         # Email notifications & credential generation
│   ├── tests/                # Automated Jest + Supertest test suite (36 tests)
│   └── package.json          # Backend scripts & dependencies
├── Frontend/                 # React + TypeScript + Vite frontend app
│   ├── src/
│   │   ├── components/       # UI design components & navigation
│   │   ├── contexts/         # Authentication context provider
│   │   ├── lib/              # API client utility & type definitions
│   │   ├── pages/            # Full-page route views (Dashboard, Jobs, Admin Analytics, etc.)
│   │   └── test/             # Vitest unit & component tests (10 tests)
│   └── package.json          # Frontend scripts & dependencies
├── schema.sql                # Complete PostgreSQL database schema definition (including last_seen & last_ip)
├── migrations.sql            # Idempotent DB migrations for existing deployments
└── SETUP_GUIDE.md            # Comprehensive operational & setup documentation
```

---

## 4. REST API Reference

| Module | HTTP Method & Path | Description | Access |
| :--- | :--- | :--- | :--- |
| **System** | `GET /api/health` | Service status check & email delivery mode report | Public |
| **Auth** | `POST /api/auth/register` | Submit registration application + verification doc | Public |
| **Auth** | `POST /api/auth/login` | Authenticate with username/email + password | Public |
| **Auth** | `GET /api/auth/me` | Fetch currently authenticated user details | Auth |
| **Auth** | `POST /api/auth/change-password/request` | Request 6-digit OTP code sent to user email | Auth |
| **Auth** | `POST /api/auth/change-password/verify` | Verify OTP and update user password | Auth |
| **Admin** | `GET /api/admin/pending` | List pending student/alumni registrations | Admin |
| **Admin** | `POST /api/admin/pending/:id/approve` | Approve registration & email login credentials | Admin |
| **Admin** | `POST /api/admin/pending/:id/reject` | Reject registration with optional reviewer note | Admin |
| **Admin** | `GET /api/admin/stats` | Fetch aggregate counts for admin dashboard | Admin |
| **Admin** | `GET /api/admin/analytics` | Fetch comprehensive KPI summaries & Recharts distributions | Admin |
| **Admin** | `GET /api/admin/health-report` | Fetch live server diagnostics, API latency & User Activity Audit Log | Admin |
| **Jobs** | `GET /api/jobs` | Search & filter active job opportunities | Auth |
| **Jobs** | `POST /api/jobs` | Create a new job listing | Auth |
| **Jobs** | `PUT /api/jobs/:id` | Update job details (poster or admin) | Auth |
| **Communities**| `GET /api/communities` | List all alumni communities & membership status | Auth |
| **Communities**| `GET /api/communities/:id/posts` | Retrieve community announcement feed | Member |
| **Profiles** | `GET /api/profiles/:id` | View alumni profile details & career history | Auth |
| **Network** | `GET /api/connections` | List connections & pending requests | Auth |

---

## 5. Automated Testing Suite

GEU Alumni Connect features complete automated testing across both frontend and backend architectures.

### Backend Test Suite (`Jest` + `Supertest` — **36/36 Passing**)
Tests run in-memory against API endpoints, validating middleware guards, credential generation rules, email templates, and database interactions.

```bash
cd backend
npm test
```

**Coverage Breakdown**:
- `tests/app.test.js`: Health checks, CORS headers, 404 handler.
- `tests/services/credentials.test.js`: Cryptographic password rules, OTP formatting, username uniqueness logic.
- `tests/services/email.test.js`: Template formatting and console fallback email logger.
- `tests/middleware/auth.test.js` & `admin.test.js`: JWT token validation, user hydration, admin permissions.
- `tests/routes/auth.test.js`: Registration, login validation, user profile retrieval.
- `tests/routes/admin.test.js`: Pending signup approvals, Platform Analytics distributions, and System Health diagnostics.
- `tests/routes/jobs.test.js`: Job listing creation and validation.
- `tests/routes/communities.test.js`: Membership gatekeeping and announcement feeds.

### Frontend Test Suite (`Vitest` + `React Testing Library` — **10/10 Passing**)
Tests component rendering, user interactions, routing, and API utility layers.

```bash
cd Frontend
npm test
```

**Coverage Breakdown**:
- `src/test/lib/api.test.ts`: Token storage lifecycle (`saveToken`/`clearToken`) and file URL resolution.
- `src/test/pages/Login.test.tsx`: Form rendering and input updates.
- `src/test/pages/Signup.test.tsx`: Registration form headings and required fields.
- `src/test/pages/Jobs.test.tsx`: Job board layout and search filter rendering.

---

## 6. Quick Start & Execution Guide (Zero Trouble Setup)

### Step 1: Database Setup (NeonDB Cloud or Local PostgreSQL)
You can run GEU Alumni Connect with either a cloud Serverless PostgreSQL database (NeonDB) or a local PostgreSQL instance:

#### Option A: NeonDB Serverless Cloud PostgreSQL (Recommended)
1. Sign up for a free account at [neon.tech](https://neon.tech) and create a new project.
2. Copy your PostgreSQL pooled connection string (`postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Run the schema initialization script against your NeonDB instance:
   ```bash
   psql "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" -f schema.sql
   ```

#### Option B: Local PostgreSQL
Make sure PostgreSQL (v14+) is running locally, then initialize the database:
```bash
psql -U postgres -c "CREATE DATABASE geu_alumni;"
psql -U postgres -d geu_alumni -f schema.sql
```

### Step 2: Cloudinary Setup (File & Document Storage)
GEU Alumni Connect uses **Cloudinary** to store student ID verification documents, profile avatars, and PDF resumes.
1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. From your Cloudinary Dashboard, copy your **Cloud Name**, **API Key**, and **API Secret**.
3. You will place these in `backend/.env` in the next step.

### Step 3: Configure & Run Backend Server
```bash
cd backend
npm install
cp .env.example .env
```
Open `backend/.env` and update:
- `DATABASE_URL`: Your NeonDB or local PostgreSQL connection string.
- `JWT_SECRET`: Any secure random secret string.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Your Cloudinary keys from Step 2.
- *Email Note*: If you leave `SMTP_USER` and `SMTP_PASS` empty, the backend automatically runs in **Console Fallback Mode**, printing generated passwords and OTP verification codes directly to your terminal window.

Start the backend API server:
```bash
npm run dev
```
Backend API starts on **http://localhost:3001**.

### Step 4: Create Super-Admin Account via CLI Utility
Open a new terminal window inside `backend/` and run our automated admin creation utility:
```bash
cd backend
node scripts/create-admin.js admin@geu.ac.in admin Admin@12345 "System Super Admin"
```
This instantly creates your super-admin account (`admin` / `Admin@12345`).

### Step 5: Configure & Run Frontend Server
In a separate terminal window:
```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```
Frontend opens on **http://localhost:8080**. Log in with `admin` / `Admin@12345` to access the Admin Panel, sign-up review queue, Platform Analytics, and System Health Diagnostics!

## 7. Cloud Deployment on Render (`render.yaml`)
GEU Alumni Connect is pre-configured for one-click cloud deployment on [Render.com](https://render.com) using our included **`render.yaml` Blueprint** specification:
- Automatically provisions the **Node.js Express Backend Service** and **React Static Site**.
- Includes pre-built Single-Page Application (SPA) rewrite rules (`/*` ➔ `/index.html`).
- For complete, step-by-step instructions on deploying to Render in under 5 minutes and running the initial super-admin setup, read **[`RENDER_DEPLOYMENT.md`](./RENDER_DEPLOYMENT.md)**.

## 8. Detailed Setup Guide
For complete step-by-step instructions on configuring production deployments, Gmail SMTP App Passwords, and operational architecture, refer to **[`SETUP_GUIDE.md`](./SETUP_GUIDE.md)**.

---

## 9. Enterprise Security & Encryption Architecture
GEU Alumni Connect enforces strict data encryption in transit (TLS/SSL) and at rest (`bcryptjs`), complete protection against XSS/Clickjacking (`helmet`), brute-force/DoS mitigation (`express-rate-limit`), HTTP parameter pollution checks (`hpp`), and 100% parameterized SQL query execution. For a full breakdown of all security controls and threat defenses, refer to **[`SECURITY.md`](./SECURITY.md)**.

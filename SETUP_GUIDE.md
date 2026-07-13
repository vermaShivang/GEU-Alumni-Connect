# GEU Alumni Connect — Complete Setup, Execution & Operational Guide

This document provides step-by-step instructions for installing, configuring, testing, and executing the **GEU Alumni Connect** platform from scratch.

---

## Prerequisites & System Requirements

Before starting, ensure your system has the following installed:

| Component | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | v18.0.0 or higher | Runtime for backend Express server & frontend Vite builder |
| **PostgreSQL**| v14.0 or higher | Primary relational database |
| **npm** | v9.0+ (bundled with Node) | Package and script manager |
| **Git** | Any modern version | Source control |

---

## Step 1: Database Initialization & Migrations

### 1.1 Create the PostgreSQL Database
Open your terminal or command prompt and run:
```bash
psql -U postgres -c "CREATE DATABASE geu_alumni;"
```

### 1.2 Initialize Schema
- **For a fresh database installation**, load the full schema:
  ```bash
  psql -U postgres -d geu_alumni -f schema.sql
  ```
- **For upgrading an existing database deployment**, execute the idempotent migration file:
  ```bash
  psql -U postgres -d geu_alumni -f migrations.sql
  ```

### 1.3 Create or Promote the First Super-Admin

Because administrators approve new signups and manage roles, you need an initial super-admin account. You can create one instantly using either our CLI utility or SQL:

#### Option A: One-Command CLI Utility (Recommended)
Navigate to the `backend/` directory and run our automated admin creation script:
```bash
cd backend
node scripts/create-admin.js admin@geu.ac.in admin Admin@12345 "System Super Admin"
```
This script automatically inserts or elevates the account to `is_admin = true` and `is_super_admin = true` with fully hashed credentials.

#### Option B: Manual SQL Promotion
1. First, register through the frontend UI (`http://localhost:8080/signup`) so your application is inserted into `pending_registrations`.
2. Execute the following SQL query to approve the first registration and make that user a super-admin:

```sql
-- Create extension if needed for password generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Approve the first pending signup and make them super-admin
WITH ins AS (
  INSERT INTO users (id, email, username, password_hash, is_admin, is_super_admin, must_change_password)
  SELECT uuid_generate_v4(), email, split_part(email, '@', 1),
         crypt('AdminSecret!123', gen_salt('bf')),
         TRUE, TRUE, TRUE
    FROM pending_registrations
   WHERE status = 'pending'
   ORDER BY created_at LIMIT 1
   RETURNING id, email
)
INSERT INTO profiles (id, user_id, full_name)
SELECT uuid_generate_v4(), ins.id, p.full_name
  FROM ins JOIN pending_registrations p ON p.email = ins.email;

UPDATE pending_registrations SET status = 'approved'
 WHERE id = (SELECT id FROM pending_registrations
              WHERE status = 'pending' ORDER BY created_at LIMIT 1);
```

Once logged in as super-admin (`admin` / `Admin@12345`), you can promote other users directly from the **Admin Dashboard UI** (`/admin`).

---

## Step 2: Backend Configuration & Execution

### 2.1 Install Dependencies
Navigate to the `backend/` directory and install required Node packages:
```bash
cd backend
npm install
```

### 2.2 Environment Configuration (`.env`)
Copy the template environment file:
```bash
cp .env.example .env
```

Edit `backend/.env` with the following variables:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Port where Express API listens |
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` | Connection URI for NeonDB Cloud or Local PostgreSQL |
| `JWT_SECRET` | `long_cryptographic_random_string` | Secret key for signing auth tokens |
| `BASE_URL` | `http://localhost:3001` | Backend public URL |
| `FRONTEND_URL` | `http://localhost:8080` | CORS allowed origin for frontend |
| `CLOUDINARY_CLOUD_NAME` | `dcrv1lp8u` | Your Cloudinary cloud name for file uploads |
| `CLOUDINARY_API_KEY` | `your_cloudinary_api_key` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `your_cloudinary_api_secret` | Cloudinary API Secret |
| `SMTP_HOST` | `smtp.gmail.com` *(Optional)* | Mail host server |
| `SMTP_PORT` | `587` *(Optional)* | SMTP mail port |
| `SMTP_USER` | `alumni.geu@gmail.com` *(Optional)* | Email address for notifications |
| `SMTP_PASS` | `app_specific_password` *(Optional)* | Gmail App Password |

> **Generate a secure `JWT_SECRET` quickly**:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 2.3 Start Backend Server
```bash
npm run dev
```
You should see:
```
✅ GEU Alumni backend running at http://localhost:3001
   ✉  SMTP not configured — emails will be logged to console.
```

---

## Step 3: Frontend Configuration & Execution

Open a **new terminal window** and navigate to the `Frontend/` directory:

### 3.1 Install Dependencies
```bash
cd Frontend
npm install
```

### 3.2 Environment Configuration (`.env`)
Create a `.env` file in `Frontend/` pointing to your backend API:
```bash
echo "VITE_API_URL=http://localhost:3001" > .env
```

### 3.3 Start Frontend Development Server
```bash
npm run dev
```
Open your browser to **http://localhost:8080**.

---

## Step 4: Verification via Automated Test Suite

Before deploying or running end-to-end user workflows, verify that both frontend and backend pass all automated tests.

### 4.1 Run Backend Tests
From the `backend/` directory:
```bash
npm test
```
**Expected Result**: All 9 Jest test suites pass (34 unit & route tests).

### 4.2 Run Frontend Tests
From the `Frontend/` directory:
```bash
npm test
```
**Expected Result**: All 5 Vitest suites pass (10 component & API tests).

---

## Step 5: Email Setup (SMTP vs. Development Console Mode)

### Development Console Mode (Default)
When `SMTP_USER` is not defined in `backend/.env`, the email service operates in **Console Mode**. All approval emails, temporary credentials, and OTP verification codes are cleanly printed to your backend terminal stdout formatted as follows:

```
──────── [EMAIL — console fallback] ────────
To:       student@geu.ac.in
Subject:  GEU Alumni Connect — Your verification code: 482910
--------
Hi student,
Use the code below to change your password. It is valid for 10 minutes.
   482910
────────────────────────────────────────────
```

### Production Gmail SMTP Configuration
To send live emails:
1. Enable **2-Step Verification** on your Google Account.
2. Generate an **App Password** via [Google Account Security](https://myaccount.google.com/apppasswords).
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_USER=your@gmail.com`, and `SMTP_PASS=your_app_password` in `backend/.env`.
4. Restart the backend server.

---

## Step 6: End-to-End System Execution & Verification Walkthrough

1. **Automated Unit & Integration Verification**:
   - Run backend test suite (36 tests verifying auth, admin analytics, health report, jobs, communities):
     ```bash
     cd backend && npm test
     ```
   - Run frontend component test suite (10 tests):
     ```bash
     cd Frontend && npm test
     ```
2. **New User Application**:
   - Navigate to `http://localhost:8080/signup`.
   - Fill in full name, graduation year, student ID, and upload a document.
3. **Admin Review & Approval**:
   - Log into `http://localhost:8080/login` with your Super-Admin account (`admin` / `Admin@12345`).
   - Open `/admin` → **Sign-up Approvals**.
   - Click **Approve**. The system generates a username and temporary password and delivers them via email/console.
4. **Platform Analytics & Interactive Visualizations**:
   - Open `/admin` → **Platform Analytics** tab.
   - Inspect the interactive **Graduation Batches Bar Chart** and **Academic Programs Donut Chart** (powered by Recharts). Click **Refresh Analytics** to see the animated live refresh indicator.
5. **Real-Time System Diagnostics & IP Audit Log**:
   - Open `/admin` → **System & API Health** tab.
   - Click **Run Health Check** to test live database latency, heap memory usage, 7 API microservices latency status, and inspect the real-time **User Activity Audit Log** featuring online pulsing indicators and captured client **IP Addresses**.
6. **First Login & OTP Password Change**:
   - Log in using the newly emailed username + temporary password.
   - The user is routed to `/dashboard/change-password`.
   - Enter current password → receive 6-digit OTP → verify OTP and enter new permanent password.
7. **Alumni Features**:
   - Explore **Job Board** (`/dashboard/jobs`) to post or search jobs.
   - Join **Communities** (`/dashboard/communities`) to view announcements and participate in discussions.
   - Connect with alumni (`/dashboard/network`) to view connection-gated resumes.

---

## Troubleshooting & Frequently Asked Questions

### Q1: `password authentication failed for user postgres`
- Verify that `DATABASE_URL` in `backend/.env` contains your correct PostgreSQL password: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/geu_alumni`.

### Q2: CORS error or `Connection refused` when Frontend calls API
- Ensure `backend/` is running on port `3001`.
- Verify `Frontend/.env` has `VITE_API_URL=http://localhost:3001`.

### Q3: `ERROR: extension "uuid-ossp" does not exist`
- Connect to PostgreSQL as superuser and execute:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

### Q4: OTP expired immediately
- Ensure server time is synchronized (`NOW()` in PostgreSQL matches your server system clock). OTP tokens have a 10-minute TTL.

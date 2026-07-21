# GEU Alumni Connect — Complete Render Deployment Guide

Deploying **GEU Alumni Connect** to [Render.com](https://render.com) is fast and straightforward because the repository includes a pre-configured **`render.yaml` Blueprint** file and full SPA routing support.

---

## 🏗️ Deployment Architecture on Render

When deployed, your application runs as two connected services on Render's global cloud:
1. **`geu-alumni-backend` (Node.js Web Service)**: Runs your Express API, handles file uploads via Cloudinary, and connects to your pooled NeonDB PostgreSQL database.
2. **`geu-alumni-frontend` (React + Vite Static Site)**: Serves your optimized production build (`dist/`) over global CDN with automatic Single-Page Application (SPA) URL rewrites (`/*` ➔ `/index.html`).

---

## 🚀 Option 1: Automated Blueprint Deployment (Recommended)

The easiest way to deploy both services simultaneously is using our `render.yaml` blueprint:

### Step 1: Push `render.yaml` to GitHub
Make sure `render.yaml` is pushed to your GitHub repository (`main` or your active deployment branch).

### Step 2: Create Blueprint on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** at the top right and select **Blueprint**.
3. Connect your GitHub account and select the repository **`Khushi-kat2811/GEU-Alumni-Connect`**.
4. Render will automatically scan and detect `render.yaml`.

### Step 3: Input Environment Secrets
Render will prompt you to enter values for the environment variables marked as `sync: false`:
- **`DATABASE_URL`**: Your pooled NeonDB PostgreSQL connection string (`postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
- **`CLOUDINARY_CLOUD_NAME`**: Your Cloudinary cloud name (e.g., `dcrv1lp8u`).
- **`CLOUDINARY_API_KEY`**: Your Cloudinary API Key.
- **`CLOUDINARY_API_SECRET`**: Your Cloudinary API Secret.
- **`SMTP_USER` / `SMTP_PASS`** *(Optional)*: Enter your Gmail address and App Password if you want live email delivery. If left blank, the backend runs in **Console Fallback Mode** (viewable directly in Render's Log tab).

Click **Apply**. Render will start building and deploying both your backend API and frontend static site.

---

## 🛠️ Option 2: Manual Dashboard Setup

If you prefer creating each service manually from the Render Dashboard instead of using the Blueprint:

### 1. Create Backend Web Service (`geu-alumni-backend`)
1. Click **New +** ➔ **Web Service** and select your GitHub repository.
2. Configure the settings:
   - **Name**: `geu-alumni-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Under **Environment Variables**, add:
   - `DATABASE_URL` = `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
   - `JWT_SECRET` = *(Click "Generate" or enter a long random secret string)*
   - `BASE_URL` = `https://geu-alumni-backend.onrender.com` *(Replace with your exact Render backend URL)*
   - `FRONTEND_URL` = `https://geu-alumni-frontend.onrender.com` *(Replace with your exact Render frontend URL)*
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` = Your Cloudinary credentials
4. Click **Create Web Service**.

### 2. Create Frontend Static Site (`geu-alumni-frontend`)
1. Click **New +** ➔ **Static Site** and select your GitHub repository.
2. Configure the settings:
   - **Name**: `geu-alumni-frontend`
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://geu-alumni-backend.onrender.com` *(Must exactly match your live backend URL)*
4. Under **Redirects/Rewrites**, add a rewrite rule so React Router page refreshes work cleanly across all tabs (`/jobs`, `/admin`, `/network`):
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
5. Click **Create Static Site**.

---

## 🔑 Step 4: Create Your Live Super-Admin Account on Render

Once both services are live on Render, your production database needs an initial super-admin account to approve signups and access the **Platform Analytics & Health Diagnostics Engine (`/admin`)**.

You can create one instantly using **Render Web Shell**:
1. Go to your **`geu-alumni-backend`** web service in the Render Dashboard.
2. Click on the **Shell** tab on the left sidebar.
3. Run our automated super-admin creation utility:
   ```bash
   node scripts/create-admin.js admin@geu.ac.in admin Admin@12345 "System Super Admin"
   ```
4. You will see:
   ```text
   ✅ Successfully created new super-admin user: admin@geu.ac.in
   Username: admin
   Password: Admin@12345
   ```

Now open your live frontend (`https://geu-alumni-frontend.onrender.com`), log in with `admin` / `Admin@12345`, and explore your fully deployed, enterprise-grade alumni networking platform!

---

## 💡 Important Render Free Tier Note (Cold Starts)
If you deploy on Render's **Free Plan**, web services spin down after 15 minutes of inactivity. When someone visits your site after a period of inactivity, the initial backend request (`/api/auth/me` or `/api/jobs`) may take **30–50 seconds** while the server wakes up. Once awake, all subsequent requests are lightning fast!

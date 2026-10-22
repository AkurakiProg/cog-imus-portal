# Church of God World Missions Philippines - Imus Web Portal

A full-stack web application and church management portal for **Church of God World Missions Philippines - Imus**, providing public church information, sermons, events, livestreams, photo galleries, prayer requests, and role-based internal management dashboards for Administrators, Ministry Leaders, and Church Members.

---

## Features

- **Public Church Website**:
  - Home landing page with active announcement banners.
  - Public sermon library with video playback modal.
  - Upcoming and ongoing church events.
  - Photo gallery albums.
  - Interactive prayer request and contact message submission.
  - Livestream broadcast status and viewer integration.
  - Church history and about pages.

- **Authentication & Security**:
  - Secure authentication with bcrypt password hashing (12 rounds).
  - Time-based One-Time Password (TOTP) Two-Factor Authentication (2FA) with recovery codes.
  - Replay attack prevention on 2FA verification.
  - Single-session concurrency enforcement (session watchdog).
  - AES-256-GCM encryption for sensitive field data.
  - HTTP-only JWT cookies with CSRF/XSS mitigations (Helmet, CORS domain restrictions).
  - Rate limiting on public and authentication endpoints.

- **Role-Based Access Control (RBAC)**:
  - **Administrator**: Full system management, user accounts, role assignment, audit logs, financial records, database backup and recovery, department heads, and site content.
  - **Ministry Leader**: Ministry attendance tracking, Connect-to-Serve (C2S) groups, and financial viewing.
  - **Member**: Personal profile management, 2FA setup, prayer requests, event calendar, and ministry involvement.

---

## Tech Stack

- **Runtime & Backend**: Node.js (v18+ recommended, v24 supported), Express 4.19
- **Database**: MySQL / MariaDB (33 relational tables) with connection pooling (`mysql2`)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, FontAwesome 6, Chart.js
- **Security**: Helmet, Express Rate Limit, AES-256-GCM (`crypto`), bcryptjs, otplib
- **Communications**: Nodemailer (SMTP), Semaphore SMS API

---

## Getting Started

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **MySQL** or **MariaDB** 8.0+ / 10.5+

### 2. Installation
```bash
# Clone the repository and navigate into the project directory
cd "COG Imus Portal Website - Deployed"

# Install project dependencies
npm install
```

### 3. Database Setup
1. Create a MySQL database (e.g., `church_portal`):
   ```sql
   CREATE DATABASE church_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Import the complete 33-table schema and initial seed data:
   ```bash
   mysql -u root -p church_portal < database/schema.sql
   ```

### 4. Environment Variables
Copy `.env.example` to `.env` and fill in your environment-specific credentials:
```bash
cp .env.example .env
```
Key configuration items in `.env`:
- `PORT`: Web server port (e.g., `3000`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL database connection
- `JWT_SECRET`: High-entropy random string (minimum 32 characters)
- `DATA_ENCRYPTION_KEY`: 32-byte hex or base64 key for AES-256-GCM encryption
- `SMTP_USER`, `SMTP_PASS`: Dedicated SMTP credentials for transactional emails
- `SEMAPHORE_API_KEY`: Semaphore API key for Philippine SMS OTP notifications

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm start` | `node server.js` | Runs production Express server |
| `npm run dev` | `nodemon server.js` | Runs development server with file auto-reloading |
| `npm test` | `node --test --test-concurrency=1 tests/*.test.js` | Executes automated unit, integration, and regression test suites (38 tests) |
| `npm run lint:check` | `node scripts/lint_check.js` | Runs syntax validation across all 90 JavaScript source files |

---

## Production Deployment

### Recommended: GoDaddy VPS / Linux Server (PM2 + Nginx + MySQL)
This application utilizes persistent local disk storage (`uploads/`), long-running Server-Sent Events (SSE) for realtime livestreams and notifications, and MySQL connection pooling. A Linux Virtual Private Server (Ubuntu/AlmaLinux) or cPanel VPS is the optimal hosting platform.

1. **Deploy Code**: Transfer repository files to `/var/www/cog-portal`.
2. **Install Dependencies**: `npm ci --production`
3. **Configure Environment**: Set up production `.env` with strict secrets.
4. **Process Manager (PM2)**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "cog-portal"
   pm2 startup
   pm2 save
   ```
5. **Reverse Proxy (Nginx)**: Proxy port 80/443 to `http://127.0.0.1:3000` with SSE buffering disabled (`proxy_buffering off;`).
6. **SSL Certificate**: Secure with Let's Encrypt using `certbot --nginx`.

### Alternative: Vercel (Serverless)
A `vercel.json` configuration is included. Note that deploying on Vercel requires:
1. Moving local file uploads (`uploads/`) to cloud storage (AWS S3, Cloudinary, or Supabase Storage).
2. Hosting MySQL on a managed cloud database (e.g., PlanetScale, Supabase, or AWS RDS).
3. Adapting SSE / Realtime bus for serverless execution timeouts.

---

## Security Best Practices
- Keep `.env` strictly confidential and never commit to version control.
- Ensure all uploaded media extensions are sanitized.
- Rotate administrative and service passwords periodically.

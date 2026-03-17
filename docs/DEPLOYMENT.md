# Deployment Guide — Mantra IMIS Portal

## Overview

Mantra IMIS is a **static web application** — it requires no server runtime, database server, or build pipeline to deploy. Simply serve the `src/` directory from any static host.

---

## Prerequisites

- The file `src/index.html` is the complete application.
- All CSS and JavaScript are embedded — no CDN dependencies (except Google Fonts).
- Supabase integration is optional; the app runs fully in mock mode without it.

---

## Hosting Options

### GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `Deploy from a branch`, select `main`, and set the folder to `/src`.
4. Save. Your app will be live at:
   ```
   https://<your-org>.github.io/<repo-name>/
   ```

Or use the npm deploy script:
```bash
npm run deploy:gh-pages
```

---

### Netlify

**Option A — Drag and Drop**
1. Go to [netlify.com](https://netlify.com) → **Add new site → Deploy manually**.
2. Drag the `src/` folder into the deploy zone.
3. Done — you'll receive a `*.netlify.app` URL instantly.

**Option B — Git Integration**
1. Connect your GitHub repository to Netlify.
2. Set **Publish directory** to `src`.
3. Leave **Build command** empty (no build step needed).

**Option C — CLI**
```bash
npm run deploy:netlify
```

**Netlify config** (`netlify.toml` — already included):
```toml
[build]
  publish = "src"
  command = ""

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://*.supabase.co;"
```

---

### Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Output Directory** to `src`.
3. Leave **Build Command** empty.
4. Deploy.

Or via CLI:
```bash
npx vercel --prod
```

---

### Nginx (Self-Hosted)

```nginx
server {
    listen 80;
    server_name imis.yourdomain.org;

    root /var/www/mantra-imis-portal/src;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML — never cache (app updates must be instant)
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store";
    }

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name imis.yourdomain.org;

    ssl_certificate     /etc/letsencrypt/live/imis.yourdomain.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/imis.yourdomain.org/privkey.pem;

    root /var/www/mantra-imis-portal/src;
    index index.html;
}
```

---

### Apache (Self-Hosted)

```apache
<VirtualHost *:443>
    ServerName imis.yourdomain.org
    DocumentRoot /var/www/mantra-imis-portal/src

    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/imis.yourdomain.org/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/imis.yourdomain.org/privkey.pem

    <Directory /var/www/mantra-imis-portal/src>
        Options -Indexes
        AllowOverride All
        Require all granted
    </Directory>

    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
</VirtualHost>
```

---

## Supabase Setup (Production)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Note your **Project URL** and **anon (public) key**.

### 2. Run Schema Migration

Execute the following SQL in the Supabase SQL editor:

```sql
-- Donors
CREATE TABLE donor (
  donor_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name    text NOT NULL,
  donor_code    text UNIQUE NOT NULL,
  donor_type    text,
  description   text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Grants
CREATE TABLE grants (
  grant_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id                uuid REFERENCES donor(donor_id),
  grant_name              text NOT NULL,
  grant_code              text UNIQUE NOT NULL,
  grant_status            text DEFAULT 'active',
  total_committed_amount  numeric,
  currency                text DEFAULT 'INR',
  start_date              date,
  end_date                date,
  description             text,
  is_active               boolean DEFAULT true,
  created_at              timestamptz DEFAULT now()
);

-- Programme scope per grant
CREATE TABLE grant_program_scope (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id         uuid REFERENCES grants(grant_id),
  allocated_amount numeric,
  is_active        boolean DEFAULT true
);

-- Intervention scope per grant
CREATE TABLE grant_intervention_scope (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id         uuid REFERENCES grants(grant_id),
  intervention_id  text,
  is_active        boolean DEFAULT true
);

-- Budget lines
CREATE TABLE grant_framework_budget (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id             uuid REFERENCES grants(grant_id),
  budget_category_code text,
  budget_line_code     text,
  budget_head_name     text,
  intervention_id      text,
  unit_count           numeric,
  cost_per_unit        numeric,
  allocated_amount     numeric DEFAULT 0,
  budget_status        text DEFAULT 'active',
  sort_order           integer,
  created_at           timestamptz DEFAULT now()
);

-- Disbursement schedule
CREATE TABLE grant_disbursement_schedule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id         uuid REFERENCES grants(grant_id),
  installment_no   integer,
  due_date         date,
  expected_amount  numeric DEFAULT 0,
  actual_amount    numeric,
  status           text DEFAULT 'planned',
  notes            text,
  created_at       timestamptz DEFAULT now()
);

-- Reporting schedule
CREATE TABLE grant_reporting_schedule (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id             uuid REFERENCES grants(grant_id),
  report_type          text,
  reporting_period_end date,
  due_date             date,
  status               text DEFAULT 'planned',
  notes                text,
  created_at           timestamptz DEFAULT now()
);
```

### 3. Enable Row Level Security

```sql
ALTER TABLE donor                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_program_scope      ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_intervention_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_framework_budget   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_disbursement_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_reporting_schedule ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all grant data
CREATE POLICY "authenticated read" ON grants
  FOR SELECT TO authenticated USING (true);

-- Only service role can write (via backend functions)
-- Add write policies as needed for your auth model
```

### 4. Configure the Application

In `src/index.html`, find (around line 6006):
```javascript
const SB_URL = 'YOUR_SUPABASE_URL';
const SB_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace with your real values:
```javascript
const SB_URL = 'https://xyzcompany.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

---

## Environment Variables (for CI/CD)

When using GitHub Actions or Netlify/Vercel environment injection, set:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key (safe to expose in frontend) |

> **Never** use the `service_role` key in frontend code.

---

## Security Checklist

- [ ] HTTPS enforced (SSL certificate in place)
- [ ] `X-Frame-Options: DENY` header set
- [ ] `X-Content-Type-Options: nosniff` header set
- [ ] Supabase RLS enabled on all tables
- [ ] Only `anon` key used in frontend (not `service_role`)
- [ ] Google Fonts CSP allowed in Content-Security-Policy
- [ ] Supabase domain allowed in CSP `connect-src`
- [ ] Directory listing disabled on server
- [ ] No sensitive data in git history

---

## CI/CD Pipeline

See `.github/workflows/deploy.yml` for the automated GitHub Actions pipeline that:
1. Validates HTML on every push
2. Deploys to GitHub Pages on merge to `main`

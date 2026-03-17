# Mantra IMIS — Impact Monitoring Information System

> **Version:** v16 · Precision Light (v3.0 Design)
> **Type:** Government SaaS · Education Impact Portal
> **Stack:** Vanilla HTML · CSS · JavaScript · Supabase (optional)

---

## Overview

Mantra IMIS is a browser-based Impact Monitoring Information System built for education programmes across Indian states. It provides M&E teams, field officers, and leadership with a unified platform to track indicators, manage grants, upload response data, and generate impact reports — all from a single, dependency-free HTML application.

---

## Features

| Module | Description |
|---|---|
| **Auth** | Role-based login (POC, Leader, Admin). OTP prototype included. |
| **Dashboard** | KPI strip, program health cards, submission status matrix. |
| **Monthly Reporting** | Indicator submission sheet with autosave, filters, CSV export. |
| **M&E Builder** | Build and publish indicator frameworks per program and intervention. |
| **Grant Management** | Portfolio view, budget tracker, utilisation certificates, disbursement schedule. |
| **Data Upload** | Drag-and-drop CSV/Excel upload with UDISE code mapping and impact computation. |
| **Dark Mode** | Full system-wide dark/light theme toggle. |

---

## Project Structure

```
mantra-imis-portal/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint & validate on every push
│       └── deploy.yml          # Deploy to GitHub Pages / Netlify
│
├── src/
│   └── index.html              # ★ Main application (self-contained, untouched)
│
├── public/
│   └── assets/
│       ├── icons/              # Favicon, PWA icons
│       └── fonts/              # Offline font fallbacks (optional)
│
├── docs/
│   ├── ARCHITECTURE.md         # System design and data flow
│   ├── USER_GUIDE.md           # Role-based feature walkthrough
│   ├── DEPLOYMENT.md           # Hosting and Supabase setup guide
│   └── CHANGELOG.md            # Version history
│
├── config/
│   └── supabase.example.env    # Supabase config template
│
├── scripts/
│   ├── serve.sh                # Local dev server (Python / npx serve)
│   └── deploy.sh               # Manual deploy helper
│
├── tests/
│   └── README.md               # Testing strategy and future test plan
│
├── .editorconfig               # Consistent editor settings
├── .gitignore                  # Git ignore rules
├── LICENSE                     # MIT License
├── package.json                # npm scripts (serve, lint)
└── README.md                   # This file
```

---

## Quick Start

### Option 1 — Open Directly (No install needed)

```bash
# Simply open in any modern browser
open src/index.html
```

### Option 2 — Local Dev Server (Recommended)

```bash
# Using npm
npm install
npm run serve

# OR using Python
python -m http.server 3000 --directory src
```

Then visit: **http://localhost:3000**

### Option 3 — Using the shell script

```bash
bash scripts/serve.sh
```

---

## Supabase Integration

The application ships in **mock mode** by default — all actions are simulated in-memory. To connect a real Supabase backend:

1. Copy the config template:
   ```bash
   cp config/supabase.example.env config/supabase.env
   ```

2. Fill in your project credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

3. In `src/index.html`, locate the Supabase config block (search `YOUR_SUPABASE_URL`) and replace with your values:
   ```javascript
   const SB_URL = 'https://your-project.supabase.co';
   const SB_KEY = 'your-anon-key';
   ```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full Supabase schema and RLS policy setup.

---

## Roles

| Role | Access |
|---|---|
| `poc` | Monthly reporting, data upload |
| `leader` | All POC access + M&E Builder + Dashboard analytics |
| `admin` | All access + Grant Management + system configuration |

---

## Supported Programmes

Bihar · Karnataka · Uttar Pradesh · Odisha · Punjab · Rajasthan · Madhya Pradesh · Jharkhand · Assam · Maharashtra

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | Full |
| Firefox 88+ | Full |
| Safari 14+ | Full |
| Edge 90+ | Full |
| IE 11 | Not supported |

---

## Deployment

| Platform | Guide |
|---|---|
| GitHub Pages | [docs/DEPLOYMENT.md#github-pages](docs/DEPLOYMENT.md) |
| Netlify | [docs/DEPLOYMENT.md#netlify](docs/DEPLOYMENT.md) |
| Vercel | [docs/DEPLOYMENT.md#vercel](docs/DEPLOYMENT.md) |
| Self-hosted Nginx | [docs/DEPLOYMENT.md#nginx](docs/DEPLOYMENT.md) |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT © Mantra IMIS Contributors — see [LICENSE](LICENSE)

# Eco Tray Solutions — Deployment Guide
## GitHub → Cloudflare Pages → ecotraysolutions.com

---

## STEP 1 — Push to GitHub (do this on YOUR computer)

Open Terminal (Mac) or Command Prompt (Windows) and run these commands
one by one. Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

```bash
# 1. Go to the project folder
cd "Eco Tray Solutions LLP/ecotray-website"

# 2. Initialize git (already done — skip if .git folder exists)
git init
git branch -m main

# 3. Connect to GitHub (create the repo first at github.com/new)
#    Name it: ecotray-solutions  (or any name you prefer)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/ecotray-solutions.git

# 4. Stage and commit everything
git add .
git commit -m "Initial release: Eco Tray Solutions website v1.0"

# 5. Push to GitHub
git push -u origin main
```

> If it asks for a password, use a GitHub Personal Access Token (PAT):
> GitHub.com → Settings → Developer settings → Personal access tokens → Generate new token
> Give it "repo" scope. Use the token as your password.

---

## STEP 2 — Deploy on Cloudflare Pages

### 2a. Log in to Cloudflare
Go to: https://dash.cloudflare.com

### 2b. Create a Pages project
1. Click **Workers & Pages** in the left sidebar
2. Click **Create application** → **Pages** tab
3. Click **Connect to Git**
4. Authorise Cloudflare to access your GitHub account
5. Select your **ecotray-solutions** repository
6. Click **Begin setup**

### 2c. Build settings (IMPORTANT)
The website is pure static HTML — no build step needed.

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | *(leave blank)* |
| Build output directory | `/` (root) |

Click **Save and Deploy**.

Cloudflare will deploy in about 60 seconds and give you a URL like:
`https://ecotray-solutions.pages.dev`

---

## STEP 3 — Configure Contact Form Email (Cloudflare Pages Function)

The repo includes `functions/submit.js` — a Cloudflare Pages Function that
handles `POST /submit` automatically (no extra server needed). It uses
**MailChannels**, which is free and built into Cloudflare Workers.

### 3a. Set Environment Variables in Cloudflare Dashboard
Go to: **Cloudflare Dashboard → Workers & Pages → your project → Settings → Environment variables**

Add these three variables (click "Add variable" for each):

| Variable name  | Value to enter                        |
|----------------|---------------------------------------|
| `ADMIN_EMAILS` | `hummusrepublicavon@gmail.com`        |
| `FROM_EMAIL`   | `noreply@ecotraysolutions.com`        |
| `FROM_NAME`    | `Eco Tray Solutions Website`          |

Click **Save and deploy** after adding all three.

> These are NOT secrets — no need to encrypt them. But if you want to add
> multiple admin emails, separate with commas: `email1@x.com,email2@x.com`

### 3b. Enable MailChannels (DKIM — recommended for deliverability)
Without DKIM, emails may land in spam. Add this DNS TXT record in Cloudflare:

1. Go to **Cloudflare Dashboard → ecotraysolutions.com → DNS**
2. Click **Add record**
3. Fill in:
   - Type: `TXT`
   - Name: `_mailchannels`
   - Content: `v=mc1 cfid=ecotraysolutions.com`
   - TTL: `Auto`
4. Click **Save**

This authorises MailChannels to send email on behalf of your domain.

### 3c. Test the contact form
Once deployed to `ecotraysolutions.com`, fill in the contact form and submit.
You should receive an email at `hummusrepublicavon@gmail.com` within seconds.
If it lands in spam, add the sender to your contacts.

### Local testing (without Cloudflare)
Run `node server.js` on your machine — the form auto-detects `localhost`
and posts to `http://localhost:3000/submit` instead. Requires `.env` with
Gmail SMTP credentials (see STEP 5).

---

## STEP 4 — Connect ecotraysolutions.com to Cloudflare Pages

You have already purchased **ecotraysolutions.com** via Cloudflare — great!
Cloudflare manages both the domain and the CDN, so connecting is seamless.

### 4a. Attach domain to Pages
1. In your Pages project → **Custom domains** tab
2. Click **Set up a custom domain**
3. Enter `ecotraysolutions.com` (and optionally `www.ecotraysolutions.com`)
4. Cloudflare automatically creates the DNS records — no manual DNS edits needed

### 4b. SSL / HTTPS
Cloudflare provisions a free SSL certificate automatically within a few minutes.
Your site will be live at **https://ecotraysolutions.com** with full HTTPS.

---

## STEP 5 — Configure Email for Local Dev (SMTP)

Create a `.env` file in your project root (NEVER commit this to git):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
ADMIN_EMAILS=your_email@gmail.com
FROM_NAME=Eco Tray Solutions Website
FROM_EMAIL=noreply@ecotraysolutions.com
```

**Gmail App Password setup:**
1. Go to myaccount.google.com → Security
2. Enable 2-Step Verification (required)
3. Search "App passwords" → Create one named "Eco Tray Website"
4. Copy the 16-character password → paste as SMTP_PASS

---

## YOUR DOMAIN
**ecotraysolutions.com** — purchased and managed on Cloudflare.

Auto-renews annually through Cloudflare at cost (~$10–12/year).
Manage at: https://dash.cloudflare.com → **Domain Registration → Manage**

---

## WHAT HAPPENS AFTER GITHUB PUSH

Every time you push a change to the `main` branch:
1. GitHub notifies Cloudflare automatically
2. Cloudflare rebuilds and redeploys in ~30 seconds
3. Your live site updates with zero downtime

This is your full CI/CD pipeline — no extra tools needed.

---

## QUICK REFERENCE — Commands you'll use regularly

```bash
# Make a change, then deploy it:
git add -A
git commit -m "Update product descriptions"
git push

# Start local server for testing:
node server.js
# Then open: http://localhost:3000

# Install dependencies (first time or after pulling):
npm install
```

/* ============================================================
   ECO TRAY SOLUTIONS — LOCAL / PRODUCTION SERVER
   Stack : Node.js + Express
   Features:
     - Serves all static HTML/CSS/JS/assets
     - Handles POST /submit from the contact form
     - Captures submitter's IP + geo-location via ip-api.com
     - Sends a formatted HTML admin email via Nodemailer
     - Returns JSON { success: true/false } to the frontend

   HOW TO RUN LOCALLY:
     1. npm install
     2. Copy .env.example to .env and fill in your SMTP details
     3. node server.js   (or: npm start)
     4. Open http://localhost:3000

   FOR PRODUCTION (Cloudflare Pages + Workers / any Node host):
     - Set the ENV variables on your host dashboard instead of .env
     - The static files can alternatively be served by Cloudflare CDN
       with only the /submit endpoint running as a Worker or on a VPS.
   ============================================================ */

'use strict';

const path      = require('path');
const http      = require('http');
const https     = require('https');
const fs        = require('fs');

// ── Graceful dependency loading ────────────────────────────
let express, nodemailer;

try { express    = require('express');    } catch(e) { express    = null; }
try { nodemailer = require('nodemailer'); } catch(e) { nodemailer = null; }

// ── Load .env if present (local dev) ───────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .forEach(l => {
      const [k, ...v] = l.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
}

const PORT    = process.env.PORT    || 3000;
const SITE_DIR = __dirname;

// ── CONFIG (edit or set via .env) ─────────────────────────
const CONFIG = {
  // SMTP settings — replace with your email provider details
  smtp: {
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user:   process.env.SMTP_USER   || 'YOUR_EMAIL@gmail.com',
    pass:   process.env.SMTP_PASS   || 'YOUR_APP_PASSWORD',
  },
  // Where the admin notification email goes
  adminEmails: (process.env.ADMIN_EMAILS || 'admin@ecotraysolutions.com').split(',').map(e => e.trim()),
  // The "from" address shown on admin emails
  fromName:    process.env.FROM_NAME  || 'Eco Tray Solutions Website',
  fromEmail:   process.env.FROM_EMAIL || 'noreply@ecotraysolutions.com',
};

// ── Fallback: pure Node.js static server (no Express) ─────
if (!express) {
  console.log('Express not found — starting minimal static file server...');
  startMinimalServer();
} else {
  startExpressServer();
}

/* ════════════════════════════════════════════════════════════
   EXPRESS SERVER (full feature set)
   ════════════════════════════════════════════════════════════ */
function startExpressServer() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve all static files from the website folder
  app.use(express.static(SITE_DIR, {
    extensions: ['html'],
    index:      'index.html',
  }));

  // ── POST /submit — contact form handler ─────────────────
  app.post('/submit', async (req, res) => {
    const { fullName, countryCode, phoneNumber, email, itemDescription, timeline } = req.body;

    // Basic server-side validation
    if (!fullName || !email || !itemDescription || !timeline) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    // Get submitter IP
    const ip = (
      req.headers['cf-connecting-ip']  ||   // Cloudflare
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'Unknown'
    ).replace('::ffff:', '');

    // Geo-lookup the IP (non-blocking, best-effort)
    let geo = { city: 'Unknown', regionName: '', country: 'Unknown', isp: '' };
    try {
      geo = await ipLookup(ip);
    } catch (_) { /* silently skip if lookup fails */ }

    // Timeline label map
    const timelineLabels = {
      '0-3months': 'Within 0–3 months',
      '3-6months': '3–6 months',
      'inquiring': 'Just inquiring',
      'other':     'Other',
    };
    const timelineLabel = timelineLabels[timeline] || timeline;

    // Build the admin HTML email
    const htmlEmail = buildAdminEmail({
      fullName, countryCode, phoneNumber, email,
      itemDescription, timelineLabel, ip, geo,
      submittedAt: new Date().toUTCString(),
    });

    // Send email (if nodemailer available + SMTP configured)
    let emailSent = false;
    if (nodemailer && CONFIG.smtp.user !== 'YOUR_EMAIL@gmail.com') {
      try {
        const transporter = nodemailer.createTransport({
          host:   CONFIG.smtp.host,
          port:   CONFIG.smtp.port,
          secure: CONFIG.smtp.secure,
          auth: {
            user: CONFIG.smtp.user,
            pass: CONFIG.smtp.pass,
          },
        });

        await transporter.sendMail({
          from:    `"${CONFIG.fromName}" <${CONFIG.fromEmail}>`,
          to:      CONFIG.adminEmails.join(', '),
          subject: `🌿 New Enquiry from ${fullName} — Eco Tray Solutions`,
          html:    htmlEmail,
        });

        emailSent = true;
        console.log(`[${new Date().toISOString()}] Email sent for enquiry from: ${email}`);
      } catch (err) {
        console.error(`[EMAIL ERROR] ${err.message}`);
      }
    } else {
      // Log to console in dev mode (SMTP not configured)
      console.log('\n' + '═'.repeat(60));
      console.log('📬  NEW ENQUIRY RECEIVED (email not configured — logging)');
      console.log('═'.repeat(60));
      console.log(`  Name:        ${fullName}`);
      console.log(`  Phone:       ${countryCode || ''} ${phoneNumber || ''}`);
      console.log(`  Email:       ${email}`);
      console.log(`  Timeline:    ${timelineLabel}`);
      console.log(`  Description: ${itemDescription.substring(0, 120)}...`);
      console.log(`  IP:          ${ip}`);
      console.log(`  Location:    ${geo.city}, ${geo.regionName}, ${geo.country}`);
      console.log(`  ISP:         ${geo.isp}`);
      console.log(`  Time:        ${new Date().toUTCString()}`);
      console.log('═'.repeat(60) + '\n');
      emailSent = true; // treat as success in dev
    }

    if (emailSent) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Could not send notification email.' });
    }
  });

  // 404 fallback
  app.use((req, res) => {
    res.status(404).sendFile(path.join(SITE_DIR, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log('\n' + '🌿 '.repeat(20));
    console.log(`  ECO TRAY SOLUTIONS — Local Server Running`);
    console.log(`  ➜  http://localhost:${PORT}`);
    console.log(`  ➜  http://localhost:${PORT}/about.html`);
    console.log(`  ➜  http://localhost:${PORT}/testimonials.html`);
    console.log(`  ➜  http://localhost:${PORT}/contact.html`);
    console.log('');
    console.log(`  SMTP configured: ${CONFIG.smtp.user !== 'YOUR_EMAIL@gmail.com' ? '✅ Yes' : '⚠️  No (form logs to console)'}`);
    console.log(`  Admin email(s):  ${CONFIG.adminEmails.join(', ')}`);
    console.log('🌿 '.repeat(20) + '\n');
  });
}

/* ════════════════════════════════════════════════════════════
   MINIMAL STATIC SERVER (fallback — no Express needed)
   ════════════════════════════════════════════════════════════ */
function startMinimalServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    // Handle POST /submit in minimal mode
    if (req.method === 'POST' && urlPath === '/submit') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('\n📬 NEW ENQUIRY (minimal mode):');
          console.log(JSON.stringify(data, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false }));
        }
      });
      return;
    }

    const filePath = path.join(SITE_DIR, urlPath);
    const ext      = path.extname(filePath);
    const mime     = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(SITE_DIR, 'index.html'), (e2, d2) => {
          res.writeHead(e2 ? 404 : 200, { 'Content-Type': 'text/html' });
          res.end(d2 || 'Not found');
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
    console.log(`\n🌿 Eco Tray Solutions (minimal mode) → http://localhost:${PORT}\n`);
  });
}

/* ════════════════════════════════════════════════════════════
   IP GEO-LOOKUP (free, no API key needed)
   ════════════════════════════════════════════════════════════ */
function ipLookup(ip) {
  return new Promise((resolve, reject) => {
    // Skip lookup for localhost / private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
      return resolve({ city: 'Localhost', regionName: 'Local Network', country: 'Local', isp: 'N/A' });
    }

    const url = `http://ip-api.com/json/${ip}?fields=status,city,regionName,country,isp,query`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success') resolve(parsed);
          else reject(new Error('IP lookup failed'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/* ════════════════════════════════════════════════════════════
   HTML EMAIL BUILDER
   ════════════════════════════════════════════════════════════ */
function buildAdminEmail({ fullName, countryCode, phoneNumber, email, itemDescription, timelineLabel, ip, geo, submittedAt }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width"/>
<title>New Enquiry — Eco Tray Solutions</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1B5E20,#2E7D32,#388E3C);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">🌿 New Enquiry Received</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Eco Tray Solutions Website</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#374151;">A new quote request has been submitted via the website contact form. Details below:</p>

          <!-- Contact Info -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td colspan="2" style="padding-bottom:12px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Contact Information</span>
            </td></tr>
            ${row('👤 Full Name',    fullName)}
            ${row('📞 Phone',        `${countryCode || ''} ${phoneNumber || '—'}`)}
            ${row('✉️ Email',        `<a href="mailto:${email}" style="color:#2E7D32;font-weight:600;">${email}</a>`)}
          </table>

          <!-- Enquiry Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td colspan="2" style="padding-bottom:12px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Enquiry Details</span>
            </td></tr>
            ${row('📅 Timeline', timelineLabel)}
            <tr>
              <td style="padding:10px 14px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB;" colspan="2">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">📦 Item Description</p>
                <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">${escHtml(itemDescription)}</p>
              </td>
            </tr>
          </table>

          <!-- IP / Location -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td colspan="2" style="padding-bottom:12px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Submission Metadata</span>
            </td></tr>
            ${row('🌐 IP Address',  ip)}
            ${row('📍 Location',   `${geo.city || ''}${geo.regionName ? ', '+geo.regionName : ''}, ${geo.country || 'Unknown'}`)}
            ${row('🏢 ISP',        geo.isp || 'Unknown')}
            ${row('🕐 Timestamp',  submittedAt)}
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-top:32px;">
            <a href="mailto:${email}?subject=Re: Your Eco Tray Solutions Enquiry&body=Hi ${encodeURIComponent(fullName)},%0A%0AThank you for your enquiry..."
               style="display:inline-block;background:#2E7D32;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:100px;">
              Reply to ${escHtml(fullName)} →
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">This email was automatically generated by the Eco Tray Solutions website contact form.<br/>Do not reply to this email directly — use the button above to reply to the enquirer.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 14px 8px 0;font-size:13px;font-weight:600;color:#6B7280;white-space:nowrap;vertical-align:top;width:140px;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:500;">${value}</td>
    </tr>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

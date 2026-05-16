/**
 * ECO TRAY SOLUTIONS — Cloudflare Pages Function
 * Route: POST /submit  (auto-mapped from functions/submit.js)
 *
 * Handles contact form submissions:
 *  1. Validates required fields server-side
 *  2. Geo-locates the submitter's IP via Cloudflare's built-in CF object
 *  3. Sends a formatted HTML admin email via Resend (https://resend.com)
 *
 * Environment variables to set in Cloudflare Pages → Settings → Variables:
 *   RESEND_API_KEY — from resend.com dashboard (e.g. re_xxxxxxxxxxxx)
 *   ADMIN_EMAILS   — comma-separated list, e.g. umangrdesai@gmail.com
 *   FROM_EMAIL     — verified sender, e.g. noreply@ecotraysolutions.com
 *   FROM_NAME      — e.g. Eco Tray Solutions Website
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── CORS headers ──────────────────────────────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Parse body ────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid request body.' }, 400, corsHeaders);
  }

  const { fullName, countryCode, phoneNumber, email, itemDescription, timeline } = body;

  // ── Server-side validation ────────────────────────────────
  if (!fullName || !email || !itemDescription || !timeline) {
    return jsonResponse({ success: false, error: 'Missing required fields.' }, 400, corsHeaders);
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    return jsonResponse({ success: false, error: 'Invalid email address.' }, 400, corsHeaders);
  }

  // ── Get IP + Cloudflare geo ───────────────────────────────
  const ip = request.headers.get('CF-Connecting-IP') || 'Unknown';
  const cf = request.cf || {};
  const geo = {
    city:    cf.city            || 'Unknown',
    region:  cf.region          || '',
    country: cf.country         || 'Unknown',
    isp:     cf.asOrganization  || 'Unknown',
  };

  // ── Timeline label ────────────────────────────────────────
  const timelineLabels = {
    '0-3months': 'Within 0–3 months',
    '3-6months': '3–6 months',
    'inquiring': 'Just inquiring',
    'other':     'Other',
  };
  const timelineLabel = timelineLabels[timeline] || timeline;
  const submittedAt   = new Date().toUTCString();

  // ── Config ───────────────────────────────────────────────
  const resendApiKey  = env.RESEND_API_KEY || '';
  const adminEmails   = (env.ADMIN_EMAILS || 'umangrdesai@gmail.com')
                          .split(',').map(e => e.trim());
  const fromName      = env.FROM_NAME  || 'Eco Tray Solutions Website';
  const fromEmail     = env.FROM_EMAIL || 'noreply@ecotraysolutions.com';

  const htmlEmail = buildAdminEmail({
    fullName, countryCode, phoneNumber, email,
    itemDescription, timelineLabel, ip, geo, submittedAt,
  });

  // ── Send via Resend API ───────────────────────────────────
  let sent = false;
  let errorDetail = '';

  if (!resendApiKey) {
    errorDetail = 'RESEND_API_KEY not configured';
    console.error(errorDetail);
  } else {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from:    `${fromName} <${fromEmail}>`,
          to:      adminEmails,
          subject: `New Enquiry from ${fullName} — Eco Tray Solutions`,
          html:    htmlEmail,
          reply_to: email,
        }),
      });

      const resendBody = await resendRes.json();

      if (resendRes.ok) {
        sent = true;
        console.log('Email sent via Resend, id:', resendBody.id);
      } else {
        errorDetail = JSON.stringify(resendBody);
        console.error('Resend error:', errorDetail);
      }
    } catch (err) {
      errorDetail = err.message;
      console.error('Email send exception:', errorDetail);
    }
  }

  // Log submission regardless
  console.log(JSON.stringify({
    event:     'form_submission',
    name:      fullName,
    email,
    timeline:  timelineLabel,
    ip,
    city:      geo.city,
    country:   geo.country,
    timestamp: submittedAt,
    emailSent: sent,
    error:     errorDetail || null,
  }));

  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ── CORS preflight ────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:8px 14px 8px 0;font-size:13px;font-weight:600;color:#6B7280;white-space:nowrap;vertical-align:top;width:140px;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:500;">${value}</td>
    </tr>`;
}

function buildAdminEmail({ fullName, countryCode, phoneNumber, email, itemDescription, timelineLabel, ip, geo, submittedAt }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Enquiry — Eco Tray Solutions</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <tr>
        <td style="background:linear-gradient(135deg,#1B5E20,#2E7D32,#388E3C);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">New Enquiry Received</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">ecotraysolutions.com — Contact Form</p>
        </td>
      </tr>

      <tr><td style="padding:36px 40px;">
        <p style="margin:0 0 24px;font-size:15px;color:#374151;">A new quote request was submitted. Details below:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td colspan="2" style="padding-bottom:12px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Contact Information</span>
          </td></tr>
          ${row('Full Name', escHtml(fullName))}
          ${row('Phone', escHtml(`${countryCode || ''} ${phoneNumber || '—'}`))}
          ${row('Email', `<a href="mailto:${escHtml(email)}" style="color:#2E7D32;font-weight:600;">${escHtml(email)}</a>`)}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td colspan="2" style="padding-bottom:12px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Enquiry Details</span>
          </td></tr>
          ${row('Timeline', escHtml(timelineLabel))}
          <tr>
            <td colspan="2" style="padding:10px 14px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Item Description</p>
              <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">${escHtml(itemDescription)}</p>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td colspan="2" style="padding-bottom:12px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Submission Metadata</span>
          </td></tr>
          ${row('IP Address', escHtml(ip))}
          ${row('Location', escHtml(`${geo.city}${geo.region ? ', ' + geo.region : ''}, ${geo.country}`))}
          ${row('ISP / Org', escHtml(geo.isp))}
          ${row('Timestamp', escHtml(submittedAt))}
        </table>

        <div style="text-align:center;margin-top:32px;">
          <a href="mailto:${escHtml(email)}?subject=Re:%20Your%20Eco%20Tray%20Solutions%20Enquiry"
             style="display:inline-block;background:#2E7D32;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:100px;">
            Reply to ${escHtml(fullName)} &rarr;
          </a>
        </div>
      </td></tr>

      <tr>
        <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">Auto-generated by ecotraysolutions.com contact form.<br/>Use the button above to reply directly to the enquirer.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

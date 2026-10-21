/**
 * ECOTRAY SOLUTIONS — Customer Reviews API (Cloudflare Pages Function)
 * Routes:
 *   GET  /api/reviews  → list of APPROVED reviews (public fields only)
 *   POST /api/reviews  → submit a review; stored as PENDING and the admin
 *                        is emailed Approve / Reject links.
 *
 * Bindings / variables (Cloudflare → Pages project → Settings):
 *   REVIEWS        KV namespace binding (required)
 *   REVIEW_SECRET  long random string used to sign approve/reject links (required, mark as Secret)
 *   RESEND_API_KEY, ADMIN_EMAILS, FROM_EMAIL, FROM_NAME  (same as contact form)
 *
 * KV layout:
 *   review:<id>              full record incl. private email, IP, status
 *   approved:<ts>-<id>       public copy, written only on approval
 *   rl:<ip>                  rate-limit counter (expires after 1 hour)
 */

const MAX_PUBLIC = 60;

export async function onRequestGet({ env }) {
  if (!env.REVIEWS) return json({ reviews: [] });
  const list = await env.REVIEWS.list({ prefix: 'approved:', limit: 1000 });
  // newest first (keys contain a timestamp)
  const keys = list.keys.map((k) => k.name).sort().reverse().slice(0, MAX_PUBLIC);
  const reviews = (await Promise.all(keys.map((k) => env.REVIEWS.get(k, 'json')))).filter(Boolean);
  return json({ reviews }, 200, { 'Cache-Control': 'public, max-age=60' });
}

export async function onRequestPost({ request, env }) {
  if (!env.REVIEWS || !env.REVIEW_SECRET) {
    return json({ success: false, error: 'Reviews are not set up yet. Please email us instead.' }, 503);
  }

  let b;
  try { b = await request.json(); } catch { return json({ success: false, error: 'Invalid request.' }, 400); }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (b.website) return json({ success: true });

  const clean = (v, max) => String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
  const r = {
    name:     clean(b.name, 80),
    business: clean(b.business, 100),
    location: clean(b.location, 80),
    email:    clean(b.email, 120).toLowerCase(),
    products: clean(b.products, 120),
    text:     String(b.text || '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, 1200),
    rating:   Math.round(Number(b.rating)),
  };

  if (!r.name || !r.business) return json({ success: false, error: 'Please add your name and business name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return json({ success: false, error: 'Please enter a valid email.' }, 400);
  if (!(r.rating >= 1 && r.rating <= 5)) return json({ success: false, error: 'Please choose a star rating.' }, 400);
  if (r.text.length < 20) return json({ success: false, error: 'Please write at least 20 characters.' }, 400);
  if (b.consent !== true) return json({ success: false, error: 'Please tick the confirmation box.' }, 400);

  // Rate limit: max 3 submissions per IP per hour
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `rl:${ip}`;
  const hits = Number(await env.REVIEWS.get(rlKey)) || 0;
  if (hits >= 3) return json({ success: false, error: 'Too many submissions. Please try again later.' }, 429);
  await env.REVIEWS.put(rlKey, String(hits + 1), { expirationTtl: 3600 });

  const cf = request.cf || {};
  const id = crypto.randomUUID();
  const record = {
    id, ...r, status: 'pending',
    createdAt: new Date().toISOString(),
    ip, geo: [cf.city, cf.region, cf.country].filter(Boolean).join(', ') || 'Unknown',
  };
  await env.REVIEWS.put(`review:${id}`, JSON.stringify(record));

  // Email admin with signed moderation links
  const origin = new URL(request.url).origin;
  const link = async (action) => `${origin}/api/reviews/moderate?id=${id}&action=${action}&sig=${await sign(env.REVIEW_SECRET, `${id}:${action}`)}`;
  await sendAdminEmail(env, record, await link('approve'), await link('reject'));

  return json({ success: true });
}

// ── Helpers ─────────────────────────────────────────────────
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export async function sign(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendAdminEmail(env, r, approveUrl, rejectUrl) {
  if (!env.RESEND_API_KEY) { console.error('RESEND_API_KEY missing; review stored but no email sent', r.id); return; }
  const to = (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (!to.length) { console.error('ADMIN_EMAILS missing'); return; }
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
  const row = (l, v) => `<tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#6B7280;font-weight:600;vertical-align:top;white-space:nowrap">${l}</td><td style="padding:6px 0;font-size:14px;color:#111827">${v}</td></tr>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f4;font-family:Inter,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#2E7D32;padding:26px 36px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:20px">New review waiting for approval</h1>
      <p style="margin:6px 0 0;color:#fff;font-size:22px;letter-spacing:2px">${stars}</p></td></tr>
    <tr><td style="padding:28px 36px">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Name', esc(r.name))}${row('Business', esc(r.business))}${row('Location', esc(r.location) || '—')}
        ${row('Email (private)', esc(r.email))}${row('Ordered', esc(r.products) || '—')}
        ${row('IP / Geo', esc(r.ip) + ' — ' + esc(r.geo))}${row('Submitted', esc(r.createdAt))}
      </table>
      <div style="margin:18px 0;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#111827">${esc(r.text)}</div>
      <p style="font-size:13px;color:#6B7280;margin:0 0 18px">Check this matches a real order before approving. Approved reviews appear on the Testimonials page within about a minute.</p>
      <div style="text-align:center">
        <a href="${approveUrl}" style="display:inline-block;background:#2E7D32;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:100px;margin:4px">Approve &amp; publish</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#fff;color:#B91C1C;border:2px solid #B91C1C;text-decoration:none;font-weight:700;padding:10px 26px;border-radius:100px;margin:4px">Reject</a>
      </div>
    </td></tr>
  </table></td></tr></table></body></html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${env.FROM_NAME || 'Ecotray Solutions Website'} <${env.FROM_EMAIL || 'noreply@ecotraysolutions.com'}>`,
        to, subject: `New ${r.rating}★ review from ${r.business} — approval needed`, html, reply_to: r.email,
      }),
    });
    if (!res.ok) console.error('Resend error', await res.text());
  } catch (e) { console.error('Email exception', e.message); }
}

/**
 * ECOTRAY SOLUTIONS — Review moderation (Cloudflare Pages Function)
 * Route: /api/reviews/moderate?id=…&action=approve|reject&sig=…
 *
 * GET  shows a confirmation page (so email link-scanners can't auto-approve).
 * POST performs the action. Links are signed with REVIEW_SECRET (HMAC-SHA256).
 */
import { sign } from './index.js';

async function verify(env, url) {
  const id = url.searchParams.get('id') || '';
  const action = url.searchParams.get('action') || '';
  const sig = url.searchParams.get('sig') || '';
  if (!env.REVIEWS || !env.REVIEW_SECRET) return { error: 'Reviews are not configured.' };
  if (!/^[0-9a-f-]{36}$/.test(id) || !['approve', 'reject'].includes(action)) return { error: 'Invalid link.' };
  const expected = await sign(env.REVIEW_SECRET, `${id}:${action}`);
  if (!timingSafeEqual(expected, sig)) return { error: 'This link is not valid.' };
  const rec = await env.REVIEWS.get(`review:${id}`, 'json');
  if (!rec) return { error: 'Review not found. It may have been deleted.' };
  return { id, action, rec };
}

export async function onRequestGet({ request, env }) {
  const v = await verify(env, new URL(request.url));
  if (v.error) return page('Can’t open this review', `<p>${esc(v.error)}</p>`, 400);
  const { action, rec } = v;
  if (rec.status !== 'pending') {
    return page('Already handled', `<p>This review was already <strong>${esc(rec.status)}</strong>.</p>${preview(rec)}`);
  }
  const label = action === 'approve' ? 'Approve &amp; publish' : 'Reject review';
  const color = action === 'approve' ? '#2E7D32' : '#B91C1C';
  return page(action === 'approve' ? 'Publish this review?' : 'Reject this review?',
    `${preview(rec)}
     <form method="POST"><button style="background:${color};color:#fff;border:0;font-weight:700;font-size:16px;padding:14px 32px;border-radius:100px;cursor:pointer">${label}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const v = await verify(env, new URL(request.url));
  if (v.error) return page('Can’t update this review', `<p>${esc(v.error)}</p>`, 400);
  const { id, action, rec } = v;
  if (rec.status !== 'pending') return page('Already handled', `<p>This review was already <strong>${esc(rec.status)}</strong>.</p>`);

  rec.status = action === 'approve' ? 'approved' : 'rejected';
  rec.moderatedAt = new Date().toISOString();
  await env.REVIEWS.put(`review:${id}`, JSON.stringify(rec));

  if (rec.status === 'approved') {
    const pub = {
      id, name: rec.name, business: rec.business, location: rec.location,
      products: rec.products, rating: rec.rating, text: rec.text,
      createdAt: rec.createdAt, approvedAt: rec.moderatedAt,
    };
    await env.REVIEWS.put(`approved:${Date.now()}-${id}`, JSON.stringify(pub));
    return page('Published ✓', `<p>The review from <strong>${esc(rec.business)}</strong> is now live.</p><p><a href="/testimonials.html#reviews">View the Testimonials page →</a></p>`);
  }
  return page('Rejected', `<p>The review from <strong>${esc(rec.business)}</strong> will not be shown.</p>`);
}

// ── Helpers ─────────────────────────────────────────────────
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function preview(r) {
  return `<div style="text-align:left;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:18px;margin:18px 0">
    <div style="color:#F5B301;font-size:20px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
    <p style="margin:8px 0;white-space:pre-wrap">${esc(r.text)}</p>
    <p style="margin:0;color:#6B7280;font-size:14px">— ${esc(r.name)}, ${esc(r.business)}${r.location ? ', ' + esc(r.location) : ''}</p></div>`;
}
function page(title, body, status = 200) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} — Ecotray Reviews</title></head>
<body style="margin:0;background:#f4f4f4;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1A1A1A">
<div style="max-width:560px;margin:48px auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<h1 style="font-size:22px;margin:0 0 8px">${title}</h1>${body}</div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
}

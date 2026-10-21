/* ============================================================
   ECOTRAY SOLUTIONS — TESTIMONIALS PAGE
   1. Photo lightbox for the customer-story gallery
   2. Loads approved reviews from GET /api/reviews
   3. Submits new reviews to POST /api/reviews (held for approval)
   ============================================================ */
(function () {
  'use strict';

  // ── 1. Lightbox ───────────────────────────────────────────
  const items = Array.from(document.querySelectorAll('.gallery-item'));
  const box = document.getElementById('lightbox');
  if (box && items.length) {
    const img = box.querySelector('.lightbox__img');
    let idx = 0, lastFocus = null;
    const show = (i) => {
      idx = (i + items.length) % items.length;
      img.src = items[idx].dataset.full;
      img.alt = items[idx].querySelector('img').alt;
    };
    const open = (i) => { lastFocus = document.activeElement; show(i); box.hidden = false; document.body.style.overflow = 'hidden'; box.querySelector('.lightbox__close').focus(); };
    const close = () => { box.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
    items.forEach((el, i) => el.addEventListener('click', () => open(i)));
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__nav--prev').addEventListener('click', () => show(idx - 1));
    box.querySelector('.lightbox__nav--next').addEventListener('click', () => show(idx + 1));
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

  // ── 2. Load approved reviews ──────────────────────────────
  const grid = document.getElementById('reviewsGrid');
  const empty = document.getElementById('reviewsEmpty');

  function renderReviews(list) {
    if (!grid) return;
    if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    grid.innerHTML = list.map((r) => `
      <article class="review-card">
        <div class="review-card__top">
          <div class="review-card__header">
            <div class="review-card__avatar">${esc(initials(r.name))}</div>
            <div class="review-card__meta">
              <strong class="review-card__name">${esc(r.name)}</strong>
              <span class="review-card__company">${esc(r.business)}${r.location ? ', ' + esc(r.location) : ''}</span>
              <div class="review-card__stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
            </div>
            <span class="review-card__verified">✓ Verified order</span>
          </div>
          <blockquote class="review-card__body">"${esc(r.text)}"</blockquote>
        </div>
        <div class="review-card__footer">
          ${r.products ? `<span class="review-card__product-tag">📦 ${esc(r.products)}</span>` : '<span></span>'}
          <span class="review-card__date">${esc(fmtDate(r.approvedAt || r.createdAt))}</span>
        </div>
      </article>`).join('');
  }

  if (grid) {
    fetch('/api/reviews', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => renderReviews(Array.isArray(d.reviews) ? d.reviews : []))
      .catch(() => renderReviews([]));
  }

  // ── 3. Submit a review ────────────────────────────────────
  const form = document.getElementById('reviewForm');
  if (!form) return;
  const msg = document.getElementById('reviewMessage');
  const btn = document.getElementById('rvSubmit');
  const text = document.getElementById('rvText');
  const count = document.getElementById('rvCount');
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 1200`; });

  const say = (type, html) => {
    msg.className = `form-message form-message--${type}`;
    msg.innerHTML = html; msg.hidden = false;
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = form.consent.checked;
    const problems = [];
    if (!data.name || !data.name.trim()) problems.push('your name');
    if (!data.business || !data.business.trim()) problems.push('your business name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) problems.push('a valid email');
    if (!data.rating) problems.push('a star rating');
    if (!data.text || data.text.trim().length < 20) problems.push('a review of at least 20 characters');
    if (!data.consent) problems.push('the confirmation checkbox');
    if (problems.length) { say('error', 'Please add ' + problems.join(', ') + '.'); return; }

    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) {
        form.reset(); count.textContent = '0 / 1200';
        say('success', '<strong>Thank you!</strong> Your review was received. We publish reviews after confirming the order, usually within 1–2 business days.');
      } else {
        say('error', esc(out.error || 'Something went wrong. Please try again.'));
      }
    } catch (err) {
      say('error', 'Could not reach the server. Please check your connection and try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Review';
    }
  });
})();

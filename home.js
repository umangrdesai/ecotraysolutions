/* ============================================================
   ECO TRAY SOLUTIONS — HOME PAGE JAVASCRIPT
   Features:
   - Product category tab filter (with animation)
   - FAQ accordion (native <details> enhancement)
   - Scroll-triggered count-up for stats
   - Trust bar pause on hover
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initProductTabs();
    initFaqAccordion();
    initTrustBarPause();
  });

  /* ── PRODUCT TABS / FILTER ─────────────────────────────── */
  function initProductTabs() {
    const tabs  = document.querySelectorAll('.products__tab');
    const cards = document.querySelectorAll('.product-card[data-category]');

    if (!tabs.length || !cards.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const filter = tab.dataset.filter;

        // Update active tab
        tabs.forEach(function (t) {
          t.classList.remove('products__tab--active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('products__tab--active');
        tab.setAttribute('aria-selected', 'true');

        // Filter cards with a fade
        cards.forEach(function (card, i) {
          const match = filter === 'all' || card.dataset.category === filter;

          if (match) {
            card.style.display = '';
            // Stagger fade in
            card.style.opacity = '0';
            card.style.transform = 'translateY(16px)';
            setTimeout(function () {
              card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, i * 60);
          } else {
            card.style.transition = 'none';
            card.style.opacity = '0';
            card.style.display = 'none';
          }
        });
      });
    });
  }

  /* ── FAQ: smooth open/close & only one open at a time ───── */
  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) {
          // Close all others
          items.forEach(function (other) {
            if (other !== item && other.open) {
              other.open = false;
            }
          });
        }
      });
    });
  }

  /* ── TRUST BAR: pause scroll on hover ────────────────────── */
  function initTrustBarPause() {
    const bar = document.querySelector('.trust-bar__inner');
    if (!bar) return;

    bar.addEventListener('mouseenter', function () {
      bar.style.animationPlayState = 'paused';
    });

    bar.addEventListener('mouseleave', function () {
      bar.style.animationPlayState = 'running';
    });
  }

})();

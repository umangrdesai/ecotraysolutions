/* ============================================================
   ECO TRAY SOLUTIONS — GLOBAL JAVASCRIPT
   Handles: Mobile nav, scroll effects, active link states,
            smooth scroll, animations on scroll
   ============================================================ */

(function () {
  'use strict';

  // ── DOM Ready ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initNavbar();
    initActiveNavLink();
    initScrollAnimations();
    initCounters();
  });

  // ── Navbar: Scroll shadow + Mobile toggle ──────────────────
  function initNavbar() {
    const navbar  = document.querySelector('.navbar');
    const toggle  = document.querySelector('.navbar__toggle');
    const mobile  = document.querySelector('.navbar__mobile');

    if (!navbar) return;

    // Add shadow on scroll
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });

    // Mobile menu toggle
    if (toggle && mobile) {
      toggle.addEventListener('click', function () {
        const isOpen = mobile.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
      });

      // Close mobile menu on link click
      mobile.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobile.classList.remove('open');
          toggle.classList.remove('open');
          toggle.setAttribute('aria-expanded', false);
          document.body.style.overflow = '';
        });
      });

      // Close on outside click
      document.addEventListener('click', function (e) {
        if (!navbar.contains(e.target) && !mobile.contains(e.target)) {
          mobile.classList.remove('open');
          toggle.classList.remove('open');
          toggle.setAttribute('aria-expanded', false);
          document.body.style.overflow = '';
        }
      });
    }
  }

  // ── Active Nav Link (based on current page) ────────────────
  function initActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('.navbar__link, .navbar__mobile-link').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href === currentPath ||
          (currentPath === '' && href === 'index.html') ||
          (currentPath === 'index.html' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  // ── Scroll Animations (Intersection Observer) ──────────────
  function initScrollAnimations() {
    const els = document.querySelectorAll('[data-animate]');
    if (!els.length) return;

    // Set initial state
    els.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.delay || 0;
          setTimeout(function () {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { observer.observe(el); });
  }

  // ── Animated Counters (for stats strip) ───────────────────
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  function animateCounter(el) {
    const target   = parseInt(el.dataset.counter, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1800;
    const start    = performance.now();

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ── Smooth scroll for anchor links ────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80; // nav height buffer
        const top    = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

})();

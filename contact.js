/* ============================================================
   ECO TRAY SOLUTIONS — CONTACT FORM (Frontend Validation)
   Local dev  → POSTs to http://localhost:3000/submit (server.js)
   Production → POSTs to /submit (Cloudflare Pages Function)
   ============================================================ */

(function () {
  'use strict';

  const form       = document.getElementById('contactForm');
  const submitBtn  = document.getElementById('submitBtn');
  const btnText    = submitBtn ? submitBtn.querySelector('.btn-text')    : null;
  const btnLoading = submitBtn ? submitBtn.querySelector('.btn-loading') : null;
  const successMsg = document.getElementById('formSuccess');
  const errorMsg   = document.getElementById('formError');

  if (!form) return;

  // ── Real-time validation on blur ──────────────────────────
  const fields = form.querySelectorAll('.form-input, .form-select, .form-textarea');

  fields.forEach(function (field) {
    field.addEventListener('blur', function () {
      validateField(field);
    });
    field.addEventListener('input', function () {
      // Clear error state while user is typing
      field.classList.remove('invalid');
      const errEl = field.parentNode.querySelector('.field-error');
      if (errEl) errEl.remove();
    });
  });

  // ── Form submit ───────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Validate all fields
    let isValid = true;
    fields.forEach(function (field) {
      if (!validateField(field)) isValid = false;
    });

    if (!isValid) {
      // Scroll to first error
      const firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }
      return;
    }

    // Build payload
    const countryCode = document.getElementById('countryCode');
    const payload = {
      fullName:        form.fullName.value.trim(),
      countryCode:     countryCode ? countryCode.value : '',
      phoneNumber:     form.phoneNumber.value.trim(),
      email:           form.email.value.trim(),
      itemDescription: form.itemDescription.value.trim(),
      timeline:        form.timeline.value,
    };

    // Show loading state
    setLoading(true);
    hideMessages();

    // POST to backend — detect local dev vs production automatically
    const apiEndpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/submit'
      : '/submit';

    fetch(apiEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Server error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        setLoading(false);
        if (data.success) {
          showSuccess();
          form.reset();
          fields.forEach(function (f) { f.classList.remove('valid', 'invalid'); });
        } else {
          showError();
        }
      })
      .catch(function (err) {
        console.error('Form submission error:', err);
        setLoading(false);
        showError();
      });
  });

  // ── Field Validator ───────────────────────────────────────
  function validateField(field) {
    const id    = field.id;
    const value = field.value.trim();
    let   error = '';

    // Remove existing error
    const existing = field.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
    field.classList.remove('invalid', 'valid');

    // Skip country code select (always has a value)
    if (id === 'countryCode') return true;

    if (!value) {
      error = 'This field is required.';
    } else if (id === 'email') {
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(value)) error = 'Please enter a valid email address.';
    } else if (id === 'phoneNumber') {
      const phoneRx = /^[\d\s\-().+]{7,20}$/;
      if (!phoneRx.test(value)) error = 'Please enter a valid phone number.';
    } else if (id === 'fullName' && value.length < 2) {
      error = 'Please enter your full name.';
    } else if (id === 'itemDescription' && value.length < 20) {
      error = 'Please provide more detail (at least 20 characters) so we can quote accurately.';
    } else if (id === 'timeline' && value === '') {
      error = 'Please select a timeline.';
    }

    if (error) {
      field.classList.add('invalid');
      const errEl = document.createElement('span');
      errEl.className = 'field-error';
      errEl.textContent = error;
      field.parentNode.appendChild(errEl);
      return false;
    }

    field.classList.add('valid');
    return true;
  }

  // ── UI Helpers ────────────────────────────────────────────
  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (btnText)    btnText.style.display    = loading ? 'none'         : 'inline';
    if (btnLoading) btnLoading.style.display = loading ? 'inline-block' : 'none';
  }

  function hideMessages() {
    if (successMsg) successMsg.style.display = 'none';
    if (errorMsg)   errorMsg.style.display   = 'none';
  }

  function showSuccess() {
    if (successMsg) {
      successMsg.style.display = 'block';
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showError() {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

})();

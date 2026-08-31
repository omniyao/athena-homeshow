/**
 * Athena Bathrooms - Guess the Bubbles Frontend Controller
 * Features: Touch/Kiosk mode, Offline Queueing, Live Validation, Prize Selection, Auto-Reset.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('bubblesEntryForm');
  const formContainer = document.getElementById('formSection');
  const successContainer = document.getElementById('successSection');
  const submitBtn = document.getElementById('submitBtn');
  const kioskCountdownEl = document.getElementById('kioskCountdown');
  const termsModal = document.getElementById('termsModal');
  const openTermsBtn = document.getElementById('openTermsModal');
  const closeTermsBtn = document.getElementById('closeTermsModal');
  const prizeCards = document.querySelectorAll('.prize-card');

  // Detect URL parameters (e.g. ?event=auckland or ?event=christchurch)
  const urlParams = new URLSearchParams(window.location.search);
  const currentEvent = urlParams.get('event') === 'christchurch' 
    ? 'Home Show Christchurch 2026' 
    : 'Home Show Auckland 2026';

  const eventBadge = document.getElementById('eventBadge');
  if (eventBadge) {
    eventBadge.textContent = currentEvent;
  }

  // Kiosk Inactivity Reset (Default: 60 seconds)
  const KIOSK_RESET_SECONDS = 60;
  let inactivityTimer = null;
  let countdownInterval = null;

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      resetFormToInitial();
    }, KIOSK_RESET_SECONDS * 1000);
  }

  // Listen to user interactions for kiosk auto-reset
  ['touchstart', 'mousedown', 'mousemove', 'keypress', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();

  // Prize Card Selection Interaction
  prizeCards.forEach(card => {
    card.addEventListener('click', () => {
      prizeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
      }
    });
  });

  // Terms Modal Controls
  if (openTermsBtn && termsModal) {
    openTermsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      termsModal.style.display = 'flex';
    });
  }

  if (closeTermsBtn && termsModal) {
    closeTermsBtn.addEventListener('click', () => {
      termsModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === termsModal) {
      termsModal.style.display = 'none';
    }
  });

  // Form Submission Handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Collect form data
      const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim().toLowerCase(),
        mobile: document.getElementById('mobile').value.trim(),
        address: document.getElementById('address').value.trim(),
        postcode: document.getElementById('postcode').value.trim(),
        bubbleGuess: parseInt(document.getElementById('bubbleGuess').value, 10),
        nominatedPrize: document.querySelector('input[name="nominatedPrize"]:checked')?.value || '',
        agreeTerms: document.getElementById('agreeTerms').checked,
        marketingConsent: document.getElementById('marketingConsent').checked,
        event: currentEvent,
        timestamp: new Date().toISOString()
      };

      // Validation
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.mobile || !formData.postcode) {
        alert('Please fill in all required contact details.');
        return;
      }

      if (isNaN(formData.bubbleGuess) || formData.bubbleGuess < 1) {
        alert('Please enter a valid numeric bubble guess.');
        return;
      }

      if (!formData.nominatedPrize) {
        alert('Please select one Athena product you would like to win.');
        return;
      }

      if (!formData.agreeTerms) {
        alert('You must accept the competition Terms & Conditions to enter.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Entry...';

      try {
        // Attempt sending to backend API
        const response = await fetch('http://localhost:3000/api/bubbles-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          throw new Error('API server returned an error: ' + response.statusText);
        }

        showSuccessView();
      } catch (err) {
        console.warn('Network / API issue. Saving entry to local offline queue...', err);
        saveOfflineEntry(formData);
        showSuccessView();
      }
    });
  }

  // Offline Caching Mechanism
  function saveOfflineEntry(data) {
    const queue = JSON.parse(localStorage.getItem('athena_offline_entries') || '[]');
    queue.push(data);
    localStorage.setItem('athena_offline_entries', JSON.stringify(queue));
  }

  // Sync Offline Entries when back online
  async function syncOfflineQueue() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem('athena_offline_entries') || '[]');
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} offline entries...`);
    const remaining = [];

    for (const entry of queue) {
      try {
        const res = await fetch('http://localhost:3000/api/bubbles-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        if (!res.ok) remaining.push(entry);
      } catch (e) {
        remaining.push(entry);
      }
    }

    localStorage.setItem('athena_offline_entries', JSON.stringify(remaining));
  }

  window.addEventListener('online', syncOfflineQueue);
  setInterval(syncOfflineQueue, 30000); // Check every 30s

  function showSuccessView() {
    formContainer.style.display = 'none';
    successContainer.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let remainingSeconds = 15;
    if (kioskCountdownEl) {
      kioskCountdownEl.textContent = `Screen will reset in ${remainingSeconds} seconds...`;
      clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds > 0) {
          kioskCountdownEl.textContent = `Screen will reset in ${remainingSeconds} seconds...`;
        } else {
          clearInterval(countdownInterval);
          resetFormToInitial();
        }
      }, 1000);
    }
  }

  function resetFormToInitial() {
    clearInterval(countdownInterval);
    if (form) form.reset();
    prizeCards.forEach(c => c.classList.remove('selected'));
    if (formContainer) formContainer.style.display = 'block';
    if (successContainer) successContainer.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit My Guess';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Reset button on success page
  const resetBtn = document.getElementById('resetKioskBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetFormToInitial();
    });
  }
});

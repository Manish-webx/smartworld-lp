(() => {
  const $ = (s, c = document) => c ? c.querySelector(s) : null;
  const $$ = (s, c = document) => c ? [...c.querySelectorAll(s)] : [];

  // Nav
  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  // Slide-in menu
  const burger = $('#burger'), drawer = $('#drawer');
  if (burger && drawer) {
    const setDrawer = open => {
      document.body.classList.toggle('drawer-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      burger.setAttribute('aria-expanded', open);
      drawer.setAttribute('aria-hidden', !open);
    };
    burger.onclick = () => setDrawer(true);
    const dClose = $('#drawerClose');
    const dOverlay = $('#drawerOverlay');
    if (dClose) dClose.onclick = () => setDrawer(false);
    if (dOverlay) dOverlay.onclick = () => setDrawer(false);
    $$('a, button[data-open]', drawer).forEach(el => el.addEventListener('click', () => setDrawer(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
  }

  // Reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }), { threshold: .12 });
  $$('.rv').forEach(el => io.observe(el));

  // Modal
  const modal = $('#enquire');
  const openModal = title => {
    if (!modal) return;
    const f = $('form', modal);
    if (f) {
      f.classList.remove('sent');
      f.reset();
      const mTitle = $('#modalTitle');
      if (mTitle) mTitle.textContent = title || 'Enquire Now';
      if (f.source) f.source.value = title || 'Enquire Now';
    }
    modal.classList.add('on');
    document.body.style.overflow = 'hidden';
  };

  const closeAll = () => {
    $$('.modal,.lightbox').forEach(m => m.classList.remove('on'));
    document.body.style.overflow = '';
  };

  $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.title)));
  $$('[data-close]').forEach(b => b.onclick = closeAll);
  $$('.modal,.lightbox').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAll(); }));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // Auto-open enquiry popup once after 20s
  setTimeout(() => {
    if (!sessionStorage.getItem('enq') && !$('.modal.on,.lightbox.on')) {
      openModal('Get Exclusive Pre-Launch Price');
      try { sessionStorage.setItem('enq', 1); } catch (e) {}
    }
  }, 20000);

  // Forms — submit leads asynchronously to mail1.php
  const submitLead = async (formData) => {
    const res = await fetch('mail1.php', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => ({ status: 'success', redirect: 'thank-you.html' }));
    if (data && data.status === 'error') {
      throw new Error(data.message || 'Submission error');
    }
    return data;
  };

  $$('.js-form').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const ph = $('[name=phone]', f), nm = $('[name=name]', f);
    if (!nm || !nm.value.trim()) return nm && nm.focus();

    const cleanPh = (ph ? ph.value : '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPh)) {
      ph.setCustomValidity('Enter a valid 10-digit mobile number');
      ph.reportValidity();
      ph.setCustomValidity('');
      return ph.focus();
    }

    const btn = $('[type=submit]', f);
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    }

    try {
      const formData = new FormData(f);
      formData.set('phone', cleanPh);
      if (!formData.get('url')) {
        formData.set('url', window.location.href);
      }
      formData.set('ajax', '1');

      // Append UTM parameters if present in URL
      const sp = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
        if (sp.get(k) && !formData.has(k)) {
          formData.set(k, sp.get(k));
        }
      });

      const result = await submitLead(formData);

      // Any submitted lead unlocks floor plans for the rest of the session
      try {
        sessionStorage.setItem('enq', '1');
        sessionStorage.setItem('fpUnlocked', '1');
        sessionStorage.setItem('leadName', nm.value.trim());
      } catch (err) {}

      const redirectUrl = (result && result.redirect) || ('thank-you.html?name=' + encodeURIComponent(nm.value.trim()));
      location.href = redirectUrl;
    } catch (err) {
      console.error('Lead submission error:', err);
      alert(err.message || 'There was a temporary problem submitting your enquiry. Please try again or call us at +91 93555 58585.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }));

  const fpView = $('#fpView');
  try { if (sessionStorage.getItem('fpUnlocked') && fpView) fpView.classList.remove('locked'); } catch (e) {}
  $$('input[type=tel]').forEach(i => i.addEventListener('input', () => i.value = i.value.replace(/\D/g, '')));

  // Gallery tabs
  $$('.tabs button').forEach(b => b.onclick = () => {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.gal-grid').forEach(g => g.classList.toggle('on', g.id === b.dataset.tab));
  });

  // Floor plans
  const fpImg = $('#fpImg');
  if (fpImg) {
    $$('.fp-tabs button').forEach(b => b.onclick = () => {
      $$('.fp-tabs button').forEach(x => x.classList.toggle('on', x === b));
      fpImg.src = b.dataset.fp;
    });
  }

  // FAQ
  $$('.faq-item button').forEach(b => b.onclick = () => {
    const it = b.parentElement, was = it.classList.contains('open');
    $$('.faq-item').forEach(x => x.classList.remove('open'));
    if (!was) it.classList.add('open');
  });

  // Lightbox
  const lb = $('#lb');
  if (lb) {
    const lbImg = $('img', lb), lbCap = $('.lb-cap', lb);
    let set = [], idx = 0;
    const show = i => {
      idx = (i + set.length) % set.length;
      if (lbImg) lbImg.src = set[idx].src;
      if (lbCap) lbCap.textContent = set[idx].cap;
    };
    $$('[data-lightbox]').forEach(group => {
      if (group.dataset.src) {
        group.onclick = () => { set = [{ src: group.dataset.src, cap: 'Location Map' }]; show(0); lb.classList.add('on'); };
        return;
      }
      const items = $$('figure', group);
      items.forEach((fig, i) => fig.onclick = () => {
        set = items.map(f => ({ src: $('img', f).src, cap: $('img', f).alt + ' · ' + ($('.tag', f)?.textContent || '') }));
        show(i); lb.classList.add('on'); document.body.style.overflow = 'hidden';
      });
    });
    if ($('.lb-prev')) $('.lb-prev').onclick = () => show(idx - 1);
    if ($('.lb-next')) $('.lb-next').onclick = () => show(idx + 1);
    addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
  }

  // Awards Slider (about-us.html)
  const awardsTrack = $('.awards-slider-track');
  const awardsPrev = $('.awards-prev');
  const awardsNext = $('.awards-next');

  if (awardsTrack && awardsPrev && awardsNext && !awardsTrack.dataset.init) {
    awardsTrack.dataset.init = '1';
    const slides = $$('.award-slide', awardsTrack);
    let currentIndex = 0;

    const getVisibleCount = () => {
      const w = awardsTrack.clientWidth;
      if (w <= 480) return 1;
      if (w <= 768) return 2;
      if (w <= 1024) return 3;
      return 4;
    };

    const scrollToSlide = (idx) => {
      const total = slides.length;
      const visible = getVisibleCount();
      if (idx >= total) {
        currentIndex = 0;
      } else if (idx < 0) {
        currentIndex = Math.max(0, total - visible);
      } else {
        currentIndex = idx;
      }
      const target = slides[currentIndex];
      if (target) {
        awardsTrack.scrollTo({
          left: target.offsetLeft - awardsTrack.offsetLeft,
          behavior: 'smooth'
        });
      }
    };

    let scrollTimeout;
    awardsTrack.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const currentScroll = awardsTrack.scrollLeft;
        let closestIdx = 0;
        let minDiff = Infinity;
        slides.forEach((s, i) => {
          const diff = Math.abs((s.offsetLeft - awardsTrack.offsetLeft) - currentScroll);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        });
        currentIndex = closestIdx;
      }, 120);
    }, { passive: true });

    awardsNext.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(currentIndex + getVisibleCount());
      resetAutoplay();
    });

    awardsPrev.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(currentIndex - getVisibleCount());
      resetAutoplay();
    });

    let autoTimer = setInterval(() => {
      scrollToSlide(currentIndex + getVisibleCount());
    }, 3200);

    const resetAutoplay = () => {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        scrollToSlide(currentIndex + getVisibleCount());
      }, 3200);
    };

    awardsTrack.addEventListener('mouseenter', () => clearInterval(autoTimer));
    awardsTrack.addEventListener('mouseleave', () => resetAutoplay());
    awardsTrack.addEventListener('touchstart', () => clearInterval(autoTimer), { passive: true });
    awardsTrack.addEventListener('touchend', () => resetAutoplay(), { passive: true });
  }
})();

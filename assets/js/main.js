(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Nav
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  // Slide-in menu
  const burger = $('#burger'), drawer = $('#drawer');
  const setDrawer = open => {
    document.body.classList.toggle('drawer-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    burger.setAttribute('aria-expanded', open);
    drawer.setAttribute('aria-hidden', !open);
  };
  burger.onclick = () => setDrawer(true);
  $('#drawerClose').onclick = $('#drawerOverlay').onclick = () => setDrawer(false);
  $$('a, button[data-open]', drawer).forEach(el => el.addEventListener('click', () => setDrawer(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });

  // Reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.rv').forEach(el => io.observe(el));

  // Modal
  const modal = $('#enquire');
  let unlockOnSubmit = false;
  const openModal = (title, unlock) => {
    const f = $('form', modal); f.classList.remove('sent'); f.reset();
    $('#modalTitle').textContent = title || 'Enquire Now';
    f.source.value = title || 'Enquire Now';
    unlockOnSubmit = !!unlock;
    modal.classList.add('on'); document.body.style.overflow = 'hidden';
  };
  const closeAll = () => { $$('.modal,.lightbox').forEach(m => m.classList.remove('on')); document.body.style.overflow = ''; };
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.title, b.hasAttribute('data-unlock'))));
  $$('[data-close]').forEach(b => b.onclick = closeAll);
  $$('.modal,.lightbox').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAll(); }));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  // Auto-open enquiry popup once after 20s
  setTimeout(() => { if (!sessionStorage.getItem('enq') && !$('.modal.on,.lightbox.on')) { openModal('Get Exclusive Pre-Launch Price'); try { sessionStorage.setItem('enq', 1); } catch (e) {} } }, 20000);

  // Forms — wire `submitLead` to your CRM / Google Sheet / webhook
  const submitLead = data => { console.log('Lead', data); return Promise.resolve(); };
  $$('.js-form').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const ph = $('[name=phone]', f), nm = $('[name=name]', f);
    if (!nm.value.trim()) return nm.focus();
    if (!/^[6-9]\d{9}$/.test(ph.value)) { ph.setCustomValidity('Enter a valid 10-digit mobile number'); ph.reportValidity(); ph.setCustomValidity(''); return; }
    submitLead(Object.fromEntries(new FormData(f))).then(() => {
      f.classList.add('sent');
      try { sessionStorage.setItem('enq', 1); } catch (e) {}
      if (f.closest('#enquire') && unlockOnSubmit) $('#fpView').classList.remove('locked');
    });
  }));
  $$('input[type=tel]').forEach(i => i.addEventListener('input', () => i.value = i.value.replace(/\D/g, '')));

  // Gallery tabs
  $$('.tabs button').forEach(b => b.onclick = () => {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.gal-grid').forEach(g => g.classList.toggle('on', g.id === b.dataset.tab));
  });

  // Floor plans
  $$('.fp-tabs button').forEach(b => b.onclick = () => {
    $$('.fp-tabs button').forEach(x => x.classList.toggle('on', x === b));
    $('#fpImg').src = b.dataset.fp;
  });

  // FAQ
  $$('.faq-item button').forEach(b => b.onclick = () => {
    const it = b.parentElement, was = it.classList.contains('open');
    $$('.faq-item').forEach(x => x.classList.remove('open'));
    if (!was) it.classList.add('open');
  });

  // Lightbox
  const lb = $('#lb'), lbImg = $('img', lb), lbCap = $('.lb-cap', lb);
  let set = [], idx = 0;
  const show = i => { idx = (i + set.length) % set.length; lbImg.src = set[idx].src; lbCap.textContent = set[idx].cap; };
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
  $('.lb-prev').onclick = () => show(idx - 1);
  $('.lb-next').onclick = () => show(idx + 1);
  addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
})();

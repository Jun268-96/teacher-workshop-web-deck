(() => {
  'use strict';
  const config = window.WORKSHOP_CONFIG || {};
  const deck = document.querySelector('#deck');
  let slides = [...deck.querySelectorAll(':scope > .slide')];
  const prev = document.querySelector('[data-prev]');
  const next = document.querySelector('[data-next]');
  const toggle = document.querySelector('#toc-toggle');
  const contents = document.querySelector('#contents');
  let index = 0;
  const safeLink = value => {
    try { const url = new URL(value, location.href); return ['https:', 'http:', 'file:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  };
  document.querySelectorAll('[data-config]').forEach(el => { if (config[el.dataset.config]) el.textContent = config[el.dataset.config]; });
  document.querySelectorAll('[data-logo]').forEach(el => { if (!el.src.startsWith('data:') && config.logo && safeLink(config.logo)) el.src = config.logo; el.alt = config.logoAlt || ''; });
  document.querySelectorAll('[data-duration]').forEach(el => { el.textContent = config.durationMinutes || 15; });
  document.querySelectorAll('[data-mascots]:not(body)').forEach(el => { el.hidden = config.modules?.mascots !== true; });
  document.body.dataset.mascots = config.modules?.mascots === true ? 'on' : 'off';
  document.title = config.title || document.title;
  function setToc(open) { contents.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); }
  function fromHash() { try { return slides.findIndex(s => s.id === decodeURIComponent(location.hash.slice(1))); } catch { return -1; } }
  function showSlide(position, updateHash = true) {
    index = Math.max(0, Math.min(position, slides.length - 1));
    slides.forEach((slide, i) => { slide.hidden = i !== index; slide.classList.toggle('active', i === index); });
    const active = slides[index];
    document.body.dataset.tone = active.dataset.tone || 'pink';
    document.body.dataset.layout = active.classList.contains('cover') ? 'cover' : active.classList.contains('statement') ? 'statement' : 'standard';
    document.querySelector('[data-counter]').textContent = `${index + 1} / ${slides.length}`;
    document.querySelector('[data-current-title]').textContent = active.dataset.title;
    document.querySelector('.progress i').style.transform = `scaleX(${(index + 1) / slides.length})`;
    contents.querySelectorAll('button').forEach((button, i) => { if (i === index) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    prev.disabled = index === 0; next.disabled = index === slides.length - 1;
    if (updateHash) history.replaceState(null, '', `#${active.id}`);
    deck.scrollTop = 0; setToc(false);
    document.querySelector('#deck-status').textContent = `${index + 1} / ${slides.length} · ${active.dataset.title}`;
    document.dispatchEvent(new CustomEvent('workshop:slide', { detail: { id: active.id, index } }));
  }
  function rebuildToc() { contents.replaceChildren(); slides.forEach((slide, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${i + 1}. ${slide.dataset.title}`;
    button.addEventListener('click', () => { showSlide(i); toggle.focus(); }); contents.append(button);
  }); }
  rebuildToc();
  prev.addEventListener('click', () => showSlide(index - 1)); next.addEventListener('click', () => showSlide(index + 1));
  deck.addEventListener('click', event => {
    if(document.body.classList.contains('is-editing')) return;
    const go=event.target.closest('[data-go]');
    if(go) {const i=slides.findIndex(s=>s.id===go.dataset.go);if(i>=0)showSlide(i);}
    const explain=event.target.closest('[data-explain]');
    if(explain) {const dialog=document.createElement('dialog'),text=document.createElement('p'),close=document.createElement('button');text.textContent=explain.dataset.explain;close.textContent='닫기';close.onclick=()=>dialog.close();dialog.append(text,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
  });
  deck.addEventListener('keydown',e=>{if(!document.body.classList.contains('is-editing')&&['Enter',' '].includes(e.key)&&e.target.matches('[data-explain]')){e.preventDefault();e.target.click();}});
  toggle.addEventListener('click', () => setToc(contents.hidden));
  const tocAnchor = document.querySelector('.toc-anchor');
  tocAnchor.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setToc(true); });
  tocAnchor.addEventListener('pointerleave', () => { if (!tocAnchor.contains(document.activeElement)) setToc(false); });
  tocAnchor.addEventListener('focusout', event => { if (!tocAnchor.contains(event.relatedTarget)) setToc(false); });
  document.addEventListener('pointerdown', event => { if (!tocAnchor.contains(event.target)) setToc(false); });
  window.addEventListener('hashchange', () => showSlide(Math.max(0, fromHash()), false));
  document.addEventListener('keydown', async event => {
    if (event.key === 'Escape') { setToc(false); return; }
    if (document.body.classList.contains('is-editing') || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open],[role=dialog][aria-modal=true]')) return;
    if (event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]')) return;
    if (!contents.hidden && tocAnchor.contains(event.target)) return;
    if (event.target.closest('[role=tab]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    if (['ArrowRight','PageDown'].includes(event.key)) { event.preventDefault(); showSlide(index + 1); }
    else if (['ArrowLeft','PageUp'].includes(event.key)) { event.preventDefault(); showSlide(index - 1); }
    else if (event.key === ' ' && !event.target.closest('button,a')) { event.preventDefault(); showSlide(index + 1); }
    else if (event.key === 'Home') { event.preventDefault(); showSlide(0); }
    else if (event.key === 'End') { event.preventDefault(); showSlide(slides.length - 1); }
    else if (event.key.toLowerCase() === 'f') {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch { document.querySelector('#deck-status').textContent = '브라우저에서 전체화면을 허용해 주세요.'; }
    }
  });
  function chooseTab(tab) {
    const page=tab.closest('.slide');
    page.querySelectorAll('[data-tab]').forEach(button=>{const selected=button===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
    page.querySelectorAll('[data-panel]').forEach(panel=>{panel.hidden=panel.dataset.panel!==tab.dataset.tab;});
  }
  function initialiseTabs() { slides.forEach(p=>{const tab=p.querySelector('[data-tab]');if(tab)chooseTab(tab);}); }
  deck.addEventListener('click',e=>{
    if(document.body.classList.contains('is-editing'))return;
    const tab=e.target.closest('[data-tab]');if(tab)chooseTab(tab);
    const draw=e.target.closest('#draw,[data-runtime-id="draw"]');
    if(draw) {const page=draw.closest('.slide'),input=page.querySelector('#student-count,[data-runtime-id="student-count"]');if(input.reportValidity())page.querySelector('#draw-result,[data-runtime-id="draw-result"]').textContent=`${Math.floor(Math.random()*Number(input.value))+1}번`;}
  });
  deck.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-tab]');if(!tab||document.body.classList.contains('is-editing'))return;
    const tabs=[...tab.closest('.slide').querySelectorAll('[data-tab]')],i=tabs.indexOf(tab);let target;
    if(event.key==='ArrowRight')target=(i+1)%tabs.length;
    if(event.key==='ArrowLeft')target=(i-1+tabs.length)%tabs.length;
    if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;
    if(target!==undefined){event.preventDefault();event.stopPropagation();chooseTab(tabs[target]);tabs[target].focus();}
  });
  initialiseTabs();
  const resources = document.querySelector('[data-resources]');
  (resources?.children.length ? [] : config.resources || []).forEach(item => {
    const href = safeLink(item.href); if (!href) return;
    const card = document.createElement('a'); card.className = 'resource-card'; card.dataset.editKey='resource-'+resources.children.length;card.dataset.editType='block'; card.href = href;
    if (new URL(href).origin !== location.origin && !item.href.startsWith('#')) { card.target = '_blank'; card.rel = 'noopener noreferrer'; }
    if (item.image && safeLink(item.image)) { const img = document.createElement('img'); img.src = item.image; img.alt = item.title;img.dataset.editKey=card.dataset.editKey+'-image'; card.append(img); }
    const copy = document.createElement('div'), heading = document.createElement('h3'), description = document.createElement('p');
    heading.dataset.editKey=card.dataset.editKey+'-title';description.dataset.editKey=card.dataset.editKey+'-description';heading.textContent = item.title; description.textContent = item.description || ''; copy.append(heading, description); card.append(copy); resources?.append(card);
  });
  const timer = document.querySelector('[data-timer]');
  if (timer && config.modules?.timer) {
    timer.hidden = false;
    const duration = Math.max(1, Number(config.durationMinutes) || 15) * 60000;
    const storageKey = `workshop-timer:${config.deckId || 'deck'}`;
    let state = { remaining: duration, deadline: null };
    try { const cached = JSON.parse(sessionStorage.getItem(storageKey)); if (cached && Number.isFinite(cached.remaining) && (cached.deadline === null || Number.isFinite(cached.deadline))) state = cached; } catch { /* file and privacy modes may deny storage */ }
    const remaining = () => state.deadline === null ? state.remaining : Math.max(0, state.deadline - Date.now());
    function save() { try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
    function render() {
      const left = remaining();
      if (state.deadline !== null && left === 0) { state = { remaining: 0, deadline: null }; save(); }
      const seconds = Math.ceil(left / 1000);
      document.querySelector('#timer-output').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
      document.querySelector('#timer-start').textContent = state.deadline === null ? '시작' : '일시정지';
    }
    document.querySelector('#timer-start').addEventListener('click', () => { const left = remaining(); state = state.deadline === null ? { remaining: left || duration, deadline: Date.now() + (left || duration) } : { remaining: left, deadline: null }; save(); render(); });
    document.querySelector('#timer-reset').addEventListener('click', () => { state = { remaining: duration, deadline: null }; save(); render(); });
    const timerToggle = document.querySelector('#timer-toggle'), controls = document.querySelector('#timer-controls');
    const setTimer = open => { controls.hidden = !open; timerToggle.setAttribute('aria-expanded', String(open)); };
    timerToggle.addEventListener('click', () => setTimer(controls.hidden));
    timer.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setTimer(true); });
    timer.addEventListener('pointerleave', () => { if (!timer.contains(document.activeElement)) setTimer(false); });
    timer.addEventListener('focusout', e => { if (!timer.contains(e.relatedTarget)) setTimer(false); });
    setInterval(render, 250); render();
  }
  window.WorkshopDeck = {
    currentId:()=>slides[index]?.id,
    go:id=>{const i=slides.findIndex(s=>s.id===id);if(i>=0)showSlide(i);},
    refresh:id=>{slides=[...deck.querySelectorAll(':scope > .slide')];rebuildToc();initialiseTabs();showSlide(Math.max(0,slides.findIndex(s=>s.id===id)));}
  };
  showSlide(Math.max(0, fromHash()));
})();

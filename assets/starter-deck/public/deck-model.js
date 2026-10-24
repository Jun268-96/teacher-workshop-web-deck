/* Canonical, versioned edits over trusted HTML templates. No imported HTML or code is executed. */
(() => {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const idOK = v => typeof v === 'string' && /^[a-zA-Z][\w-]{0,99}$/.test(v);
  const safeImage = v => typeof v === 'string' && v.length < 3000000 && (/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v) || /^(assets\/)[\w./%-]+$/.test(v) && !decodeURIComponent(v).includes('..'));
  function youtube(v) { try { const u = new URL(v); const host = u.hostname.replace(/^www\./,''); const id = host === 'youtu.be' ? u.pathname.slice(1) : ['youtube.com','youtube-nocookie.com'].includes(host) ? (u.searchParams.get('v') || u.pathname.split('/').pop()) : ''; return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null; } catch { return null; } }
  function validate(state, bases) {
    if (state?.schema !== 1 || state.deckId !== window.WORKSHOP_CONFIG.deckId || state.templateVersion !== 1 || !Number.isInteger(state.revision) || state.revision < 0 || !Array.isArray(state.pages) || !state.pages.length || state.pages.length > 100) throw Error('이 덱과 호환되는 편집본이 아닙니다.');
    const ids = new Set();
    function checkId(id) { if (!idOK(id) || ids.has(id)) throw Error('중복되거나 잘못된 ID입니다.'); ids.add(id); }
    for (const p of state.pages) {
      checkId(p.id); if (!bases.has(p.template) && p.template !== 'blank') throw Error('원본 템플릿이 필요합니다. 소스 묶음을 함께 여세요.');
      if (typeof p.title !== 'string' || p.title.length > 200 || typeof p.notes !== 'string' || p.notes.length > 30000 || !Number.isFinite(p.seconds) || p.seconds < 0 || p.seconds > 86400 || !Array.isArray(p.objects) || p.objects.length > 100) throw Error('페이지 데이터가 올바르지 않습니다.');
      const keys = new Set();
      for (const o of p.objects) {
        checkId(o.id); if (typeof o.key !== 'string' || !/^[\w-]{1,100}$/.test(o.key) || keys.has(o.key)) throw Error('오브젝트 키가 올바르지 않습니다.'); keys.add(o.key);
        if (!['text','image','youtube','block'].includes(o.type) || typeof o.content !== 'string' || o.content.length > 3000000 || typeof o.deleted !== 'boolean') throw Error('오브젝트 데이터가 올바르지 않습니다.');
        if (o.type === 'image' && !safeImage(o.content)) throw Error('PNG/JPEG/WebP 또는 프로젝트 assets/ 이미지만 가능합니다.');
        if (o.type === 'youtube' && !youtube(o.content)) throw Error('유효한 YouTube 주소가 필요합니다.');
        const s = o.style;
        if (!s || Object.keys(s).some(k => !['fontSize','fontWeight','letterSpacing','color','textAlign','width','height','x','y','offsetX','offsetY'].includes(k))) throw Error('지원하지 않는 스타일입니다.');
        for (const [k,v] of Object.entries(s)) {
          if (['fontSize','fontWeight','width','height','x','y','offsetX','offsetY'].includes(k) && (!Number.isFinite(v) || v < ({fontSize:12,fontWeight:100,width:1,height:0,x:-20,y:-20,offsetX:-100,offsetY:-100}[k]) || v > ({fontSize:140,fontWeight:900,width:100,height:800,x:20,y:20,offsetX:100,offsetY:100}[k]))) throw Error('배치 범위를 벗어났습니다.');
          if(k==='letterSpacing'&&(!Number.isFinite(v)||v<-.2||v>1))throw Error('자간 범위를 벗어났습니다.');
          if (k === 'color' && !/^#[a-fA-F0-9]{6}$/.test(v) || k === 'textAlign' && !['left','center','right'].includes(v)) throw Error('지원하지 않는 글자 스타일입니다.');
        }
        const b = o.behavior;
        if (!b || Object.keys(b).some(k=>!['tooltip','explain'].includes(k)) || Object.values(b).some(v=>typeof v !== 'string' || v.length > 2000)) throw Error('동작 데이터가 올바르지 않습니다.');
      }
    }
    if (JSON.stringify(state).length > 12000000) throw Error('편집본이 너무 큽니다. 이미지를 줄여 주세요.');
    return clone(state);
  }
  window.WorkshopModel = {clone,uid,youtube,validate,safeImage};
})();

/* Canonical, versioned edits over trusted HTML templates. No imported HTML or code is executed. */
(() => {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const idOK = v => typeof v === 'string' && /^[a-zA-Z][\w-]{0,99}$/.test(v);
  const safeImage = v => typeof v === 'string' && v.length < 3000000 && (/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v) || /^(assets\/)[\w./%-]+$/.test(v) && !decodeURIComponent(v).includes('..'));
  const VIDEO_BYTES=20*1024*1024,DOCUMENT_CHARS=64*1024*1024;
  function safeVideo(v){if(typeof v!=='string')return false;if(/^assets\/[\w./%-]+\.mp4$/.test(v))try{return !decodeURIComponent(v).includes('..');}catch{return false;}const prefix='data:video/mp4;base64,';if(!v.startsWith(prefix))return false;const b=v.slice(prefix.length);if(b.length<16||b.length>Math.ceil(VIDEO_BYTES/3)*4||b.length%4||/[^a-zA-Z0-9+/=]/.test(b)||!/^[^=]*={0,2}$/.test(b))return false;try{return atob(b.slice(0,32)).slice(4,8)==='ftyp';}catch{return false;}}
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
        if (!['text','image','youtube','video','block','scene'].includes(o.type) || typeof o.content !== 'string' || o.content.length > (o.type==='video'?Math.ceil(VIDEO_BYTES/3)*4+32:3000000) || typeof o.deleted !== 'boolean') throw Error('오브젝트 데이터가 올바르지 않습니다.');
        if (o.type === 'scene') { if(!window.WorkshopScenes)throw Error('장면 런타임이 필요합니다.');window.WorkshopScenes.parse(o.content); }
        if (o.type === 'image' && !safeImage(o.content)) throw Error('PNG/JPEG/WebP 또는 프로젝트 assets/ 이미지만 가능합니다.');
        if(o.type==='video'&&!safeVideo(o.content))throw Error('20MB 이하 MP4 또는 프로젝트 assets/ 영상만 가능합니다.');
        if (o.type === 'youtube' && !youtube(o.content)) throw Error('유효한 YouTube 주소가 필요합니다.');
        const s = o.style;
        if (!s || Object.keys(s).some(k => !['fontSize','fontWeight','letterSpacing','color','textAlign','width','height','x','y','offsetX','offsetY','position'].includes(k))) throw Error('지원하지 않는 스타일입니다.');
        for (const [k,v] of Object.entries(s)) {
          if (['fontSize','fontWeight','width','height','x','y','offsetX','offsetY'].includes(k) && (!Number.isFinite(v) || v < ({fontSize:12,fontWeight:100,width:1,height:0,x:-20,y:-20,offsetX:-100,offsetY:-100}[k]) || v > ({fontSize:140,fontWeight:900,width:100,height:800,x:20,y:20,offsetX:100,offsetY:100}[k]))) throw Error('배치 범위를 벗어났습니다.');
          if(k==='position'&&v!=='absolute')throw Error('지원하지 않는 배치 방식입니다.');
          if(k==='letterSpacing'&&(!Number.isFinite(v)||v<-.2||v>1))throw Error('자간 범위를 벗어났습니다.');
          if (k === 'color' && !/^#[a-fA-F0-9]{6}$/.test(v) || k === 'textAlign' && !['left','center','right'].includes(v)) throw Error('지원하지 않는 글자 스타일입니다.');
        }
        const b = o.behavior;
        if (!b || Object.keys(b).some(k=>!['tooltip','explain','click'].includes(k)) || ['tooltip','explain'].some(k=>b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>2000))) throw Error('동작 데이터가 올바르지 않습니다.');
        if (b.click != null) {
          const a=b.click;
          if (!a || typeof a!=='object' || Array.isArray(a) || !['swap-image','toggle'].includes(a.kind) || !idOK(a.targetId) || Object.keys(a).some(k=>!['kind','targetId',...(a.kind==='swap-image'?['src']:[])].includes(k)) || a.kind==='swap-image'&&!safeImage(a.src) || b.explain) throw Error('사진 변경 또는 보이기 동작이 올바르지 않습니다.');
        }
      }
      const objects=new Map(p.objects.filter(o=>!o.deleted).map(o=>[o.id,o]));
      for(const o of objects.values()) {
        const a=o.behavior.click;if(!a)continue;const target=objects.get(a.targetId);
        if(!target || a.kind==='swap-image'&&target.type!=='image' || a.kind==='toggle'&&target.id===o.id)throw Error('동작 대상은 같은 페이지의 다른 요소 또는 바꿀 사진이어야 합니다.');
        const seen=new Set([o.id]);let item=o;
        while(item?.behavior.click?.kind==='toggle'){const id=item.behavior.click.targetId;if(seen.has(id))throw Error('서로를 숨기는 동작은 만들 수 없습니다.');seen.add(id);item=objects.get(id);}
      }
    }
    if (JSON.stringify(state).length > DOCUMENT_CHARS) throw Error('편집본은 64MB 이하입니다. 사진이나 동영상 용량을 줄여 주세요.');
    return clone(state);
  }
  window.WorkshopModel = {clone,uid,youtube,validate,safeImage,safeVideo,VIDEO_BYTES,DOCUMENT_CHARS};
})();

(() => {
  'use strict';
  const M = window.WorkshopModel, api = window.WorkshopDeck;
  if (!M || !api || new URLSearchParams(location.search).get('present') === '1') return;
  const $ = s => document.querySelector(s), clone = M.clone;
  let initialPage;try{initialPage=decodeURIComponent(location.hash.slice(1));}catch{initialPage=null;}
  function readText(el){const copy=el.cloneNode(true);copy.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));return copy.textContent;}
  const baseDOM = $('#deck').cloneNode(true), bases = new Map(), seed = [];
  baseDOM.querySelectorAll(':scope > .slide').forEach(page => {
    bases.set(page.id, page.cloneNode(true));
    seed.push({id:page.id,template:page.id,title:page.dataset.title,notes:'',seconds:0,objects:[...page.querySelectorAll('[data-edit-key]')].map(el=>({id:`${page.id}-${el.dataset.editKey}`,key:el.dataset.editKey,type:el.dataset.editType || (el.tagName === 'IMG' ? 'image' : 'text'),content:el.tagName === 'IMG' ? el.getAttribute('src') : readText(el),deleted:false,style:{},behavior:{}}))});
  });
  const initial = {schema:1,templateVersion:1,deckId:window.WORKSHOP_CONFIG.deckId,revision:0,pages:seed};
  let panelPage = '', doc = clone(initial), undo = [], redo = [], queue = [], selected = null, editing = false, behaviorPreview = false, pending = null, storageOK = true;
  function validRequests(value) { if(!Array.isArray(value))throw Error('요청 목록이 올바르지 않습니다.'); return value.slice(0,100).map(r=>{if(typeof r.id!=='string'||typeof r.request!=='string'||r.request.length>10000||!r.context?.page?.id||!r.context?.object?.id||typeof r.context.page.title!=='string')throw Error('요청 항목이 올바르지 않습니다.');return clone(r);}); }
  const key = `workshop-editor:v1:${doc.deckId}`;
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) { doc = M.validate(saved.document,bases); queue = validRequests(saved.requests); } } catch { storageOK = false; }
  const root = document.createElement('aside'); root.id = 'workshop-editor'; root.dataset.editorUi = ''; root.hidden = new URLSearchParams(location.search).get('edit') !== '1';
  root.innerHTML = `<button id="edit-toggle" type="button" aria-pressed="false">편집</button>
  <section id="edit-tools" aria-label="발표자료 편집" hidden>
    <header><strong id="edit-mode-label">편집 모드</strong><button type="button" data-action="done">발표로</button></header>
    <p id="save-state" role="status"></p><button type="button" data-action="behavior-test" id="behavior-test" aria-pressed="false">동작 시험</button><p id="edit-mode-hint">요소를 끌어 이동하고, 더블클릭해 글자를 수정하세요.</p><label>페이지 선택<select id="page-select"></select></label><div class="edit-row"><button data-action="undo">실행 취소</button><button data-action="redo">다시 실행</button></div>
    <details><summary>페이지·발표 노트</summary><label>페이지 이름<input id="page-title" maxlength="200"></label><label>발표 노트<textarea id="page-notes" rows="3"></textarea></label><label>예상 시간(초)<input id="page-seconds" type="number" min="0" max="86400"></label><button data-action="page-save">적용</button><div class="edit-row"><button data-action="page-add">새 페이지</button><button data-action="page-copy">복제</button><button data-action="page-delete">삭제</button><button data-action="page-up">앞으로</button><button data-action="page-down">뒤로</button></div></details>
    <div class="edit-row"><button data-action="add-text">글자 추가</button><button data-action="add-image">사진 추가</button><button data-action="add-video">YouTube 추가</button></div>
    <label class="sr-only" for="object-list">편집 대상</label><select id="object-list"><option value="">대상을 선택하세요</option></select>
    <section id="object-tools" hidden><h3 id="object-name"></h3><label>AI에게 어떻게 바꿔달라고 할까요?<textarea id="change-request" rows="3" placeholder="이 사진을 크게 하고, 클릭하면 교실 적용 예시를 보여줘."></textarea></label><label>동작 조건(선택)<select id="request-trigger"><option value="">지정 없음</option><option>마우스를 올렸을 때</option><option>클릭했을 때</option><option>값을 입력하거나 선택했을 때</option><option>제출했을 때</option></select></label>
      <div class="edit-row"><button data-action="queue-add">요청 목록에 추가</button><button data-action="annotation" id="annotation-button" hidden>ChatGPT 주석</button></div>
    <details id="direct-tools"><summary>직접 수정</summary><label>내용<textarea id="object-content" rows="3"></textarea></label>
      <div class="edit-grid"><label>글자 크기<input id="object-size" type="number" min="12" max="140" step="2"></label><label>굵기<select id="object-weight"><option value="400">보통</option><option value="600">중간</option><option value="800">굵게</option></select></label><label>색<input id="object-color" type="color"></label><label>정렬<select id="object-align"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label><label>너비(%)<input id="object-width" type="number" min="10" max="100" step="5"></label><label>높이(px, 0=자동)<input id="object-height" type="number" min="0" max="800" step="10"></label><label>가로 이동(px)<input id="object-x" type="number" min="-4000" max="4000" step="1"></label><label>세로 이동(px)<input id="object-y" type="number" min="-4000" max="4000" step="1"></label></div>
      <div class="edit-row"><button data-action="object-save">직접 수정 적용</button><button data-action="image-replace">사진 교체</button><button data-action="object-delete">삭제</button></div>
      </details><details><summary>동작 추가·변경</summary><label>호버 설명<input id="object-tooltip" maxlength="2000"></label><label>클릭 설명<textarea id="object-explain" rows="2"></textarea></label><button data-action="behavior-save">동작 적용</button></details>
      </section>
    <details id="queue-details"><summary>수정 요청 <span id="queue-count">0</span>개</summary><ol id="request-list"></ol><button data-action="copy">요청 전체 복사</button><button data-action="requests-export">요청 파일 저장</button><label>복사가 막혔을 때<textarea id="batch-copy" readonly rows="4"></textarea></label></details>
    <details><summary>저장·전달</summary><p>편집본에는 발표 노트가 포함됩니다. 새 대화에는 편집본과 원본 소스도 함께 전달하세요.</p><div class="edit-row"><button data-action="export">편집본 저장</button><button data-action="import">편집본 불러오기</button><button data-action="presentation">발표용 HTML 저장</button><button data-action="patch">AI 변경안 불러오기</button></div><p id="impact-state"></p></details>
  </section><input id="edit-file" type="file" hidden><dialog id="patch-dialog"><h2>변경안 미리보기</h2><label>확인할 페이지<select id="preview-page"></select></label><pre></pre><p>내용·대본·시간 배분을 확인한 뒤 확정하세요.</p><button data-action="patch-accept">확정</button><button data-action="patch-cancel">취소</button></dialog>`;
  document.body.append(root);
  function current() { return doc.pages.find(p=>p.id === api.currentId()) || doc.pages[0]; }
  function target() { return current().objects.find(o=>o.id === selected && !o.deleted); }
  function status(text) { $('#save-state').textContent = text; }
  function persist() { try { localStorage.setItem(key,JSON.stringify({document:doc,requests:queue})); status('이 브라우저에 저장됨 · v'+doc.revision); storageOK=true; } catch { storageOK=false;status('브라우저 저장 실패 · 편집본 파일을 저장하세요.'); } }
  function publish(next, record = true) {
    next.revision = doc.revision + 1; M.validate(next,bases);
    if (record) { undo.push(clone(doc)); if(undo.length>40) undo.shift(); redo=[]; }
    doc = clone(next); persist(); render();
  }
  function mutate(fn) { const next=clone(doc);fn(next);publish(next); }
  function render() {
    const old = doc.pages.some(p=>p.id===initialPage)?initialPage:api.currentId(), tabs=[...$('#deck').querySelectorAll('[role=tab][aria-selected=true]')].map(n=>[n.closest('.slide').id,n.dataset.tab]), inputs=[...$('#deck').querySelectorAll('input,textarea,select')].map(n=>[n.closest('.slide').id,n.dataset.runtimeId||n.id,n.value]); $('#deck').replaceChildren();initialPage=null;
    for (const p of doc.pages) {
      const source=bases.get(p.template), el=source ? source.cloneNode(true) : document.createElement('section');
      const idMap=new Map(); el.querySelectorAll('[id]').forEach(n=> { const id=p.id===p.template?n.id:`${p.id}-${n.id}`;idMap.set(n.id,id);n.dataset.runtimeId=n.dataset.runtimeId||n.id;n.id=id; });
      el.querySelectorAll('[aria-controls],[aria-labelledby],[for]').forEach(n=>['aria-controls','aria-labelledby','for'].forEach(a=>{if(n.hasAttribute(a))n.setAttribute(a,n.getAttribute(a).split(' ').map(id=>idMap.get(id)||id).join(' '));}));
      if(el.hasAttribute('aria-labelledby')) el.setAttribute('aria-labelledby',idMap.get(el.getAttribute('aria-labelledby'))||el.getAttribute('aria-labelledby'));
      el.id=p.id;el.classList.add('slide');el.dataset.title=p.title;el.setAttribute('oai-annotation-container','');
      for (const o of p.objects) {
        let node=[...el.querySelectorAll('[data-edit-key]')].find(n=>n.dataset.editKey===o.key);
        if(o.deleted) { node?.remove(); continue; }
        if(!node) { node=document.createElement(o.type==='image'?'img':o.type==='youtube'?'iframe':'p'); node.dataset.editKey=o.key;node.dataset.added='true';el.append(node); }
        node.dataset.objectId=o.id;node.dataset.editType=o.type;
        if(o.type==='text'&&readText(node)!==o.content){node.textContent=o.content;node.style.whiteSpace='pre-line';}
        if(o.type==='image') { node.src=o.content;node.alt=node.alt||'편집한 이미지';node.draggable=false; }
        if(o.type==='youtube') {node.src=M.youtube(o.content);node.title='YouTube 영상';node.allowFullscreen=true;node.referrerPolicy='strict-origin-when-cross-origin';node.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');}
        const s=o.style; for (const prop of ['fontSize','fontWeight','color','textAlign','width','height']) if(s[prop]!==undefined) node.style[prop]=['fontSize','height'].includes(prop)?s[prop]?s[prop]+'px':'auto':prop==='width'?s[prop]+'%':s[prop];
        if(s.offsetX!==undefined||s.offsetY!==undefined){node.dataset.moveX=s.offsetX||0;node.dataset.moveY=s.offsetY||0;node.style.translate='none';}else node.style.translate=`${s.x||0}% ${s.y||0}%`;node.style.maxWidth='100%';if(o.type==='image')node.style.objectFit='contain';
        if(o.behavior.tooltip){node.dataset.tooltip=o.behavior.tooltip;node.tabIndex=0;node.removeAttribute('title');}
        if(o.behavior.explain) {node.dataset.explain=o.behavior.explain;node.tabIndex=0;node.setAttribute('role','button');}
        node.setAttribute('oai-annotatable',`${p.title} · ${o.key}`);
        node.setAttribute('oai-annotation-metadata',JSON.stringify(metadata(p,o)));
      }
      $('#deck').append(el);
    }
    api.refresh(old);for(const [pageId,tab] of tabs){const p=document.getElementById(pageId);p?.querySelectorAll('[data-tab]').forEach(n=>{const on=n.dataset.tab===tab;n.setAttribute('aria-selected',String(on));n.tabIndex=on?0:-1;});p?.querySelectorAll('[data-panel]').forEach(n=>n.hidden=n.dataset.panel!==tab);}for(const [pageId,id,value]of inputs){const p=document.getElementById(pageId),n=p?.querySelector(`[data-runtime-id="${id}"],#${CSS.escape(id)}`);if(n)n.value=value;}renderPanel();highlight();
  }
  function metadata(p,o) {return {deckId:doc.deckId.slice(0,256),revision:doc.revision,pageId:p.id,objectId:o.id,objectType:o.type};}
  function context(p,o) {
    const page = document.getElementById(p.id), node=page.querySelector(`[data-object-id="${o.id}"]`);
    return {deckId:doc.deckId,templateVersion:doc.templateVersion,revision:doc.revision,page:{id:p.id,title:p.title,notes:p.notes,seconds:p.seconds},object:{...clone(o),content:o.type==='image'&&o.content.startsWith('data:')?`embedded:${o.id}`:o.content},internalState:{tabs:[...page.querySelectorAll('[role=tab][aria-selected=true]')].map(t=>t.textContent),inputs:[...page.querySelectorAll('input,select,textarea')].map(n=>({id:n.dataset.editKey||n.id,value:n.value}))},preserve:{attributes:node?[...node.attributes].filter(a=>/^data-|^aria-/.test(a.name)).map(a=>[a.name,a.value]):[],behavior:o.behavior},assets:o.type==='image'?[o.content.startsWith('data:')?`embedded:${o.id}`:o.content]:[],impactReview:['화면과 사례의 의미','발표 노트','시간 배분','관련 페이지와 참여 활동']};
  }
  function highlight() {document.querySelectorAll('.edit-selected').forEach(n=>n.classList.remove('edit-selected')); if(editing&&selected) document.querySelector(`[data-object-id="${selected}"]`)?.classList.add('edit-selected');}
  function renderPanel() {
    const p=current(), o=target();$('#page-select').replaceChildren(...doc.pages.map((x,i)=>new Option(`${i+1}. ${x.title}`,x.id)));$('#page-select').value=p.id;$('#page-title').value=p.title;$('#page-notes').value=p.notes;$('#page-seconds').value=p.seconds;
    $('#object-list').replaceChildren(new Option('대상을 선택하세요',''),...p.objects.filter(x=>!x.deleted).map(x=>new Option(x.type==='text'?x.content.slice(0,30):x.key,x.id)));$('#object-list').value=o?.id||'';
    $('#object-tools').hidden=!o; if(!o)return;
    const node=document.querySelector(`[data-object-id="${o.id}"]`),style=node?getComputedStyle(node):{};
    $('#object-name').textContent=o.type==='text'?'글자':o.type==='image'?'사진':o.type==='youtube'?'영상':'화면 블록';$('#object-content').value=o.type==='image'&&o.content.startsWith('data:')?'[업로드한 이미지]':o.content;
    $('#object-content').disabled=['image','block'].includes(o.type);
    $('#object-size').value=o.style.fontSize||Math.round(parseFloat(style.fontSize)||32);const weight=o.style.fontWeight||Math.round((parseFloat(style.fontWeight)||400)/100)*100;if(![...$('#object-weight').options].some(n=>n.value===String(weight)))$('#object-weight').add(new Option(String(weight),String(weight)));$('#object-weight').value=String(weight);const rgb=style.color?.match(/\d+/g);$('#object-color').value=o.style.color||(rgb?.length>=3?'#'+rgb.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#19262a');$('#object-align').value=o.style.textAlign||(['left','right','center'].includes(style.textAlign)?style.textAlign:'left');
    for(const k of ['width','height']) $(`#object-${k}`).value=o.style[k]??(k==='width'?100:0);const translate=(style.translate||'0 0').split(' ');const pixels=(v,size)=>v?.endsWith('%')?parseFloat(v)*size/100:parseFloat(v)||0;$('#object-x').value=Math.round(pixels(translate[0],node?.offsetWidth||0));$('#object-y').value=Math.round(pixels(translate[1],node?.offsetHeight||0));
    $('#object-tooltip').value=o.behavior.tooltip||'';$('#object-explain').value=o.behavior.explain||'';
    $('[data-action="image-replace"]').hidden=o.type!=='image';
  }
  function setBehaviorPreview(on){behaviorPreview=on&&editing;document.body.classList.toggle('is-behavior-preview',behaviorPreview);$('#edit-mode-label').textContent=behaviorPreview?'동작 시험':'편집 모드';$('#behavior-test').textContent=behaviorPreview?'편집으로':'동작 시험';$('#behavior-test').setAttribute('aria-pressed',String(behaviorPreview));$('#edit-mode-hint').textContent=behaviorPreview?'동작 시험 중 · 화면에서 호버하거나 클릭해 보세요. 이동하려면 편집으로 돌아가세요.':'요소를 끌어 이동하고, 더블클릭해 글자를 수정하세요.';api.hideTooltip?.();}
  function setEditing(on) { editing=on;setBehaviorPreview(false);panelPage=api.currentId();document.body.classList.toggle('is-editing',on);$('#edit-tools').hidden=!on;$('#edit-toggle').setAttribute('aria-pressed',String(on));$('#edit-toggle').textContent=on?'편집 중':'편집';api.layoutMoved?.();renderPanel();highlight(); }
  function choose(id) { selected=id;renderPanel();highlight(); }
  function download(name,content,type='application/json') {const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function batch() {return JSON.stringify({format:'workshop-change-requests/v1',deckId:doc.deckId,baseRevision:doc.revision,instructions:'각 요청 context.revision은 수집 당시 상태입니다. 첨부 편집본의 현재 버전과 내용이 달라졌다면 충돌을 확인하세요. 정확한 page.id/object.id로 수정하세요. 요청 외 대상과 기존 동작을 보존하세요. 첨부 편집본+원본 소스가 필요합니다. JSON 패치는 {deckId,baseRevision,changes:[{pageId,objectId,set:{content,style,behavior}}],pageUpdates:[{pageId,notes,seconds}]} 형식입니다. 지원하지 않는 코드 변경은 별도 소스 차이로 전달하고 검증하세요.',requests:queue},null,2);}
  function renderQueue() {$('#queue-count').textContent=queue.length;$('#request-list').replaceChildren();for(const r of queue){const li=document.createElement('li'),label=document.createElement('p'),input=document.createElement('textarea'),remove=document.createElement('button');label.textContent=`${r.context.page.title} · ${{text:'글자',image:'사진',youtube:'영상',block:'화면 블록'}[r.context.object.type]||'선택 요소'}`;input.value=r.request;input.setAttribute('aria-label','저장된 수정 요청');input.addEventListener('change',()=>{r.request=input.value;persist();$('#batch-copy').value=batch();});remove.textContent='이 요청 삭제';remove.type='button';remove.addEventListener('click',()=>{queue=queue.filter(x=>x.id!==r.id);persist();renderQueue();});li.append(label,input,remove);$('#request-list').append(li);}$('#batch-copy').value=batch();}
  function file(accept,fn) {const input=$('#edit-file');input.accept=accept;input.value='';input.onchange=()=>{if(input.files[0]?.size>16000000){status('파일은 16MB 이하로 줄여 주세요.');return;}if(input.files[0])Promise.resolve(fn(input.files[0])).catch(e=>status(e.message));};input.click();}
  async function image(replace=false) {file('image/png,image/jpeg,image/webp',async f=>{if(f.size>2000000)throw Error('사진은 2MB 이하로 줄여 주세요.');const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});if(!M.safeImage(value))throw Error('PNG/JPEG/WebP만 가능합니다.');const o=target();mutate(d=>{const p=d.pages.find(p=>p.id===current().id);if(replace&&o?.type==='image')p.objects.find(x=>x.id===o.id).content=value;else p.objects.push({id:M.uid('obj'),key:M.uid('image'),type:'image',content:value,style:{width:70,height:300},behavior:{},deleted:false});});});}
  function previewPatch(patch) {
    if(patch.deckId!==doc.deckId||patch.baseRevision!==doc.revision||!Array.isArray(patch.changes)||patch.changes.length>100)throw Error('대상 덱/버전이 다릅니다. 현재 편집본으로 다시 요청하세요.');
    const next=clone(doc), descriptions=[];
    for(const change of patch.changes){const p=next.pages.find(p=>p.id===change.pageId),o=p?.objects.find(o=>o.id===change.objectId&&!o.deleted);if(!o||!change.set||Object.keys(change.set).some(k=>!['content','style','behavior'].includes(k)))throw Error('수정 대상 또는 필드가 올바르지 않습니다.');for(const [k,v]of Object.entries(change.set))o[k]=['style','behavior'].includes(k)?{...o[k],...v}:v;descriptions.push(`${p.title} · ${Object.keys(change.set).map(k=>({content:'내용',style:'배치·스타일',behavior:'동작'}[k])).join(', ')} 변경`);}
    if(patch.pageUpdates!==undefined&&!Array.isArray(patch.pageUpdates))throw Error('발표 노트 변경이 올바르지 않습니다.');for(const update of patch.pageUpdates||[]){const p=next.pages.find(p=>p.id===update.pageId);if(!p||Object.keys(update).some(k=>!['pageId','notes','seconds'].includes(k)))throw Error('페이지 변경이 올바르지 않습니다.');if(update.notes!==undefined)p.notes=update.notes;if(update.seconds!==undefined)p.seconds=update.seconds;descriptions.push(`${p.title}: 노트·시간 검토`);}
    M.validate(next,bases);pending={next,base:doc.revision};const saved=doc;doc=next;render();doc=saved;$('#preview-page').replaceChildren(...next.pages.filter(p=>patch.changes.some(c=>c.pageId===p.id)||(patch.pageUpdates||[]).some(c=>c.pageId===p.id)).map(p=>new Option(p.title,p.id)));$('#preview-page').value=api.currentId();$('#patch-dialog pre').textContent=descriptions.join('\n')||'변경 없음';$('#patch-dialog').showModal();
  }
  async function portable() {
    const output=document.documentElement.cloneNode(true);output.querySelectorAll('[data-editor-ui],script[src="editor.js"],link[href="editor.css"]').forEach(n=>n.remove());output.querySelector('body').classList.remove('is-editing','is-behavior-preview');output.querySelectorAll('[data-runtime-overlay]').forEach(n=>n.remove());output.querySelectorAll('[data-config]').forEach(n=>n.removeAttribute('data-config'));output.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));output.querySelectorAll('.edit-selected').forEach(n=>n.classList.remove('edit-selected'));output.querySelectorAll('[data-object-id]').forEach(n=>{n.removeAttribute('oai-annotation-metadata');n.removeAttribute('oai-annotatable');});
    output.querySelectorAll('script[src="deck-model.js"]').forEach(n=>n.remove());
    const dataURL=async url=>{const response=await fetch(url);if(!response.ok)throw Error('에셋을 읽을 수 없습니다: '+url);const blob=await response.blob();return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});};
    for(const link of output.querySelectorAll('link[rel=stylesheet]')){const response=await fetch(link.href);if(!response.ok)throw Error('스타일을 읽을 수 없습니다.');let css=await response.text();const refs=[...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)];for(const ref of refs)if(!ref[1].startsWith('data:'))css=css.replace(ref[0],`url("${await dataURL(new URL(ref[1],link.href))}")`);const style=document.createElement('style');style.textContent=css;link.replaceWith(style);}
    for(const a of output.querySelectorAll('a[href]')){const url=new URL(a.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash)a.setAttribute('href',url.hash);}
    for(const img of output.querySelectorAll('img[src]'))if(!img.src.startsWith('data:'))img.src=await dataURL(img.src);
    for(const link of output.querySelectorAll('link[rel=icon]'))link.href=await dataURL(link.href);
    for(const script of output.querySelectorAll('script[src]')){const response=await fetch(script.src);if(!response.ok)throw Error('발표 스크립트를 읽을 수 없습니다.');script.textContent=(await response.text()).replace(/<\/script/gi,'<\\/script');script.removeAttribute('src');script.removeAttribute('defer');}
    // Runtime initialises after markup even when saved HTML uses inline scripts.
    const scripts=[...output.querySelectorAll('script')];scripts.forEach(s=>output.querySelector('body').append(s));
    download(`${doc.deckId}-presentation.html`,'<!doctype html>\n'+output.outerHTML,'text/html');status('발표용 HTML 저장됨 · YouTube/참여 서버는 온라인 필요');
  }
  root.addEventListener('click',async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;try{
    const p=current(),o=target();if(behaviorPreview&&!['behavior-test','behavior-save','annotation'].includes(action))setBehaviorPreview(false);
    if(action==='behavior-test')setBehaviorPreview(!behaviorPreview);
    if(action==='done'){setEditing(false);root.hidden=true;const url=new URL(location.href);url.searchParams.delete('edit');history.replaceState(null,'',url);}
    if(action==='undo'&&undo.length){const prior=undo.pop();redo.push(clone(doc));publish(prior,false);}
    if(action==='redo'&&redo.length){const next=redo.pop();undo.push(clone(doc));publish(next,false);}
    if(action==='page-save')mutate(d=>{const x=d.pages.find(x=>x.id===p.id);x.title=$('#page-title').value;x.notes=$('#page-notes').value;x.seconds=Number($('#page-seconds').value);});
    if(action==='page-add'){const id=M.uid('page');mutate(d=>d.pages.push({id,template:'blank',title:'새 페이지',notes:'',seconds:0,objects:[{id:M.uid('obj'),key:'heading',type:'text',content:'새 페이지',style:{fontSize:56,fontWeight:800},behavior:{},deleted:false}]}));api.go(id);}
    if(action==='page-copy'){const copy=clone(p);copy.id=M.uid('page');copy.objects.forEach(o=>o.id=M.uid('obj'));mutate(d=>d.pages.splice(d.pages.findIndex(x=>x.id===p.id)+1,0,copy));api.go(copy.id);}
    if(action==='page-delete'){if(doc.pages.length<2)throw Error('페이지 하나는 남겨야 합니다.');mutate(d=>d.pages.splice(d.pages.findIndex(x=>x.id===p.id),1));}
    if(['page-up','page-down'].includes(action))mutate(d=>{const i=d.pages.findIndex(x=>x.id===p.id),j=i+(action==='page-up'?-1:1);if(j>=0&&j<d.pages.length)[d.pages[i],d.pages[j]]=[d.pages[j],d.pages[i]];});
    if(action==='add-text'||action==='add-video'){const type=action==='add-text'?'text':'youtube',video=type==='youtube'?window.prompt('YouTube 주소를 입력하세요.'):null;if(type==='youtube'&&!video)return;if(type==='youtube'&&!M.youtube(video))throw Error('YouTube 주소를 확인하세요.');const added={id:M.uid('obj'),key:M.uid(type),type,content:type==='text'?'새 글자':video,style:type==='text'?{}:{width:80,height:320},behavior:{},deleted:false};selected=added.id;mutate(d=>d.pages.find(x=>x.id===p.id).objects.push(added));}
    if(['add-image','image-replace'].includes(action))await image(action==='image-replace');
    if(action==='object-save'&&o)mutate(d=>{const x=d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id);if(['text','youtube'].includes(x.type))x.content=$('#object-content').value;x.style={...x.style,fontSize:Number($('#object-size').value),fontWeight:Number($('#object-weight').value),color:$('#object-color').value,textAlign:$('#object-align').value,...Object.fromEntries(['width','height'].map(k=>[k,Number($(`#object-${k}`).value)])),x:0,y:0,offsetX:Number($('#object-x').value)/document.getElementById(p.id).clientWidth*100,offsetY:Number($('#object-y').value)/document.getElementById(p.id).clientHeight*100};});
    if(action==='object-delete'&&o)mutate(d=>{const x=d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id);x.deleted=true;if(x.type==='image')x.content='assets/brand/vanollim-pixel.png';if(x.type==='youtube')x.content='https://youtu.be/jNQXAC9IVRw'; });
    if(action==='behavior-save'&&o){mutate(d=>{d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id).behavior={tooltip:$('#object-tooltip').value,explain:$('#object-explain').value};});setBehaviorPreview(true);status('동작을 적용했습니다. 화면에서 호버/클릭으로 확인하세요.');}
    if(action==='queue-add'&&o){const request=$('#change-request').value.trim();if(!request)throw Error('변경 요청을 적어 주세요.');queue.push({id:M.uid('request'),request,trigger:$('#request-trigger').value,context:context(p,o)});persist();renderQueue();$('#queue-details').open=true;$('#change-request').value='';}
    if(action==='annotation'&&o){const annotation=document.oai?.annotation;const result=annotation?.request?.(document.querySelector(`[data-object-id="${o.id}"]`),{initialComment:$('#change-request').value.slice(0,240),metadata:metadata(p,o)});status(result?.accepted?'주석 요청이 수락됨 · 실제 전송은 주석 창에서 확인하세요.':'주석을 열지 못했습니다. 요청 복사·파일 저장을 사용하세요.');}
    if(action==='copy'){const text=batch();$('#batch-copy').value=text;try{await navigator.clipboard.writeText(text);status('요청 복사됨 · 편집본과 원본 소스도 전달하세요.');}catch{$('#batch-copy').focus();$('#batch-copy').select();status('아래 요청 내용을 직접 복사하세요.');}}
    if(action==='requests-export')download(`${doc.deckId}-requests.json`,batch());
    if(action==='export')download(`${doc.deckId}-edit.json`,JSON.stringify({format:'workshop-edit/v1',document:doc,requests:queue},null,2));
    if(action==='import')file('.json',async f=>{const data=JSON.parse(await f.text());const next=M.validate(data.document,bases);const requests=validRequests(data.requests);publish(next);queue=requests;persist();renderQueue();});
    if(action==='presentation')await portable();
    if(action==='patch')file('.json',async f=>previewPatch(JSON.parse(await f.text())));
    if(action==='patch-accept'&&pending){if(pending.base!==doc.revision)throw Error('미리보기 이후 편집본이 바뀌었습니다. 다시 불러오세요.');publish(pending.next);pending=null;$('#patch-dialog').close();$('#impact-state').textContent='AI 변경안 적용됨 · 노트와 시간 배분을 확인하세요.';}
    if(action==='patch-cancel'){pending=null;render();$('#patch-dialog').close();}
  }catch(error){status(error.message);}});
  $('#preview-page').addEventListener('change',e=>api.go(e.target.value));
  $('#patch-dialog').addEventListener('cancel',()=>{pending=null;render();});
  $('#edit-toggle').addEventListener('click',()=>setEditing(!editing));$('#page-select').addEventListener('change',e=>api.go(e.target.value));$('#object-list').addEventListener('change',e=>choose(e.target.value));
  $('#deck').addEventListener('click',e=>{if(!editing||behaviorPreview)return;const el=e.target.closest('[data-object-id]');if(el){e.preventDefault();e.stopImmediatePropagation();choose(el.dataset.objectId);}else if(e.target.closest('a,button,input,textarea,select,iframe')){e.preventDefault();e.stopImmediatePropagation();}},true);
  $('#deck').addEventListener('pointerdown',e=>{
    const el=e.target.closest('[data-object-id]');if(!editing||behaviorPreview||!el||e.button!==0||el.isContentEditable)return;
    if(el.dataset.objectId!==selected)choose(el.dataset.objectId);
    const o=target(),page=el.closest('.slide'),box=page.getBoundingClientRect(),original=el.getBoundingClientRect(),computed=getComputedStyle(el);
    const parts=(computed.translate||'0 0').split(' '),px=(v,size)=>v?.endsWith('%')?parseFloat(v)*size/100:parseFloat(v)||0;
    const start={x:e.clientX,y:e.clientY,ox:px(parts[0],el.offsetWidth),oy:px(parts[1],el.offsetHeight),width:el.style.width};
    let moved=false,fitWidth;
    el.setPointerCapture(e.pointerId);
    function position(ev){const rect=el.getBoundingClientRect(),pad=4;const baseX=original.left,baseY=original.top;
      const x=Math.min(box.right-pad-rect.width-baseX,Math.max(box.left+pad-baseX,ev.clientX-start.x));
      const y=Math.min(box.bottom-pad-rect.height-baseY,Math.max(box.top+pad-baseY,ev.clientY-start.y));return{x:start.ox+x,y:start.oy+y};}
    const move=ev=>{
      if(!moved&&Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>4){moved=true;
        // Default stretched headings should move like text boxes. Explicit widths stay intact.
        if(o.type==='text'&&o.style.width===undefined){const range=document.createRange();range.selectNodeContents(el);const width=range.getBoundingClientRect().width;const parent=el.parentElement,parentStyle=getComputedStyle(parent),parentWidth=parent.clientWidth-parseFloat(parentStyle.paddingLeft)-parseFloat(parentStyle.paddingRight);if(width>0&&parentWidth>0){fitWidth=Math.max(10,Math.min(100,(width+4)/parentWidth*100));el.style.width=fitWidth+'%';}}
      }
      if(!moved)return;ev.preventDefault();const pos=position(ev);el.style.translate=`${pos.x}px ${pos.y}px`;
    };
    function cleanup(){el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',finish);el.removeEventListener('pointercancel',cancel);}
    const finish=ev=>{cleanup();if(!moved)return;const pos=position(ev);mutate(d=>Object.assign(d.pages.find(p=>p.id===current().id).objects.find(n=>n.id===o.id).style,{x:0,y:0,offsetX:pos.x/box.width*100,offsetY:pos.y/box.height*100,...(fitWidth===undefined?{}:{width:fitWidth})}));};
    const cancel=()=>{cleanup();el.style.width=start.width;el.style.translate=`${start.ox}px ${start.oy}px`;};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',cancel);
  });
  $('#deck').addEventListener('dblclick',e=>{const el=e.target.closest('[data-object-id]'),o=target();if(!editing||behaviorPreview||!el||o?.type!=='text')return;el.contentEditable='plaintext-only';el.focus();el.addEventListener('blur',()=>{const value=el.textContent;el.removeAttribute('contenteditable');mutate(d=>d.pages.find(x=>x.id===current().id).objects.find(x=>x.id===o.id).content=value);},{once:true});});
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(editing&&e.key==='Escape'){if(behaviorPreview)setBehaviorPreview(false);else setEditing(false);return;}if(editing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();root.querySelector(`[data-action="${e.shiftKey?'redo':'undo'}"]`).click();}});
  document.addEventListener('workshop:slide',()=>{if(editing){if(panelPage!==api.currentId())selected=null;panelPage=api.currentId();renderPanel();highlight();}});
  $('#annotation-button').hidden=typeof document.oai?.annotation?.request!=='function';
  // Read-only integration API for agents/tests; mutations use validated revision-checked patches.
  window.WorkshopEditor={get document(){return clone(doc);},get requests(){return clone(queue);},previewPatch,exportRequests:batch};
  render();renderQueue();status(storageOK?'이 브라우저에 저장됨 · v'+doc.revision:'이전 편집본을 읽지 못했습니다. 파일 불러오기를 사용하세요.');
})();

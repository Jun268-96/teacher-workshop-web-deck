(() => {
  'use strict';
  const M = window.WorkshopModel, api = window.WorkshopDeck;
  if (!M || !api || new URLSearchParams(location.search).get('present') === '1') return;
  const $ = s => document.querySelector(s), clone = M.clone;
  let ui=null;
  let initialPage;try{initialPage=decodeURIComponent(location.hash.slice(1));}catch{initialPage=null;}
  function readText(el){const copy=el.cloneNode(true);copy.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));return copy.textContent;}
  const baseDOM = $('#deck').cloneNode(true), bases = new Map(), seed = [];
  baseDOM.querySelectorAll(':scope > .slide').forEach(page => {
    bases.set(page.id, page.cloneNode(true));
    seed.push({id:page.id,template:page.id,title:page.dataset.title,notes:'',seconds:0,objects:[...page.querySelectorAll('[data-edit-key]')].filter(el=>!el.matches('[data-brand-slot][hidden]')).map(el=>({id:`${page.id}-${el.dataset.editKey}`,key:el.dataset.editKey,type:el.dataset.editType || (el.tagName === 'IMG' ? 'image' : 'text'),content:el.tagName === 'IMG' ? el.getAttribute('src') : readText(el),deleted:false,style:{},behavior:{}}))});
  });
  const initial = {schema:1,templateVersion:1,deckId:window.WORKSHOP_CONFIG.deckId,revision:0,pages:seed};
  let panelPage = '', doc = clone(initial), undo = [], redo = [], queue = [], selected = null, editing = false, behaviorPreview = false, targetPicking = false, inserting = false, pending = null, storageOK = true;
  function validRequests(value) { if(!Array.isArray(value))throw Error('요청 목록이 올바르지 않습니다.'); return value.slice(0,100).map(r=>{if(typeof r.id!=='string'||typeof r.request!=='string'||r.request.length>10000||!r.context?.page?.id||!r.context?.object?.id||typeof r.context.page.title!=='string')throw Error('요청 항목이 올바르지 않습니다.');return clone(r);}); }
  const key = `workshop-editor:v1:${doc.deckId}`;
  let inboxConnection=null,inboxSaved=null,inboxBusy=false;
  try{const saved=JSON.parse(localStorage.getItem(key+':inbox'));if(/^batch-[a-f0-9]{64}$/.test(saved?.id))inboxSaved=saved;}catch{}
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
    <details id="direct-tools"><summary>정밀 배치</summary>
      <div class="edit-grid"><label>너비 (영역 대비 %)<input id="object-width" type="number" min="1" max="100" step="1" aria-describedby="placement-width-help"></label><label>높이 설정<select id="object-height-mode"><option value="auto">내용에 맞춤 (자동)</option><option value="manual">직접 지정</option></select></label><label id="object-height-field" class="placement-full" hidden>박스 높이 (px)<input id="object-height" type="number" min="1" max="800" step="1" aria-describedby="placement-height-help"></label></div>
      <p id="placement-width-help" class="placement-help">너비 100%는 이 요소가 놓인 영역의 전체 너비입니다.</p><p id="placement-height-help" class="placement-help"></p>
      <fieldset class="placement-position"><legend id="placement-origin-title">원래 위치에서 이동</legend><p id="placement-origin-help" class="placement-help">0은 원래 자동 배치된 위치입니다.</p><div class="edit-grid"><label>가로 이동 (px)<input id="object-x" type="number" min="-4000" max="4000" step="1" aria-describedby="placement-x-help"><small id="placement-x-help">− 왼쪽 / + 오른쪽</small></label><label>세로 이동 (px)<input id="object-y" type="number" min="-4000" max="4000" step="1" aria-describedby="placement-y-help"><small id="placement-y-help">− 위쪽 / + 아래쪽</small></label></div></fieldset>
      <button data-action="object-save">배치 적용</button>
      </details><details><summary>동작 추가·변경</summary><label>마우스를 올려놓았을 때 보여줄 설명<input id="object-tooltip" maxlength="2000" placeholder="예: 모둠별로 함께 해결할 상황입니다." aria-describedby="behavior-hover-help"></label><p id="behavior-hover-help">선택한 글자나 사진 옆에 작은 말풍선으로 나타납니다.</p><label>클릭하거나 터치했을 때<select id="behavior-kind"><option value="explain">설명 창 열기</option><option value="swap-image">사진 바꾸기</option><option value="toggle">다른 요소 보이기·숨기기</option><option value="none">아무 일도 하지 않기</option></select></label>
      <div id="behavior-explain-fields"><label>보여줄 설명<textarea id="object-explain" rows="2" placeholder="예: 그림을 보고 해결 방법을 한 가지씩 이야기해 보세요." aria-describedby="behavior-click-help"></textarea></label><p id="behavior-click-help">설명이 별도의 창으로 열립니다.</p></div>
      <div id="behavior-target-fields" hidden><p id="behavior-target-label">어떤 요소를 바꿀까요?</p><div class="edit-row"><button type="button" data-ui-action="target-pick" class="editor-soft" id="behavior-pick-target">화면에서 대상 고르기</button><button type="button" data-action="behavior-unlink" id="behavior-unlink" hidden>연결 끊기</button></div><select id="behavior-target" hidden aria-label="연결 대상"></select><div id="behavior-target-preview" class="behavior-target-preview"></div><p id="behavior-target-help"></p></div>
      <div id="behavior-image-fields" hidden><button type="button" data-action="behavior-image" class="editor-soft">바뀔 사진 선택</button><img id="behavior-image-preview" alt="클릭한 뒤 나타날 사진" hidden><p>다시 클릭하면 원래 사진으로 돌아옵니다.</p></div>
      <p id="behavior-error" role="alert" hidden></p><button data-action="behavior-save">적용하고 미리보기</button></details>
      </section>
    <details id="queue-details"><summary>수정 요청 <span id="queue-count">0</span>개</summary><button type="button" data-action="queue-inbox" id="queue-inbox-button" hidden>프로젝트 요청함에 저장</button><button type="button" data-action="inbox-result" id="inbox-result-button" hidden>변경안 확인</button><p id="queue-inbox-help" role="status"></p><button type="button" data-action="queue-annotation" id="queue-annotation-button" hidden>모두 ChatGPT 주석으로 보내기</button><p id="queue-annotation-help"></p><ol id="request-list"></ol><button data-action="copy">요청 전체 복사</button><button data-action="requests-export">요청 파일 저장</button><label>복사가 막혔을 때<textarea id="batch-copy" readonly rows="4"></textarea></label></details>
    <details><summary>저장·전달</summary><p>편집본에는 발표 노트가 포함됩니다. 새 대화에는 편집본과 원본 소스도 함께 전달하세요.</p><div class="edit-row"><button data-action="export">편집본 저장</button><button data-action="import">편집본 불러오기</button><button data-action="presentation">발표용 HTML 저장</button><button data-action="patch">AI 변경안 불러오기</button></div><p id="impact-state"></p></details>
  </section><input id="edit-file" type="file" hidden><dialog id="patch-dialog"><h2>변경안 미리보기</h2><label>확인할 페이지<select id="preview-page"></select></label><pre></pre><p>내용·대본·시간 배분을 확인한 뒤 확정하세요.</p><button data-action="patch-accept">확정</button><button data-action="patch-cancel">취소</button></dialog>`;
  document.body.append(root);
  // Keep the selected text connected and visible while the native annotation editor captures it.
  const shareDialog=document.createElement('dialog');shareDialog.id='editor-request-share';shareDialog.setAttribute('aria-labelledby','request-share-title');
  shareDialog.innerHTML='<header><h2 id="request-share-title">모아둔 수정 요청</h2><button type="button" data-action="share-close" aria-label="요청 전달 창 닫기">닫기</button></header><p id="request-share-state" role="status"></p><pre id="request-share-text" tabindex="0"></pre><footer><button type="button" data-action="share-prev">이전 묶음</button><span id="request-share-part"></span><button type="button" data-action="share-next">다음 묶음</button><button type="button" data-action="share-annotation">ChatGPT 주석으로 보내기</button></footer>';
  root.append(shareDialog);let shareSnapshot=null,shareParts=[],shareIndex=0;
  const resizeFrame=document.createElement('div');resizeFrame.id='edit-resize-frame';resizeFrame.dataset.editorUi='';resizeFrame.hidden=true;
  for(const [corner,label] of [['nw','왼쪽 위'],['ne','오른쪽 위'],['sw','왼쪽 아래'],['se','오른쪽 아래']]){const handle=document.createElement('button');handle.type='button';handle.dataset.resizeCorner=corner;handle.setAttribute('aria-label',`${label} 모서리 크기 조절`);handle.title=`${label} 모서리를 끌어 크기 조절`;resizeFrame.append(handle);}
  document.body.append(resizeFrame);
  const guides=document.createElement('div');guides.id='edit-alignment-guides';guides.dataset.editorUi='';guides.setAttribute('aria-hidden','true');guides.hidden=true;
  for(const axis of ['x','y']){const line=document.createElement('i');line.dataset.guideAxis=axis;line.hidden=true;guides.append(line);}document.body.append(guides);
  function hideGuides(){guides.hidden=true;for(const line of guides.children)line.hidden=true;}
  function showGuide(axis,match,rect,frame){
    const line=guides.querySelector(`[data-guide-axis="${axis}"]`);line.hidden=!match;if(!match)return;
    const clip=$('#deck').getBoundingClientRect(),vertical=axis==='x',peer=match.rect;
    const start=Math.max(vertical?frame.top:frame.left,vertical?clip.top:clip.left,0,match.kind==='page'?-Infinity:Math.min(vertical?rect.top:rect.left,vertical?peer.top:peer.left)-12);
    const end=Math.min(vertical?frame.bottom:frame.right,vertical?clip.bottom:clip.right,vertical?innerHeight:innerWidth,match.kind==='page'?Infinity:Math.max(vertical?rect.bottom:rect.right,vertical?peer.bottom:peer.right)+12);
    Object.assign(line.style,{left:(vertical?match.value:start)+'px',top:(vertical?start:match.value)+'px',width:(vertical?0:Math.max(0,end-start))+'px',height:(vertical?Math.max(0,end-start):0)+'px'});line.dataset.guideKind=match.kind;guides.hidden=false;
  }
  let resizeObserved=null,resizeGesture=null,behaviorImage='';
  const resizeObserver=new ResizeObserver(()=>syncResizeFrame());
  function syncResizeFrame(){
    const o=target(),node=o&&document.querySelector(`[data-object-id="${o.id}"]`);
    const visible=editing&&!behaviorPreview&&!targetPicking&&!inserting&&['text','image'].includes(o?.type)&&node&&!node.isContentEditable&&node.getClientRects().length;
    resizeFrame.hidden=!visible;ui?.syncLinks?.();if(!visible)return;
    if(resizeObserved!==node){resizeObserver.disconnect();resizeObserver.observe(node);resizeObserved=node;}
    const r=node.getBoundingClientRect();Object.assign(resizeFrame.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  }
  window.addEventListener('resize',syncResizeFrame);$('#deck').addEventListener('scroll',syncResizeFrame);document.addEventListener('workshop:layout',syncResizeFrame);
  function current() { return doc.pages.find(p=>p.id === api.currentId()) || doc.pages[0]; }
  function target() { return current().objects.find(o=>o.id === selected && !o.deleted); }
  function status(text) { $('#save-state').textContent = text; }
  function persist() { try { localStorage.setItem(key,JSON.stringify({document:doc,requests:queue})); status('이 브라우저에 저장됨'); storageOK=true; } catch { storageOK=false;status('브라우저 저장 실패 · 편집본 파일을 저장하세요.'); } }
  function publish(next, record = true) {
    next.revision = doc.revision + 1; M.validate(next,bases);
    if (record) { undo.push(clone(doc)); if(undo.length>40) undo.shift(); redo=[]; }
    doc = clone(next); persist(); render();
  }
  function mutate(fn) { const next=clone(doc);fn(next);publish(next); }
  function render() {
    ui?.cancelPick?.(false);ui?.cancelInsert?.();
    const old = doc.pages.some(p=>p.id===initialPage)?initialPage:api.currentId(), tabs=[...$('#deck').querySelectorAll('[role=tab][aria-selected=true]')].map(n=>[n.closest('.slide').id,n.dataset.tab]), inputs=[...$('#deck').querySelectorAll('input,textarea,select')].filter(n=>n.id||n.dataset.runtimeId).map(n=>[n.closest('.slide').id,n.dataset.runtimeId||n.id,n.value]); $('#deck').replaceChildren();initialPage=null;
    for (const p of doc.pages) {
      const source=bases.get(p.template), el=source ? source.cloneNode(true) : document.createElement('section');
      const idMap=new Map(); el.querySelectorAll('[id]').forEach(n=> { const id=p.id===p.template?n.id:`${p.id}-${n.id}`;idMap.set(n.id,id);n.dataset.runtimeId=n.dataset.runtimeId||n.id;n.id=id; });
      el.querySelectorAll('[aria-controls],[aria-labelledby],[for]').forEach(n=>['aria-controls','aria-labelledby','for'].forEach(a=>{if(n.hasAttribute(a))n.setAttribute(a,n.getAttribute(a).split(' ').map(id=>idMap.get(id)||id).join(' '));}));
      if(el.hasAttribute('aria-labelledby')) el.setAttribute('aria-labelledby',idMap.get(el.getAttribute('aria-labelledby'))||el.getAttribute('aria-labelledby'));
      el.id=p.id;if(p.objects.some(o=>!o.deleted&&o.style.position==='absolute'))el.style.position='relative';el.classList.add('slide');el.dataset.title=p.title;el.setAttribute('oai-annotation-container','');
      for (const o of p.objects) {
        let node=[...el.querySelectorAll('[data-edit-key]')].find(n=>n.dataset.editKey===o.key);
        if(o.deleted) { node?.remove(); continue; }
        if(!node) { node=document.createElement(o.type==='image'?'img':o.type==='youtube'?'iframe':o.type==='scene'?'div':'p'); node.dataset.editKey=o.key;node.dataset.added='true';el.append(node); }
        node.dataset.objectId=o.id;node.dataset.editType=o.type;
        if(o.type==='text'&&readText(node)!==o.content){node.textContent=o.content;node.style.whiteSpace='pre-line';}
        if(o.type==='scene')window.WorkshopScenes.mount(node,o.content);
        if(o.type==='image') { node.src=o.content;node.alt=node.alt||'편집한 이미지';node.draggable=false; }
        if(o.type==='youtube') {node.src=M.youtube(o.content);node.title='YouTube 영상';node.allowFullscreen=true;node.referrerPolicy='strict-origin-when-cross-origin';node.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');}
        const s=o.style;if(s.position==='absolute')Object.assign(node.style,{position:'absolute',left:'0',top:'0',margin:'0'}); for (const prop of ['fontSize','fontWeight','color','textAlign','width','height']) if(s[prop]!==undefined) node.style[prop]=['fontSize','height'].includes(prop)?s[prop]?s[prop]+'px':'auto':prop==='width'?s[prop]+'%':s[prop];
        if(s.letterSpacing!==undefined)node.style.letterSpacing=s.letterSpacing+'em';
        if(s.offsetX!==undefined||s.offsetY!==undefined){node.dataset.moveX=s.offsetX||0;node.dataset.moveY=s.offsetY||0;node.style.translate='none';}else node.style.translate=`${s.x||0}% ${s.y||0}%`;node.style.maxWidth='100%';if(s.width!==undefined)node.style.minWidth='0';if(s.height>0)node.style.maxHeight='none';if(o.type==='image')node.style.objectFit='contain';
        if(o.behavior.tooltip){node.dataset.tooltip=o.behavior.tooltip;node.tabIndex=0;node.removeAttribute('title');}
        if(o.behavior.click){node.dataset.clickAction=JSON.stringify(o.behavior.click);node.tabIndex=0;if(!node.matches('button,input,select,textarea'))node.setAttribute('role','button');}
        if(o.behavior.explain) {node.dataset.explain=o.behavior.explain;node.tabIndex=0;node.setAttribute('role','button');}
        node.setAttribute('oai-annotatable',`${p.title} · ${o.key}`);
        node.setAttribute('oai-annotation-metadata',JSON.stringify(metadata(p,o)));
      }
      $('#deck').append(el);
    }
    api.refresh(old);for(const [pageId,tab] of tabs){const p=document.getElementById(pageId);p?.querySelectorAll('[data-tab]').forEach(n=>{const on=n.dataset.tab===tab;n.setAttribute('aria-selected',String(on));n.tabIndex=on?0:-1;});p?.querySelectorAll('[data-panel]').forEach(n=>n.hidden=n.dataset.panel!==tab);}for(const [pageId,id,value]of inputs){const p=document.getElementById(pageId),n=p?.querySelector(`[data-runtime-id="${id}"],#${CSS.escape(id)}`);if(n){n.value=value;if(n.matches('[data-scene-range]'))n.dispatchEvent(new Event('input',{bubbles:true}));}}renderPanel();highlight();
  }
  function metadata(p,o) {return {deckId:doc.deckId.slice(0,256),revision:doc.revision,pageId:p.id,objectId:o.id,objectType:o.type};}
  function context(p,o) {
    const page=document.getElementById(p.id),node=page.querySelector(`[data-object-id="${o.id}"]`),behavior=clone(o.behavior),assets=o.type==='image'?[o.content.startsWith('data:')?`embedded:${o.id}`:o.content]:[];
    if(behavior.click?.kind==='swap-image'){if(behavior.click.src.startsWith('data:'))behavior.click.src=`embedded-action:${o.id}`;assets.push(behavior.click.src);}
    return {deckId:doc.deckId,templateVersion:doc.templateVersion,revision:doc.revision,page:{id:p.id,title:p.title,notes:p.notes,seconds:p.seconds},object:{...clone(o),behavior,content:o.type==='image'&&o.content.startsWith('data:')?`embedded:${o.id}`:o.content},internalState:{tabs:[...page.querySelectorAll('[role=tab][aria-selected=true]')].map(t=>t.textContent),inputs:[...page.querySelectorAll('input,select,textarea')].map(n=>({id:n.dataset.editKey||n.id,value:n.value}))},preserve:{attributes:node?[...node.attributes].filter(a=>/^data-|^aria-/.test(a.name)).map(a=>[a.name,a.name==='data-click-action'?JSON.stringify(behavior.click):a.value]):[],behavior},assets,impactReview:['화면과 사례의 의미','발표 노트','시간 배분','관련 페이지와 참여 활동']};
  }
  function highlight() {document.querySelectorAll('.edit-selected,.edit-resizable').forEach(n=>n.classList.remove('edit-selected','edit-resizable')); if(editing&&selected){const node=document.querySelector(`[data-object-id="${selected}"]`);node?.classList.add('edit-selected');if(['text','image'].includes(target()?.type))node?.classList.add('edit-resizable');}syncResizeFrame();ui?.refresh();}
  function renderPanel() {
    const p=current(), o=target();$('#page-select').replaceChildren(...doc.pages.map((x,i)=>new Option(`${i+1}. ${x.title}`,x.id)));$('#page-select').value=p.id;$('#page-title').value=p.title;$('#page-notes').value=p.notes;$('#page-seconds').value=p.seconds;
    $('#object-list').replaceChildren(new Option('대상을 선택하세요',''),...p.objects.filter(x=>!x.deleted).map(x=>new Option(x.type==='text'?x.content.slice(0,30):x.key,x.id)));$('#object-list').value=o?.id||'';
    $('#object-tools').hidden=!o; if(!o)return;
    const node=document.querySelector(`[data-object-id="${o.id}"]`),style=node?getComputedStyle(node):{};
    $('#object-name').textContent=o.type==='text'?'글자':o.type==='image'?'사진':o.type==='youtube'?'영상':o.type==='scene'?'장면':'화면 블록';
    $('#object-width').value=o.style.width??100;$('#object-height-mode').value=o.style.height>0?'manual':'auto';$('#object-height').value=o.style.height>0?o.style.height:Math.max(1,Math.min(800,Math.round(node?.getBoundingClientRect().height||100)));heightMode();const free=o.style.position==='absolute';$('#placement-origin-title').textContent=free?'페이지 왼쪽 위에서의 위치':'원래 위치에서 이동';$('#placement-origin-help').textContent=free?'0, 0은 페이지의 왼쪽 위 모서리입니다. 가로는 오른쪽으로, 세로는 아래쪽으로 잽니다.':'0은 원래 자동 배치된 위치입니다.';const translate=(style.translate||'0 0').split(' ');const pixels=(v,size)=>v?.endsWith('%')?parseFloat(v)*size/100:parseFloat(v)||0;$('#object-x').value=Math.round(pixels(translate[0],node?.offsetWidth||0));$('#object-y').value=Math.round(pixels(translate[1],node?.offsetHeight||0));
    $('#object-tooltip').value=o.behavior.tooltip||'';$('#object-explain').value=o.behavior.explain||'';$('#behavior-kind').value=o.behavior.click?.kind||(o.behavior.click===null?'none':'explain');behaviorImage=o.behavior.click?.src||'';$('#behavior-error').hidden=true;behaviorFields(o.behavior.click?.targetId);
  }
  function objectLabel(o,p=current()){const i=p.objects.filter(x=>!x.deleted&&x.type===o.type).findIndex(x=>x.id===o.id)+1;return o.type==='text'?o.content.replace(/\s+/g,' ').slice(0,45)||'빈 글자':`${({image:'사진',youtube:'영상',scene:'장면',block:'화면 묶음'})[o.type]} ${i}`;}
  function behaviorFields(targetId=$('#behavior-target').value){
    const kind=$('#behavior-kind').value,o=target(),p=current(),source=o&&document.querySelector(`[data-object-id="${o.id}"]`);
    $('#behavior-explain-fields').hidden=kind!=='explain';$('#behavior-target-fields').hidden=!['swap-image','toggle'].includes(kind);$('#behavior-image-fields').hidden=kind!=='swap-image';
    const candidates=p.objects.filter(x=>{if(x.deleted||kind==='swap-image'&&x.type!=='image'||kind==='toggle'&&x.id===o?.id)return false;const n=document.querySelector(`[data-object-id="${x.id}"]`);return n&&n.getClientRects().length&&!n.closest('[hidden]')&&(n===source||!n.contains(source)&&!source?.contains(n));});
    $('#behavior-target').replaceChildren(new Option(candidates.length?'선택해 주세요':kind==='swap-image'?'먼저 이 페이지에 사진을 추가해 주세요':'먼저 이 페이지에 다른 요소를 추가해 주세요',''),...candidates.map(x=>new Option(objectLabel(x),x.id)));
    $('#behavior-target').value=candidates.some(x=>x.id===targetId)?targetId:kind==='swap-image'&&o?.type==='image'?o.id:'';
    $('#behavior-target-label').textContent=kind==='swap-image'?'어떤 사진을 바꿀까요?':'어떤 요소를 보여줄까요?';$('#behavior-target-help').textContent=kind==='toggle'?'발표 시작에는 숨겨져 있다가, 클릭할 때마다 나타났다 사라집니다. 편집 중에는 흐리게 보입니다.':'이 페이지에 있는 사진을 골라 주세요.';
    $('#behavior-pick-target').disabled=!candidates.length;behaviorTargetPreview();$('#behavior-image-preview').hidden=!behaviorImage;if(behaviorImage)$('#behavior-image-preview').src=behaviorImage;else $('#behavior-image-preview').removeAttribute('src');ui?.layout();
  }
  function behaviorTargetPreview(){const box=$('#behavior-target-preview'),item=current().objects.find(x=>x.id===$('#behavior-target').value);box.replaceChildren();box.hidden=!item;$('#behavior-unlink').hidden=!item&&!target()?.behavior.click;$('#behavior-pick-target').textContent=item?'연결 대상 다시 고르기':'화면에서 대상 고르기';if(item){if(item.type==='image'){const img=document.createElement('img');img.src=item.content;img.alt='연결된 사진';box.append(img);}const text=document.createElement('span');text.textContent='선택한 대상 · '+objectLabel(item);box.append(text);}ui?.syncLinks?.();}
  $('#behavior-kind').addEventListener('change',()=>{behaviorFields();$('#behavior-error').hidden=true;});$('#behavior-target').addEventListener('change',behaviorTargetPreview);
  function clearActionReferences(page,ids){for(const item of page.objects)if(ids.has(item.behavior.click?.targetId))delete item.behavior.click;}
  function heightMode(){const manual=$('#object-height-mode').value==='manual';$('#object-height-field').hidden=!manual;$('#object-height').disabled=!manual;$('#placement-height-help').textContent=manual?'입력한 값이 최종 박스 높이입니다. 글자 크기는 바뀌지 않습니다.':'높이는 내용에 맞춰 자동으로 정해집니다.';}
  $('#object-height-mode').addEventListener('change',()=>{heightMode();ui?.layout();});
  function setBehaviorPreview(on){ui?.cancelPick?.(false);ui?.cancelInsert?.();behaviorPreview=on&&editing;hideGuides();document.body.classList.toggle('is-behavior-preview',behaviorPreview);$('#edit-mode-label').textContent=behaviorPreview?'동작 시험':'편집 모드';$('#behavior-test').textContent=behaviorPreview?'편집으로':'동작 시험';$('#behavior-test').setAttribute('aria-pressed',String(behaviorPreview));$('#edit-mode-hint').textContent=behaviorPreview?'미리보기 중 · 마우스를 올려놓거나 클릭해 보세요. 이동하려면 편집으로 돌아가세요.':'요소를 끌어 이동하고, 모서리로 크기를 조절하세요. 더블클릭하면 글자를 수정합니다.';api.hideTooltip?.();api.resetActions?.();syncResizeFrame();ui?.refresh();}
  function setEditing(on) { editing=on;if(!on)shareDialog.close();else if(!inboxConnection)connectInbox();setBehaviorPreview(false);panelPage=api.currentId();document.body.classList.toggle('is-editing',on);api.resetActions?.();$('#edit-tools').hidden=!on;$('#edit-toggle').setAttribute('aria-pressed',String(on));$('#edit-toggle').textContent=on?'편집 중':'편집';api.layoutMoved?.();renderPanel();highlight();ui?.layout(); }
  function choose(id) { selected=id;renderPanel();highlight(); }
  function download(name,content,type='application/json') {const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function batch() {return JSON.stringify({format:'workshop-change-requests/v1',deckId:doc.deckId,baseRevision:doc.revision,instructions:'각 요청 context.revision은 수집 당시 상태입니다. 첨부 편집본의 현재 버전과 내용이 달라졌다면 충돌을 확인하세요. 정확한 page.id/object.id로 수정하세요. 요청 외 대상과 기존 동작을 보존하세요. 첨부 편집본+원본 소스가 필요합니다. JSON 패치는 {deckId,baseRevision,changes:[{pageId,objectId,set:{content,style,behavior}}],pageUpdates:[{pageId,notes,seconds}]} 형식입니다. 지원하지 않는 코드 변경은 별도 소스 차이로 전달하고 검증하세요.',requests:queue},null,2);}
  function annotationAvailable(){return typeof document.oai?.annotation?.request==='function';}
  function inboxControls(){
    $('#queue-inbox-button').hidden=!inboxConnection;$('#queue-inbox-button').disabled=inboxBusy||!queue.length;
    $('#inbox-result-button').hidden=!inboxConnection||!inboxSaved;$('#inbox-result-button').disabled=inboxBusy;
  }
  async function connectInbox(){
    if(!['127.0.0.1','localhost'].includes(location.hostname)){inboxHelp('프로젝트 요청함은 npm run dev로 연 로컬 편집기에서 사용할 수 있습니다.');return false;}
    try{const res=await fetch('/api/editor-inbox',{cache:'no-store',signal:AbortSignal.timeout(5000)}),data=res.ok?await res.json():null;if(!data?.available||data.deckId!==doc.deckId||typeof data.token!=='string')throw Error();inboxConnection=data;inboxControls();inboxHelp(inboxSaved?'저장한 요청함이 있습니다. 에이전트가 작업한 뒤 변경안을 확인하세요.':'같은 프로젝트에서 작업하는 Claude Code·Codex가 읽을 수 있습니다.');return true;}
    catch{inboxConnection=null;inboxControls();inboxHelp('프로젝트 요청함을 쓰려면 이 프로젝트에서 npm run dev로 미리보기를 여세요.');return false;}
  }
  function inboxHelp(message){$('#queue-inbox-help').textContent=message;}
  async function inboxFetch(route,body){
    if(!inboxConnection&&!await connectInbox())throw Error('로컬 요청함에 연결하지 못했습니다.');
    const res=await fetch('/api/editor-inbox'+route,{method:body===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'x-workshop-editor-token':inboxConnection.token,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await res.json();if(!res.ok){if(res.status===403){inboxConnection=null;await connectInbox();}throw Error(data.error||'요청함 저장에 실패했습니다.');}return data;
  }
  async function saveInbox(){
    if(inboxBusy)return;if(!queue.length)throw Error('먼저 수정 요청을 목록에 추가해 주세요.');
    inboxBusy=true;inboxControls();const payload={format:'workshop-editor-inbox/v1',document:clone(doc),requests:clone(queue)};
    try{const saved=await inboxFetch('/batches',payload);inboxSaved={id:saved.id,location:saved.location};try{localStorage.setItem(key+':inbox',JSON.stringify(inboxSaved));}catch{}
      inboxHelp(`프로젝트 요청함에 저장됨${saved.duplicate?' · 같은 편집본과 요청은 중복 저장하지 않았습니다.':''} · 에이전트에게 “요청함 확인해서 반영해줘”라고 말씀해 주세요. 자동 실행되지는 않습니다.`);status('프로젝트 요청함에 저장됨 · 요청 목록과 편집본은 보존됩니다.');
    }catch(e){inboxHelp('저장하지 못했습니다. 요청 목록과 편집본은 이 브라우저에 남아 있습니다. '+e.message);status('요청함 저장 실패 · 연결을 확인한 뒤 다시 눌러 주세요.');}
    finally{inboxBusy=false;inboxControls();}
  }
  async function inboxResult(){
    if(inboxBusy||!inboxSaved)return;inboxBusy=true;inboxControls();
    try{const result=await inboxFetch('/batches/'+inboxSaved.id);if(result.status.state==='ready'&&result.patch){previewPatch(result.patch);pending.inboxId=inboxSaved.id;}else inboxHelp(({pending:'아직 에이전트 작업 전입니다.',working:'에이전트가 작업 중입니다.',done:'이미 처리한 요청입니다.',blocked:'에이전트가 확인을 요청했습니다.'}[result.status.state]||'요청함 상태 확인')+' '+(result.status.note||''));}
    catch(e){inboxHelp(e.message);status(e.message);}finally{inboxBusy=false;inboxControls();}
  }
  function shareState(message){$('#request-share-state').textContent=message;status(message);}
  function renderShare(){
    const part=shareIndex+1,total=shareParts.length;
    $('#request-share-text').textContent=`수정 요청 ${shareSnapshot.count}개\ndeckId: ${shareSnapshot.deckId}\nbaseRevision: ${shareSnapshot.revision}\n묶음 ${part}/${total}${total>1?' · 모든 묶음을 전달한 뒤 합쳐서 검토하세요.':''}\n내장 이미지의 바이너리는 참조로 대체했습니다. 원본 소스에 접근할 수 없으면 필요한 편집본을 요청하세요.\n\n${shareParts[shareIndex]}`;
    $('#request-share-text').scrollTop=0;$('#request-share-part').textContent=total>1?`${part} / ${total}`:'';
    for(const name of ['prev','next']){const b=shareDialog.querySelector(`[data-action="share-${name}"]`);b.hidden=total===1;b.disabled=name==='prev'?shareIndex===0:part===total;}
    shareState(total>1?`요청이 길어 ${total}묶음으로 나눴습니다. 각 묶음을 주석으로 보내 주세요. 내용을 생략하지 않았습니다.`:'주석 창에서 확인한 뒤 보내 주세요. 요청 목록은 그대로 보관됩니다.');
  }
  function requestShareAnnotation(){
    if(!annotationAvailable()){shareState('이 브라우저는 ChatGPT 주석을 지원하지 않습니다. 앱 안의 브라우저에서 열거나 요청 복사·파일 저장을 사용하세요.');return;}
    const range=document.createRange();range.selectNodeContents($('#request-share-text'));
    try{const result=document.oai.annotation.request(range,{initialComment:`모아둔 수정 요청 ${shareSnapshot.count}개를 검토하고 반영해줘.${shareParts.length>1?` 묶음 ${shareIndex+1}/${shareParts.length}, 나머지 묶음까지 받은 뒤 진행해줘.`:''} 각 대상 ID와 버전을 확인하고 요청 외 내용은 보존해줘.`});
      shareState(result?.accepted?'주석 요청이 수락됨 · 주석 창에서 보내기를 눌러 주세요. 전송 완료는 아직 확인되지 않았습니다.':'주석을 열지 못했습니다. 열린 주석 창이나 사이트의 주석 허용 설정을 확인한 뒤 다시 눌러 주세요. 요청은 보관됩니다.');
    }catch{shareState('주석을 열지 못했습니다. 다시 시도하거나 요청 복사·파일 저장을 사용하세요. 요청은 보관됩니다.');}
  }
  function shareQueue(){
    if(!queue.length)throw Error('먼저 수정 요청을 목록에 추가해 주세요.');
    // The 240-unit comment is only a prompt. The actual requests travel as selected text.
    // Range requests accept <=20,000 UTF-16 units; split explicitly without dropping content.
    const text=JSON.stringify(JSON.parse(batch()),(k,v)=>typeof v==='string'?v.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi,'embedded-image: 원본 편집본 참조'):v,2);
    shareSnapshot={deckId:doc.deckId,revision:doc.revision,count:queue.length};shareParts=[];shareIndex=0;
    for(let start=0;start<text.length;){let end=Math.min(start+18000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;shareParts.push(text.slice(start,end));start=end;}
    ui?.close();renderShare();if(!shareDialog.open)shareDialog.show();requestShareAnnotation();
  }
  function renderQueue() {$('#queue-count').textContent=queue.length;$('#queue-annotation-button').disabled=!queue.length;inboxControls();$('#request-list').replaceChildren();for(const r of queue){const li=document.createElement('li'),label=document.createElement('p'),input=document.createElement('textarea'),remove=document.createElement('button');label.textContent=`${r.context.page.title} · ${{text:'글자',image:'사진',youtube:'영상',block:'화면 블록',scene:'장면'}[r.context.object.type]||'선택 요소'}`;input.value=r.request;input.setAttribute('aria-label','저장된 수정 요청');input.addEventListener('change',()=>{r.request=input.value;persist();$('#batch-copy').value=batch();});remove.textContent='이 요청 삭제';remove.type='button';remove.addEventListener('click',()=>{queue=queue.filter(x=>x.id!==r.id);persist();renderQueue();});li.append(label,input,remove);$('#request-list').append(li);}$('#batch-copy').value=batch();ui?.refresh();}
  function file(accept,fn) {const input=$('#edit-file');input.accept=accept;input.value='';input.onchange=()=>{if(input.files[0]?.size>16000000){status('파일은 16MB 이하로 줄여 주세요.');return;}if(input.files[0])Promise.resolve(fn(input.files[0])).catch(e=>status(e.message));};input.click();}
  let lastCanvasPoint=null;
  const inputTarget=n=>n?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]');
  function visibleCanvas(){const p=document.getElementById(current().id).getBoundingClientRect(),d=$('#deck').getBoundingClientRect(),cs=getComputedStyle($('#deck')),b=parseFloat(cs.borderTopWidth)||0;const left=Math.max(p.left+4,d.left+b+4),top=Math.max(p.top+4,d.top+b+4),right=Math.min(p.right-4,d.right-b-4),bottom=Math.min(p.bottom-4,d.bottom-b-4);return {x:left,y:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};}
  function insertionRect(draft,point,drawn){const f=visibleCanvas(),ratio=draft.ratio||(draft.type==='youtube'?16/9:5),maxH=Math.min(800,f.height),width=Math.min(f.width,Math.max(24,Math.min(draft.type==='text'?320:480,f.width*.6))),height=draft.type==='text'?Math.min(56,maxH):Math.min(width/ratio,maxH*.65);let w=draft.type==='text'?width:Math.min(width,height*ratio),h=height;if(drawn){w=Math.min(f.width,Math.max(24,drawn.width));h=Math.min(maxH,Math.max(24,drawn.height));}const x=point?.x??f.x+(f.width-w)/2,y=point?.y??f.y+(f.height-h)/2;return {x:Math.max(f.x,Math.min(f.x+f.width-w,x)),y:Math.max(f.y,Math.min(f.y+f.height-h,y)),width:w,height:h};}
  function videoDraft(value){const content=M.youtube(value.trim());if(!content)throw Error('YouTube 동영상 주소를 입력해 주세요.');return {type:'youtube',content,ratio:16/9};}
  async function imageDraft(f){if(f.size>2000000||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error(f.type.startsWith('video/')?'동영상은 YouTube 주소로 추가해 주세요.':'2MB 이하 PNG/JPEG/WebP 사진을 선택해 주세요.');const content=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('사진을 읽지 못했습니다.'));r.readAsDataURL(f);});if(!M.safeImage(content))throw Error('사진 형식을 확인해 주세요.');const img=new Image();img.src=content;await img.decode();return {type:'image',content,ratio:img.naturalWidth/img.naturalHeight};}
  function beginInsert(type){if(!editing)return;if(behaviorPreview)setBehaviorPreview(false);ui?.cancelPick?.(false);ui?.cancelInsert?.();if(type==='text')ui?.place?.({type:'text',content:'새 글자'});if(type==='youtube')ui?.video?.();if(type==='image'){const pageId=current().id,revision=doc.revision;file('image/png,image/jpeg,image/webp',async f=>{const draft=await imageDraft(f);if(!editing||current().id!==pageId||doc.revision!==revision){status('페이지나 편집본이 바뀌어 사진 추가를 취소했습니다. 다시 선택해 주세요.');return;}ui?.place?.(draft);});}}
  function editNewText(id,pageId){const node=document.querySelector(`[data-object-id="${id}"]`);if(!node)return;node.contentEditable='plaintext-only';node.focus();const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);syncResizeFrame();ui?.refresh();node.addEventListener('blur',()=>{const value=node.innerText;node.removeAttribute('contenteditable');const item=doc.pages.find(p=>p.id===pageId)?.objects.find(o=>o.id===id&&!o.deleted);if(item&&item.content!==value)mutate(d=>{d.pages.find(p=>p.id===pageId).objects.find(o=>o.id===id).content=value;});else{syncResizeFrame();ui?.refresh();}},{once:true});}
  function insertAt(draft,rect,options={}){if(!editing||behaviorPreview||targetPicking||options.pageId&&options.pageId!==current().id)throw Error('현재 편집 중인 페이지에만 추가할 수 있습니다.');const p=current(),frame=document.getElementById(p.id).getBoundingClientRect(),r=insertionRect(draft,rect,rect),id=M.uid('obj'),style={position:'absolute',width:r.width/frame.width*100,height:draft.type==='text'&&!options.drawn?0:r.height,x:0,y:0,offsetX:(r.x-frame.left)/frame.width*100,offsetY:(r.y-frame.top)/frame.height*100,...(draft.type==='text'?{fontSize:frame.width<400?20:32}:{})};selected=id;mutate(d=>{d.pages.find(x=>x.id===p.id).objects.push({id,key:M.uid(draft.type),type:draft.type,content:draft.content,style,behavior:{},deleted:false});});if(options.editText)editNewText(id,p.id);status('추가했습니다. 끌어서 이동하거나 모서리로 크기를 조절할 수 있습니다.');return id;}
  $('#deck').addEventListener('pointermove',e=>{if(editing&&!inserting&&!targetPicking)lastCanvasPoint={x:e.clientX,y:e.clientY,pageId:current().id};});
  async function ingest(data,point){const files=[...data.files||[]],items=[...data.items||[]];if(!files.length)for(const item of items)if(item.kind==='file'){const f=item.getAsFile();if(f)files.push(f);}if(files.length>1)throw Error('사진은 한 장씩 놓아 주세요.');const pageId=current().id,revision=doc.revision;let draft;if(files.length)draft=await imageDraft(files[0]);else{const text=data.getData('text/plain')||data.getData('text/uri-list')?.split('\n').find(v=>v&&!v.startsWith('#'))||'';if(!text.trim())return;if(text.length>30000)throw Error('한 번에 넣는 글자는 30,000자 이하로 나눠 주세요.');draft=M.youtube(text.trim())?videoDraft(text):{type:'text',content:text};}if(!editing||behaviorPreview||current().id!==pageId||doc.revision!==revision)throw Error('페이지나 편집본이 바뀌어 추가를 취소했습니다.');ui?.cancelInsert?.();insertAt(draft,insertionRect(draft,point),{pageId});}
  document.addEventListener('paste',e=>{if(!editing||behaviorPreview||targetPicking||inputTarget(e.target)||inputTarget(document.activeElement)||document.querySelector('dialog[open]')||!e.clipboardData)return;const data=e.clipboardData;if(!data.files.length&&![...data.items||[]].some(i=>i.kind==='file')&&!data.getData('text/plain').trim())return;e.preventDefault();const point=lastCanvasPoint?.pageId===current().id?lastCanvasPoint:null;ingest(data,point).catch(error=>status(error.message));});
  const dropData=e=>e.dataTransfer&&![...e.dataTransfer.types].includes('text/x-workshop-page')&&[...e.dataTransfer.types].some(t=>['Files','text/plain','text/uri-list'].includes(t));
  document.addEventListener('dragover',e=>{if(!editing||!dropData(e)||inputTarget(e.target))return;e.preventDefault();if(behaviorPreview||targetPicking){e.dataTransfer.dropEffect='none';return;}e.dataTransfer.dropEffect='copy';if($('#deck').contains(e.target)&&!document.querySelector('dialog[open]'))ui?.dropHint?.(true);});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget||!$('#deck').contains(e.relatedTarget))ui?.dropHint?.(false);});
  document.addEventListener('drop',e=>{ui?.dropHint?.(false);if(!editing||!dropData(e)||inputTarget(e.target))return;e.preventDefault();if(behaviorPreview||targetPicking){status('미리보기나 대상 선택을 마친 뒤에 놓아 주세요.');return;}if(!$('#deck').contains(e.target)||document.querySelector('dialog[open]')){status('설정 창을 닫고 슬라이드 안에 놓아 주세요.');return;}ingest(e.dataTransfer,{x:e.clientX,y:e.clientY}).catch(error=>status(error.message));});
  async function image(replace=false) {file('image/png,image/jpeg,image/webp',async f=>{if(f.size>2000000)throw Error('사진은 2MB 이하로 줄여 주세요.');const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});if(!M.safeImage(value))throw Error('PNG/JPEG/WebP만 가능합니다.');const o=target();mutate(d=>{const p=d.pages.find(p=>p.id===current().id);if(replace&&o?.type==='image')p.objects.find(x=>x.id===o.id).content=value;else {const added={id:M.uid('obj'),key:M.uid('image'),type:'image',content:value,style:{width:70,height:300},behavior:{},deleted:false};selected=added.id;p.objects.push(added);}});});}
  function previewPatch(patch) {
    if(patch.deckId!==doc.deckId||patch.baseRevision!==doc.revision||!Array.isArray(patch.changes)||patch.changes.length>100)throw Error('대상 덱/버전이 다릅니다. 현재 편집본으로 다시 요청하세요.');
    const next=clone(doc), descriptions=[];
    for(const change of patch.changes){const p=next.pages.find(p=>p.id===change.pageId),o=p?.objects.find(o=>o.id===change.objectId&&!o.deleted);if(!o||!change.set||Object.keys(change.set).some(k=>!['content','style','behavior'].includes(k)))throw Error('수정 대상 또는 필드가 올바르지 않습니다.');for(const [k,v]of Object.entries(change.set))o[k]=['style','behavior'].includes(k)?{...o[k],...v}:v;descriptions.push(`${p.title} · ${Object.keys(change.set).map(k=>({content:'내용',style:'배치·스타일',behavior:'동작'}[k])).join(', ')} 변경`);}
    if(patch.pageUpdates!==undefined&&!Array.isArray(patch.pageUpdates))throw Error('발표 노트 변경이 올바르지 않습니다.');for(const update of patch.pageUpdates||[]){const p=next.pages.find(p=>p.id===update.pageId);if(!p||Object.keys(update).some(k=>!['pageId','notes','seconds'].includes(k)))throw Error('페이지 변경이 올바르지 않습니다.');if(update.notes!==undefined)p.notes=update.notes;if(update.seconds!==undefined)p.seconds=update.seconds;descriptions.push(`${p.title}: 노트·시간 검토`);}
    M.validate(next,bases);ui?.close();pending={next,base:doc.revision};const saved=doc;doc=next;render();doc=saved;$('#preview-page').replaceChildren(...next.pages.filter(p=>patch.changes.some(c=>c.pageId===p.id)||(patch.pageUpdates||[]).some(c=>c.pageId===p.id)).map(p=>new Option(p.title,p.id)));$('#preview-page').value=[...$('#preview-page').options].some(o=>o.value===api.currentId())?api.currentId():$('#preview-page').options[0]?.value||api.currentId();api.go($('#preview-page').value);$('#patch-dialog pre').textContent=descriptions.join('\n')||'변경 없음';$('#patch-dialog').showModal();
  }
  async function portable() {
    const output=document.documentElement.cloneNode(true);api.resetActions?.(output.querySelector('#deck'),false);output.querySelectorAll('[data-editor-ui],script[src="editor.js"],link[href="editor.css"]').forEach(n=>n.remove());output.querySelector('body').classList.remove('is-editing','is-behavior-preview');output.querySelectorAll('[data-runtime-overlay]').forEach(n=>n.remove());output.querySelectorAll('[data-config]').forEach(n=>n.removeAttribute('data-config'));output.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));output.querySelectorAll('.edit-selected').forEach(n=>n.classList.remove('edit-selected'));output.querySelectorAll('[data-object-id]').forEach(n=>{n.removeAttribute('oai-annotation-metadata');n.removeAttribute('oai-annotatable');});
    output.querySelectorAll('script[src="deck-model.js"],script[data-editor-library]').forEach(n=>n.remove());
    const dataURL=async url=>{const response=await fetch(url);if(!response.ok)throw Error('에셋을 읽을 수 없습니다: '+url);const blob=await response.blob();return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});};
    for(const link of output.querySelectorAll('link[rel=stylesheet]')){const response=await fetch(link.href);if(!response.ok)throw Error('스타일을 읽을 수 없습니다.');let css=await response.text();const refs=[...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)];for(const ref of refs)if(!ref[1].startsWith('data:'))css=css.replace(ref[0],`url("${await dataURL(new URL(ref[1],link.href))}")`);const style=document.createElement('style');style.textContent=css;link.replaceWith(style);}
    for(const a of output.querySelectorAll('a[href]')){const url=new URL(a.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash)a.setAttribute('href',url.hash);}
    for(const scene of output.querySelectorAll('[data-scene-config]')){const config=window.WorkshopScenes.parse(scene.dataset.sceneConfig);for(let i=0;i<config.images.length;i++){if(config.images[i].startsWith('data:'))continue;let embedded=await dataURL(config.images[i]);if(embedded.startsWith('data:image/svg+xml')){const image=new Image();image.src=embedded;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.min(1600,image.naturalWidth||1200);canvas.height=Math.max(1,Math.round(canvas.width*(image.naturalHeight||675)/(image.naturalWidth||1200)));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);embedded=canvas.toDataURL('image/png');}config.images[i]=embedded;}scene.dataset.sceneConfig=JSON.stringify(config);}
    for(const node of output.querySelectorAll('[data-click-action]')){const action=JSON.parse(node.dataset.clickAction);if(action.kind==='swap-image'&&!action.src.startsWith('data:')){let embedded=await dataURL(new URL(action.src,location.href));if(embedded.startsWith('data:image/svg+xml')){const image=new Image();image.src=embedded;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.min(1600,image.naturalWidth||1200);canvas.height=Math.max(1,Math.round(canvas.width*(image.naturalHeight||675)/(image.naturalWidth||1200)));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);embedded=canvas.toDataURL('image/png');}action.src=embedded;}node.dataset.clickAction=JSON.stringify(action);}
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
    if(action==='page-copy'){const copy=clone(p);copy.id=M.uid('page');const ids=new Map(copy.objects.map(o=>[o.id,M.uid('obj')]));copy.objects.forEach(o=>{o.id=ids.get(o.id);if(o.behavior.click)o.behavior.click.targetId=ids.get(o.behavior.click.targetId);});mutate(d=>d.pages.splice(d.pages.findIndex(x=>x.id===p.id)+1,0,copy));api.go(copy.id);}
    if(action==='page-delete'){if(doc.pages.length<2)throw Error('페이지 하나는 남겨야 합니다.');mutate(d=>d.pages.splice(d.pages.findIndex(x=>x.id===p.id),1));}
    if(['page-up','page-down'].includes(action))mutate(d=>{const i=d.pages.findIndex(x=>x.id===p.id),j=i+(action==='page-up'?-1:1);if(j>=0&&j<d.pages.length)[d.pages[i],d.pages[j]]=[d.pages[j],d.pages[i]];});
    if(action==='add-text'||action==='add-video'){const type=action==='add-text'?'text':'youtube',video=type==='youtube'?window.prompt('YouTube 주소를 입력하세요.'):null;if(type==='youtube'&&!video)return;if(type==='youtube'&&!M.youtube(video))throw Error('YouTube 주소를 확인하세요.');const added={id:M.uid('obj'),key:M.uid(type),type,content:type==='text'?'새 글자':video,style:type==='text'?{}:{width:80,height:320},behavior:{},deleted:false};selected=added.id;mutate(d=>d.pages.find(x=>x.id===p.id).objects.push(added));}
    if(['add-image','image-replace'].includes(action))await image(action==='image-replace');
    if(action==='object-save'&&o){const height=$('#object-height-mode').value==='manual'?Number($('#object-height').value):0;if(!Number.isFinite(height)||$('#object-height-mode').value==='manual'&&(height<1||height>800))throw Error('직접 지정할 박스 높이는 1~800px로 입력하세요.');mutate(d=>{const x=d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id);x.style={...x.style,width:Number($('#object-width').value),height,x:0,y:0,offsetX:Number($('#object-x').value)/document.getElementById(p.id).clientWidth*100,offsetY:Number($('#object-y').value)/document.getElementById(p.id).clientHeight*100};});}
    if(action==='object-delete'&&o){const node=document.querySelector(`[data-object-id="${o.id}"]`),ids=new Set([o.id,...[...(node?.querySelectorAll('[data-object-id]')||[])].map(n=>n.dataset.objectId)]);mutate(d=>{const page=d.pages.find(x=>x.id===p.id);for(const x of page.objects)if(ids.has(x.id)){x.deleted=true;x.behavior={};if(x.type==='image')x.content='assets/brand/vanollim-pixel.png';if(x.type==='youtube')x.content='https://youtu.be/jNQXAC9IVRw';}clearActionReferences(page,ids);});}
    if(action==='behavior-image'&&o){const sourceId=o.id;file('image/png,image/jpeg,image/webp',async f=>{if(f.size>2000000||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('2MB 이하 PNG/JPEG/WebP 사진을 선택하세요.');const value=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});if(!M.safeImage(value))throw Error('사진 형식을 확인하세요.');if(target()?.id!==sourceId)return;behaviorImage=value;$('#behavior-image-preview').src=value;$('#behavior-image-preview').hidden=false;$('#behavior-error').hidden=true;ui?.layout();});}
    if(action==='behavior-unlink'&&o){const tooltipDraft=$('#object-tooltip').value,explainDraft=$('#object-explain').value,hasSaved=Boolean(o.behavior.click);if(hasSaved)mutate(d=>{d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id).behavior.click=null;});else{$('#behavior-kind').value=o.behavior.explain?'explain':'none';behaviorImage='';behaviorFields('');}$('#object-tooltip').value=tooltipDraft;$('#object-explain').value=explainDraft;ui?.syncLinks?.();status(hasSaved?'연결을 끊었습니다. 실행 취소로 되돌릴 수 있습니다.':'선택 중인 연결을 취소했습니다.');}
    if(action==='behavior-save'&&o){const kind=$('#behavior-kind').value,b={tooltip:$('#object-tooltip').value,explain:kind==='explain'?$('#object-explain').value:''};if(kind==='none')b.click=null;if(['swap-image','toggle'].includes(kind)){const targetId=$('#behavior-target').value;if(!targetId)throw Error(kind==='swap-image'?'바꿀 사진을 골라 주세요.':'보여줄 요소를 골라 주세요.');if(kind==='swap-image'&&!behaviorImage)throw Error('클릭한 뒤 나타날 새 사진을 선택해 주세요.');b.click={kind,targetId,...(kind==='swap-image'?{src:behaviorImage}:{})};}mutate(d=>{d.pages.find(x=>x.id===p.id).objects.find(x=>x.id===o.id).behavior=b;});ui?.close();setBehaviorPreview(true);status('동작을 적용했습니다. 화면에서 마우스를 올려놓거나 클릭해 확인하세요.');}
    if(action==='queue-add'&&o){const request=$('#change-request').value.trim();if(!request)throw Error('변경 요청을 적어 주세요.');queue.push({id:M.uid('request'),request,trigger:$('#request-trigger').value,context:context(p,o)});persist();renderQueue();ui?.refresh();$('#queue-details').open=true;$('#change-request').value='';}
    if(action==='queue-annotation')shareQueue();
    if(action==='queue-inbox')await saveInbox();
    if(action==='inbox-result')await inboxResult();
    if(action==='share-annotation')requestShareAnnotation();
    if(action==='share-close')shareDialog.close();
    if(action==='share-prev'||action==='share-next'){shareIndex=Math.max(0,Math.min(shareParts.length-1,shareIndex+(action==='share-next'?1:-1)));renderShare();}
    if(action==='annotation'&&o){const annotation=document.oai?.annotation;const result=annotation?.request?.(document.querySelector(`[data-object-id="${o.id}"]`),{initialComment:$('#change-request').value.slice(0,240),metadata:metadata(p,o)});status(result?.accepted?'주석 요청이 수락됨 · 실제 전송은 주석 창에서 확인하세요.':'주석을 열지 못했습니다. 요청 복사·파일 저장을 사용하세요.');}
    if(action==='copy'){const text=batch();$('#batch-copy').value=text;try{await navigator.clipboard.writeText(text);status('요청 복사됨 · 편집본과 원본 소스도 전달하세요.');}catch{$('#batch-copy').focus();$('#batch-copy').select();status('아래 요청 내용을 직접 복사하세요.');}}
    if(action==='requests-export')download(`${doc.deckId}-requests.json`,batch());
    if(action==='export')download(`${doc.deckId}-edit.json`,JSON.stringify({format:'workshop-edit/v1',document:doc,requests:queue},null,2));
    if(action==='import')file('.json',async f=>{const data=JSON.parse(await f.text());const next=M.validate(data.document,bases);const requests=validRequests(data.requests);publish(next);queue=requests;persist();renderQueue();});
    if(action==='presentation')await portable();
    if(action==='patch')file('.json',async f=>previewPatch(JSON.parse(await f.text())));
    if(action==='patch-accept'&&pending){if(pending.base!==doc.revision)throw Error('미리보기 이후 편집본이 바뀌었습니다. 다시 불러오세요.');const inboxId=pending.inboxId;publish(pending.next);pending=null;$('#patch-dialog').close();$('#impact-state').textContent='AI 변경안 적용됨 · 노트와 시간 배분을 확인하세요.';if(inboxId)try{await inboxFetch('/batches/'+inboxId+'/applied',{revision:doc.revision});inboxHelp('변경안을 반영했습니다. 실행 취소로 되돌릴 수 있습니다.');}catch{inboxHelp('변경안은 반영했지만 요청함의 완료 상태를 갱신하지 못했습니다.');}}
    if(action==='patch-cancel'){pending=null;render();$('#patch-dialog').close();}
  }catch(error){status(error.message);if(action==='behavior-save'){const help=$('#behavior-error');help.textContent=error.message;help.hidden=false;ui?.layout();}}});
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
    const peers=[...page.querySelectorAll('[data-object-id]')].filter(n=>n!==el&&!el.contains(n)&&!n.contains(el));
    let moved=false,fitWidth;
    el.setPointerCapture(e.pointerId);
    function position(ev){const rect=el.getBoundingClientRect(),pad=4;const baseX=original.left,baseY=original.top;
      let x=Math.min(box.right-pad-rect.width-baseX,Math.max(box.left+pad-baseX,ev.clientX-start.x)),y=Math.min(box.bottom-pad-rect.height-baseY,Math.max(box.top+pad-baseY,ev.clientY-start.y));
      hideGuides();if(!ev.altKey){
        const targets={x:[{value:(box.left+box.right)/2,rect:box,kind:'page'}],y:[{value:(box.top+box.bottom)/2,rect:box,kind:'page'}]};
        for(const peer of peers){if(!peer.getClientRects().length||getComputedStyle(peer).visibility==='hidden')continue;const r=peer.getBoundingClientRect();if(!r.width||!r.height)continue;for(const value of [r.left,(r.left+r.right)/2,r.right])targets.x.push({value,rect:r,kind:'object'});for(const value of [r.top,(r.top+r.bottom)/2,r.bottom])targets.y.push({value,rect:r,kind:'object'});}
        const nearest=(axis,origin,size,min,max)=>{let best=null;for(const target of targets[axis])for(const anchor of [origin,origin+size/2,origin+size]){const delta=target.value-anchor,distance=Math.abs(delta);if(distance<=(e.pointerType==='touch'?10:6)&&origin+delta>=min-.01&&origin+size+delta<=max+.01&&(!best||distance<best.distance))best={...target,delta,distance};}return best;};
        const sx=nearest('x',baseX+x,rect.width,box.left+pad,box.right-pad),sy=nearest('y',baseY+y,rect.height,box.top+pad,box.bottom-pad);x+=sx?.delta||0;y+=sy?.delta||0;
        const final={left:baseX+x,top:baseY+y,right:baseX+x+rect.width,bottom:baseY+y+rect.height};showGuide('x',sx,final,box);showGuide('y',sy,final,box);
      }
      return{x:start.ox+x,y:start.oy+y};}
    const move=ev=>{
      if(!moved&&Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>4){moved=true;document.body.classList.add('is-dragging');
        // Default stretched headings should move like text boxes. Explicit widths stay intact.
        if(o.type==='text'&&o.style.width===undefined){const range=document.createRange();range.selectNodeContents(el);const width=range.getBoundingClientRect().width;const parent=el.parentElement,parentStyle=getComputedStyle(parent),parentWidth=parent.clientWidth-parseFloat(parentStyle.paddingLeft)-parseFloat(parentStyle.paddingRight);if(width>0&&parentWidth>0){fitWidth=Math.max(10,Math.min(100,(width+4)/parentWidth*100));el.style.width=fitWidth+'%';}}
      }
      if(!moved)return;ev.preventDefault();const pos=position(ev);el.style.translate=`${pos.x}px ${pos.y}px`;syncResizeFrame();
    };
    function cleanup(){el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',finish);el.removeEventListener('pointercancel',cancel);document.body.classList.remove('is-dragging');hideGuides();}
    const finish=ev=>{const pos=moved?position(ev):null;cleanup();if(pos)mutate(d=>Object.assign(d.pages.find(p=>p.id===current().id).objects.find(n=>n.id===o.id).style,{x:0,y:0,offsetX:pos.x/box.width*100,offsetY:pos.y/box.height*100,...(fitWidth===undefined?{}:{width:fitWidth})}));};
    const cancel=()=>{cleanup();el.style.width=start.width;el.style.translate=`${start.ox}px ${start.oy}px`;syncResizeFrame();};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',cancel);
  });
  resizeFrame.addEventListener('click',e=>e.stopPropagation());
  resizeFrame.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-resize-corner]'),o=target();if(!handle||!editing||behaviorPreview||!['text','image'].includes(o?.type)||e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const node=document.querySelector(`[data-object-id="${o.id}"]`),page=node.closest('.slide'),frame=page.getBoundingClientRect(),r=node.getBoundingClientRect(),parent=node.parentElement,ps=getComputedStyle(parent),cs=getComputedStyle(node);
    const parentWidth=o.style.position==='absolute'?parent.clientWidth:parent.clientWidth-parseFloat(ps.paddingLeft)-parseFloat(ps.paddingRight),west=handle.dataset.resizeCorner.includes('w'),north=handle.dataset.resizeCorner.includes('n');
    const anchor={x:west?r.right:r.left,y:north?r.bottom:r.top},ratio=r.width/r.height,oldStyle=node.getAttribute('style'),fontSize=parseFloat(cs.fontSize),letterSpacing=(parseFloat(cs.letterSpacing)||0)/fontSize;let changed=false,last=null;
    const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
    function update(ev){
      const dx=(ev.clientX-e.clientX)*(west?-1:1),dy=(ev.clientY-e.clientY)*(north?-1:1);if(!changed&&Math.hypot(dx,dy)<3)return;changed=true;
      const maxWidth=Math.max(parentWidth*.01,Math.min(parentWidth,west?anchor.x-frame.left-4:frame.right-anchor.x-4)),maxHeight=Math.max(1,Math.min(800,north?anchor.y-frame.top-4:frame.bottom-anchor.y-4)),minWidth=Math.min(Math.max(parentWidth*.01,o.type==='text'?1:24),maxWidth),minHeight=Math.min(o.type==='text'?1:Math.max(24,parseFloat(cs.lineHeight)||24),maxHeight);
      const change=Math.abs(dx/r.width)>Math.abs(dy/r.height)?dx:dy*ratio;
      const minScale=o.type==='text'?12/fontSize:0,maxScale=o.type==='text'?140/fontSize:Infinity;
      const limit=Math.min(maxWidth,maxHeight*ratio,r.width*maxScale),minimum=Math.min(limit,Math.max(minWidth,minHeight*ratio,r.width*minScale));
      const width=clamp(r.width+change,minimum,limit),height=width/ratio;
      const textStyle=o.type==='text'?{fontSize:clamp(fontSize*width/r.width,12,140),letterSpacing}:{};
      Object.assign(node.style,{width:width/parentWidth*100+'%',height:height+'px',maxHeight:'none',minWidth:'0',translate:'none',...(textStyle.fontSize?{fontSize:textStyle.fontSize+'px',letterSpacing:letterSpacing+'em'}:{})});
      const natural=node.getBoundingClientRect(),x=(west?anchor.x-natural.width:anchor.x)-natural.left,y=(north?anchor.y-natural.height:anchor.y)-natural.top;
      node.style.translate=`${x}px ${y}px`;last={width:width/parentWidth*100,height,x:0,y:0,offsetX:x/frame.width*100,offsetY:y/frame.height*100,...textStyle};syncResizeFrame();
    }
    function cleanup(){handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);resizeGesture=null;document.body.classList.remove('is-resizing');}
    const move=ev=>{ev.preventDefault();update(ev);};
    const cancel=()=>{cleanup();if(oldStyle===null)node.removeAttribute('style');else node.setAttribute('style',oldStyle);api.layoutMoved?.();syncResizeFrame();};
    const finish=ev=>{update(ev);cleanup();if(last)mutate(d=>Object.assign(d.pages.find(p=>p.id===page.id).objects.find(n=>n.id===o.id).style,last));};
    resizeGesture={cancel};document.body.classList.add('is-resizing');handle.setPointerCapture(e.pointerId);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
  });
  $('#deck').addEventListener('dblclick',e=>{const el=e.target.closest('[data-object-id]'),o=target();if(!editing||behaviorPreview||!el||o?.type!=='text')return;el.contentEditable='plaintext-only';syncResizeFrame();el.focus();el.addEventListener('blur',()=>{const value=el.innerText;el.removeAttribute('contenteditable');mutate(d=>d.pages.find(x=>x.id===current().id).objects.find(x=>x.id===o.id).content=value);},{once:true});});
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(editing&&e.key==='Escape'){if(resizeGesture){e.preventDefault();resizeGesture.cancel();}else if(behaviorPreview)setBehaviorPreview(false);else setEditing(false);return;}if(editing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();root.querySelector(`[data-action="${e.shiftKey?'redo':'undo'}"]`).click();}});
  document.addEventListener('workshop:slide',()=>{if(editing){if(panelPage!==api.currentId())selected=null;panelPage=api.currentId();renderPanel();highlight();}});
  $('#annotation-button').hidden=typeof document.oai?.annotation?.request!=='function';
  $('#queue-annotation-button').hidden=!annotationAvailable();
  $('#queue-annotation-help').textContent=annotationAvailable()?'모아둔 요청을 주석 창에서 확인한 뒤 보내세요.':'이 브라우저는 ChatGPT 주석을 지원하지 않습니다. 요청 복사·파일 저장을 사용할 수 있습니다.';
  // Read-only integration API for agents/tests; mutations use validated revision-checked patches.
  window.WorkshopEditor={get document(){return clone(doc);},get requests(){return clone(queue);},previewPatch,exportRequests:batch};
  // Private UI bridge: all writes still pass model validation, history and revision checks.
  ui=window.WorkshopEditorUI?.setup({
    state:()=>({document:doc,requests:queue,current:current(),object:target(),node:selected?document.querySelector(`[data-object-id="${selected}"]`):null,editing,preview:behaviorPreview,picking:targetPicking,inserting,canUndo:undo.length>0,canRedo:redo.length>0}),
    beginInsert,insertAt,videoDraft,insertionRect,visibleCanvas,
    setInserting:on=>{inserting=on;hideGuides();syncResizeFrame();ui?.refresh();},
    refreshBehavior:renderPanel,
    setPicking:on=>{targetPicking=on;hideGuides();syncResizeFrame();ui?.refresh();},
    go:id=>api.go(id),layout:()=>api.layoutMoved?.(),preview:setBehaviorPreview,status,
    action:name=>root.querySelector(`[data-action="${name}"]`)?.click(),
    update:set=>{const o=target();if(!o)return;mutate(d=>{const item=d.pages.find(p=>p.id===current().id).objects.find(x=>x.id===o.id);if(set.content!==undefined)item.content=set.content;if(set.style)item.style={...item.style,...set.style};});},
    duplicate:()=>{const o=target();if(!o||o.type==='block')return;const added=clone(o);added.id=M.uid('obj');if(added.behavior.click?.targetId===o.id)added.behavior.click.targetId=added.id;added.key=M.uid(o.type);added.style={...added.style,x:0,y:0,offsetX:Math.min(90,(o.style.offsetX||0)+2),offsetY:Math.min(90,(o.style.offsetY||0)+2)};selected=added.id;mutate(d=>d.pages.find(p=>p.id===current().id).objects.push(added));},
    reorder:(source,targetId)=>{if(source===targetId)return;mutate(d=>{const i=d.pages.findIndex(p=>p.id===source),j=d.pages.findIndex(p=>p.id===targetId);if(i>=0&&j>=0){const [moved]=d.pages.splice(i,1);d.pages.splice(j,0,moved);}});},
    addScene:(config,newPage)=>{const content=JSON.stringify(window.WorkshopScenes.parse(config)),o={id:M.uid('obj'),key:M.uid('scene'),type:'scene',content,style:{width:100,height:320},behavior:{},deleted:false};let id=current().id;selected=o.id;mutate(d=>{if(newPage){id=M.uid('page');d.pages.splice(d.pages.findIndex(p=>p.id===current().id)+1,0,{id,template:'blank',title:window.WorkshopScenes.kinds[config.kind],notes:'',seconds:0,objects:[{id:M.uid('obj'),key:'heading',type:'text',content:window.WorkshopScenes.kinds[config.kind],style:{fontSize:48,fontWeight:800},behavior:{},deleted:false},o]});}else d.pages.find(p=>p.id===id).objects.push(o);});api.go(id);selected=o.id;renderPanel();highlight();},
    pickImage:fn=>file('image/png,image/jpeg,image/webp',async f=>{if(f.size>2000000||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('2MB 이하 PNG/JPEG/WebP를 선택하세요.');const value=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});if(!M.safeImage(value))throw Error('사진 형식을 확인하세요.');fn(value);})
  });
  render();renderQueue();status(storageOK?'이 브라우저에 저장됨 · v'+doc.revision:'이전 편집본을 읽지 못했습니다. 파일 불러오기를 사용하세요.');
})();

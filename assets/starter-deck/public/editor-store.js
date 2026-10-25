/* Large local edits are kept transactionally; exported files remain self-contained. */
(() => {
  'use strict';
  function access(key,value,write=false){return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('이 브라우저에서는 대용량 편집본을 저장할 수 없습니다.'));return;}
    const request=indexedDB.open('workshop-editor-storage-v1',1);let db,finished=false;
    const timeout=setTimeout(()=>done(Error('브라우저 저장소를 열지 못했습니다. 다른 편집 탭을 닫고 다시 시도하세요.')),8000);
    function done(error,result){if(finished)return;finished=true;clearTimeout(timeout);db?.close();error?reject(error):resolve(result);}
    request.onupgradeneeded=()=>request.result.createObjectStore('documents');
    request.onerror=()=>done(request.error);request.onblocked=()=>done(Error('다른 편집 탭의 저장 작업을 마친 뒤 다시 시도하세요.'));
    request.onsuccess=()=>{db=request.result;if(finished){db.close();return;}clearTimeout(timeout);const tx=db.transaction('documents',write?'readwrite':'readonly'),store=tx.objectStore('documents'),op=write?store.put(value,key):store.get(key);let result;op.onsuccess=()=>{result=op.result;};tx.oncomplete=()=>done(null,result);tx.onabort=()=>done(tx.error||Error('브라우저 저장이 취소되었습니다.'));tx.onerror=()=>{};};
  });}
  window.WorkshopEditStore={read:key=>access(key),write:(key,value)=>access(key,value,true)};
})();

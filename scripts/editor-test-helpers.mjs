// Real UI navigation shared by regression tests after the editor chrome redesign.
const names={'페이지·발표 노트':'page','직접 수정':'direct','동작 추가·변경':'behavior','저장·전달':'files','수정 요청':'queue'};
export async function panel(p,name){
 if(!await p.locator('#editor-panel').count()){const summary=p.locator('summary').filter({hasText:name}).first();if(await summary.locator('..').getAttribute('open')===null)await summary.click();return;}
 const id=names[name]||name;
 if(await p.locator('#editor-panel').isVisible())await p.locator('[data-ui-action=close]').click();
 if(await p.locator('body.is-behavior-preview').count())await p.locator('#behavior-test').click();
 if(id==='behavior'&&!await p.locator('[data-ui-action=behavior]').filter({visible:true}).count())await panel(p,'direct');
 const trigger=p.locator(`[data-editor-open="${id}"], [data-ui-action="${id}"]`).filter({visible:true}).first();await trigger.click();
}
export async function selectPage(p,id){if(await p.locator('#editor-panel').isVisible())await p.locator('[data-ui-action=close]').click();await p.locator(`[data-editor-page="${id}"]`).click();}
export async function selectObject(p,id){await panel(p,'objects');await p.locator('#object-list').selectOption(id);}
const panels={'page-save':'page','page-add':'page','page-copy':'page','page-delete':'page','page-up':'page','page-down':'page','object-save':'direct','behavior-save':'behavior','queue-add':'request','annotation':'request','copy':'queue','requests-export':'queue','export':'files','import':'files','presentation':'files','patch':'files','done':'files'};
export async function action(p,name){
 if(['add-text','add-image','add-video'].includes(name)){
  await p.locator('[data-ui-action=insert]').click();await p.locator(`[data-insert-tab="${name==='add-text'?'text':'media'}"]`).click();
 }else if(panels[name]){const target=p.locator(`[data-action="${name}"]`);if(!await target.filter({visible:true}).count())await panel(p,panels[name]);}
 else if(await p.locator('#editor-panel').isVisible())await p.locator('[data-ui-action=close]').click();
 const inside=p.locator(`#editor-panel [data-action="${name}"]`).filter({visible:true});const target=await inside.count()?inside.first():p.locator(`[data-action="${name}"]`).filter({visible:true}).first();await target.click();
}

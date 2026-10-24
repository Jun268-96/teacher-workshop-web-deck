#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
try {
  if(!value('--dest')) throw new Error('Usage: node scripts/create-deck.mjs --dest <new-folder> [--name <cloudflare-worker-name>]');
  const target=path.resolve(value('--dest')),name=value('--name'),example=value('--example');
  if(example&&example!=='editor-live')throw new Error('Supported example: editor-live');
  if(name && !/^[a-z][a-z0-9-]{1,62}$/.test(name)) throw new Error('Use a lowercase Worker name, 2–63 characters.');
  try { await fs.access(target); throw new Error('Destination already exists. Choose a new directory; existing work is never overwritten.'); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/starter-deck');
  await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false});
  if(name) {
    await fs.writeFile(path.join(target,'wrangler.json'),JSON.stringify({name,compatibility_date:'2026-10-01',assets:{directory:'./public'},workers_dev:true},null,2)+'\n');
    const config=path.join(target,'public/config.js');
    await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace('deckId: "workshop-template"',`deckId: ${JSON.stringify(name)}`));
  }
  if(!name){const config=path.join(target,'public/config.js');await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace('deckId: "workshop-template"',`deckId: ${JSON.stringify('workshop-'+randomUUID())}`));}
  if(example) {
    const config=path.join(target,'public/config.js');
    let text=await fs.readFile(config,'utf8');
    text=text.replace('title: "우리 반에 필요한 도구 만들기"','title: "선택해서 바꾸는 연수자료"');
    await fs.writeFile(config,text);
    await fs.writeFile(path.join(target,'workshop/example-guide.md'),`# 편집·참여 기능 시험 예제\n\n실제 사회정서학습 연수나 다른 컴퓨터의 결과물을 복원한 자료가 아닙니다. 로고·기관명 없는 기능 시험용 템플릿입니다.\n\n1. npm run dev 후 /?edit=1로 편집기를 여세요. 서로 다른 다섯 페이지에서 대상을 골라 요청을 모으세요.\n2. 수정 요청 목록의 프로젝트 요청함에 저장을 누르고 같은 폴더의 에이전트에게 요청함 확인을 부탁하세요. 변경안 확인에서 파일 선택 없이 미리보고 확정/취소/실행 취소를 시험하세요. 자세한 CLI 사용법은 workshop/editor-inbox.md에 있습니다. ChatGPT 주석은 지원 환경에서 대안으로 사용할 수 있습니다.\n3. npm run live 후 /live-host/에서 터미널에 표시된 운영 키로 새 회차를 만드세요. 참가자 주소 /participate/?code=코드를 별도 브라우저 두 개에서 여세요.\n4. 투표·단어·질문·사례 분기·마무리를 각각 열고 응답·공개·숨김·종료·재접속을 확인하세요. Node 서버는 로컬 참조 구현이며 공개 배포되지 않았습니다.\n5. 서버가 없는 발표는 그대로 실행됩니다. 참여 모듈 추가는 실제 연수 구성안에서 별도로 결정하세요.\n`);
  }
  console.log(JSON.stringify({created:target,brand:null,design:'paper-frame',deploymentTarget:name||null,example:example||null,editor:'/?edit=1',inbox:'npm run dev → 프로젝트 요청함에 저장 → 에이전트가 같은 폴더에서 읽기',participation:'npm run live → /live-host/ (local reference server)',next:'Read workshop/ brief, adapt public/, then run node harness/harness.mjs doctor. Nothing has been installed or deployed.'},null,2));
} catch(error) { console.error(error.message);process.exitCode=1; }

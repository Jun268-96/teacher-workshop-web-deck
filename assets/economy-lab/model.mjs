import crypto from 'node:crypto';
export const products={meal:{name:'든든 도시락',need:'한 끼 해결',symbol:'▰'},sticker:{name:'꾸미기 스티커',need:'즐거움',symbol:'✳'}};
export const phases=['lobby','day','market','review'];
export const phaseNames={lobby:'준비',day:'낮 · 노동과 생산',market:'밤 · 소비와 판매',review:'돌아보기'};
export const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
export const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function initial(teacherHash){return {schema:1,teacherHash,epoch:crypto.randomUUID(),revision:1,phase:'lobby',paused:false,people:[],trades:[],costPool:0,receipts:[]};}
export function actor(state,token){const digest=hash(token||'');if(digest===state.teacherHash)return {teacher:true};const p=state.people.find(p=>p.hash===digest);if(!p)fail(401,'다시 입장해 주세요. 수업이 초기화되었을 수 있습니다.');return {teacher:false,person:p};}
const company=s=>s.people.filter(p=>p.role==='company');
export function view(s,a){const companies=company(s).map(p=>({id:p.id,name:p.name,product:p.product,price:p.price,stock:p.stock,hiring:p.balance>=30}));const common={epoch:s.epoch,revision:s.revision,phase:s.phase,phaseName:phaseNames[s.phase],paused:s.paused,participantCount:s.people.length,companies,role:a.teacher?'teacher':a.person.role,products};
 if(!a.teacher){const {hash,...me}=a.person;return {...common,me};}
 const households=s.people.filter(p=>p.role==='household'),enterprise=company(s);
 return {...common,people:s.people.map(({hash,...p})=>p),trades:s.trades,totals:{wages:enterprise.reduce((n,p)=>n+p.wages,0),sales:enterprise.reduce((n,p)=>n+p.revenue,0),savings:households.reduce((n,p)=>n+p.balance,0),worked:households.filter(p=>p.worked).length,finished:households.filter(p=>p.finished).length,households:households.length,companies:enterprise.length,costPool:s.costPool,money:s.people.reduce((n,p)=>n+p.balance,0)+s.costPool}};
}
export function join(s,token){if(!/^[a-f0-9]{64}$/.test(token||''))fail(400,'입장 정보를 확인해 주세요.');let p=s.people.find(p=>p.hash===hash(token));if(p)return p;
 if(s.phase==='review')fail(409,'돌아보기 중입니다. 다음 체험을 기다려 주세요.');if(s.people.length>=80)fail(409,'체험은 80명까지 가능합니다.');
 const index=s.people.length,role=index%2===0?'household':'company',ordinal=s.people.filter(p=>p.role===role).length+1;
 p={id:crypto.randomUUID(),hash:hash(token),role,joinedPhase:s.phase,name:`${role==='household'?'가계':'기업'} ${ordinal}`,balance:role==='household'?40:120,...(role==='household'?{worked:false,employer:null,basket:[],finished:false,reason:''}:{product:ordinal%2?'meal':'sticker',price:20,stock:0,wages:0,materials:0,revenue:0})};s.people.push(p);s.revision++;return p;
}
export function apply(s,a,input){if(!input||typeof input!=='object'||Array.isArray(input)||input.epoch!==s.epoch)fail(409,'수업이 바뀌었습니다. 새 화면을 확인해 주세요.');
 if(typeof input.actionId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(input.actionId))fail(400,'요청 식별자가 필요합니다.');
 const owner=a.teacher?'teacher':a.person.id,key=owner+':'+input.actionId,signature=hash(JSON.stringify(input)),past=s.receipts.find(r=>r.key===key);
 if(past){if(past.signature!==signature)fail(409,'같은 요청을 다른 내용으로 보낼 수 없습니다.');return {duplicate:true};}
 if(s.receipts.length>=10000)fail(409,'체험 기록이 가득 찼습니다. 교사에게 초기화를 요청해 주세요.');
 if(a.teacher){
  if(input.kind==='advance'){if(input.from!==s.phase)fail(409,'진행 단계가 이미 바뀌었습니다.');const next=phases[phases.indexOf(s.phase)+1];if(!next)fail(409,'마지막 단계입니다.');if(next==='day'&&(!company(s).length||!s.people.some(p=>p.role==='household')))fail(409,'가계와 기업이 각각 한 명 이상 필요합니다.');s.phase=next;s.paused=false;}
  else if(input.kind==='pause'){if(typeof input.value!=='boolean')fail(400,'멈춤 상태를 확인하세요.');s.paused=input.value;}
  else if(input.kind==='reset'){const next=initial(s.teacherHash);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,next);return {reset:true};}
  else fail(400,'교사 동작을 확인하세요.');
 }else{
  if(['advance','pause','reset'].includes(input.kind))fail(403,'교사만 진행을 바꿀 수 있습니다.');if(s.paused)fail(409,'선생님이 잠시 멈췄습니다.');const p=a.person;
  if(input.kind==='offer'){
   if(p.role!=='company'||s.phase!=='day')fail(403,'기업은 낮에 판매 계획을 정합니다.');
   if(!Object.hasOwn(products,input.product)||!Number.isInteger(input.price)||input.price<10||input.price>50)fail(400,'상품과 가격(10~50)을 확인하세요.');
   if(p.stock&&p.product!==input.product)fail(409,'생산한 뒤에는 상품 종류를 바꿀 수 없습니다.');p.product=input.product;p.price=input.price;
  }else if(input.kind==='work'){
   if(p.role!=='household'||s.phase!=='day')fail(403,'가계는 낮에 일할 수 있습니다.');if(p.worked)fail(409,'오늘은 이미 일했습니다.');const employer=company(s).find(c=>c.id===input.companyId);if(!employer)fail(400,'기업을 선택해 주세요.');if(employer.balance<30)fail(409,'이 기업의 생산 자금이 부족합니다.');
   employer.balance-=30;employer.wages+=20;employer.materials+=10;employer.stock+=2;p.balance+=20;p.worked=true;p.employer=employer.id;s.costPool+=10;
  }else if(input.kind==='buy'){
   if(p.role!=='household'||s.phase!=='market')fail(403,'가계는 밤에 소비합니다.');if(p.finished)fail(409,'이미 선택을 마쳤습니다.');const seller=company(s).find(c=>c.id===input.companyId);if(!seller)fail(400,'판매 기업을 확인하세요.');if(seller.stock<1)fail(409,'품절되었습니다.');if(p.balance<seller.price)fail(409,'남은 예산이 부족합니다.');
   p.balance-=seller.price;seller.balance+=seller.price;seller.revenue+=seller.price;seller.stock--;p.basket.push({companyId:seller.id,product:seller.product,price:seller.price});s.trades.push({id:crypto.randomUUID(),buyer:p.id,seller:seller.id,product:seller.product,price:seller.price});
  }else if(input.kind==='finish'){
   if(p.role!=='household'||s.phase!=='market')fail(403,'밤에 선택을 마칠 수 있습니다.');if(typeof input.reason!=='string'||input.reason.trim().length<2||input.reason.length>160)fail(400,'선택한 이유를 2~160자로 적어 주세요.');if(p.finished)fail(409,'이미 선택을 마쳤습니다.');p.reason=input.reason.trim();p.finished=true;
  }else fail(400,'동작을 확인하세요.');
 }
 s.receipts.push({key,signature});s.revision++;return {duplicate:false};
}

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=process.env.PORT||3000;
const rooms=new Map();
const VALID_EMOJIS=new Set(['🔥','😅','😈','👏','🤯']);
const VALID_PHRASES=new Set(["You suck!","You're a peckerhead!","You got lucky!","So close","Tough Break!"]);

const send=(res,code,obj,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(obj):obj)};
const parse=req=>new Promise(resolve=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{resolve(JSON.parse(body||'{}'))}catch{resolve({})}})});
const roomCode=()=>crypto.randomBytes(3).toString('hex').toUpperCase();
const uid=()=>crypto.randomUUID();
function shuffle(input){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeDeck(){const d=[{type:'number',value:0,id:'n0'}];for(let v=1;v<=12;v++)for(let c=0;c<v;c++)d.push({type:'number',value:v,id:`n${v}-${c}`});for(const name of ['freeze','flip3','second'])for(let c=0;c<3;c++)d.push({type:'action',name,id:`${name}-${c}`});for(const v of [2,4,6,8,10])d.push({type:'modifier',value:v,id:`m${v}`});d.push({type:'multiplier',value:2,id:'x2'});if(d.length!==94)throw new Error('Deck must contain 94 cards.');return shuffle(d)}
function makePlayer(id,name){return{id,name:String(name||'Player').slice(0,18),score:0,cards:[],mods:[],statusCards:[],active:true,stayed:false,busted:false,frozen:false,second:false,roundScore:0,lastSeen:Date.now()}}
function score(p){if(p.busted)return 0;let total=p.cards.reduce((s,c)=>s+c.value,0);if(p.mods.some(c=>c.type==='multiplier'))total*=2;total+=p.mods.filter(c=>c.type==='modifier').reduce((s,c)=>s+c.value,0);if(p.cards.length>=7)total+=15;return total}
const activePlayers=r=>r.players.filter(p=>p.active);
const playerById=(r,id)=>r.players.find(p=>p.id===id);
const currentPlayer=r=>r.players[r.turnIndex];
const actionLabel=n=>n==='freeze'?'Freeze':n==='flip3'?'Flip Three':'Second Chance';
function replenish(r){if(!r.deck.length&&r.discard.length){r.deck=shuffle(r.discard.splice(0));r.log.push('The discard pile was shuffled into a new draw pile.')}}
function take(r){replenish(r);return r.deck.pop()||null}
function discardPlayerCards(r,p){r.discard.push(...p.cards,...p.mods,...(p.statusCards||[]));if(p.second){const c=r.heldSecondCards.get(p.id);if(c)r.discard.push(c)}r.heldSecondCards.delete(p.id)}
function finishRound(r,reason='Round complete.'){
  if(r.phase!=='playing')return;
  r.phase='roundEnd';r.pendingAction=null;r.flow=null;
  for(const p of r.players){p.roundScore=score(p);p.score+=p.roundScore;p.active=false;discardPlayerCards(r,p)}
  r.log.push(reason);
  const high=Math.max(...r.players.map(p=>p.score)),leaders=r.players.filter(p=>p.score===high);
  if(high>=200&&leaders.length===1){r.phase='gameOver';r.winner=leaders[0].name;r.log.push(`${r.winner} wins with ${high} points!`)}
  else if(high>=200&&leaders.length>1){r.winner=null;r.log.push(`The game is tied at ${high}. Everyone plays another complete round.`)}
  r.dealerIndex=(r.dealerIndex+1)%r.players.length;
}
function checkRoundEnd(r){if(r.phase!=='playing')return true;if(activePlayers(r).length===0){finishRound(r);return true}return false}
function advanceTurn(r){if(checkRoundEnd(r))return;for(let i=0;i<r.players.length;i++){r.turnIndex=(r.turnIndex+1)%r.players.length;if(currentPlayer(r)?.active)return}}
function startChoiceTurns(r){r.flow=null;r.turnIndex=(r.dealerIndex+1)%r.players.length;while(r.phase==='playing'&&!currentPlayer(r)?.active)advanceTurn(r);if(r.phase==='playing')r.log.push(`${currentPlayer(r).name} may Hit or Stay.`)}
function resumeFlow(r,resume){if(r.phase!=='playing'||!resume)return;if(resume.type==='deal')continueInitialDeal(r,resume.nextOffset);else if(resume.type==='turn')advanceTurn(r);else if(resume.type==='flip3')continueFlipThree(r,resume.targetId,resume.remaining,resume.queued||[],resume.after);else if(resume.type==='resolveQueue')resolveQueuedActions(r,resume.queue||[],resume.after)}
function grantSecondChance(r,p,card,resume){
  if(!p||!p.active){r.discard.push(card);resumeFlow(r,resume);return}
  if(!p.second){p.second=true;r.heldSecondCards.set(p.id,card);r.log.push(`${p.name} drew and kept a Second Chance.`);resumeFlow(r,resume);return}
  const eligible=activePlayers(r).filter(x=>x.id!==p.id&&!x.second);
  if(!eligible.length){r.discard.push(card);r.log.push(`${p.name} drew an extra Second Chance. Every other active player already has one, so it was discarded.`);resumeFlow(r,resume);return}
  r.pendingAction={kind:'secondTransfer',chooserId:p.id,card,resume,eligibleIds:eligible.map(x=>x.id)};
  r.log.push(`${p.name} drew an extra Second Chance and must give it to an active player who does not have one.`);
}
function offerAction(r,chooserId,card,resume,restrictedTargets=null){
  if(card.name==='second'){grantSecondChance(r,playerById(r,chooserId),card,resume);return}
  const eligible=activePlayers(r).filter(p=>!restrictedTargets||restrictedTargets.includes(p.id));
  if(!eligible.length){r.discard.push(card);resumeFlow(r,resume);return}
  r.pendingAction={kind:card.name,chooserId,card,resume,eligibleIds:eligible.map(p=>p.id)};
  r.log.push(`${playerById(r,chooserId)?.name||'A player'} drew ${actionLabel(card.name)} and must choose a target.`);
}
function resolveNumber(r,p,c){
  const dup=p.cards.some(x=>x.value===c.value);
  if(dup&&p.second){p.second=false;const held=r.heldSecondCards.get(p.id);if(held)r.discard.push(held);r.heldSecondCards.delete(p.id);r.discard.push(c);r.log.push(`${p.name}'s Second Chance prevented duplicate ${c.value}.`);return'safe'}
  p.cards.push(c);
  if(dup){p.busted=true;p.active=false;r.log.push(`${p.name} busted on ${c.value}!`);return'bust'}
  r.log.push(`${p.name} flipped ${c.value}.`);
  if(p.cards.length>=7){finishRound(r,`${p.name} flipped seven unique Number cards and ended the round!`);return'flip7'}
  return'safe';
}
function resolveNonAction(r,p,c){if(c.type==='number')return resolveNumber(r,p,c);p.mods.push(c);r.log.push(`${p.name} gained ${c.type==='multiplier'?'×2':'+'+c.value}.`);return'safe'}
function drawForTurn(r,p){const c=take(r);if(!c)return finishRound(r,'The deck was exhausted.');if(c.type!=='action'){resolveNonAction(r,p,c);if(r.phase==='playing')advanceTurn(r)}else offerAction(r,p.id,c,{type:'turn'})}
function continueInitialDeal(r,offset=0){if(r.phase!=='playing')return;if(offset>=r.players.length)return startChoiceTurns(r);const index=(r.dealerIndex+1+offset)%r.players.length,p=r.players[index],c=take(r);if(!c)return finishRound(r,'The deck was exhausted.');if(c.type==='action')offerAction(r,p.id,c,{type:'deal',nextOffset:offset+1});else{resolveNonAction(r,p,c);if(r.phase==='playing')continueInitialDeal(r,offset+1)}}
function applyAction(r,chooser,target,card,resume){
  if(card.name==='freeze'){
    target.statusCards.push(card);target.frozen=true;target.stayed=true;target.active=false;target.roundScore=score(target);
    r.log.push(`${chooser.name} froze ${target.name} at ${target.roundScore} points.`);
    if(!checkRoundEnd(r))resumeFlow(r,resume);return;
  }
  r.discard.push(card);
  if(card.name==='flip3'){r.log.push(`${chooser.name} played Flip Three on ${target.name}.`);continueFlipThree(r,target.id,3,[],resume)}
}
function continueFlipThree(r,targetId,remaining,queued,after){
  if(r.phase!=='playing')return;
  const target=playerById(r,targetId);
  if(!target?.active||remaining<=0)return resolveQueuedActions(r,queued,after);
  const c=take(r);if(!c)return finishRound(r,'The deck was exhausted.');
  if(c.type!=='action'){const result=resolveNonAction(r,target,c);if(r.phase!=='playing'||result!=='safe')return;return continueFlipThree(r,targetId,remaining-1,queued,after)}
  if(c.name==='second'){grantSecondChance(r,target,c,{type:'flip3',targetId,remaining:remaining-1,queued,after});return}
  queued.push({chooserId:targetId,card:c});
  r.log.push(`${target.name} revealed ${actionLabel(c.name)} during Flip Three; it will resolve after the remaining flips.`);
  continueFlipThree(r,targetId,remaining-1,queued,after);
}
function resolveQueuedActions(r,queue,after){if(r.phase!=='playing')return;if(!queue.length)return resumeFlow(r,after);const [next,...rest]=queue,chooser=playerById(r,next.chooserId);if(!chooser?.active){r.discard.push(next.card);return resolveQueuedActions(r,rest,after)}offerAction(r,chooser.id,next.card,{type:'resolveQueue',queue:rest,after})}
function startRound(r){r.round++;r.phase='playing';r.pendingAction=null;r.flow={type:'deal'};r.winner=null;r.players.forEach(p=>Object.assign(p,{cards:[],mods:[],statusCards:[],active:true,stayed:false,busted:false,frozen:false,second:false,roundScore:0}));r.heldSecondCards.clear();r.deck=makeDeck();r.discard=[];r.log=[`Round ${r.round} begins. ${r.players[r.dealerIndex].name} is the dealer.`];continueInitialDeal(r,0)}
function publicState(r){
  const pending=r.pendingAction?{kind:r.pendingAction.kind,chooserId:r.pendingAction.chooserId,card:r.pendingAction.card,eligibleIds:r.pendingAction.eligibleIds}:null;
  return{code:r.code,hostId:r.hostId,phase:r.phase,round:r.round,turnIndex:r.turnIndex,dealerIndex:r.dealerIndex,deckCount:r.deck.length,discardCount:r.discard.length,pendingAction:pending,players:r.players.map(p=>({...p,connected:Date.now()-p.lastSeen<12000})),log:r.log.slice(-18),winner:r.winner,reaction:r.reaction};
}
function apiError(res,message,status=400){send(res,status,{ok:false,error:message})}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/health')return send(res,200,{ok:true,service:'flip-rush-7'});
  if(url.pathname.startsWith('/api/')){
    const body=req.method==='POST'?await parse(req):{};
    if(url.pathname==='/api/create'){
      let code=roomCode();while(rooms.has(code))code=roomCode();
      const playerId=uid(),r={code,hostId:playerId,phase:'lobby',round:0,turnIndex:0,dealerIndex:0,players:[makePlayer(playerId,body.name||'Host')],deck:makeDeck(),discard:[],heldSecondCards:new Map(),pendingAction:null,flow:null,log:['Room created.'],winner:null,reaction:null};
      rooms.set(code,r);return send(res,200,{ok:true,room:code,playerId,state:publicState(r)});
    }
    if(url.pathname==='/api/join'){
      const code=String(body.room||'').toUpperCase(),r=rooms.get(code);
      if(!r)return apiError(res,'Room not found.',404);if(r.phase!=='lobby')return apiError(res,'Game already started.');if(r.players.length>=9)return apiError(res,'This room is full. Flip Rush 7 supports 3–9 players.');
      const playerId=uid(),joined=makePlayer(playerId,body.name);r.players.push(joined);r.log.push(`${joined.name} joined.`);return send(res,200,{ok:true,room:code,playerId,state:publicState(r)});
    }
    const code=String(body.room||url.searchParams.get('room')||'').toUpperCase(),r=rooms.get(code);
    if(!r)return apiError(res,'Room not found.',404);
    const playerId=body.playerId||url.searchParams.get('playerId'),p=playerById(r,playerId);if(p)p.lastSeen=Date.now();
    if(url.pathname==='/api/state')return send(res,200,{ok:true,state:publicState(r)});
    if(!p)return apiError(res,'Player not found.',403);

    if(url.pathname==='/api/start'){
      if(r.hostId!==playerId)return apiError(res,'Only the host can start the game.');
      if(r.players.length<3||r.players.length>9)return apiError(res,'Flip Rush 7 requires 3–9 players.');
      startRound(r);
    }else if(url.pathname==='/api/hit'){
      if(r.phase!=='playing'||r.pendingAction||currentPlayer(r)?.id!==playerId)return apiError(res,'It is not your Hit/Stay decision.');
      drawForTurn(r,p);
    }else if(url.pathname==='/api/stay'){
      if(r.phase!=='playing'||r.pendingAction||currentPlayer(r)?.id!==playerId)return apiError(res,'It is not your Hit/Stay decision.');
      if(!p.cards.length&&!p.mods.length&&!p.second)return apiError(res,'You need at least one card in front of you before you can Stay.');
      p.stayed=true;p.active=false;p.roundScore=score(p);r.log.push(`${p.name} stayed with ${p.roundScore} points.`);advanceTurn(r);
    }else if(url.pathname==='/api/target'){
      const a=r.pendingAction;if(!a||a.chooserId!==playerId)return apiError(res,'You do not have an action card to resolve.');if(!a.eligibleIds.includes(body.targetId))return apiError(res,'That player is not an eligible target.');
      const target=playerById(r,body.targetId),chooser=playerById(r,playerId),{card,resume}=a;r.pendingAction=null;
      if(a.kind==='secondTransfer'){target.second=true;r.heldSecondCards.set(target.id,card);r.log.push(`${chooser.name} gave the extra Second Chance to ${target.name}.`);resumeFlow(r,resume)}
      else applyAction(r,chooser,target,card,resume);
    }else if(url.pathname==='/api/next'){
      if(r.hostId!==playerId||r.phase!=='roundEnd')return apiError(res,'Only the host can start the next round.');startRound(r);
    }else if(url.pathname==='/api/reaction'){
      const type=body.type,text=String(body.text||'');
      if(type==='emoji'&&!VALID_EMOJIS.has(text))return apiError(res,'Invalid reaction.');
      if(type==='phrase'&&!VALID_PHRASES.has(text))return apiError(res,'Invalid phrase.');
      if(type!=='emoji'&&type!=='phrase')return apiError(res,'Invalid reaction type.');
      r.reaction={id:uid(),playerId:p.id,playerName:p.name,type,text,at:Date.now()};
    }else return apiError(res,'Unknown action.',404);
    return send(res,200,{ok:true,state:publicState(r)});
  }

  let rel=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/,''));
  const file=path.resolve(__dirname,rel);
  if(file!==__dirname&&!file.startsWith(__dirname+path.sep))return send(res,403,'Forbidden','text/plain');
  fs.readFile(file,(e,d)=>e?send(res,404,'Not found','text/plain'):send(res,200,d,mime[path.extname(file)]||'application/octet-stream'));
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Flip Rush 7 running on port ${PORT}`));

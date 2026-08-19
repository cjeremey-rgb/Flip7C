let players=[],deck=[],discard=[],round=0,dealerIndex=0,turnIndex=0,phase='home',pendingAction=null,soundOn=localStorage.fr7sound!=='off',busy=false;
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const avatarColors=['#32e5cb','#ffdd42','#ff6f91'];
function haptic(ms=18){if(navigator.vibrate)navigator.vibrate(ms)}
function tone(freq=440,duration=.08,type='sine',gain=.05){if(!soundOn)return;try{const C=window.AudioContext||window.webkitAudioContext,a=new C(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.stop(a.currentTime+duration)}catch{}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeDeck(){const d=[{type:'number',value:0,id:'n0'}];for(let v=1;v<=12;v++)for(let c=0;c<v;c++)d.push({type:'number',value:v,id:`n${v}-${c}`});for(const name of ['freeze','flip3','second'])for(let c=0;c<3;c++)d.push({type:'action',name,id:`${name}-${c}`});for(const v of [2,4,6,8,10])d.push({type:'modifier',value:v,id:`m${v}`});d.push({type:'multiplier',value:2,id:'x2'});return shuffle(d)}
function makePlayer(name,bot=false,style='balanced'){return{name,bot,style,score:0,cards:[],mods:[],statusCards:[],active:true,stayed:false,busted:false,frozen:false,second:false,roundScore:0}}
function activePlayers(){return players.map((p,i)=>({p,i})).filter(x=>x.p.active)}
function score(p){if(p.busted)return 0;let total=p.cards.reduce((s,c)=>s+c.value,0);if(p.mods.some(c=>c.type==='multiplier'))total*=2;total+=p.mods.filter(c=>c.type==='modifier').reduce((s,c)=>s+c.value,0);if(p.cards.length>=7)total+=15;return total}
function log(s){$('log').innerHTML+=`<div>${esc(s)}</div>`;$('log').scrollTop=$('log').scrollHeight}
function actionName(n){return n==='freeze'?'FREEZE':n==='flip3'?'FLIP THREE':'SECOND CHANCE'}
function cardEl(card,index=0){const e=document.createElement('div');e.className='card';e.style.animationDelay=`${Math.min(index*25,160)}ms`;if(card.type==='number'){e.textContent=card.value;e.dataset.label=card.value}else if(card.type==='modifier'){e.textContent='+'+card.value;e.classList.add('mod');e.dataset.label='BONUS'}else if(card.type==='multiplier'){e.textContent='×2';e.classList.add('mult');e.dataset.label='BOOST'}else{e.textContent=actionName(card.name);e.classList.add('action',card.name);e.dataset.label='ACTION'}return e}
function render(){
  if(!players.length)return;
  $('round').textContent=round;$('deckCount').textContent=deck.length;
  $('players').innerHTML='';
  players.forEach((p,i)=>{const e=document.createElement('div');e.className='player '+(phase==='playing'&&!pendingAction&&i===turnIndex?'turn':'')+(p.frozen?' frozen':'');const live=p.busted?'BUSTED':p.frozen?`FROZEN ${p.roundScore}`:p.stayed?`BANKED ${p.roundScore}`:`${p.cards.length} NUMBERS`;e.innerHTML=`<div class="avatar" style="background:${avatarColors[i%avatarColors.length]}">${esc(p.name[0].toUpperCase())}</div><div><div class="name">${esc(p.name)}${p.bot?' 🤖':''}${i===dealerIndex?' ◇':''}</div><small>${live}${p.second?' · 2ND CHANCE':''}</small></div><div class="score">${p.score}</div>`;$('players').appendChild(e)});
  $('botTable').innerHTML='';
  players.slice(1).forEach((p,j)=>{const i=j+1,seat=document.createElement('div');seat.className='bot-seat '+(phase==='playing'&&!pendingAction&&i===turnIndex?'turn ':'')+(p.busted?'busted ':p.stayed&&!p.frozen?'banked ':p.frozen?'frozen ':'');seat.innerHTML=`<div class="bot-seat-head"><b>${esc(p.name)} 🤖</b><small>${p.busted?'BUSTED':p.frozen?'FROZEN':p.stayed?'STAYED':score(p)+' PTS'}</small></div><div class="bot-hand"></div>`;const hand=seat.querySelector('.bot-hand');[...p.cards,...p.mods,...p.statusCards,...(p.second?[{type:'action',name:'second'}]:[])].forEach((c,k)=>hand.appendChild(cardEl(c,k)));if(p.busted||p.stayed){const o=document.createElement('div');o.className='result-overlay '+(p.busted?'bust':p.frozen?'frozen':'hold');o.textContent=p.busted?'BUST':p.frozen?'FROZEN':'STAY';seat.appendChild(o)}$('botTable').appendChild(seat)});
  const area=$('myArea');area.innerHTML='';const me=players[0],h=document.createElement('div');h.className='hand';[...me.cards,...me.mods,...me.statusCards,...(me.second?[{type:'action',name:'second'}]:[])].forEach((c,i)=>h.appendChild(cardEl(c,i)));area.appendChild(h);
  if(me.busted||me.stayed){const o=document.createElement('div');o.className='result-overlay '+(me.busted?'bust':me.frozen?'frozen':'hold');o.textContent=me.busted?'BUST':me.frozen?'FROZEN':'STAY';area.appendChild(o)}
  $('scorePreview').querySelector('b').textContent=score(me);
  const myTurn=phase==='playing'&&!pendingAction&&turnIndex===0&&me.active&&!busy;
  $('hit').disabled=!myTurn;$('stay').disabled=!myTurn||!(me.cards.length||me.mods.length||me.second);
  $('hit').classList.toggle('hidden',phase!=='playing'||!!pendingAction);$('stay').classList.toggle('hidden',phase!=='playing'||!!pendingAction);$('next').classList.toggle('hidden',phase!=='roundEnd');
  if(pendingAction){const who=players[pendingAction.chooserIndex];$('status').innerHTML=`<span class="pulse"></span><b>${pendingAction.chooserIndex===0?(pendingAction.kind==='secondTransfer'?'GIVE AWAY EXTRA SECOND CHANCE':`CHOOSE A TARGET FOR ${actionName(pendingAction.card.name)}`):`${esc(who.name)} IS CHOOSING A TARGET`}</b><small>Action card in play</small>`}
  else if(phase==='playing'){$('status').innerHTML=`<span class="pulse"></span><b>${turnIndex===0?'YOUR DECISION — FLIP OR STAY':`${esc(players[turnIndex].name)}'S TURN`}</b><small>${turnIndex===0?'How far will you push it?':'Computer opponent is deciding'}</small>`}
  else if(phase==='roundEnd')$('status').innerHTML=`<span class="pulse"></span><b>ROUND COMPLETE</b><small>Scores have been banked</small>`;
  else if(phase==='gameOver')$('status').innerHTML=`<span class="pulse"></span><b>GAME COMPLETE</b><small>${esc(players.slice().sort((a,b)=>b.score-a.score)[0].name)} wins</small>`;
}
function removeHeldSecond(p){p.second=false}
function resolveNumber(i,c){const p=players[i],dup=p.cards.some(x=>x.value===c.value);if(dup&&p.second){removeHeldSecond(p);discard.push(c);log(`${p.name}'s Second Chance prevented duplicate ${c.value}.`);return'safe'}p.cards.push(c);if(dup){p.busted=true;p.active=false;log(`${p.name} busted on ${c.value}!`);return'bust'}log(`${p.name} flipped ${c.value}.`);if(p.cards.length>=7){log(`${p.name} flipped seven unique Number cards!`);endRound(`${p.name} reached Flip 7.`);return'flip7'}return'safe'}
function resolveNonAction(i,c){const p=players[i];if(c.type==='number')return resolveNumber(i,c);p.mods.push(c);log(`${p.name} gained ${c.type==='multiplier'?'×2':'+'+c.value}.`);return'safe'}
async function chooseTarget(title,opts){
  if(!opts.length)return null;
  return new Promise(resolve=>{const p=$('targetPicker');p.classList.remove('hidden');p.innerHTML=`<div class="target-title">${title}</div><div class="target-list"></div>`;const list=p.querySelector('.target-list');opts.forEach(x=>{const b=document.createElement('button');b.className='target';b.innerHTML=`<span>${esc(x.i===0?'Yourself':x.p.name)}</span><small>${x.i===0?'YOU':`${x.p.cards.length} NUMBER CARDS`}</small>`;b.onclick=()=>{p.classList.add('hidden');resolve(x.i)};list.appendChild(b)})})
}
function botActionChoice(kind,chooser,opts){if(kind==='freeze'){const others=opts.filter(x=>x.i!==chooser);if(others.length&&Math.random()<.88)return others.sort((a,b)=>score(b.p)-score(a.p))[0].i;return opts[Math.floor(Math.random()*opts.length)].i}if(kind==='flip3'){const others=opts.filter(x=>x.i!==chooser);return (others.length?others:opts)[Math.floor(Math.random()*(others.length?others:opts).length)].i}return opts[Math.floor(Math.random()*opts.length)].i}
async function grantSecond(i,c){
  const p=players[i];
  if(!p.second){p.second=true;log(`${p.name} kept a Second Chance.`);return}
  const opts=activePlayers().filter(x=>x.i!==i&&!x.p.second);
  if(!opts.length){discard.push(c);log(`${p.name} drew an extra Second Chance. Every other active player already has one, so it was discarded.`);return}
  let target=i===0?await chooseTarget('Give the extra <b>SECOND CHANCE</b> to:',opts):botActionChoice('second',i,opts);
  players[target].second=true;log(`${p.name} gave the extra Second Chance to ${players[target].name}.`);
}
async function resolveAction(chooser,c){
  if(c.name==='second'){await grantSecond(chooser,c);return}
  const opts=activePlayers(); if(!opts.length){discard.push(c);return}
  let target=chooser===0?await chooseTarget(`Choose who receives <b>${actionName(c.name)}</b>`,opts):botActionChoice(c.name,chooser,opts);
  const t=players[target];discard.push(c);
  if(c.name==='freeze'){t.frozen=true;t.stayed=true;t.active=false;t.statusCards.push(c);t.roundScore=score(t);log(`${players[chooser].name} froze ${t.name} at ${t.roundScore} points.`);return}
  if(c.name==='flip3'){log(`${players[chooser].name} played Flip Three on ${t.name}.`);await resolveFlipThree(target)}
}
async function resolveFlipThree(target){
  const queued=[];
  for(let k=0;k<3&&phase==='playing'&&players[target].active;k++){
    if(!deck.length)deck=makeDeck();const c=deck.pop();
    if(c.type==='action'&&c.name!=='second'){queued.push(c);log(`${players[target].name} revealed ${actionName(c.name)} during Flip Three; it will resolve after the sequence.`)}
    else if(c.type==='action'&&c.name==='second'){await grantSecond(target,c)}
    else{const result=resolveNonAction(target,c);if(result!=='safe'||phase!=='playing')break}
    render();await wait(260)
  }
  for(const c of queued){if(phase!=='playing'||!players[target].active)break;await resolveAction(target,c);render();await wait(220)}
}
async function drawCard(i){
  if(!deck.length)deck=makeDeck();const c=deck.pop();const p=players[i];
  if(c.type==='action'){log(`${p.name} drew ${actionName(c.name)}.`);await resolveAction(i,c)}
  else resolveNonAction(i,c);
  render();
}
function advanceTurn(){if(phase!=='playing')return;if(activePlayers().length===0){endRound('Everyone is done for the round.');return}for(let k=0;k<players.length;k++){turnIndex=(turnIndex+1)%players.length;if(players[turnIndex].active)break}render();if(turnIndex!==0)botTurn()}
function botShouldStay(p){const v=score(p);if(p.cards.length>=6)return false;const base=p.style==='cautious'?20:p.style==='bold'?34:27;if(v>=base)return true;if(v>=15)return Math.random()<(p.style==='cautious'?.62:p.style==='bold'?.2:.4);return false}
async function botTurn(){if(phase!=='playing'||busy||turnIndex===0||!players[turnIndex].active)return;busy=true;render();await wait(650);const i=turnIndex,p=players[i];if(botShouldStay(p)){p.stayed=true;p.active=false;p.roundScore=score(p);log(`${p.name} stayed with ${p.roundScore} points.`);busy=false;render();advanceTurn();return}await drawCard(i);busy=false;if(phase==='playing')advanceTurn()}
async function initialDeal(){
  busy=true;
  for(let n=1;n<=players.length&&phase==='playing';n++){const i=(dealerIndex+n)%players.length;await drawCard(i);await wait(260)}
  busy=false;if(phase!=='playing')return;turnIndex=(dealerIndex+1)%players.length;while(!players[turnIndex].active)turnIndex=(turnIndex+1)%players.length;render();if(turnIndex!==0)botTurn()
}
function endRound(reason){
  if(phase!=='playing')return;phase='roundEnd';busy=false;
  players.forEach(p=>{p.roundScore=score(p);p.score+=p.roundScore;p.active=false});
  log(reason);
  const high=Math.max(...players.map(p=>p.score)),leaders=players.filter(p=>p.score===high);
  if(high>=200&&leaders.length===1){phase='gameOver';log(`${leaders[0].name} wins with ${high} points!`);confetti()}
  else if(high>=200&&leaders.length>1)log(`The game is tied at ${high}. Everyone plays another complete round.`);
  dealerIndex=(dealerIndex+1)%players.length;render();
}
function startRound(){
  round++;phase='playing';pendingAction=null;deck=makeDeck();discard=[];players.forEach(p=>Object.assign(p,{cards:[],mods:[],statusCards:[],active:true,stayed:false,busted:false,frozen:false,second:false,roundScore:0}));
  $('log').innerHTML='';log(`Round ${round} begins. ${players[dealerIndex].name} is the dealer.`);render();initialDeal()
}
function startGame(){players=[makePlayer($('name').value.trim()||'You'),makePlayer('Nova',true,'cautious'),makePlayer('Ace',true,'bold')];round=0;dealerIndex=0;$('home').classList.remove('active');$('game').classList.add('active');startRound()}
$('play').onclick=startGame;
$('hit').onclick=async()=>{if(busy||phase!=='playing'||turnIndex!==0||!players[0].active)return;busy=true;haptic();tone(560,.07,'square');render();await drawCard(0);busy=false;if(phase==='playing')advanceTurn()};
$('stay').onclick=()=>{if(busy||phase!=='playing'||turnIndex!==0||!players[0].active)return;const p=players[0];p.stayed=true;p.active=false;p.roundScore=score(p);log(`${p.name} stayed with ${p.roundScore} points.`);haptic();tone(310,.07);render();advanceTurn()};
$('next').onclick=()=>{if(phase==='roundEnd')startRound()};
function confetti(){const root=$('confetti'),colors=['#32e5cb','#ffdd42','#ff4f8b','#8e7dff','#fff'];root.innerHTML='';for(let i=0;i<70;i++){const x=document.createElement('i');x.className='confetti-piece';x.style.left=Math.random()*100+'%';x.style.background=colors[i%colors.length];x.style.animationDelay=Math.random()*.8+'s';x.style.animationDuration=1.8+Math.random()*1.4+'s';root.appendChild(x)}setTimeout(()=>root.innerHTML='',3500)}
function showModal(html){$('modalBody').innerHTML=html;$('modal').classList.remove('hidden')}function closeModal(){$('modal').classList.add('hidden')}$('closeModal').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};
const help=`<h2>How to play</h2><p>Build the highest score without revealing a duplicate number.</p><ol><li>Choose <b>Flip</b> to draw or <b>Stay</b> to bank your round value.</li><li>A duplicate number busts your round unless a Second Chance protects you.</li><li>You may have only one Second Chance. If you draw another, give it to another active player without one; discard it only if nobody can receive it.</li><li>Freeze and Flip Three may target any active player, including yourself.</li><li>Second Chance blocks only a duplicate Number card — not Freeze.</li><li>Seven unique Number cards end the round and award +15.</li><li>If the highest score at 200 or more is tied, everyone plays another complete round.</li></ol>`;
$('howBtn').onclick=()=>showModal(help);$('menuBtn').onclick=()=>showModal(help);
$('soundBtn').onclick=()=>{soundOn=!soundOn;localStorage.fr7sound=soundOn?'on':'off';$('soundBtn').textContent=soundOn?'♪':'×';if(soundOn)tone(520,.08)};$('soundBtn').textContent=soundOn?'♪':'×';
if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));if(window.caches)caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)))}

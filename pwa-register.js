(() => {
  const ensureLayoutFix = () => {
    if (!document.querySelector('link[data-multiplayer-responsive-final]')) {
      const link = document.createElement('link'); link.rel='stylesheet'; link.href='./multiplayer-responsive-final.css?v=20260906-final-v1'; link.dataset.multiplayerResponsiveFinal='1'; document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-multiplayer-compact-pass]')) {
      const link = document.createElement('link'); link.rel='stylesheet'; link.href='./multiplayer-compact-pass.css?v=20260906-compact-v1'; link.dataset.multiplayerCompactPass='1'; document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-multiplayer-card-ratio-fix]')) {
      const link = document.createElement('link'); link.rel='stylesheet'; link.href='./multiplayer-card-ratio-fix.css?v=20260906-ratio-v2'; link.dataset.multiplayerCardRatioFix='1'; document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-multiplayer-card-size-pass]')) {
      const link = document.createElement('link'); link.rel='stylesheet'; link.href='./multiplayer-card-size-pass.css?v=20260906-size-v2'; link.dataset.multiplayerCardSizePass='1'; document.head.appendChild(link);
    }
  };
  const syncRoomSizeClass=()=>{const players=document.getElementById('players'),count=players?players.children.length:0,large=count>=4;document.documentElement.classList.toggle('large-room',large);document.body.classList.toggle('large-room',large)};
  const syncWinnerClass=()=>{const modal=document.getElementById('modal');document.body.classList.toggle('winner-open',Boolean(modal&&modal.dataset.mode==='winner'&&!modal.classList.contains('hidden')))};
  ensureLayoutFix();
  window.addEventListener('DOMContentLoaded',()=>{ensureLayoutFix();syncRoomSizeClass();syncWinnerClass();const players=document.getElementById('players');if(players)new MutationObserver(syncRoomSizeClass).observe(players,{childList:true});const modal=document.getElementById('modal');if(modal)new MutationObserver(syncWinnerClass).observe(modal,{attributes:true,attributeFilter:['class','data-mode']})});
  if(!('serviceWorker' in navigator))return;window.addEventListener('load',()=>{navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).then(registration=>registration.update().catch(()=>{})).catch(()=>{})});
})();

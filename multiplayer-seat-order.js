(() => {
  const myId = localStorage.fr7pid || '';
  let canonicalOrder = [];
  let playerObserver = null;
  let botObserver = null;

  function idsOf(root) {
    return root ? [...root.children].map(el => el.dataset.playerId).filter(Boolean) : [];
  }

  function sameOrder(a, b) {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  function rotatedOrder(order) {
    if (!myId || !order.includes(myId)) return [...order];
    const index = order.indexOf(myId);
    return [...order.slice(index), ...order.slice(0, index)];
  }

  function reorderRoot(root, desired, observer) {
    if (!root || !desired.length) return;
    const current = idsOf(root);
    const wanted = desired.filter(id => current.includes(id));
    if (sameOrder(current, wanted)) return;
    const byId = new Map([...root.children].map(el => [el.dataset.playerId, el]));
    observer?.disconnect();
    for (const id of wanted) {
      const el = byId.get(id);
      if (el) root.appendChild(el);
    }
    observer?.observe(root, { childList: true });
  }

  function syncFromServerRender() {
    const players = document.getElementById('players');
    const bots = document.getElementById('botTable');
    if (!players) return;

    const incoming = idsOf(players);
    if (incoming.length) canonicalOrder = incoming;
    const clockwise = rotatedOrder(canonicalOrder);

    reorderRoot(players, clockwise, playerObserver);
    reorderRoot(bots, clockwise.filter(id => id !== myId), botObserver);
  }

  function start() {
    const players = document.getElementById('players');
    const bots = document.getElementById('botTable');
    if (!players || !bots) return;

    canonicalOrder = idsOf(players);
    playerObserver = new MutationObserver(syncFromServerRender);
    botObserver = new MutationObserver(() => {
      if (!canonicalOrder.length) return;
      reorderRoot(bots, rotatedOrder(canonicalOrder).filter(id => id !== myId), botObserver);
    });
    playerObserver.observe(players, { childList: true });
    botObserver.observe(bots, { childList: true });
    syncFromServerRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

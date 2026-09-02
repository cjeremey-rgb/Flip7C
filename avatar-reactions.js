(() => {
  const ITEMS = [
    ['🔥', 'fire', 'excited', 'On fire'],
    ['😂', 'laugh', 'excited', 'Laughing'],
    ['🤣', 'rolling-laugh', 'excited', 'Rolling laughing'],
    ['😁', 'grin', 'excited', 'Big grin'],
    ['😅', 'sweat', 'shocked', 'Nervous laugh'],
    ['😬', 'grimace', 'shocked', 'Grimacing'],
    ['😈', 'devil', 'angry', 'Mischievous'],
    ['🤯', 'mind-blown', 'shocked', 'Mind blown'],
    ['😱', 'scared', 'shocked', 'Scared'],
    ['🙄', 'eye-roll', 'neutral', 'Eye roll'],
    ['🤔', 'thinking', 'neutral', 'Thinking'],
    ['😡', 'furious', 'angry', 'Furious'],
    ['😭', 'crying', 'shocked', 'Crying'],
    ['😎', 'cool', 'neutral', 'Cool'],
    ['🥳', 'party', 'excited', 'Party'],
    ['👏', 'clap', 'excited', 'Applause'],
    ['👍', 'thumbs-up', 'excited', 'Thumbs up'],
    ['👎', 'thumbs-down', 'angry', 'Thumbs down'],
    ['❤️', 'love', 'excited', 'Love it'],
    ['💀', 'dead', 'shocked', 'Dead'],
    ['🍀', 'lucky', 'excited', 'Lucky'],
    ['🤞', 'fingers-crossed', 'neutral', 'Fingers crossed'],
    ['💩', 'poop', 'angry', 'Poop'],
    ['🤡', 'clown', 'shocked', 'Clown']
  ].map(([emoji, key, mood, label]) => ({ emoji, key, mood, label }));

  const QUICK_PHRASES = ['Nice Job!', "You're almost there!", 'So Close!', 'You suck!', 'Oh Man!', 'Good luck!', "Let's go!", 'Your turn!', 'Hurry up!', 'No way!', 'Are you kidding me?', 'That was lucky!', 'Bad luck!', 'I needed that!', "Don't bust!", 'Risk it!', 'Hold already!', 'Not today!', 'Ouch!', 'Great game!', 'You got this!', 'That hurt!', "I'm feeling lucky!", 'Here we go!'];
  const BECCA_PHRASE = "You're a peckerhead!";
  const AVATARS = new Set(['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6', 'avatar-7', 'avatar-8', 'avatar-9', 'avatar-10', 'avatar-nova', 'avatar-ace']);
  const byEmoji = new Map(ITEMS.map(item => [item.emoji, item]));

  function safeAvatar(avatar) {
    return AVATARS.has(avatar) ? avatar : 'avatar-1';
  }

  function itemFor(emoji) {
    return byEmoji.get(emoji) || ITEMS[0];
  }

  function imageSource(avatar, mood) {
    const id = safeAvatar(avatar);
    return mood && mood !== 'neutral' ? `${id}-${mood}.webp` : `${id}.webp`;
  }

  function stickerMarkup(avatar, emoji, extraClass = '') {
    const item = itemFor(emoji);
    return `<span class="avatar-reaction-sticker mood-${item.mood} reaction-${item.key} ${extraClass}" data-reaction="${item.key}"><img src="${imageSource(avatar, item.mood)}" alt=""><span class="reaction-cue" aria-hidden="true">${item.emoji}</span></span>`;
  }

  function pickerMarkup(avatar, includePhrases = true) {
    const buttons = ITEMS.map(item => `<button type="button" class="avatar-reaction-button" data-emoji="${item.emoji}" aria-label="Send ${item.label}">${stickerMarkup(avatar, item.emoji)}</button>`).join('');
    return buttons + (includePhrases ? '<button type="button" id="phraseMenuBtn" class="phrase-menu-btn" aria-label="Quick phrases"><span aria-hidden="true">💬</span><b>PHRASES</b></button>' : '');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function popMarkup(avatar, emoji, name) {
    const item = itemFor(emoji);
    return `<div class="reaction-burst reaction-${item.key}" data-mood="${item.mood}"><i class="reaction-spark spark-one"></i><i class="reaction-spark spark-two"></i><i class="reaction-spark spark-three"></i>${stickerMarkup(avatar, emoji, 'reaction-pop-sticker')}</div><b class="reaction-player-name">${escapeHtml(name || 'Player')}</b>`;
  }

  globalThis.AvatarReactions = { ITEMS, QUICK_PHRASES, BECCA_PHRASE, itemFor, pickerMarkup, popMarkup, stickerMarkup };
})();

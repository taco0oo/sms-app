// =========================================
// STATE & STORAGE
// =========================================
let globalData = JSON.parse(localStorage.getItem('cute_sms_data')) || {
  apiKey: '',
  bgUrl: '',
  activeContactId: 1,
  utcOffset: 0,
  proactiveTextsEnabled: true,
  notificationsEnabled: true,
  user: { name: 'Sally', nicknames: 'sal; sallo', pronouns: 'she/her', appearance: 'Cute aesthetic lover', pfp: '🌸' },
  stickers: [],
  contacts: [
    {
      id: 1,
      origName: 'Jacob',
      nickname: 'pookie❤️',
      pfp: '🤖',
      personality: 'Grumpy guy, secretly cares a lot, dramatic, aloof',
      environment: 'In class right now; classmates are panicking over exams.',
      quirks: 'ALWAYS replies in a single big message block. Hates cluttering SMS.',
      backstory: 'Childhood friend who texts you reluctantly.',
      appearance: 'Messy black hair, tall, dark hoodies',
      relationshipPct: 15,
      memoryEnabled: true,
      relationshipContext: 'Met in high school, got lost in an amusement park together for hours.',
      status: '',
      music: '',
      routine: '',
      memories: [],
      history: [],
      savedStickers: [],
      unreadCount: 0,
      lastActivityAt: Date.now()
    }
  ]
};

let selectedMsgIndex = null;
let selectedContactIdForDelete = null;
let selectedStickerIdForDelete = null;
let longTouchTimer = null;
let tempStickerImg = '';

function saveData() {
  localStorage.setItem('cute_sms_data', JSON.stringify(globalData));
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function sendSystemNotification(senderName, messageText) {
  if (globalData.notificationsEnabled !== false && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`New message from ${senderName} 📩`, {
      body: messageText,
      icon: 'icon-192.png'
    });
  }
}

// Helper: Calculate custom local time based on user-set UTC offset
function getUserLocalTimeDetails() {
  const now = new Date();
  if (globalData.utcOffset !== undefined && globalData.utcOffset !== '') {
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetMs = utcMs + (parseFloat(globalData.utcOffset) * 3600000);
    const targetDate = new Date(targetMs);
    const hours = targetDate.getHours();
    const minutes = targetDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return {
      formattedTime: `${displayHours}:${minutes} ${ampm}`,
      hour24: hours
    };
  } else {
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return {
      formattedTime: `${displayHours}:${minutes} ${ampm}`,
      hour24: hours
    };
  }
}

// =========================================
// INITIALIZATION & RENDER
// =========================================
window.onload = () => {
  if (globalData.bgUrl) document.getElementById('chat-box').style.backgroundImage = `url('${globalData.bgUrl}')`;
  renderHeader();
  renderMessages();
  renderContacts();
  renderUserProfileBar();
  renderStickers();
  setupMobileKeyboardResize();
  document.getElementById('user-input').addEventListener('input', extendReplyWaitIfPending);
};

function getActiveContact() {
  return globalData.contacts.find(c => c.id === globalData.activeContactId) || globalData.contacts[0];
}

function renderHeader() {
  const c = getActiveContact();
  const pfpEl = document.getElementById('header-pfp');
  if (c.pfp && (c.pfp.startsWith('data:image') || c.pfp.startsWith('http'))) {
    pfpEl.style.backgroundImage = `url('${c.pfp}')`;
    pfpEl.innerText = '';
  } else {
    pfpEl.style.backgroundImage = 'none';
    pfpEl.innerText = c.pfp || '✦';
  }

  if (c.nickname) {
    document.getElementById('header-nickname').innerText = `${c.nickname}`;
    document.getElementById('header-origname').innerText = `(${c.origName})`;
    document.getElementById('header-origname').style.display = 'inline';
  } else {
    document.getElementById('header-nickname').innerText = c.origName;
    document.getElementById('header-origname').style.display = 'none';
  }

  const pct = (c.relationshipPct || 0).toFixed(1);
  document.getElementById('rel-meter-bar').style.width = `${pct}%`;
  document.getElementById('rel-meter-percent').innerText = `${pct}%`;
}

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getDateLabel(ts) {
  const d = new Date(ts || Date.now());
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function appendDateDivider(ts) {
  const chatBox = document.getElementById('chat-box');
  const divider = document.createElement('div');
  divider.className = 'date-divider';
  divider.innerText = getDateLabel(ts);
  chatBox.appendChild(divider);
}

function renderMessages() {
  const c = getActiveContact();
  const chatBox = document.getElementById('chat-box');
  chatBox.innerHTML = '';

  let lastUserIdx = -1;
  c.history.forEach((m, idx) => { if (m.role === 'user') lastUserIdx = idx; });

  let lastDay = null;
  c.history.forEach((m, idx) => {
    const ts = m.timestamp || Date.now();
    const dayKey = new Date(ts).toDateString();
    if (dayKey !== lastDay) {
      appendDateDivider(ts);
      lastDay = dayKey;
    }
    const showSeen = m.role === 'user' && idx === lastUserIdx && m.seen;
    appendBubble(m.content, m.role === 'user' ? 'user' : 'bot', false, idx, m.isSticker, m.stickerUrl, showSeen, ts);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function markLastUserMessageSeen() {
  const chatBox = document.getElementById('chat-box');
  chatBox.querySelectorAll('.message-wrapper.user .msg-meta').forEach(el => {
    el.innerText = el.innerText.replace(' · Seen', '');
  });
  const userWrappers = chatBox.querySelectorAll('.message-wrapper.user');
  const lastWrapper = userWrappers[userWrappers.length - 1];
  if (!lastWrapper) return;
  const meta = lastWrapper.querySelector('.msg-meta');
  if (meta && !meta.innerText.includes('Seen')) meta.innerText += ' · Seen';
}

function renderContacts() {
  const listEl = document.getElementById('contact-list');
  const searchInput = document.getElementById('search-contacts');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  listEl.innerHTML = '';

  globalData.contacts.filter(c => c.origName.toLowerCase().includes(search) || (c.nickname && c.nickname.toLowerCase().includes(search))).forEach(c => {
    const item = document.createElement('div');
    item.className = `contact-item ${c.id === globalData.activeContactId ? 'active' : ''}`;
    
    const displayName = c.nickname ? `${c.nickname} <span style="font-size:11px; color:var(--text-pale);">(${c.origName})</span>` : c.origName;
    const isImg = c.pfp && (c.pfp.startsWith('data:image') || c.pfp.startsWith('http'));
    const unread = c.unreadCount || 0;

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="pfp-circle" style="${isImg ? `background-image:url('${c.pfp}')` : ''}">${isImg ? '' : (c.pfp || '✦')}</div>
        <div style="font-size:14px; font-weight:600;">${displayName}</div>
        ${unread > 0 ? `<div class="unread-badge">${unread > 9 ? '9+' : unread}</div>` : ''}
      </div>
      <button class="icon-btn" onclick="event.stopPropagation(); openContactSettingsFor(${c.id})">⋮</button>
    `;

    item.addEventListener('touchstart', () => { longTouchTimer = setTimeout(() => openDeleteContactModal(c.id), 600); });
    item.addEventListener('touchend', () => clearTimeout(longTouchTimer));
    item.addEventListener('contextmenu', (e) => { e.preventDefault(); openDeleteContactModal(c.id); });

    item.onclick = () => {
      globalData.activeContactId = c.id;
      c.unreadCount = 0;
      saveData();
      renderHeader();
      renderMessages();
      renderContacts();
      closeDrawer();
    };
    listEl.appendChild(item);
  });
}

function renderUserProfileBar() {
  const u = globalData.user;
  document.getElementById('user-name-display').innerText = u.name;
  const pfpEl = document.getElementById('user-pfp-display');
  if (u.pfp && (u.pfp.startsWith('data:image') || u.pfp.startsWith('http'))) {
    pfpEl.style.backgroundImage = `url('${u.pfp}')`;
    pfpEl.innerText = '';
  } else {
    pfpEl.style.backgroundImage = 'none';
    pfpEl.innerText = u.pfp || '👤';
  }
}

// =========================================
// DYNAMIC MOBILE KEYBOARD LAYOUT HANDLER
// =========================================
function setupMobileKeyboardResize() {
  const appContainer = document.getElementById('phone-app');
  const chatBox = document.getElementById('chat-box');
  const vv = window.visualViewport;

  function updateHeight() {
    if (vv) {
      appContainer.style.height = `${vv.height}px`;
      appContainer.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : 'none';
    } else {
      appContainer.style.height = `${window.innerHeight}px`;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  updateHeight();

  if (vv) {
    vv.addEventListener('resize', updateHeight);
    vv.addEventListener('scroll', updateHeight);
  } else {
    window.addEventListener('resize', updateHeight);
  }

  const inputField = document.getElementById('user-input');
  inputField.addEventListener('focus', () => {
    document.getElementById('sticker-drawer').classList.remove('open');
    setTimeout(updateHeight, 50);
    setTimeout(updateHeight, 300);
    setTimeout(updateHeight, 600);
  });
  inputField.addEventListener('blur', () => setTimeout(updateHeight, 300));
}

// =========================================
// STICKERS SYSTEM
// =========================================
function toggleStickerDrawer() {
  const drawer = document.getElementById('sticker-drawer');
  const isOpen = drawer.classList.contains('open');
  if (!isOpen) {
    document.activeElement.blur();
    drawer.classList.add('open');
  } else {
    drawer.classList.remove('open');
  }
  setTimeout(() => {
    const chatBox = document.getElementById('chat-box');
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 100);
}

function renderStickers() {
  const grid = document.getElementById('sticker-grid');
  grid.innerHTML = '';
  if (!globalData.stickers) globalData.stickers = [];

  globalData.stickers.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'sticker-item';
    div.innerHTML = `<img src="${s.imgUrl}" title="${s.name}"/>`;
    
    div.onclick = () => sendSticker(s);

    div.addEventListener('touchstart', () => {
      longTouchTimer = setTimeout(() => openDeleteStickerModal(s.id), 600);
    });
    div.addEventListener('touchend', () => clearTimeout(longTouchTimer));
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openDeleteStickerModal(s.id);
    });

    grid.appendChild(div);
  });
}

function openAddStickerModal() {
  document.getElementById('stk-name').value = '';
  document.getElementById('stk-desc').value = '';
  tempStickerImg = '';
  document.getElementById('add-sticker-modal').style.display = 'flex';
}

function handleStickerUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { tempStickerImg = e.target.result; };
  reader.readAsDataURL(file);
}

function saveNewSticker() {
  const name = document.getElementById('stk-name').value.trim() || 'Custom Sticker';
  const desc = document.getElementById('stk-desc').value.trim() || 'A cute sticker';
  if (!tempStickerImg) { alert("Please select an image file!"); return; }

  globalData.stickers.push({ id: Date.now(), name, desc, imgUrl: tempStickerImg });
  saveData();
  renderStickers();
  closeModal('add-sticker-modal');
}

function openDeleteStickerModal(stickerId) {
  selectedStickerIdForDelete = stickerId;
  const sticker = globalData.stickers.find(s => s.id === stickerId);
  if (!sticker) return;

  document.getElementById('delete-sticker-text').innerText = `Are you sure you want to delete the "${sticker.name}" sticker?`;
  document.getElementById('delete-sticker-modal').style.display = 'flex';
}

function confirmDeleteSticker() {
  if (!selectedStickerIdForDelete) return;
  globalData.stickers = globalData.stickers.filter(s => s.id !== selectedStickerIdForDelete);
  saveData();
  renderStickers();
  closeModal('delete-sticker-modal');
}

function sendSticker(sticker) {
  document.getElementById('sticker-drawer').classList.remove('open');
  const c = getActiveContact();

  if (!c.savedStickers) c.savedStickers = [];
  if (!c.savedStickers.some(st => st.imgUrl === sticker.imgUrl)) {
    c.savedStickers.push(sticker);
  }

  c.history.push({
    role: 'user',
    content: `[Sent Sticker: "${sticker.name}" - Vibe: ${sticker.desc}]`,
    isSticker: true,
    stickerUrl: sticker.imgUrl
  });
  c.lastActivityAt = Date.now();
  saveData();
  renderMessages();
  queueAiResponse();
}

// =========================================
// AI & MESSAGING LOGIC WITH WARMTH METER
// =========================================
async function sendMessage() {
  if (!globalData.apiKey) {
    alert("Please set your Groq API Key first by clicking top right 3 dots! ⋮");
    openGlobalSettingsModal();
    return;
  }

  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;

  const c = getActiveContact();
  const now = Date.now();
  const prevMsg = c.history[c.history.length - 1];
  if (!prevMsg || new Date(prevMsg.timestamp || now).toDateString() !== new Date(now).toDateString()) {
    appendDateDivider(now);
  }
  appendBubble(text, 'user', true, c.history.length, false, '', false, now);
  input.value = '';
  c.history.push({ role: 'user', content: text, seen: false, timestamp: now });
  c.lastActivityAt = now;
  saveData();

  queueAiResponse();
}

let responseDebounceTimer = null;
let awaitingReply = false;
const RESPONSE_DEBOUNCE_MS = 3500; // waits this long after your last message/keystroke before replying

function updateBotStatusIndicator(text) {
  const el = document.getElementById('bot-status-indicator');
  if (el) el.innerText = text || '';
}

function queueAiResponse() {
  awaitingReply = true;
  clearTimeout(responseDebounceTimer);
  updateBotStatusIndicator('Waiting for you to finish...');
  responseDebounceTimer = setTimeout(() => { triggerAiResponse(); }, RESPONSE_DEBOUNCE_MS);
}

// Called on every keystroke in the input box. If a reply is pending, typing
// (even without sending) pushes the reply back so the bot doesn't answer
// mid-thought.
function extendReplyWaitIfPending() {
  if (!awaitingReply) return;
  clearTimeout(responseDebounceTimer);
  updateBotStatusIndicator('Waiting for you to finish...');
  responseDebounceTimer = setTimeout(() => { triggerAiResponse(); }, RESPONSE_DEBOUNCE_MS);
}

async function triggerAiResponse() {
  awaitingReply = false;
  const c = getActiveContact();
  const u = globalData.user;
  const timeDetails = getUserLocalTimeDetails();

  updateBotStatusIndicator('Typing...');

  const lastMsg = c.history[c.history.length - 1];
  if (lastMsg) lastMsg.seen = true;
  saveData();
  markLastUserMessageSeen();

  const typingBubble = appendTypingDots();

  const savedStickerOptions = (c.savedStickers && c.savedStickers.length > 0)
    ? `\nAVAILABLE STICKERS YOU HAVE SAVED/STOLEN FROM USER:\n` + c.savedStickers.map((s, idx) => `[STICKER_INDEX:${idx}] - "${s.name}" (${s.desc})`).join('\n') + `\nIf you want to send one back, include [USE_STICKER:index] at the end of your reply.`
    : '';

  // Time-aware sleepiness prompt logic
  let timeOfDayContext = `The current local time is ${timeDetails.formattedTime}.`;
  if (timeDetails.hour24 >= 23 || timeDetails.hour24 < 5) {
    timeOfDayContext += ` It's late at night / early morning. You might feel sleepy, groggy, or advise the user to go to sleep.`;
  } else if (timeDetails.hour24 >= 5 && timeDetails.hour24 < 9) {
    timeOfDayContext += ` It's early morning. You might be getting ready, tired, or waking up.`;
  }

  const systemPrompt = `
You are roleplaying as ${c.origName} in a custom SMS app.
${c.nickname ? `User calls you "${c.nickname}".` : ''}

CHARACTER PROFILE:
- Personality: ${c.personality || 'Friendly'}
- Current Situation / Environment: ${c.environment || 'Just hanging out.'}
- Manner of Texting / Quirks: ${c.quirks || 'Texts naturally'}
- Backstory: ${c.backstory || 'None'}
- Physical Appearance: ${c.appearance || 'Not specified'}
- Current Activity/Status: ${c.status || 'Just relaxing'} (If user asks what you're doing, refer to this!)
- Favorite Music/Artists: ${c.music || 'Various genres'} (Use this taste when discussing songs)
- Daily Routine/Vibe: ${c.routine || 'Normal schedule'}
${getMemoriesPromptContext(c)}
REAL-TIME TIME AWARENESS:
${timeOfDayContext} (If the user asks what time it is, answer accurately according to this time!).

RELATIONSHIP WARMTH LEVEL: ${c.relationshipPct || 0}% (out of 100%).

${c.memoryEnabled ? `CALLBACK MEMORIES & SHARED HISTORY:
- ${c.relationshipContext || 'Shared past experiences'}` : ''}

USER PROFILE:
- Name: ${u.name} (${u.nicknames})
- Pronouns: ${u.pronouns}
- User Context: ${u.appearance}
${savedStickerOptions}

FORMAT INSTRUCTION:
1. Judge how warm, thoughtful, and engaged the user's LATEST message(s) were. Output tag: [RELATIONSHIP_DELTA: +0.7]
2. If using a saved sticker, include [USE_STICKER:index] at the end.
3. Use ||| to split multiple texts if character quirks warrant it.
  `;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...c.history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content }))
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${globalData.apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: apiMessages,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) {
      typingBubble.innerText = "Error: " + data.error.message;
      return;
    }

    let reply = data.choices[0].message.content;

    const deltaMatch = reply.match(/\[RELATIONSHIP_DELTA:\s*([\+\-]?\d*(?:\.\d+)?)]/i);
    let delta = 0.4;
    if (deltaMatch) {
      delta = parseFloat(deltaMatch[1]);
      reply = reply.replace(/\[RELATIONSHIP_DELTA:\s*[\+\-]?\d*(?:\.\d+)?\]/gi, '').trim();
    }
    c.relationshipPct = Math.min(100, Math.max(0, (c.relationshipPct || 0) + delta));

    let usedStickerUrl = null;
    const stickerMatch = reply.match(/\[USE_STICKER:(\d+)\]/i);
    if (stickerMatch) {
      const stkIdx = parseInt(stickerMatch[1], 10);
      if (c.savedStickers && c.savedStickers[stkIdx]) {
        usedStickerUrl = c.savedStickers[stkIdx].imgUrl;
      }
      reply = reply.replace(/\[USE_STICKER:\d+\]/gi, '').trim();
    }

    const chunks = reply.split('|||').map(t => t.trim()).filter(Boolean);
    await deliverBotMessages(c, chunks, typingBubble, usedStickerUrl);
    updateBotStatusIndicator('');

  } catch (err) {
    typingBubble.innerText = "Error connecting to Groq API.";
    updateBotStatusIndicator('');
  }
}

async function deliverBotMessages(c, chunks, firstTypingBubble, usedStickerUrl) {
  const isViewingThisChat = c.id === globalData.activeContactId;

  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    const typingBubble = isViewingThisChat ? (i === 0 ? firstTypingBubble : appendTypingDots()) : null;

    const delay = Math.min(Math.max(350, text.length * 12), 1800);
    await new Promise(resolve => setTimeout(resolve, delay));

    const newBotMsg = { role: 'assistant', content: text, timestamp: Date.now() };
    if (usedStickerUrl && i === chunks.length - 1) {
      newBotMsg.isSticker = true;
      newBotMsg.stickerUrl = usedStickerUrl;
    }
    c.history.push(newBotMsg);
    c.lastActivityAt = Date.now();

    if (isViewingThisChat) {
      if (typingBubble) typingBubble.innerText = text;
      saveData();
      renderHeader();
      renderMessages();
    } else {
      c.unreadCount = (c.unreadCount || 0) + 1;
      saveData();
      renderContacts();
    }

    if (!isViewingThisChat || document.hidden) {
      sendSystemNotification(c.nickname || c.origName, text);
    }
  }
}

// =========================================
// PROACTIVE "THEY TEXT FIRST" SYSTEM
// =========================================
const PROACTIVE_CHECK_INTERVAL_MS = 60000;
const PROACTIVE_MIN_QUIET_MS = 60 * 60 * 1000;
const PROACTIVE_CHANCE = 0.15;

setInterval(checkForProactiveMessages, PROACTIVE_CHECK_INTERVAL_MS);

async function checkForProactiveMessages() {
  if (!globalData.apiKey) return;
  if (globalData.proactiveTextsEnabled === false) return;

  for (const c of globalData.contacts) {
    const lastAt = c.lastActivityAt || 0;
    const quietFor = Date.now() - lastAt;
    if (quietFor < PROACTIVE_MIN_QUIET_MS) continue;
    if (Math.random() > PROACTIVE_CHANCE) continue;

    await sendProactiveMessage(c, quietFor);
  }
}

async function sendProactiveMessage(c, quietForMs) {
  const u = globalData.user;
  const isViewingThisChat = c.id === globalData.activeContactId;
  const timeDetails = getUserLocalTimeDetails();

  const quietHours = quietForMs / (60 * 60 * 1000);
  const moodHint = quietHours >= 6
    ? `It's been a long time (${Math.round(quietHours)}+ hours) — express impatience, concern, or teasing naturally.`
    : `It's been an hour — keep it casual and light.`;

  const systemPrompt = `
You are roleplaying as ${c.origName}. You are texting ${u.name} first after a period of silence.
CHARACTER PROFILE: ${c.personality}
ENVIRONMENT: ${c.environment || 'Hanging out'}
TIME: ${timeDetails.formattedTime}
SILENCE CONTEXT: ${moodHint}
  `;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...c.history.slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
    { role: 'user', content: '(silence — no new message from the user in a while)' }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${globalData.apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: apiMessages,
        temperature: 0.8
      })
    });

    const data = await response.json();
    if (data.error) return;

    const reply = data.choices[0].message.content;
    const chunks = reply.split('|||').map(t => t.trim()).filter(Boolean);
    if (chunks.length === 0) return;

    const firstTypingBubble = isViewingThisChat ? appendTypingDots() : null;
    await deliverBotMessages(c, chunks, firstTypingBubble, null);

  } catch (err) {
    // Fail silently
  }
}

function appendBubble(text, sender, autoScroll, index, isSticker = false, stickerUrl = '', seen = false, timestamp = null) {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'message';

  if (isSticker) {
    bubble.innerHTML = `<img src="${stickerUrl}" class="sticker-msg-img" />` + (text.startsWith('[Sent Sticker') ? '' : `<div>${text}</div>`);
  } else {
    bubble.innerText = text;
  }

  bubble.addEventListener('touchstart', () => {
    longTouchTimer = setTimeout(() => openDeleteModal(index), 600);
  });
  bubble.addEventListener('touchend', () => clearTimeout(longTouchTimer));
  bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); openDeleteModal(index); });

  wrapper.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerText = formatTime(timestamp) + (seen ? ' · Seen' : '');
  wrapper.appendChild(meta);

  chatBox.appendChild(wrapper);
  if (autoScroll) chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

function appendTypingDots() {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper bot`;
  const bubble = document.createElement('div');
  bubble.className = 'message';
  bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  wrapper.appendChild(bubble);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

// =========================================
// GALLERY IMAGE HANDLING
// =========================================
function handlePfpUpload(event, targetInputId) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { document.getElementById(targetInputId).value = e.target.result; };
  reader.readAsDataURL(file);
}

function handleBgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { globalData.bgUrl = e.target.result; };
  reader.readAsDataURL(file);
}

// =========================================
// MODALS & QUICK EDIT POPUP
// =========================================
function toggleQuickEdit(event) {
  event.stopPropagation();
  const pop = document.getElementById('quick-edit-pop');
  pop.style.display = pop.style.display === 'flex' ? 'none' : 'flex';
}

function openDeleteModal(index) {
  selectedMsgIndex = index;
  document.getElementById('delete-following-chk').checked = false;
  document.getElementById('delete-msg-modal').style.display = 'flex';
}

function confirmDeleteMessage() {
  if (selectedMsgIndex === null) return;
  const c = getActiveContact();
  if (document.getElementById('delete-following-chk').checked) {
    c.history = c.history.slice(0, selectedMsgIndex);
  } else {
    c.history.splice(selectedMsgIndex, 1);
  }
  saveData();
  renderMessages();
  closeModal('delete-msg-modal');
}

function openDeleteContactModal(contactId) {
  selectedContactIdForDelete = contactId;
  const targetContact = globalData.contacts.find(c => c.id === contactId);
  if (!targetContact) return;
  document.getElementById('delete-contact-text').innerText = `Are you sure you want to delete "${targetContact.nickname || targetContact.origName}"?`;
  document.getElementById('delete-contact-modal').style.display = 'flex';
}

function confirmDeleteContact() {
  if (!selectedContactIdForDelete) return;
  if (globalData.contacts.length <= 1) {
    alert("You must keep at least one contact!");
    closeModal('delete-contact-modal');
    return;
  }
  globalData.contacts = globalData.contacts.filter(c => c.id !== selectedContactIdForDelete);
  if (globalData.activeContactId === selectedContactIdForDelete) {
    globalData.activeContactId = globalData.contacts[0].id;
  }
  saveData();
  renderContacts();
  renderHeader();
  renderMessages();
  closeModal('delete-contact-modal');
}

function clearCurrentChat() {
  if (confirm("Are you sure you want to clear this entire conversation?")) {
    const c = getActiveContact();
    c.history = [];
    saveData();
    renderMessages();
    closeModal('global-settings-modal');
  }
}

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('backdrop').style.display = 'block';
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('backdrop').style.display = 'none';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Quick Edit
function openQuickEditModal() {
  document.getElementById('quick-edit-pop').style.display = 'none';
  const c = getActiveContact();
  document.getElementById('qe-pfp').value = c.pfp || '';
  document.getElementById('qe-nickname').value = c.nickname || '';
  document.getElementById('quick-edit-modal').style.display = 'flex';
}

function saveQuickEdit() {
  const c = getActiveContact();
  c.pfp = document.getElementById('qe-pfp').value.trim() || '🤖';
  c.nickname = document.getElementById('qe-nickname').value.trim();
  saveData();
  renderHeader();
  renderContacts();
  closeModal('quick-edit-modal');
}

// Contact Settings
function openContactSettingsModal() {
  document.getElementById('quick-edit-pop').style.display = 'none';
  openContactSettingsFor(globalData.activeContactId);
}

function openContactSettingsFor(id) {
  const c = globalData.contacts.find(x => x.id === id);
  if (!c) return;
  globalData.activeContactId = id;
  document.getElementById('cs-origname').value = c.origName;
  document.getElementById('cs-personality').value = c.personality || '';
  document.getElementById('cs-environment').value = c.environment || '';
  document.getElementById('cs-quirks').value = c.quirks || '';
  document.getElementById('cs-memory-toggle').checked = !!c.memoryEnabled;
  document.getElementById('cs-rel-context').value = c.relationshipContext || '';
  document.getElementById('cs-backstory').value = c.backstory || '';
  document.getElementById('cs-appearance').value = c.appearance || '';
  document.getElementById('contact-settings-modal').style.display = 'flex';
}

function saveContactSettings() {
  const c = getActiveContact();
  c.origName = document.getElementById('cs-origname').value.trim() || 'Character';
  c.personality = document.getElementById('cs-personality').value;
  c.environment = document.getElementById('cs-environment').value;
  c.quirks = document.getElementById('cs-quirks').value;
  c.memoryEnabled = document.getElementById('cs-memory-toggle').checked;
  c.relationshipContext = document.getElementById('cs-rel-context').value;
  c.backstory = document.getElementById('cs-backstory').value;
  c.appearance = document.getElementById('cs-appearance').value;
  saveData();
  renderHeader();
  renderContacts();
  closeModal('contact-settings-modal');
}

// =========================================
// PERSONAL DOSSIER (status / music / routine)
// =========================================
function openPersonalDossierModal() {
  document.getElementById('quick-edit-pop').style.display = 'none';
  const c = getActiveContact();
  document.getElementById('pd-status').value = c.status || '';
  document.getElementById('pd-music').value = c.music || '';
  document.getElementById('pd-routine').value = c.routine || '';
  document.getElementById('personal-dossier-modal').style.display = 'flex';
}

function savePersonalDossier() {
  const c = getActiveContact();
  c.status = document.getElementById('pd-status').value;
  c.music = document.getElementById('pd-music').value;
  c.routine = document.getElementById('pd-routine').value;
  saveData();
  closeModal('personal-dossier-modal');
}

// =========================================
// PER-CHARACTER MEMORY CALENDAR
// =========================================
let calendarViewYear, calendarViewMonth;

function openCalendarModal() {
  const now = new Date();
  calendarViewYear = now.getFullYear();
  calendarViewMonth = now.getMonth();
  const panel = document.getElementById('calendar-day-panel');
  panel.classList.add('hidden');
  panel.innerHTML = '';
  renderCalendarGrid();
  document.getElementById('calendar-modal').style.display = 'flex';
}

function changeCalendarMonth(delta) {
  calendarViewMonth += delta;
  if (calendarViewMonth < 0) { calendarViewMonth = 11; calendarViewYear--; }
  if (calendarViewMonth > 11) { calendarViewMonth = 0; calendarViewYear++; }
  document.getElementById('calendar-day-panel').classList.add('hidden');
  renderCalendarGrid();
}

function renderCalendarGrid() {
  const c = getActiveContact();
  if (!c.memories) c.memories = [];

  const label = new Date(calendarViewYear, calendarViewMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  document.getElementById('calendar-month-label').innerText = label;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
    const head = document.createElement('div');
    head.className = 'calendar-day-head';
    head.innerText = d;
    grid.appendChild(head);
  });

  const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
  const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day empty';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (dateISO === todayISO) cell.classList.add('today');
    const hasMemory = c.memories.some(m => m.dateISO === dateISO);
    if (hasMemory) cell.classList.add('has-memory');
    cell.innerHTML = `<span>${day}</span>${hasMemory ? '<div class="mem-dot"></div>' : ''}`;
    cell.onclick = () => openCalendarDayPanel(dateISO);
    grid.appendChild(cell);
  }
}

function openCalendarDayPanel(dateISO) {
  const c = getActiveContact();
  if (!c.memories) c.memories = [];
  const panel = document.getElementById('calendar-day-panel');
  panel.classList.remove('hidden');

  const existing = c.memories.find(m => m.dateISO === dateISO);
  const displayDate = new Date(dateISO + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  panel.innerHTML = `
    <label>${displayDate}</label>
    <textarea id="calendar-desc-input" rows="2" placeholder="What happened / is planned?">${existing ? existing.description : ''}</textarea>
    <div class="memory-row">
      <button class="save-btn" id="calendar-save-btn">${existing ? 'Update' : 'Add'} Date</button>
      ${existing ? '<button class="danger-btn" id="calendar-del-btn">Delete</button>' : ''}
    </div>
  `;

  document.getElementById('calendar-save-btn').onclick = () => {
    const desc = document.getElementById('calendar-desc-input').value.trim();
    if (!desc) { alert('Please write something for this date!'); return; }
    if (existing) {
      existing.description = desc;
    } else {
      c.memories.push({ id: Date.now(), dateISO, description: desc });
    }
    saveData();
    renderCalendarGrid();
    panel.classList.add('hidden');
  };

  if (existing) {
    document.getElementById('calendar-del-btn').onclick = () => {
      c.memories = c.memories.filter(m => m.id !== existing.id);
      saveData();
      renderCalendarGrid();
      panel.classList.add('hidden');
    };
  }
}

function getMemoriesPromptContext(c) {
  if (!c.memories || c.memories.length === 0) return '';
  let ctx = '\nMEMORIES & CALENDAR EVENTS:\nYou remember the following past/scheduled events with the user:\n';
  c.memories.forEach(m => {
    const label = m.dateISO ? new Date(m.dateISO + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : (m.date || '');
    ctx += `- [${label}]: ${m.description}\n`;
  });
  return ctx;
}

function addNewContact() {
  const newId = Date.now();
  const newContact = {
    id: newId,
    origName: 'New Contact',
    nickname: '',
    pfp: '🌸',
    personality: '',
    environment: '',
    quirks: '',
    backstory: '',
    appearance: '',
    relationshipPct: 0,
    memoryEnabled: true,
    relationshipContext: '',
    status: '',
    music: '',
    routine: '',
    memories: [],
    history: [],
    savedStickers: [],
    unreadCount: 0,
    lastActivityAt: Date.now()
  };
  globalData.contacts.push(newContact);
  globalData.activeContactId = newId;
  saveData();
  renderContacts();
  renderHeader();
  renderMessages();
  openContactSettingsFor(newId);
}

// User Profile
function openUserModal() {
  const u = globalData.user;
  document.getElementById('usr-name').value = u.name;
  document.getElementById('usr-nicknames').value = u.nicknames;
  document.getElementById('usr-pronouns').value = u.pronouns;
  document.getElementById('usr-appearance').value = u.appearance;
  document.getElementById('usr-pfp').value = u.pfp;
  document.getElementById('user-modal').style.display = 'flex';
}

function saveUserProfile() {
  globalData.user = {
    name: document.getElementById('usr-name').value || 'User',
    nicknames: document.getElementById('usr-nicknames').value,
    pronouns: document.getElementById('usr-pronouns').value,
    appearance: document.getElementById('usr-appearance').value,
    pfp: document.getElementById('usr-pfp').value || '🌸'
  };
  saveData();
  renderUserProfileBar();
  closeModal('user-modal');
}

// Global Settings
function openGlobalSettingsModal() {
  document.getElementById('gs-api-key').value = globalData.apiKey || '';
  document.getElementById('gs-utc-offset').value = globalData.utcOffset !== undefined ? globalData.utcOffset : '';
  const proactiveToggle = document.getElementById('gs-proactive-toggle');
  if (proactiveToggle) proactiveToggle.checked = globalData.proactiveTextsEnabled !== false;
  const notifToggle = document.getElementById('gs-notifications-toggle');
  if (notifToggle) notifToggle.checked = globalData.notificationsEnabled !== false;
  document.getElementById('global-settings-modal').style.display = 'flex';
}

function saveGlobalSettings() {
  globalData.apiKey = document.getElementById('gs-api-key').value.trim();

  const utcRaw = document.getElementById('gs-utc-offset').value.trim();
  if (utcRaw === '' || !isNaN(parseFloat(utcRaw))) {
    globalData.utcOffset = utcRaw === '' ? '' : parseFloat(utcRaw);
  } else {
    alert('Time zone offset should be a number like -5 or +5.5 — keeping your previous value.');
  }

  const proactiveToggle = document.getElementById('gs-proactive-toggle');
  if (proactiveToggle) globalData.proactiveTextsEnabled = proactiveToggle.checked;
  const notifToggle = document.getElementById('gs-notifications-toggle');
  if (notifToggle) {
    globalData.notificationsEnabled = notifToggle.checked;
    if (globalData.notificationsEnabled) requestNotificationPermission();
  }
  document.getElementById('chat-box').style.backgroundImage = globalData.bgUrl ? `url('${globalData.bgUrl}')` : 'none';
  saveData();
  closeModal('global-settings-modal');
}

// =========================================
// PWA SERVICE WORKER REGISTRATION
// =========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service worker registration failed:', err);
    });
  });
    }

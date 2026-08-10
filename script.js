// =========================================
// STATE & STORAGE
// =========================================
let globalData = JSON.parse(localStorage.getItem('cute_sms_data')) || {
  apiKey: '',
  bgUrl: '',
  activeContactId: 1,
  user: { name: 'Sally', nicknames: 'sal; sallo', pronouns: 'she/her', appearance: 'Cute aesthetic lover', pfp: '🌸' },
  stickers: [],
  contacts: [
    {
      id: 1,
      origName: 'Jacob',
      nickname: 'pookie❤️',
      pfp: '🤖',
      personality: 'Grumpy guy, secretly cares a lot, dramatic, aloof',
      quirks: 'ALWAYS replies in a single big message block. Hates cluttering SMS.',
      backstory: 'Childhood friend who texts you reluctantly.',
      appearance: 'Messy black hair, tall, dark hoodies',
      relationshipPct: 15,
      memoryEnabled: true,
      relationshipContext: 'Met in high school, got lost in an amusement park together for hours.',
      temperature: 0.7,
      responseLength: 'balanced',
      messageFrequency: 'single',
      relDynamic: 'unromantic',
      alwaysRemember: 'Always be a little reluctant when opening texts.',
      history: [],
      savedStickers: []
    }
  ]
};

let selectedMsgIndex = null;
let selectedContactIdForDelete = null;
let selectedStickerIdForDelete = null;
let longTouchTimer = null;
let tempStickerImg = '';
let typingPauseTimer = null; // Buffer timer for sensing multiple user messages

function saveData() {
  localStorage.setItem('cute_sms_data', JSON.stringify(globalData));
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
  setupTypingBufferDetector();
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

function renderMessages() {
  const c = getActiveContact();
  const chatBox = document.getElementById('chat-box');
  chatBox.innerHTML = '';

  let lastUserIdx = -1;
  c.history.forEach((m, idx) => { if (m.role === 'user') lastUserIdx = idx; });

  c.history.forEach((m, idx) => {
    const showSeen = m.role === 'user' && idx === lastUserIdx && m.seen;
    appendBubble(m.content, m.role === 'user' ? 'user' : 'bot', false, idx, m.isSticker, m.stickerUrl, showSeen);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function markLastUserMessageSeen() {
  const chatBox = document.getElementById('chat-box');
  chatBox.querySelectorAll('.seen-label').forEach(el => el.remove());
  const userWrappers = chatBox.querySelectorAll('.message-wrapper.user');
  const lastWrapper = userWrappers[userWrappers.length - 1];
  if (!lastWrapper) return;
  const label = document.createElement('div');
  label.className = 'seen-label';
  label.innerText = 'Seen';
  lastWrapper.appendChild(label);
}

function renderContacts() {
  const listEl = document.getElementById('contact-list');
  const search = document.getElementById('search-contacts').value.toLowerCase();
  listEl.innerHTML = '';

  globalData.contacts.filter(c => c.origName.toLowerCase().includes(search) || (c.nickname && c.nickname.toLowerCase().includes(search))).forEach(c => {
    const item = document.createElement('div');
    item.className = `contact-item ${c.id === globalData.activeContactId ? 'active' : ''}`;
    
    const displayName = c.nickname ? `${c.nickname} <span style="font-size:11px; color:var(--text-pale);">(${c.origName})</span>` : c.origName;
    const isImg = c.pfp && (c.pfp.startsWith('data:image') || c.pfp.startsWith('http'));
    
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="pfp-circle" style="${isImg ? `background-image:url('${c.pfp}')` : ''}">${isImg ? '' : (c.pfp || '✦')}</div>
        <div style="font-size:14px; font-weight:600;">${displayName}</div>
      </div>
      <button class="icon-btn" onclick="event.stopPropagation(); openContactSettingsFor(${c.id})">⋮</button>
    `;

    item.addEventListener('touchstart', () => { longTouchTimer = setTimeout(() => openDeleteContactModal(c.id), 600); });
    item.addEventListener('touchend', () => clearTimeout(longTouchTimer));
    item.addEventListener('contextmenu', (e) => { e.preventDefault(); openDeleteContactModal(c.id); });

    item.onclick = () => {
      globalData.activeContactId = c.id;
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
// MOBILE KEYBOARD LAYOUT HANDLER
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
// MULTI-MESSAGE & TYPING SENSING BUFFER
// =========================================
function setupTypingBufferDetector() {
  const input = document.getElementById('user-input');
  input.addEventListener('input', () => {
    // Whenever user types, reset delay timer so bot waits for user to finish
    if (typingPauseTimer) clearTimeout(typingPauseTimer);
  });
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
  saveData();
  renderMessages();
  
  scheduleAiResponse();
}

// =========================================
// AI & MESSAGING LOGIC WITH FLEXIBLE PARAMETERS
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
  appendBubble(text, 'user', true, c.history.length);
  input.value = '';
  c.history.push({ role: 'user', content: text, seen: false });
  saveData();

  scheduleAiResponse();
}

function scheduleAiResponse() {
  if (typingPauseTimer) clearTimeout(typingPauseTimer);
  // Wait 3.5 seconds after the user sends a message/stops typing to trigger bot response
  typingPauseTimer = setTimeout(() => {
    triggerAiResponse();
  }, 3500);
}

const MIN_READ_DELAY_MS = 0;
const MAX_READ_DELAY_MS = 12000;

async function triggerAiResponse() {
  const c = getActiveContact();
  const u = globalData.user;

  // Simulate opening chat
  const readDelayMs = Math.floor(MIN_READ_DELAY_MS + Math.random() * (MAX_READ_DELAY_MS - MIN_READ_DELAY_MS));
  if (readDelayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, readDelayMs));
  }

  const lastMsg = c.history[c.history.length - 1];
  if (lastMsg) lastMsg.seen = true;
  saveData();
  markLastUserMessageSeen();

  const typingBubble = appendTypingDots();

  const savedStickerOptions = (c.savedStickers && c.savedStickers.length > 0)
    ? `\nAVAILABLE STICKERS YOU HAVE SAVED/STOLEN FROM USER:\n` + c.savedStickers.map((s, idx) => `[STICKER_INDEX:${idx}] - "${s.name}" (${s.desc})`).join('\n') + `\nIf you want to send one back, include [USE_STICKER:index] at the end of your reply.`
    : '';

  const readDelaySeconds = Math.round(readDelayMs / 1000);
  const delayContext = readDelaySeconds >= 7
    ? `You took about ${readDelaySeconds} seconds to notice and start replying to this text — a noticeably long gap for texting.`
    : `You replied at a normal/quick pace.`;

  // Dynamic Parameter Prompts
  const lengthPrompt = {
    'short': 'Keep your response brief and concise (1-2 short sentences).',
    'balanced': 'Provide a natural SMS-length response.',
    'long': 'Write a detailed response with multiple sentences.',
    'paragraphs': 'Write a longer, highly descriptive paragraph response.'
  }[c.responseLength || 'balanced'];

  const frequencyPrompt = {
    'single': 'Send all your thoughts in a single cohesive message block.',
    'multi': 'If natural, split thoughts into distinct shorter text ideas.'
  }[c.messageFrequency || 'single'];

  const relDynamicPrompt = {
    'romantic': 'Your relationship dynamic with the user is romantic/flirty.',
    'unromantic': 'Your relationship dynamic with the user is strictly platonic/friendly.',
    'reluctant': 'You feel reluctant, distant, or hesitant in texting the user.',
    'rival': 'You share a rival, competitive, or playful banter dynamic with the user.',
    'family': 'You share a familial or long-time trusted protective dynamic with the user.'
  }[c.relDynamic || 'unromantic'];

  const systemPrompt = `
You are roleplaying as ${c.origName} in a custom SMS app.
${c.nickname ? `User calls you "${c.nickname}".` : ''}

CHARACTER PROFILE:
- Personality: ${c.personality || 'Friendly'}
- Manner of Texting / Quirks: ${c.quirks || 'Texts naturally'}
- Backstory: ${c.backstory || 'None'}
- Physical Appearance: ${c.appearance || 'Not specified'}

PARAMETER DIRECTIVES:
- Relationship Dynamic: ${relDynamicPrompt}
- Response Length Preference: ${lengthPrompt}
- Structure: ${frequencyPrompt}
${c.alwaysRemember ? `- ALWAYS REMEMBER DIRECTIVE: ${c.alwaysRemember}` : ''}

RELATIONSHIP WARMTH LEVEL: ${c.relationshipPct || 0}% (out of 100%).
- Express warmth-level changes through the lens of your personality.

RESPONSE TIMING: ${delayContext}

${c.memoryEnabled ? `CALLBACK MEMORIES & SHARED HISTORY:
- ${c.relationshipContext || 'Shared past experiences'}
- Refer to past shared events or bring up prior details naturally.` : ''}

USER PROFILE:
- Name: ${u.name} (${u.nicknames})
- Pronouns: ${u.pronouns}
- User Context: ${u.appearance}
${savedStickerOptions}

FORMAT INSTRUCTION:
1. Rate warmth impact in smaller increments (around 0.3% per message). Output tag at the VERY END: [RELATIONSHIP_DELTA: +0.3] or [RELATIONSHIP_DELTA: -0.3] or [RELATIONSHIP_DELTA: 0].
2. If using a saved sticker, include [USE_STICKER:index] at the end.
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
        temperature: parseFloat(c.temperature || 0.7)
      })
    });

    const data = await response.json();
    if (data.error) {
      typingBubble.innerText = "Error: " + data.error.message;
      return;
    }

    let reply = data.choices[0].message.content;

    const deltaMatch = reply.match(/\[RELATIONSHIP_DELTA:\s*([\+\-]?\d*(?:\.\d+)?)]/i);
    let delta = 0.3;
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

    // Dynamic Typing Duration (2s min to 7s max based on response character length)
    const calculatedDelay = Math.min(Math.max(2000, reply.length * 40), 7000);

    setTimeout(() => {
      typingBubble.innerText = reply;
      const newBotMsg = { role: 'assistant', content: reply };
      if (usedStickerUrl) {
        newBotMsg.isSticker = true;
        newBotMsg.stickerUrl = usedStickerUrl;
      }
      c.history.push(newBotMsg);
      saveData();
      renderHeader();
      renderMessages();
    }, calculatedDelay);

  } catch (err) {
    typingBubble.innerText = "Error connecting to Groq API.";
  }
}

function appendBubble(text, sender, autoScroll, index, isSticker = false, stickerUrl = '', seen = false) {
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

  if (seen) {
    const seenLabel = document.createElement('div');
    seenLabel.className = 'seen-label';
    seenLabel.innerText = 'Seen';
    wrapper.appendChild(seenLabel);
  }

  chatBox.appendChild(wrapper);
  if (autoScroll) chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

function appendTypingDots() {
  const chatBox = document.getElementById('chat-box');
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper bot';
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

// Contact Settings Modal Handling
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
  document.getElementById('cs-quirks').value = c.quirks || '';
  document.getElementById('cs-memory-toggle').checked = !!c.memoryEnabled;
  document.getElementById('cs-rel-context').value = c.relationshipContext || '';
  document.getElementById('cs-backstory').value = c.backstory || '';
  document.getElementById('cs-appearance').value = c.appearance || '';
  
  // Sliders and new controls
  document.getElementById('cs-temperature').value = c.temperature || 0.7;
  document.getElementById('cs-temp-val').innerText = c.temperature || 0.7;
  document.getElementById('cs-res-length').value = c.responseLength || 'balanced';
  document.getElementById('cs-msg-freq').value = c.messageFrequency || 'single';
  document.getElementById('cs-rel-dynamic').value = c.relDynamic || 'unromantic';
  document.getElementById('cs-always-remember').value = c.alwaysRemember || '';

  document.getElementById('contact-settings-modal').style.display = 'flex';
}

function saveContactSettings() {
  const c = getActiveContact();
  c.origName = document.getElementById('cs-origname').value.trim() || 'Character';
  c.personality = document.getElementById('cs-personality').value;
  c.quirks = document.getElementById('cs-quirks').value;
  c.memoryEnabled = document.getElementById('cs-memory-toggle').checked;
  c.relationshipContext = document.getElementById('cs-rel-context').value;
  c.backstory = document.getElementById('cs-backstory').value;
  c.appearance = document.getElementById('cs-appearance').value;

  c.temperature = parseFloat(document.getElementById('cs-temperature').value);
  c.responseLength = document.getElementById('cs-res-length').value;
  c.messageFrequency = document.getElementById('cs-msg-freq').value;
  c.relDynamic = document.getElementById('cs-rel-dynamic').value;
  c.alwaysRemember = document.getElementById('cs-always-remember').value.trim();

  saveData();
  renderHeader();
  renderContacts();
  closeModal('contact-settings-modal');
}

function addNewContact() {
  const newId = Date.now();
  const newContact = {
    id: newId,
    origName: 'New Contact',
    nickname: '',
    pfp: '🌸',
    personality: '',
    quirks: '',
    backstory: '',
    appearance: '',
    relationshipPct: 0,
    memoryEnabled: true,
    relationshipContext: '',
    temperature: 0.7,
    responseLength: 'balanced',
    messageFrequency: 'single',
    relDynamic: 'unromantic',
    alwaysRemember: '',
    history: [],
    savedStickers: []
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
  document.getElementById('global-settings-modal').style.display = 'flex';
}

function saveGlobalSettings() {
  globalData.apiKey = document.getElementById('gs-api-key').value.trim();
  document.getElementById('chat-box').style.backgroundImage = globalData.bgUrl ? `url('${globalData.bgUrl}')` : 'none';
  saveData();
  closeModal('global-settings-modal');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service worker registration failed:', err);
    });
  });
}

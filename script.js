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

      // Only the most recent user message ever shows "Seen" (like real SMS apps).
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
        appendBubble(m.content, m.role === 'user' ? 'user' : 'bot', false, idx, m.isSticker, m.stickerUrl, m.reaction, showSeen, ts);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Adds "Seen" to the meta line under the current last user bubble and
    // removes it from any earlier one (so only the newest reflects the read state).
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
      const search = document.getElementById('search-contacts').value.toLowerCase();
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
          // vv.height shrinks when the keyboard opens.
          appContainer.style.height = `${vv.height}px`;
          // vv.offsetTop accounts for the page having scrolled up under
          // the keyboard/address bar — without this the bar can still
          // end up pinned off-screen on some Android WebViews.
          appContainer.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : 'none';
        } else {
          appContainer.style.height = `${window.innerHeight}px`;
        }
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      // Run once immediately so the layout is correct before any focus/resize event.
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
        // Some WebViews fire the visualViewport resize a beat late, so we
        // re-check a couple of times right after focus rather than once.
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

      // Bot saves user's sticker to its own saved list
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
      appendBubble(text, 'user', true, c.history.length, false, '', null, false, now);
      input.value = '';
      c.history.push({ role: 'user', content: text, seen: false, timestamp: now });
      c.lastActivityAt = now;
      saveData();

      queueAiResponse();
    }

    // How long (ms) a contact can take before even "seeing" your message.
    const MIN_READ_DELAY_MS = 0;
    const MAX_READ_DELAY_MS = 3000;

    // Give the user a moment to send a follow-up text — the bot waits for a
    // pause before it "looks at" the whole burst of messages at once.
    let responseDebounceTimer = null;
    const RESPONSE_DEBOUNCE_MS = 1100;

    function queueAiResponse() {
      clearTimeout(responseDebounceTimer);
      responseDebounceTimer = setTimeout(() => { triggerAiResponse(); }, RESPONSE_DEBOUNCE_MS);
    }

    async function triggerAiResponse() {
      const c = getActiveContact();
      const u = globalData.user;

      // --- "They haven't opened the chat yet" simulation ---------------
      const readDelayMs = Math.floor(MIN_READ_DELAY_MS + Math.random() * (MAX_READ_DELAY_MS - MIN_READ_DELAY_MS));
      if (readDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, readDelayMs));
      }

      // Mark the message "Seen" now that the delay has elapsed, then show it.
      const lastMsg = c.history[c.history.length - 1];
      if (lastMsg) lastMsg.seen = true;
      saveData();
      markLastUserMessageSeen();

      const typingBubble = appendTypingDots();

      const savedStickerOptions = (c.savedStickers && c.savedStickers.length > 0)
        ? `\nAVAILABLE STICKERS YOU HAVE SAVED/STOLEN FROM USER:\n` + c.savedStickers.map((s, idx) => `[STICKER_INDEX:${idx}] - "${s.name}" (${s.desc})`).join('\n') + `\nIf you want to send one back, include [USE_STICKER:index] at the end of your reply.`
        : '';

      const readDelaySeconds = Math.round(readDelayMs / 1000);
      const delayContext = readDelaySeconds >= 2
        ? `You took about ${readDelaySeconds} seconds to notice and start replying to this text — a bit of a gap for texting. There's a decent chance you'd open with one short, natural line explaining what kept you busy in-world, fitting your personality/backstory/appearance above. Don't force this every time it happens, and keep it brief — it's a passing remark, not the whole reply.`
        : `You replied at a normal/quick pace — no need to mention or explain timing at all.`;

      const systemPrompt = `
You are roleplaying as ${c.origName} in a custom SMS app.
${c.nickname ? `User calls you "${c.nickname}".` : ''}

CHARACTER PROFILE (this always comes first — nothing below should ever override or contradict it):
- Personality: ${c.personality || 'Friendly'}
- Manner of Texting / Quirks: ${c.quirks || 'Texts naturally'}
- Backstory: ${c.backstory || 'None'}
- Physical Appearance: ${c.appearance || 'Not specified'}

RELATIONSHIP WARMTH LEVEL: ${c.relationshipPct || 0}% (out of 100%). This only tracks how much you two have grown closer over time — it is a subtle modifier layered ON TOP of your core personality above, never a replacement for it.
- A naturally warm/welcoming character stays warm and welcoming even at low %, just a little less vulnerable/familiar than they'd be at high %.
- A naturally cold/guarded character stays guarded even at low %, gradually opening up more as % rises.
- In short: express warmth-level changes *through the lens of your personality*, not instead of it.

RESPONSE TIMING: ${delayContext}

${c.memoryEnabled ? `CALLBACK MEMORIES & SHARED HISTORY:
- ${c.relationshipContext || 'Shared past experiences'}
- System Instruction: Occasionally reference past shared events or bring up prior details from earlier in the chat naturally.` : ''}

USER PROFILE:
- Name: ${u.name} (${u.nicknames})
- Pronouns: ${u.pronouns}
- User Context: ${u.appearance}
${savedStickerOptions}

FORMAT INSTRUCTION:
1. Judge how warm, thoughtful, and engaged the user's LATEST message(s) were. Use these as calibration anchors: a bare, low-effort reply like "im okay" is worth about +0.2; a warm, inviting reply like "im good! what about you?" is worth about +0.7; something even more caring, detailed, or vulnerable can go up to +1.5. A cold, dismissive, or rude message is worth 0 or a negative value down to -0.5. Output the tag at the VERY END: [RELATIONSHIP_DELTA: +0.7]
2. If using a saved sticker, include [USE_STICKER:index] at the end.
3. If — and only if — it truly fits your quirks/personality (e.g. someone who double-texts or sends short scattered messages instead of one block), you may split your reply into multiple separate texts by putting ||| between each one. Most replies should still just be one message — only split when your character would genuinely text that way. Never use ||| if your quirks say you prefer single big message blocks.
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

        // Relationship growth logic — reward warmer, more engaged replies.
        const deltaMatch = reply.match(/\[RELATIONSHIP_DELTA:\s*([\+\-]?\d*(?:\.\d+)?)]/i);
        let delta = 0.4;
        if (deltaMatch) {
          delta = parseFloat(deltaMatch[1]);
          reply = reply.replace(/\[RELATIONSHIP_DELTA:\s*[\+\-]?\d*(?:\.\d+)?\]/gi, '').trim();
        }
        c.relationshipPct = Math.min(100, Math.max(0, (c.relationshipPct || 0) + delta));

        // Bot sticker sending logic
        let usedStickerUrl = null;
        const stickerMatch = reply.match(/\[USE_STICKER:(\d+)\]/i);
        if (stickerMatch) {
          const stkIdx = parseInt(stickerMatch[1], 10);
          if (c.savedStickers && c.savedStickers[stkIdx]) {
            usedStickerUrl = c.savedStickers[stkIdx].imgUrl;
          }
          reply = reply.replace(/\[USE_STICKER:\d+\]/gi, '').trim();
        }

        // Personality-based reaction probability
        const personalityLower = (c.personality || '').toLowerCase();
        const isAloof = personalityLower.includes('aloof') || personalityLower.includes('grumpy') || personalityLower.includes('cold') || personalityLower.includes('distant');
        const isJoyful = personalityLower.includes('joy') || personalityLower.includes('happy') || personalityLower.includes('cheerful') || personalityLower.includes('bubbly') || personalityLower.includes('excited');

        let reactionChance = 0.25;
        if (isAloof) reactionChance = 0.10;
        if (isJoyful) reactionChance = 0.45;

        if (Math.random() < reactionChance) {
          const rxns = ['❤️', '😂', '😮', '👍', '😢'];
          const botReaction = rxns[Math.floor(Math.random() * rxns.length)];
          const lastUserMsg = c.history[c.history.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user') lastUserMsg.reaction = botReaction;
        }

        // Split into multiple texts if the bot decided to double/triple-text.
        const chunks = reply.split('|||').map(t => t.trim()).filter(Boolean);
        await deliverBotMessages(c, chunks, typingBubble, usedStickerUrl);

      } catch (err) {
        typingBubble.innerText = "Error connecting to Groq API.";
      }
    }

    // Delivers one or more bot texts in sequence, each with its own short
    // "typing" pause. Reuses the already-visible typing bubble for the
    // first chunk, then shows fresh dots before each additional one.
    async function deliverBotMessages(c, chunks, firstTypingBubble, usedStickerUrl) {
      const isViewingThisChat = c.id === globalData.activeContactId;

      for (let i = 0; i < chunks.length; i++) {
        const text = chunks[i];
        const typingBubble = isViewingThisChat ? (i === 0 ? firstTypingBubble : appendTypingDots()) : null;

        // Shorter, snappier "typing" pause per message.
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
          typingBubble.innerText = text;
          saveData();
          renderHeader();
          renderMessages();
        } else {
          c.unreadCount = (c.unreadCount || 0) + 1;
          saveData();
          renderContacts();
        }
      }
    }

    // =========================================
    // PROACTIVE "THEY TEXT FIRST" SYSTEM
    // =========================================
    // Only runs while the app is open in the browser/PWA — there's no
    // real background push here, just a periodic check while the tab
    // is alive. Tweak these numbers to taste. Can be turned off entirely
    // from the ⋮ Global Settings menu.
    const PROACTIVE_CHECK_INTERVAL_MS = 60000;         // how often we roll the dice
    const PROACTIVE_MIN_QUIET_MS = 60 * 60 * 1000;      // contact must be quiet at least this long first (1 hour)
    const PROACTIVE_CHANCE = 0.15;                      // chance per check once eligible

    setInterval(checkForProactiveMessages, PROACTIVE_CHECK_INTERVAL_MS);

    async function checkForProactiveMessages() {
      if (!globalData.apiKey || document.hidden) return;
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

      const quietHours = quietForMs / (60 * 60 * 1000);
      // The longer the silence, the more it's allowed to read as
      // impatient/missing-you rather than just a casual check-in.
      const moodHint = quietHours >= 6
        ? `It's been a genuinely long time (${Math.round(quietHours)}+ hours) — you're allowed to sound a little impatient, dramatic, worried, or like you're teasing them for vanishing ("are you there??", "did you fall asleep on me?", "hellooo??"), IF that fits your personality. A more reserved character might instead sound quietly concerned or standoffish about it instead of dramatic.`
        : `It's only been about an hour — keep it light and casual, like a normal "thought of you" text, not a big dramatic gap.`;

      const systemPrompt = `
You are roleplaying as ${c.origName} in a custom SMS app. This time, YOU are texting ${u.name} first, out of the blue — they haven't messaged you in a while.

CHARACTER PROFILE:
- Personality: ${c.personality || 'Friendly'}
- Manner of Texting / Quirks: ${c.quirks || 'Texts naturally'}
- Backstory: ${c.backstory || 'None'}
- Physical Appearance: ${c.appearance || 'Not specified'}

RELATIONSHIP WARMTH LEVEL: ${c.relationshipPct || 0}% (out of 100%) — express this through the lens of your personality, not instead of it.

SILENCE CONTEXT: ${moodHint}

Write a short, natural, in-character text (or a couple, separated by |||, only if that fits your quirks) initiating contact — checking in, calling them out for going quiet, sharing something that happened to you, asking about them, whatever fits your world/personality and the silence context above. Do not greet like a stranger; you two know each other. Do NOT include any [RELATIONSHIP_DELTA] or other tags — just the text(s).
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
        // Fail silently — a missed proactive text isn't worth alarming the user over.
      }
    }

    function appendBubble(text, sender, autoScroll, index, isSticker = false, stickerUrl = '', reaction = null, seen = false, timestamp = null) {
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

      if (reaction) {
        const badge = document.createElement('div');
        badge.className = 'reaction-badge';
        badge.innerText = reaction;
        wrapper.appendChild(badge);
      }

      bubble.addEventListener('click', (e) => {
        e.stopPropagation();
        openReactionPicker(e, index);
      });

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
    // REACTIONS SYSTEM
    // =========================================
    function openReactionPicker(event, msgIndex) {
      selectedMsgIndex = msgIndex;
      const picker = document.getElementById('reaction-picker');
      const rect = event.currentTarget.getBoundingClientRect();
      const phoneRect = document.getElementById('phone-app').getBoundingClientRect();

      picker.style.top = `${rect.top - phoneRect.top - 38}px`;
      picker.style.left = `${Math.min(rect.left - phoneRect.left, 220)}px`;
      picker.style.display = 'flex';
    }

    function addReaction(emoji) {
      if (selectedMsgIndex === null) return;
      const c = getActiveContact();
      c.history[selectedMsgIndex].reaction = emoji;
      saveData();
      renderMessages();
      document.getElementById('reaction-picker').style.display = 'none';
    }

    document.addEventListener('click', () => {
      document.getElementById('reaction-picker').style.display = 'none';
      document.getElementById('quick-edit-pop').style.display = 'none';
    });

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
      const proactiveToggle = document.getElementById('gs-proactive-toggle');
      if (proactiveToggle) proactiveToggle.checked = globalData.proactiveTextsEnabled !== false;
      document.getElementById('global-settings-modal').style.display = 'flex';
    }

    function saveGlobalSettings() {
      globalData.apiKey = document.getElementById('gs-api-key').value.trim();
      const proactiveToggle = document.getElementById('gs-proactive-toggle');
      if (proactiveToggle) globalData.proactiveTextsEnabled = proactiveToggle.checked;
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


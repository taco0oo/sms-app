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
          savedStickers: []
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

    function renderMessages() {
      const c = getActiveContact();
      const chatBox = document.getElementById('chat-box');
      chatBox.innerHTML = '';

      // Only the most recent user message ever shows "Seen" (like real SMS apps).
      let lastUserIdx = -1;
      c.history.forEach((m, idx) => { if (m.role === 'user') lastUserIdx = idx; });

      c.history.forEach((m, idx) => {
        const showSeen = m.role === 'user' && idx === lastUserIdx && m.seen;
        appendBubble(m.content, m.role === 'user' ? 'user' : 'bot', false, idx, m.isSticker, m.stickerUrl, m.reaction, showSeen);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Adds a "Seen" label under the current last user bubble and removes
    // it from any earlier one (so only the newest reflects the read state).
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
      saveData();
      renderMessages();
      triggerAiResponse(`[User sent sticker: "${sticker.name}". Sticker mood/feeling description: ${sticker.desc}]`);
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
      appendBubble(text, 'user', true, c.history.length);
      input.value = '';
      c.history.push({ role: 'user', content: text, seen: false });
      saveData();

      triggerAiResponse(text);
    }

    // How long (ms) a contact can take before even "seeing" your message.
    // Tweak these two numbers to taste.
    const MIN_READ_DELAY_MS = 0;
    const MAX_READ_DELAY_MS = 15000;

    async function triggerAiResponse(latestUserText) {
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
      const delayContext = readDelaySeconds >= 7
        ? `You took about ${readDelaySeconds} seconds to notice and start replying to this text — a noticeably long gap for texting. There's a good chance you'd open with one short, natural line explaining what kept you busy in-world, fitting your personality/backstory/appearance above (e.g. what someone like you would plausibly be doing). Don't force this every time it happens, and keep it brief — it's a passing remark, not the whole reply.`
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
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (data.error) {
          typingBubble.innerText = "Error: " + data.error.message;
          return;
        }

        let reply = data.choices[0].message.content;

        // Relationship growth logic (slower: ~0.3% default per message)
        const deltaMatch = reply.match(/\[RELATIONSHIP_DELTA:\s*([\+\-]?\d*(?:\.\d+)?)]/i);
        let delta = 0.3;
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

        let botReaction = null;
        if (Math.random() < reactionChance) {
          const rxns = ['❤️', '😂', '😮', '👍', '😢'];
          botReaction = rxns[Math.floor(Math.random() * rxns.length)];
          const lastUserMsg = c.history[c.history.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user') lastUserMsg.reaction = botReaction;
        }

        // Base "typing" time, scaled up a bit and capped higher so longer
        // replies feel like they actually took effort to type out.
        const calculatedDelay = Math.min(Math.max(1200, reply.length * 35), 7000);

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

    function appendBubble(text, sender, autoScroll, index, isSticker = false, stickerUrl = '', reaction = null, seen = false) {
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

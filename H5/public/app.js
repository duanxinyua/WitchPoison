(() => {
  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  let socket = null;
  let state = null;
  let yourId = null;
  let yourPoison = null;
  let host = false;
  let roomId = '';
  let roomKey = '';
  let mode = null;
  let generating = false;
  const DEFAULT_EMOJI = '🙂';
  const STORAGE_KEY = 'witch_poison_profile';

  const el = (id) => document.getElementById(id);
  const statusEl = el('status');
  const systemMsgEl = el('systemMsg');
  const turnStatusEl = el('turnStatus');
  const boardEl = el('board');
  const playersEl = el('players');
  // 恢复表单信息
  hydrateProfile();

  el('chooseCreate').addEventListener('click', () => chooseMode('create'));
  el('chooseJoin').addEventListener('click', () => chooseMode('join'));
  el('backBtn').addEventListener('click', resetMode);
  el('connectBtn').addEventListener('click', connectRoom);
  el('startBtn').addEventListener('click', () => send({ type: 'start_game', roomId }));
  el('restartBtn').addEventListener('click', () => send({ type: 'restart_game', roomId }));
  el('leaveBtn').addEventListener('click', leaveRoom);
  el('randomRoomBtn').addEventListener('click', generateRoomId);
  el('randomNameBtn').addEventListener('click', () => {
    const name = randomName();
    el('playerName').value = name;
    statusEl.textContent = `已生成随机昵称：${name}`;
  });
  el('emojiDisplay').addEventListener('click', toggleEmojiList);
  el('roomLabel').addEventListener('click', copyRoomId);
  el('showRules').addEventListener('click', () => toggleRules(true));
  el('closeRules').addEventListener('click', () => toggleRules(false));
  el('emojiPicker').addEventListener('click', toggleEmojiList);
  ['roomId', 'roomKey', 'playerName', 'boardSize'].forEach((id) => {
    el(id).addEventListener('input', persistProfile);
  });

  function chooseMode(nextMode) {
    mode = nextMode;
    el('formArea').hidden = false;
    el('modeActions').classList.add('hidden');
    el('modeTitle').textContent = mode === 'create' ? '创建房间' : '加入房间';
    statusEl.textContent = '';
    updateFormMode();
    if (mode === 'create') {
      el('roomId').value = '';
      el('roomKey').value = '';
      persistProfile();
    } else if (mode === 'join') {
      restoreProfileForJoin();
    }
  }

  function resetMode() {
    mode = null;
    el('formArea').hidden = true;
    el('modeActions').classList.remove('hidden');
    statusEl.textContent = '';
    // 保留昵称/Emoji，清空房间相关字段
    el('roomId').value = '';
    el('roomKey').value = '';
    persistProfile();
  }

  function updateFormMode() {
    const boardField = el('boardSizeField');
    const randomRoomBtn = el('randomRoomBtn');
    if (mode === 'create') {
      boardField.classList.remove('hidden');
      el('connectBtn').textContent = '创建并加入';
      randomRoomBtn.disabled = false;
      randomRoomBtn.classList.remove('hidden');
    } else if (mode === 'join') {
      boardField.classList.add('hidden');
      el('connectBtn').textContent = '加入房间';
      randomRoomBtn.disabled = true;
      randomRoomBtn.classList.add('hidden');
    }
  }

  function connectRoom() {
    if (!mode) {
      statusEl.textContent = '请先选择创建或加入房间';
      return;
    }
    if (socket) socket.close();
    roomId = el('roomId').value.trim();
    roomKey = el('roomKey').value.trim();
    let name = el('playerName').value.trim();
    const emoji = el('playerEmoji').value.trim() || DEFAULT_EMOJI;
    if (!roomId) {
      statusEl.textContent = '房间号不能为空';
      return;
    }
    if (!name) {
      name = randomName();
      el('playerName').value = name;
      statusEl.textContent = `昵称为空，已自动生成：${name}`;
    }
    const boardSize = mode === 'create' ? Number(el('boardSize').value) || 6 : null;
    if (mode === 'create') {
      if (boardSize < 5 || boardSize > 10) {
        statusEl.textContent = '棋盘大小需在 5-10 之间';
        return;
      }
    }
    socket = new WebSocket(wsUrl);
    socket.addEventListener('open', () => {
      statusEl.textContent = '已连接，正在加入房间…';
      const payload = { type: 'join_room', roomId, roomKey, name, emoji };
      if (mode === 'create') payload.boardSize = boardSize;
      send(payload);
    });
    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    });
    socket.addEventListener('close', () => {
      statusEl.textContent = '连接已关闭';
      systemMsgEl.textContent = '连接关闭，请重新加入房间';
    });
    socket.addEventListener('error', () => {
      statusEl.textContent = '连接错误';
    });
    persistProfile();
  }

  async function generateRoomId() {
    if (mode !== 'create') {
      statusEl.textContent = '切到“创建房间”后可生成房间号';
      return;
    }
    if (generating) return;
    generating = true;
    statusEl.textContent = '生成房间号中…';
    try {
      const res = await fetch('/suggest-room');
      const data = await res.json();
      if (data.roomId) {
        el('roomId').value = data.roomId;
        statusEl.textContent = `已生成房间号：${data.roomId}`;
      } else {
        statusEl.textContent = '房间号生成失败，请重试';
      }
    } catch (e) {
      statusEl.textContent = '房间号生成失败，请检查网络';
    } finally {
      generating = false;
    }
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  function handleMessage(msg) {
    if (msg.type === 'error') {
      systemMsgEl.textContent = msg.message;
      return;
    }
    if (msg.type === 'left') {
      location.reload();
      return;
    }
    if (msg.type === 'joined') {
      yourId = msg.playerId;
      host = !!msg.host;
      el('connect-panel').hidden = true;
      el('game-panel').hidden = false;
      el('roomLabel').textContent = msg.roomId;
      statusEl.textContent = '已加入房间';
      return;
    }
    if (msg.type === 'state') {
      state = msg;
      yourPoison = msg.yourPoison || null;
      el('roomLabel').textContent = msg.roomId;
      el('boardLabel').textContent = `${msg.boardSize}×${msg.boardSize}`;
      el('yourEmoji').textContent = (state.players.find(p => p.id === yourId)?.emoji) || '❓';
      renderPlayers();
      renderBoard();
      renderStatus();
    }
  }

  function renderPlayers() {
    playersEl.innerHTML = '';
    state.players.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card';
      if (!p.alive) card.classList.add('dead');
      if (p.host) card.classList.add('host');
      card.innerHTML = `
        <div class="name">${p.emoji} ${p.name}</div>
        <div class="meta">${p.alive ? '存活' : '出局'} · ${p.ready ? '已放毒药' : '未放毒药'}${p.host ? ' · 主持人' : ''}</div>
      `;
      playersEl.appendChild(card);
    });
  }

  function renderBoard() {
    const size = state.boardSize;
    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    boardEl.innerHTML = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        const cell = document.createElement('div');
        cell.className = 'cell';
        const reveal = state.reveals.find(x => x.cell === key);
        const hit = state.poisonHits.includes(key);
        if (reveal || hit) cell.classList.add('revealed');
        if (hit) cell.classList.add('poison');
        if (yourPoison === key && !hit) cell.classList.add('your-poison');
        if (reveal) cell.textContent = findPlayerEmoji(reveal.by);
        if (hit) cell.textContent = '☠️';
        cell.addEventListener('click', () => onCellClick(key, hit || !!reveal));
        boardEl.appendChild(cell);
      }
    }
  }

  function onCellClick(key, disabled) {
    if (!state) return;
    if (state.winnerId || state.draw) return;
    if (!state.started) {
      // 选毒药
      send({ type: 'place_poison', roomId, cell: key });
      systemMsgEl.textContent = `已选择毒药格 ${formatCell(key)}`;
      return;
    }
    if (disabled) {
      systemMsgEl.textContent = '此格已翻开';
      return;
    }
    send({ type: 'reveal_cell', roomId, cell: key });
  }

  function renderStatus() {
    const current = state.players.find(p => p.id === state.currentPlayerId);
    const you = state.players.find(p => p.id === yourId);
    const winner = state.players.find(p => p.id === state.winnerId);
    const restartBtn = el('restartBtn');
    const leaveBtn = el('leaveBtn');
    if (!state.started) {
      turnStatusEl.textContent = you?.host ? '你是主持人，可在所有人放好毒药后开始' : '等待主持人开始';
      el('startBtn').hidden = !you?.host;
      el('startBtn').disabled = !state.players.every(p => p.ready) || state.players.length < 2;
      restartBtn.hidden = true;
      leaveBtn.hidden = false;
    } else {
      el('startBtn').hidden = true;
      restartBtn.hidden = !(state.finished && you?.host);
      restartBtn.disabled = !you?.host;
      leaveBtn.hidden = false;
      if (state.draw) {
        turnStatusEl.textContent = '平局：剩余未翻格均为毒药';
      } else if (winner) {
        turnStatusEl.textContent = `胜者：${winner.emoji} ${winner.name}`;
      } else {
        turnStatusEl.textContent = current ? `轮到 ${current.emoji} ${current.name}` : '';
      }
    }
  }

  function findPlayerEmoji(id) {
    const p = state.players.find(x => x.id === id);
    return p ? p.emoji : '❓';
  }

  function toggleRules(show) {
    el('rulesPanel').hidden = !show;
  }

  function leaveRoom() {
    send({ type: 'leave_room', roomId });
    // 防止 ws 异常，3 秒后强制刷新
    setTimeout(() => location.reload(), 3000);
  }

  function toggleEmojiList() {
    const list = el('emojiList');
    if (!list.dataset.built) {
      buildEmojiList();
      list.dataset.built = '1';
    }
    list.hidden = !list.hidden;
  }

  function buildEmojiList() {
    const list = el('emojiList');
    const emojis = ['🧙','🪄','🧪','🕯️','🧟','🧞','🐱','🐺','🦉','🦂','🦇','🌙','⭐','🔥','🌿','🍄','☠️','💀'];
    list.innerHTML = '';
    emojis.forEach((emo) => {
      const btn = document.createElement('div');
      btn.className = 'emoji-item';
      btn.textContent = emo;
      btn.addEventListener('click', () => {
        el('playerEmoji').value = emo;
        list.hidden = true;
        setEmoji(emo);
        statusEl.textContent = `已选择标识 ${emo}`;
        persistProfile();
      });
      list.appendChild(btn);
    });
  }

  function setEmoji(emo) {
    el('playerEmoji').value = emo;
    el('emojiDisplay').textContent = emo;
    el('emojiBadge').textContent = emo;
    persistProfile();
  }

  function persistProfile() {
    try {
      const data = {
        roomId: el('roomId').value.trim(),
        roomKey: el('roomKey').value.trim(),
        name: el('playerName').value.trim(),
        emoji: el('playerEmoji').value.trim() || DEFAULT_EMOJI,
        boardSize: el('boardSize').value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  }

  function hydrateProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setEmoji(DEFAULT_EMOJI);
        return;
      }
      const data = JSON.parse(raw);
      if (data.roomId) el('roomId').value = data.roomId;
      if (data.roomKey) el('roomKey').value = data.roomKey;
      if (data.name) el('playerName').value = data.name;
      if (data.boardSize) el('boardSize').value = data.boardSize;
      setEmoji(data.emoji || DEFAULT_EMOJI);
    } catch (e) {
      setEmoji(DEFAULT_EMOJI);
    }
  }

  function restoreProfileForJoin() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.name) el('playerName').value = data.name;
      setEmoji(data.emoji || DEFAULT_EMOJI);
    } catch (e) {
      // ignore
    }
  }

  function copyRoomId() {
    const id = el('roomLabel').textContent.trim();
    if (!id) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(() => {
        statusEl.textContent = `房间号已复制：${id}`;
      }).catch(() => {
        statusEl.textContent = '复制失败，请手动选择房间号复制';
      });
    } else {
      statusEl.textContent = '浏览器不支持一键复制，请手动复制';
    }
  }

  function formatCell(key) {
    const [r, c] = key.split(',').map((v) => parseInt(v, 10));
    if (Number.isNaN(r) || Number.isNaN(c)) return key;
    return `${r + 1},${c + 1}`;
  }

  function randomName() {
    const pool = [
      '银月女巫', '黑猫术士', '星火炼金', '迷雾使者', '夜莺占卜',
      '花火药师', '时钟咒师', '深林行者', '风暴调剂', '影子配方',
    ];
    const suffix = Math.floor(Math.random() * 90) + 10; // 2 位数字
    const base = pool[Math.floor(Math.random() * pool.length)];
    return `${base}${suffix}`;
  }
})();

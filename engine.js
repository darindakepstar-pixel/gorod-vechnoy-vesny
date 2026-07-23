/* ============================================================
   ДВИЖОК. Сюжет тут не живёт — он в scenes.js.
   ============================================================ */

const Game = (() => {

const $ = id => document.getElementById(id);
const LS = 'gvv_';
const ART = (window.CONFIG && CONFIG.artBase) ? CONFIG.artBase : 'art/';

let state, typing = null, typeFull = '', typeDone = null,
    speed = 22, debugOn = false, playerId = null, nickname = '',
    cardTimer = null, cardAfter = null;

const STAT_NAMES = { lang:'китайский', money:'деньги', rep:'репутация' };

/* ---------- хранилище: локально + облако ---------- */
const Cloud = {
  ready: false, sb: null,
  async init(){
    if(!window.CONFIG || !CONFIG.supabaseUrl || CONFIG.supabaseUrl.includes('ВСТАВЬ')) return;
    try{
      const m = await import('https://esm.sh/@supabase/supabase-js@2');
      this.sb = m.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
      this.ready = true;
    }catch(e){ console.warn('Облако недоступно, играем локально', e); }
  },
  async register(id, nick){
    if(!this.ready) return;
    try{ await this.sb.from('players').upsert({id, nickname:nick}); }catch(e){}
  },
  async push(slot, data){
    if(!this.ready || !playerId) return;
    try{ await this.sb.from('saves').upsert({player_id:playerId, slot, state:data, updated_at:new Date()}); }catch(e){}
  },
  async pull(slot){
    if(!this.ready || !playerId) return null;
    try{
      const {data} = await this.sb.from('saves').select('state').eq('player_id',playerId).eq('slot',slot).maybeSingle();
      return data ? data.state : null;
    }catch(e){ return null; }
  },
  async ending(id){
    if(!this.ready || !playerId) return;
    try{ await this.sb.from('endings').upsert({player_id:playerId, ending_id:id}); }catch(e){}
  }
};

/* ---------- состояние ---------- */
function fresh(){
  return { scene:'ch1_01', love:{lei:0,tank:0,shen:0},
           stats:{lang:0, money:0, rep:0}, flags:[], chapter:'', log:[] };
}

/* ---------- статы и всплывающие уведомления ---------- */
function paintStats(){
  $('stats').innerHTML = Object.keys(STAT_NAMES)
    .map(k => `<div class="stat">${STAT_NAMES[k]}<b>${state.stats[k]}</b></div>`).join('');
}

function toast(txt){
  const d = document.createElement('div');
  d.className = 'tmsg'; d.textContent = txt;
  $('toast').appendChild(d);
  setTimeout(() => d.remove(), 2000);
}

function applyStats(obj){
  for(const k in obj){
    if(!(k in state.stats)) continue;
    state.stats[k] += obj[k];
    toast(`${STAT_NAMES[k]} ${obj[k] > 0 ? '+' : ''}${obj[k]}`);
  }
  paintStats();
}

/* ---------- переходная карточка ---------- */
function showCard(c, after){
  cardAfter = after;
  $('cardcn').textContent = c.cn || '';
  $('carden').textContent = c.en || '';
  $('cardline').style.display = (c.lines && c.lines.length) ? '' : 'none';
  $('cardlines').innerHTML = (c.lines || []).map(l => `<div>${l}</div>`).join('');
  const el = $('card');
  el.classList.add('on');
  requestAnimationFrame(() => el.classList.add('vis'));
  cardTimer = setTimeout(skipCard, 2800);
}

function skipCard(){
  if(!cardAfter) return;
  clearTimeout(cardTimer); cardTimer = null;
  const el = $('card');
  el.classList.remove('vis');
  const go = cardAfter; cardAfter = null;
  setTimeout(() => { el.classList.remove('on'); go(); }, 500);
}

/* ---------- отрисовка ---------- */
function paintBG(key){
  const b = BACKGROUNDS[key];
  const el = $('bg');
  if(!b){ el.style.background = '#222'; return; }
  /* Ищем art/bg_ключ.jpg. Пока файла нет — используется заливка из scenes.js. */
  el.style.background = b.css;
  const probe = new Image();
  probe.onload = () => { el.style.background = `url(${ART}bg_${key}.jpg) center/cover no-repeat`; };
  probe.src = ART + 'bg_' + key + '.jpg';
}

function paintItems(list){
  const box = $('items');
  const key = JSON.stringify(list || null);
  if(box.dataset.cur === key) return;
  box.dataset.cur = key;
  if(!list || !list.length){ box.innerHTML=''; return; }
  box.innerHTML = list.map(it =>
    `<img class="item ${it.pos || 'right'} ${it.big ? 'big' : ''}"
          src="${ART}item_${it.img}.png" alt=""
          onerror="this.style.display='none'">`).join('');
}

function paintCG(name){
  const el = $('cg');
  if(!name){ el.classList.remove('on'); el.style.backgroundImage=''; el.dataset.cur=''; return; }
  if(el.dataset.cur === name) return;
  el.dataset.cur = name;
  el.style.backgroundImage = `url(${ART}cg_${name}.jpg)`;
  el.classList.add('on');
}

function paintSprite(sp){
  const box = $('sprites');
  if(!sp){ box.innerHTML=''; box.dataset.cur=''; return; }
  const c = CHARS[sp.char];
  if(!c){ box.innerHTML=''; box.dataset.cur=''; return; }
  if(box.dataset.cur === sp.char + sp.emo) return;
  box.dataset.cur = sp.char + sp.emo;

  /* Ищем art/имя_эмоция.png. Если файла нет — показываем заглушку. */
  box.innerHTML = `<img class="sprite-img" src="${ART}${sp.char}_${sp.emo}.png"
      alt="${c.name}" onerror="Game.spriteFallback(this,'${sp.char}','${sp.emo}')">`;
}

function spriteFallback(img, char, emo){
  const want = img.dataset.want || emo;
  /* нужной эмоции нет — пробуем нейтральную того же персонажа */
  if(emo !== 'neutral'){
    img.dataset.want = want;
    img.setAttribute('onerror', `Game.spriteFallback(this,'${char}','neutral')`);
    img.src = ART + char + '_neutral.png';
    return;
  }
  const c = CHARS[char];
  img.outerHTML = `<div class="sprite" style="background:linear-gradient(180deg,${c.color}cc,${c.color}66)">
      <div class="nm">${c.name}</div>
      <div class="emo">${want}</div>
      <div class="ph">заглушка<br>нет файла ${char}_${want}.png</div>
    </div>`;
}

function paintDebug(){
  if(!debugOn) return;
  $('debug').innerHTML =
    `<b>симпатия</b><br>Лэй: ${state.love.lei}<br>Танк: ${state.love.tank}<br>Шэнь: ${state.love.shen}
     <br><b>сцена</b><br>${state.scene}
     <br><b>флаги</b><br>${state.flags.length ? state.flags.join('<br>') : '—'}`;
}

/* ---------- показ сцены ---------- */
function show(id){
  const s = SCENES[id];
  if(!s){ console.error('Нет сцены:', id); return; }
  state.scene = id;

  if(s.chapter){ state.chapter = s.chapter; }
  $('chapter').textContent = state.chapter;

  paintBG(s.bg);
  paintCG(s.cg);
  paintItems(s.items);
  paintSprite(s.cg ? null : s.sprite);   /* на иллюстрации персонажи уже нарисованы */

  if(s.who){ $('namebox').textContent = s.who; $('namebox').classList.remove('hidden'); $('textbox').classList.remove('plain'); }
  else { $('namebox').classList.add('hidden'); $('textbox').classList.add('plain'); }

  if(s.love) applyLove(s.love);
  if(s.flags) s.flags.forEach(f => { if(!state.flags.includes(f)) state.flags.push(f); });

  state.log.push({who:s.who||'', text:s.text});
  if(state.log.length > 400) state.log.shift();

  if(s.stats) applyStats(s.stats);

  $('choices').innerHTML = '';
  const runText = () => type(s.text, () => {
    if(s.choices) renderChoices(s.choices);
    else if(s.ending){ Cloud.ending(id); renderChoices([{text:'Вернуться на титул', next:'__title'}]); }
  });
  if(s.card){ $('text').textContent = ''; showCard(s.card, runText); } else runText();

  paintDebug();
  autosave();
}

function applyLove(obj){
  for(const k in obj) if(k in state.love) state.love[k] += obj[k];
}

function renderChoices(list){
  const box = $('choices');
  box.innerHTML = '';
  list.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = ch.text;
    b.onclick = e => {
      e.stopPropagation();
      if(ch.love) applyLove(ch.love);
      if(ch.stats) applyStats(ch.stats);
      if(ch.flags) ch.flags.forEach(f => { if(!state.flags.includes(f)) state.flags.push(f); });
      if(ch.next === '__title') return toTitle();
      box.innerHTML = '';
      show(ch.next);
    };
    box.appendChild(b);
  });
}

/* ---------- печать по буквам ---------- */
function type(txt, done){
  clearInterval(typing); typing = null;
  typeFull = txt; typeDone = done;
  const el = $('text');
  $('caret').style.display = 'none';
  if(speed <= 0){ el.textContent = txt; $('caret').style.display=''; done && done(); return; }
  el.textContent = '';
  let i = 0;
  typing = setInterval(() => {
    el.textContent += txt[i++];
    if(i >= txt.length){
      clearInterval(typing); typing = null;
      $('caret').style.display='';
      typeDone && typeDone();
    }
  }, 60 - speed);
}

function advance(e){
  if(cardAfter){ skipCard(); return; }
  if(e && e.target.classList.contains('choice')) return;
  if(typing){
    clearInterval(typing); typing = null;
    $('text').textContent = typeFull;
    $('caret').style.display='';
    typeDone && typeDone();
    return;
  }
  if($('choices').children.length) return;
  const s = SCENES[state.scene];
  if(s && s.next) show(s.next);
}

/* ---------- сохранения ---------- */
function autosave(){ localStorage.setItem(LS+'auto', JSON.stringify(state)); Cloud.push('auto', state); }

function save(slot){
  localStorage.setItem(LS+slot, JSON.stringify(state));
  Cloud.push(slot, state);
  alert('Сохранено.');
}

async function load(slot){
  let raw = await Cloud.pull(slot);
  if(!raw){ const l = localStorage.getItem(LS+slot); raw = l ? JSON.parse(l) : null; }
  if(!raw){ alert('Пустой слот.'); return; }
  state = raw;
  if(!state.stats) state.stats = {lang:0, money:0, rep:0};
  paintStats();
  closeAll();
  $('title').style.display = 'none';
  show(state.scene);
}

/* ---------- запуск ---------- */
async function start(cont){
  nickname = ($('nick').value || 'без имени').trim();
  localStorage.setItem(LS+'nick', nickname);
  playerId = localStorage.getItem(LS+'pid');
  if(!playerId){ playerId = crypto.randomUUID(); localStorage.setItem(LS+'pid', playerId); }
  Cloud.register(playerId, nickname);

  if(cont){ await load('auto'); return; }
  state = fresh();
  paintStats();
  $('title').style.display = 'none';
  show(state.scene);
}

function toTitle(){ closeAll(); $('title').style.display='flex'; }
function openMenu(){ $('menu').classList.add('on'); }
function openLog(){
  $('logbody').innerHTML = state.log.slice(-120).map(l =>
    `<div class="logline">${l.who ? '<b>'+l.who+':</b> ' : ''}${l.text}</div>`).join('');
  $('log').classList.add('on');
}
function closeAll(){ document.querySelectorAll('.overlay').forEach(o => o.classList.remove('on')); }
function setSpeed(v){ speed = +v; localStorage.setItem(LS+'speed', v); }
function toggleDebug(){ debugOn = !debugOn; $('debug').classList.toggle('on', debugOn); paintDebug(); }

/* ---------- инициализация ---------- */
(async function(){
  state = fresh();
  const n = localStorage.getItem(LS+'nick'); if(n) $('nick').value = n;
  const sp = localStorage.getItem(LS+'speed'); if(sp){ speed = +sp; $('speed').value = sp; }
  /* фон титульного экрана, если картинка есть */
  const tbg = new Image();
  tbg.onload = () => { $('title').style.backgroundImage = `url(${ART}bg_title.jpg)`; };
  tbg.src = ART + 'bg_title.jpg';

  await Cloud.init();
  $('cloudstate').textContent = Cloud.ready ? 'облако подключено' : 'локальный режим';
  document.addEventListener('keydown', e => {
    if(e.code === 'Space' || e.code === 'Enter') advance();
    if(e.code === 'KeyD') toggleDebug();
  });
})();

return { start, advance, save, load, openMenu, openLog, closeAll, setSpeed, toggleDebug, toTitle, spriteFallback, skipCard };
})();

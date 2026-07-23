/* ============================================================
   ДВИЖОК. Сюжет тут не живёт — он в scenes.js.
   ============================================================ */

const Game = (() => {

const $ = id => document.getElementById(id);
const LS = 'gvv_';

let state, typing = null, typeFull = '', typeDone = null,
    speed = 22, debugOn = false, playerId = null, nickname = '';

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
  return { scene:'ch1_01', love:{lei:0,tank:0,shen:0}, flags:[], chapter:'', log:[] };
}

/* ---------- отрисовка ---------- */
function paintBG(key){
  const b = BACKGROUNDS[key];
  $('bg').style.background = b ? b.css : '#222';
}

function paintSprite(sp){
  const box = $('sprites');
  if(!sp){ box.innerHTML=''; return; }
  const c = CHARS[sp.char];
  if(!c){ box.innerHTML=''; return; }
  if(box.dataset.cur === sp.char + sp.emo) return;
  box.dataset.cur = sp.char + sp.emo;
  box.innerHTML = `<div class="sprite" style="background:linear-gradient(180deg,${c.color}cc,${c.color}66)">
      <div class="nm">${c.name}</div>
      <div class="emo">${sp.emo}</div>
      <div class="ph">заглушка<br>сюда придёт твой рисунок</div>
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
  paintSprite(s.sprite);

  if(s.who){ $('namebox').textContent = s.who; $('namebox').classList.remove('hidden'); $('textbox').classList.remove('plain'); }
  else { $('namebox').classList.add('hidden'); $('textbox').classList.add('plain'); }

  if(s.love) applyLove(s.love);
  if(s.flags) s.flags.forEach(f => { if(!state.flags.includes(f)) state.flags.push(f); });

  state.log.push({who:s.who||'', text:s.text});
  if(state.log.length > 400) state.log.shift();

  $('choices').innerHTML = '';
  type(s.text, () => {
    if(s.choices) renderChoices(s.choices);
    else if(s.ending){ Cloud.ending(id); renderChoices([{text:'Вернуться на титул', next:'__title'}]); }
  });

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
  await Cloud.init();
  $('cloudstate').textContent = Cloud.ready ? 'облако подключено' : 'локальный режим';
  document.addEventListener('keydown', e => {
    if(e.code === 'Space' || e.code === 'Enter') advance();
    if(e.code === 'KeyD') toggleDebug();
  });
})();

return { start, advance, save, load, openMenu, openLog, closeAll, setSpeed, toggleDebug, toTitle };
})();

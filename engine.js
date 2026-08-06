/* ============================================================
   ДВИЖОК. Сюжет тут не живёт — он в scenes.js.
   ============================================================ */

const Game = (() => {

const $ = id => document.getElementById(id);
const LS = 'gvv_';
const ART = (window.CONFIG && CONFIG.artBase) ? CONFIG.artBase : 'art/';

/* ---------- кэш картинок ----------
   Каждый файл грузится один раз. Промис помнит, получилось или нет,
   чтобы движок заранее знал, есть ли такая картинка вообще. */
const imgCache = new Map();
function ensure(url){
  if(imgCache.has(url)) return imgCache.get(url);
  const pr = new Promise(res => {
    const im = new Image();
    im.onload  = () => res(true);
    im.onerror = () => res(false);
    im.src = url;
  });
  imgCache.set(url, pr);
  return pr;
}
const okCache = new Map();
async function has(url){
  if(okCache.has(url)) return okCache.get(url);
  const r = await ensure(url); okCache.set(url, r); return r;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- облако ----------
   Если cloud.js не подключён, подставляем заглушку: игра должна
   работать локально, а не падать целиком. */
/* ---------- активная история ---------- */
let STORY = null, SCENES = {}, CHARS = {}, BACKGROUNDS = {};
function loadStory(sid){
  const s = (window.STORIES || {})[sid];
  if(!s) return false;
  STORY = s; SCENES = s.scenes; CHARS = s.chars; BACKGROUNDS = s.backgrounds;
  document.documentElement.style.setProperty('--pink', s.accent || '#ff7ab8');
  return true;
}

const CLOUD_MISSING = (typeof Cloud === 'undefined');
const CL = CLOUD_MISSING ? {
  init:()=>false, on:()=>false, user:()=>null,
  push:()=>{}, pull:async()=>null, markEnding:()=>{},
  myStats:async()=>null, leaderboard:async()=>[],
  signIn(){ throw new Error('Файл cloud.js не найден.'); },
  signUp(){ throw new Error('Файл cloud.js не найден.'); },
  signOut(){}
} : Cloud;

/* какие файлы нужны сцене */
function sceneAssets(s){
  const a = [];
  if(s.bg) a.push(ART + 'bg_' + s.bg + '.jpg');
  if(s.cg) a.push(ART + 'cg_' + s.cg + '.jpg');
  if(s.sprite) a.push(ART + spriteFile(s.sprite.char) + '_' + s.sprite.emo + '.png',
                      ART + spriteFile(s.sprite.char) + '_neutral.png');
  if(s.items) s.items.forEach(i => a.push(ART + 'item_' + i.img + '.png'));
  return a;
}

/* подтягиваем всё, куда сцена может привести */
function prefetchNext(s){
  const next = [];
  if(s.next) next.push(s.next);
  if(s.choices) s.choices.forEach(c => c.next && next.push(c.next));
  next.forEach(id => { const n = SCENES[id]; if(n) sceneAssets(n).forEach(ensure); });
}

/* фоновая догрузка всего остального, когда движок простаивает */
function preloadAll(){
  const all = new Set();
  Object.values(SCENES).forEach(s => sceneAssets(s).forEach(u => all.add(u)));
  const list = [...all]; let i = 0;
  (function step(){
    if(i >= list.length) return;
    ensure(list[i++]).then(() => setTimeout(step, 60));
  })();
}

let state, typing = null, typeFull = '', typeDone = null,
    speed = 22, debugOn = false, playerId = null, nickname = '',
    cardTimer = null, cardAfter = null;

/* статы и симпатия берём из активной истории (STORY.stats / STORY.love) */
function statList(){ return (STORY && STORY.stats) ? STORY.stats : []; }
function loveList(){ return (STORY && STORY.love) ? STORY.love : []; }
function statName(k){ const s=statList().find(x=>x.key===k); return s?s.name:null; }
function loveName(k){ const l=loveList().find(x=>x.key===k); return l?l.name:null; }
function autoSlot(){ return 'auto_' + (STORY ? STORY.id : 'x'); }

/* ---------- состояние ---------- */
function fresh(){
  const st={}, lv={};
  statList().forEach(s => st[s.key]=0);
  loveList().forEach(l => lv[l.key]=0);
  return { story: STORY ? STORY.id : 'kunming',
           scene: STORY ? STORY.start : 'ch1_01',
           love: lv, stats: st, flags:[], chapter:'',
           log:[], seen:[], playedMs:0 };
}

function totalScenes(){ return Object.keys(SCENES).length; }

/* ---------- статы и всплывающие уведомления ---------- */
function paintStats(){
  $('stats').innerHTML = statList()
    .map(s => `<div class="stat">${s.name}<b>${(state.stats && state.stats[s.key]) || 0}</b></div>`).join('');
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
    toast(`${statName(k) || k} ${obj[k] > 0 ? '+' : ''}${obj[k]}`);
  }
  paintStats();
}

/* ---------- мини-игры ---------- */
let gameAfter = null;

function offerGame(cfg, after){
  const g = (window.MINIGAMES || {})[cfg.type];
  if(!g){ after(); return; }                 /* игры нет — просто идём дальше */
  const box = $('choices');
  const b = document.createElement('button');
  b.className = 'mg-start';
  b.textContent = cfg.label || ('Играть: ' + (g.title || cfg.type));
  b.onclick = ev => { ev.stopPropagation(); runGame(cfg, after); };
  box.appendChild(b);
  if(cfg.skippable !== false){
    const s = document.createElement('button');
    s.className = 'choice';
    s.textContent = cfg.skipLabel || 'Не сейчас';
    s.onclick = ev => { ev.stopPropagation(); box.innerHTML = ''; after(); };
    box.appendChild(s);
  }
}

function runGame(cfg, after){
  const g = MINIGAMES[cfg.type];
  gameAfter = after;
  $('choices').innerHTML = '';
  $('mgame').classList.add('on');
  g.mount($('mgbox'), cfg, res => {
    $('mgame').classList.remove('on');
    $('mgbox').innerHTML = '';
    gameAfter = null;
    const rew = cfg.reward || (g.reward ? g.reward(res) : null);
    if(rew) applyStats(rew);
    if(res.success && cfg.flag && !state.flags.includes(cfg.flag)) state.flags.push(cfg.flag);
    if(cfg.love) applyLove(cfg.love);
    autosave();
    after(res);
  });
}

function quitGame(){
  $('mgame').classList.remove('on');
  $('mgbox').innerHTML = '';
  const go = gameAfter; gameAfter = null;
  if(go) go({ success:false, score:0, max:0 });
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

/* имя файла спрайта: из CHARS[char].file или сам char */
function spriteFile(char){ const c=CHARS[char]; return (c && c.file) ? c.file : char; }

/* ---------- отрисовка ---------- */
async function paintBG(key){
  const b = BACKGROUNDS[key];
  const el = $('bg');
  if(!b){ el.style.background = '#222'; return; }
  const url = ART + (b.img || ('bg_' + key + '.jpg'));
  if(await has(url)) el.style.background = `url(${url}) center/cover no-repeat`;
  else el.style.background = b.css || '#222';   /* картинки нет — заливка */
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
  box.innerHTML = `<img class="sprite-img" src="${ART}${spriteFile(sp.char)}_${sp.emo}.png"
      alt="${c.name}" onerror="Game.spriteFallback(this,'${sp.char}','${sp.emo}')">`;
}

function spriteFallback(img, char, emo){
  const want = img.dataset.want || emo;
  /* нужной эмоции нет — пробуем нейтральную того же персонажа */
  if(emo !== 'neutral'){
    img.dataset.want = want;
    img.setAttribute('onerror', `Game.spriteFallback(this,'${char}','neutral')`);
    img.src = ART + spriteFile(char) + '_neutral.png';
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
  const love = loveList().map(l => `${l.name}: ${state.love[l.key]||0}`).join('<br>') || '—';
  const stat = statList().map(s => `${s.name}: ${state.stats[s.key]||0}`).join(' · ') || '—';
  $('debug').innerHTML =
    `<b>симпатия</b><br>${love}<br><b>статы</b><br>${stat}
     <br><b>сцена</b><br>${state.scene}
     <br><b>флаги</b><br>${state.flags.length ? state.flags.slice(-6).join('<br>') : '—'}`;
}

/* ---------- показ сцены ---------- */
async function show(id){
  const s = SCENES[id];
  if(!s){ console.error('Нет сцены:', id); return; }
  state.scene = id;

  /* картинки этой сцены грузим ДО текста, но не дольше полутора секунд,
     чтобы игра не зависла на плохой связи */
  const assets = Promise.all(sceneAssets(s).map(ensure));
  if(!s.card) await Promise.race([assets, wait(1500)]);

  if(s.chapter){ state.chapter = s.chapter; }
  $('chapter').textContent = state.chapter;

  await paintBG(s.bg);
  paintCG(s.cg);
  paintItems(s.items);
  paintSprite(s.cg ? null : s.sprite);   /* на иллюстрации персонажи уже нарисованы */

  if(s.who){ $('namebox').textContent = s.who; $('namebox').classList.remove('hidden'); $('textbox').classList.remove('plain'); }
  else { $('namebox').classList.add('hidden'); $('textbox').classList.add('plain'); }

  if(s.love) applyLove(s.love);
  if(s.flags) s.flags.forEach(f => { if(!state.flags.includes(f)) state.flags.push(f); });

  if(!state.seen) state.seen = [];
  if(!state.seen.includes(id)) state.seen.push(id);
  state.log.push({who:s.who||'', text:s.text});
  if(state.log.length > 400) state.log.shift();

  if(s.stats) applyStats(s.stats);

  /* route: [{require:{...}, next:'...'}, ...] — первая подходящая ветка.
     Позволяет сцене без выбора уйти по накопленным статам. */
  if(s.route){
    for(const r of s.route){
      if(meetsReq(r.require)){ if(r.next) return show(r.next); break; }
    }
  }

  $('choices').innerHTML = '';
  const runText = () => type(s.text, () => {
    if(s.game){ offerGame(s.game, () => { if(s.next) show(s.next); }); return; }
    if(s.choices) renderChoices(s.choices);
    else if(s.ending){ CL.markEnding(id); renderChoices([{text:'Вернуться на титул', next:'__title'}]); }
  });
  if(s.card){
    /* карточка перехода заодно прикрывает загрузку */
    $('text').textContent = '';
    showCard(s.card, runText);
    assets.then(() => {});
  } else runText();
  prefetchNext(s);

  paintDebug();
  autosave();
}

function applyLove(obj){
  for(const k in obj) if(k in state.love) state.love[k] += obj[k];
}

/* проверка требования вида require:{lang:3} или require:{rep:5,lang:2} */
function meetsReq(req){
  if(!req) return true;
  for(const k in req){
    if(k in state.stats){ if(state.stats[k] < req[k]) return false; }
    else if(k in state.love){ if(state.love[k] < req[k]) return false; }
  }
  return true;
}
function reqLabel(req){
  return Object.keys(req).map(k => {
    const n = statName(k) || (loveName(k) ? 'близость: ' + loveName(k) : k);
    return `${n} ${req[k]}+`;
  }).join(', ');
}

function renderChoices(list){
  const box = $('choices');
  box.innerHTML = '';
  list.forEach(ch => {
    const ok = meetsReq(ch.require);
    const b = document.createElement('button');
    b.className = 'choice' + (ok ? '' : ' locked');
    if(ok){
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
    } else {
      b.innerHTML = `<span class="lock-ic">🔒</span>${ch.text}
        <span class="lock-req">нужно: ${reqLabel(ch.require)}</span>`;
      b.disabled = true;
    }
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
  if($('mgame').classList.contains('on')) return;
  const s = SCENES[state.scene];
  if(s && s.next) show(s.next);
}

/* ---------- сохранения ---------- */
function autosave(){
  const slot = autoSlot();
  localStorage.setItem(LS+slot, JSON.stringify(state));
  CL.push(slot, state);
  CL.push('auto', state);   /* общий слот для доски «кто как далеко» */
}

/* счётчик времени в игре */
let tick = null;
function startClock(){
  clearInterval(tick);
  tick = setInterval(() => {
    if($('title').style.display !== 'none') return;
    state.playedMs = (state.playedMs || 0) + 10000;
  }, 10000);
}

function save(slot){
  localStorage.setItem(LS+slot, JSON.stringify(state));
  CL.push(slot, state);
  alert('Сохранено.');
}

async function load(slot){
  let raw = await CL.pull(slot);
  if(!raw){ const l = localStorage.getItem(LS+slot); raw = l ? JSON.parse(l) : null; }
  if(!raw){ alert('Пустой слот.'); return; }
  state = raw;
  if(state.story && (!STORY || STORY.id !== state.story)) loadStory(state.story);
  if(!state.stats) state.stats = {lang:0, money:0, rep:0};
  if(!state.seen) state.seen = [];
  paintStats();
  closeAll();
  $('title').style.display = 'none';
  show(state.scene);
}

/* ---------- запуск ---------- */
function captureName(){
  if(!CL.on()){
    nickname = (($('nick2') && $('nick2').value) || localStorage.getItem(LS+'nick') || 'без имени').trim();
    localStorage.setItem(LS+'nick', nickname);
  }
}

/* остаётся для меню и «начать заново» — работает с текущей историей */
async function start(cont){
  const id = STORY ? STORY.id : 'kunming';
  return cont ? continueStory(id) : newStory(id);
}

function newStory(id){
  pickStoryQuiet(id);
  captureName();
  state = fresh();
  paintStats();
  $('title').style.display = 'none';
  startClock();
  show(state.scene);
}

async function continueStory(id){
  pickStoryQuiet(id);
  captureName();
  await load(autoSlot());        /* load сам прячет титул и показывает сцену */
  startClock();
}

function confirmRestart(id){
  if(confirm('Начать эту историю заново? Сохранение по ней перезапишется.')) newStory(id);
}

function pickStoryQuiet(id){
  const s = (window.STORIES||{})[id];
  if(s && !s.soon){ loadStory(id); setTitleBg(); }
}

function setTitleBg(){
  const f = (STORY && (STORY.titleBg || STORY.cover)) || 'bg_title.jpg';
  const im = new Image();
  im.onload = () => { $('title').style.backgroundImage = `url(${ART}${f})`; };
  im.src = ART + f;
}

/* ---------- вход и профиль ---------- */
function authErr(msg){ $('autherr').textContent = msg || ''; }

function showTitleMode(){
  const cloud = CL.on(), me = CL.user();
  const strip = $('tstrip');
  if(strip){
    if(cloud && me){
      strip.innerHTML = `<span class="tuser">Привет, ${nickname || 'друг'}!</span>
        <span class="tacts">
          <button class="tlink" onclick="Game.openBoard()">Кто как далеко</button>
          <button class="tlink" onclick="Game.doLogout()">Выйти</button></span>`;
    } else if(cloud){
      strip.innerHTML = `<span class="tuser">Гость</span>
        <span class="tacts"><button class="tlink" onclick="Game.showAuth()">Войти · создать аккаунт</button></span>`;
    } else {
      strip.innerHTML = `<span class="tuser">Локальный режим</span>`;
    }
  }
  if($('nick2')) $('nick2').style.display = cloud ? 'none' : 'block';
  if($('tauth'))  $('tauth').classList.remove('on');
  $('cloudstate').textContent = cloud
    ? (me ? 'аккаунт подключён · прогресс в облаке'
          : 'войди — прогресс сохранится, и друзья увидят, кто как далеко')
    : (CLOUD_MISSING ? 'файл cloud.js не найден · аккаунты выключены'
                     : 'локальный режим · сохранения только на этом устройстве');
  authErr('');
  renderStoryCards();
}

function renderStoryCards(){
  const box = $('tstories'); if(!box) return;
  const stories = Object.values(window.STORIES || {});
  box.innerHTML = stories.map(s => {
    let status = '', actions = '';
    const raw = localStorage.getItem(LS + 'auto_' + s.id);
    if(s.soon){
      status = 'в разработке';
      actions = `<button class="abtn ghost" disabled style="opacity:.5">скоро</button>`;
    } else if(raw){
      let st = {}; try{ st = JSON.parse(raw); }catch(e){}
      const seen = (st.seen || []).length;
      status = `продолжаешь · ${st.chapter || 'начало'} · ${seen} сцен`;
      actions = `<button class="abtn" onclick="Game.continueStory('${s.id}')">Продолжить</button>
                 <button class="abtn ghost" onclick="Game.confirmRestart('${s.id}')">Заново</button>`;
    } else {
      status = 'ещё не начата';
      actions = `<button class="abtn" onclick="Game.newStory('${s.id}')">Начать</button>`;
    }
    const cov = s.cover
      ? `background-image:url(art/${s.cover})`
      : `background:linear-gradient(160deg,${s.accent},#1a1420)`;
    return `<div class="lcard ${s.soon ? 'soon' : ''}">
        <div class="lcover" style="${cov}"></div>
        <div class="lbody">
          <b>${s.title}</b>
          <i>${s.subtitle || ''}</i>
          <span class="lstatus">${status}</span>
          <div class="lactions">${actions}</div>
        </div></div>`;
  }).join('');
}

function showAuth(){ if($('tauth')) $('tauth').classList.add('on'); }
function hideAuth(){ if($('tauth')) $('tauth').classList.remove('on'); }

async function doLogin(){
  authErr('');
  const n = $('nick').value.trim(), p = $('pass').value;
  if(!n || p.length < 6) return authErr('Нужно имя и пароль хотя бы из 6 знаков.');
  try{ await CL.signIn(n, p); nickname = n; localStorage.setItem(LS+'nick', n); hideAuth(); showTitleMode(); }
  catch(e){ authErr(e.status === 400 ? 'Неверное имя или пароль.' : 'Не вышло войти: ' + e.message); }
}

async function doRegister(){
  authErr('');
  const n = $('nick').value.trim(), p = $('pass').value;
  if(!n || p.length < 6) return authErr('Нужно имя и пароль хотя бы из 6 знаков.');
  try{ await CL.signUp(n, p); nickname = n; localStorage.setItem(LS+'nick', n); hideAuth(); showTitleMode(); }
  catch(e){ authErr(e.status === 422 ? 'Такое имя уже занято.' : e.message); }
}

function doLogout(){ CL.signOut(); showTitleMode(); }
function playLocal(){ hideAuth(); }
function confirmNew(){
  if(confirm('Начать заново? Текущее сохранение перезапишется.')) start(false);
}

async function openBoard(){
  const b = $('boardbody');
  b.innerHTML = '<div style="opacity:.6">Загружаю…</div>';
  $('board').classList.add('on');
  const rows = await CL.leaderboard();
  if(!rows.length){ b.innerHTML = '<div style="opacity:.6">Пока никого. Ты первая.</div>'; return; }
  b.innerHTML = rows.map(r => `<div class="logline">
      <b>${r.nickname || '—'}</b> · ${r.scenes_seen || 0} сцен · ${r.endings_found || 0} концовок
      <div style="opacity:.55;font-size:12px">${r.chapter || 'ещё не начала'} · ${r.minutes || 0} мин</div>
    </div>`).join('');
}

function toTitle(){ closeAll(); $('title').style.display='flex'; showTitleMode(); }

/* ---------- выбор истории ---------- */
function openStories(){
  const grid = $('storygrid');
  const stories = Object.values(window.STORIES || {});
  grid.innerHTML = stories.map(s => `
    <button class="story-card ${s.soon ? 'soon' : ''}" onclick="Game.pickStory('${s.id}')">
      <span class="story-cover" style="${s.cover
        ? `background-image:url(${(STORY&&STORY.id===s.id?ART:'art/')}${s.cover})`
        : `background:linear-gradient(160deg,${s.accent},#1a1420)`}"></span>
      <span class="story-meta">
        <b>${s.title}</b>
        <i>${s.subtitle || ''}</i>
        ${s.soon ? '<span class="story-soon">в разработке</span>' : ''}
      </span>
    </button>`).join('');
  $('stories').classList.add('on');
}

function pickStory(sid){
  const s = (window.STORIES||{})[sid];
  if(!s) return;
  if(s.soon){ alert('Эта история ещё пишется. Скоро!'); return; }
  loadStory(sid);
  closeAll();
  $('storytitle').textContent = s.title;
  $('title').style.display = 'flex';
  showTitleMode();
}
function openMenu(){ $('menu').classList.add('on'); }
function openLog(){
  $('logbody').innerHTML = state.log.slice(-120).map(l =>
    `<div class="logline">${l.who ? '<b>'+l.who+':</b> ' : ''}${l.text}</div>`).join('');
  $('log').classList.add('on');
}
async function openGallery(){
  const box = $('galbody');
  box.innerHTML = '<div style="opacity:.6">Загружаю…</div>';
  $('gallery').classList.add('on');

  const used = {}, firstScene = {};
  for(const [id, s] of Object.entries(SCENES)){
    if(!s.bg) continue;
    used[s.bg] = (used[s.bg] || 0) + 1;
    if(!firstScene[s.bg]) firstScene[s.bg] = id;
  }

  box.innerHTML = '';
  for(const key of Object.keys(BACKGROUNDS)){
    const url = ART + 'bg_' + key + '.jpg';
    const exists = await has(url);
    const n = used[key] || 0;
    const card = document.createElement('button');
    card.className = 'gcard';
    card.innerHTML = `
      <span class="thumb" style="background-image:${exists ? `url(${url})` : 'none'};
            ${exists ? '' : 'background:' + BACKGROUNDS[key].css}"></span>
      <span class="cap">
        <b><i class="gdot" style="background:${exists ? (n ? '#3ff2d0' : '#888') : '#ff5d7a'}"></i>
           ${BACKGROUNDS[key].name}</b>
        <span class="cnt">${exists ? '' : 'файла нет · '}${n ? n + ' сцен' : 'сцен пока нет'}</span>
      </span>`;
    if(n) card.onclick = () => { closeAll(); show(firstScene[key]); };
    else card.onclick = () => alert('Для этого фона ещё не написано ни одной сцены.');
    box.appendChild(card);
  }
}

function closeAll(){ document.querySelectorAll('.overlay').forEach(o => o.classList.remove('on')); }
function setSpeed(v){ speed = +v; localStorage.setItem(LS+'speed', v); }
function toggleDebug(){ debugOn = !debugOn; $('debug').classList.toggle('on', debugOn); paintDebug(); }

/* ---------- инициализация ---------- */
(async function(){
 try {
  state = fresh();
  const n = localStorage.getItem(LS+'nick');
  if(n){ $('nick').value = n; $('nick2').value = n; }
  const sp = localStorage.getItem(LS+'speed'); if(sp){ speed = +sp; $('speed').value = sp; }
  loadStory('kunming');   /* история по умолчанию */
  setTitleBg();

  /* заранее греем первые сцены, чтобы старт был мгновенным */
  ['ch1_01','ch1_02','ch1_10','ch1_23'].forEach(id => {
    const s = SCENES[id]; if(s) sceneAssets(s).forEach(ensure);
  });
  setTimeout(preloadAll, 2500);

  CL.init();
  showTitleMode();
  document.addEventListener('keydown', e => {
    if(e.code === 'Space' || e.code === 'Enter') advance();
    if(e.code === 'KeyD') toggleDebug();
  });
 } catch(err) {
  /* что бы ни сломалось при запуске — титул должен остаться рабочим */
  console.error('Сбой при запуске:', err);
  const cs = $('cloudstate'); if(cs) cs.textContent = 'сбой при запуске: ' + err.message;
 }
})();

return { start, advance, save, load, openMenu, openLog, openGallery, closeAll,
         setSpeed, toggleDebug, toTitle, spriteFallback, skipCard,
         doLogin, doRegister, doLogout, playLocal, confirmNew, openBoard, quitGame,
         openStories, pickStory,
         newStory, continueStory, confirmRestart, showAuth, hideAuth, renderStoryCards };
})();

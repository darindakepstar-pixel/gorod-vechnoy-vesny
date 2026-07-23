/* ============================================================
   ОБЛАКО. Аккаунты, сохранения, статистика.
   Работает на обычном fetch, без внешних библиотек:
   так надёжнее там, где зарубежные CDN недоступны.

   Если в config.js не заполнены ключи — молча выключается,
   и игра работает локально.
   ============================================================ */

const Cloud = (() => {

const LSK = 'gvv_session';
let base = '', key = '', session = null;

const on = () => !!(base && key);

/* ник -> технический адрес, детерминированно */
function nickToEmail(nick){
  let slug = nick.toLowerCase().replace(/[^a-z0-9]/g, '');
  if(slug.length < 3){
    let hsh = 0;
    for(const ch of nick) hsh = (hsh * 31 + ch.codePointAt(0)) >>> 0;
    slug = 'p' + hsh.toString(36);
  }
  return slug + '@players.gvv.app';
}

/* ---------- сеть ---------- */
async function raw(path, {method='GET', body, auth=true, headers={}} = {}){
  const h = { apikey: key, 'Content-Type':'application/json', ...headers };
  if(auth && session) h.Authorization = 'Bearer ' + session.access_token;
  const res = await fetch(base + path, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined
  });
  if(res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if(!res.ok){
    const err = new Error((data && (data.msg || data.message || data.error_description)) || res.statusText);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/* при протухшем токене — обновляем и повторяем один раз */
async function api(path, opts){
  try { return await raw(path, opts); }
  catch(e){
    if(e.status !== 401 || !session || !session.refresh_token) throw e;
    try{
      session = await raw('/auth/v1/token?grant_type=refresh_token',
        { method:'POST', auth:false, body:{ refresh_token: session.refresh_token } });
      localStorage.setItem(LSK, JSON.stringify(session));
      return await raw(path, opts);
    }catch(e2){ signOut(); throw e2; }
  }
}

/* ---------- вход ---------- */
async function signUp(nick, pass){
  const email = nickToEmail(nick);
  const r = await raw('/auth/v1/signup', { method:'POST', auth:false, body:{ email, password: pass } });
  if(!r.access_token){
    throw new Error('Аккаунт создан, но нужен вход. Если Supabase просит подтвердить почту — выключи это в настройках Authentication.');
  }
  session = r; localStorage.setItem(LSK, JSON.stringify(session));
  await api('/rest/v1/profiles', { method:'POST',
    headers:{ Prefer:'resolution=merge-duplicates' },
    body:{ id: session.user.id, nickname: nick } });
  return session.user;
}

async function signIn(nick, pass){
  const email = nickToEmail(nick);
  session = await raw('/auth/v1/token?grant_type=password',
    { method:'POST', auth:false, body:{ email, password: pass } });
  localStorage.setItem(LSK, JSON.stringify(session));
  await api('/rest/v1/profiles', { method:'POST',
    headers:{ Prefer:'resolution=merge-duplicates' },
    body:{ id: session.user.id, nickname: nick } }).catch(() => {});
  return session.user;
}

function signOut(){
  session = null;
  localStorage.removeItem(LSK);
}

const user = () => session ? session.user : null;

/* ---------- сохранения ---------- */
async function push(slot, data){
  if(!on() || !session) return false;
  try{
    await api('/rest/v1/saves', { method:'POST',
      headers:{ Prefer:'resolution=merge-duplicates' },
      body:{ user_id: session.user.id, slot, state: data, updated_at: new Date().toISOString() } });
    return true;
  }catch(e){ console.warn('Не удалось сохранить в облако:', e.message); return false; }
}

async function pull(slot){
  if(!on() || !session) return null;
  try{
    const r = await api(`/rest/v1/saves?user_id=eq.${session.user.id}&slot=eq.${slot}&select=state`);
    return (r && r[0]) ? r[0].state : null;
  }catch(e){ return null; }
}

async function markEnding(id){
  if(!on() || !session) return;
  try{
    await api('/rest/v1/endings', { method:'POST',
      headers:{ Prefer:'resolution=merge-duplicates' },
      body:{ user_id: session.user.id, ending_id: id } });
  }catch(e){}
}

/* ---------- статистика ---------- */
async function myStats(){
  if(!on() || !session) return null;
  try{
    const [saves, ends, prof] = await Promise.all([
      api(`/rest/v1/saves?user_id=eq.${session.user.id}&slot=eq.auto&select=state,updated_at`),
      api(`/rest/v1/endings?user_id=eq.${session.user.id}&select=ending_id`),
      api(`/rest/v1/profiles?id=eq.${session.user.id}&select=nickname`)
    ]);
    return {
      nickname: prof && prof[0] ? prof[0].nickname : '',
      state:    saves && saves[0] ? saves[0].state : null,
      updated:  saves && saves[0] ? saves[0].updated_at : null,
      endings:  ends ? ends.length : 0
    };
  }catch(e){ return null; }
}

/* кто как далеко зашёл — общий список */
async function leaderboard(){
  if(!on()) return [];
  try{ return await api('/rest/v1/progress?select=*&order=scenes_seen.desc&limit=20'); }
  catch(e){ return []; }
}

/* ---------- запуск ---------- */
function init(){
  if(!window.CONFIG) return false;
  base = (CONFIG.supabaseUrl || '').replace(/\/$/, '');
  key  = CONFIG.supabaseKey || '';
  if(!base || !key || base.includes('ВСТАВЬ')){ base = key = ''; return false; }
  try{
    const raw = localStorage.getItem(LSK);
    if(raw) session = JSON.parse(raw);
  }catch(e){}
  return true;
}

return { init, on, signUp, signIn, signOut, user, push, pull, markEnding, myStats, leaderboard };
})();

const fs=require('fs');
const files=['story_kunming.js','story_book.js'];
global.window={};
for(const f of files){ const src=fs.readFileSync(f,'utf8'); new Function('window',src)(global.window); }
const story=global.window.STORIES[process.argv[2]||'kunming'];
const {scenes:SCENES,chars:CHARS,backgrounds:BACKGROUNDS}=story;
const START=story.start;
console.log('Проверяю историю:',story.title);
let bad=0, ids=Object.keys(SCENES), reach=new Set(['ch1_01']);
for(const [id,s] of Object.entries(SCENES)){
  const targets=[];
  if(s.next) targets.push(s.next);
  if(s.route) s.route.forEach(r=>r.next&&targets.push(r.next));
  if(s.choices) s.choices.forEach(c=>targets.push(c.next));
  for(const t of targets){ if(!SCENES[t]){ console.log('❌ битая ссылка',id,'→',t); bad++; } else reach.add(t); }
  if(!s.next && !s.choices && !s.ending){ console.log('⚠️  тупик без концовки:',id); bad++; }
  if(s.bg && !BACKGROUNDS[s.bg]){ console.log('❌ нет фона',s.bg,'в',id); bad++; }
  if(s.sprite && !CHARS[s.sprite.char]){ console.log('❌ нет персонажа',s.sprite.char,'в',id); bad++; }
}
reach.add(START);
const unreach=ids.filter(i=>!reach.has(i));
if(unreach.length) console.log('⚠️  недостижимые:',unreach.join(', '));
console.log(`\nсцен: ${ids.length} | развилок: ${ids.filter(i=>SCENES[i].choices).length} | ошибок: ${bad}`);

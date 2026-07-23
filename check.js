const fs=require('fs');
const src=fs.readFileSync('scenes.js','utf8');const {SCENES,CHARS,BACKGROUNDS}=new Function(src+';return {SCENES,CHARS,BACKGROUNDS};')();
let bad=0, ids=Object.keys(SCENES), reach=new Set(['ch1_01']);
for(const [id,s] of Object.entries(SCENES)){
  const targets=[];
  if(s.next) targets.push(s.next);
  if(s.choices) s.choices.forEach(c=>targets.push(c.next));
  for(const t of targets){ if(!SCENES[t]){ console.log('❌ битая ссылка',id,'→',t); bad++; } else reach.add(t); }
  if(!s.next && !s.choices && !s.ending){ console.log('⚠️  тупик без концовки:',id); bad++; }
  if(s.bg && !BACKGROUNDS[s.bg]){ console.log('❌ нет фона',s.bg,'в',id); bad++; }
  if(s.sprite && !CHARS[s.sprite.char]){ console.log('❌ нет персонажа',s.sprite.char,'в',id); bad++; }
}
const unreach=ids.filter(i=>!reach.has(i));
if(unreach.length) console.log('⚠️  недостижимые:',unreach.join(', '));
console.log(`\nсцен: ${ids.length} | развилок: ${ids.filter(i=>SCENES[i].choices).length} | ошибок: ${bad}`);

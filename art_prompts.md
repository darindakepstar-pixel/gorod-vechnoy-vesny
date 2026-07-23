# Промпты для артов

Всё, что нужно для полного прототипа: **10 спрайтов + 7 фонов**.

Промпты на английском — почти все генераторы понимают его точнее русского.
Русские пояснения в скобках, их в промпт не вставляй.

---

## Как этим пользоваться

**Шаг 1. Стиль.** Сгенерируй что угодно с блоком STYLE ниже и покрути, пока картинка тебе не понравится по цвету и рисовке. Этот блок дальше вставляется в каждый промпт **дословно, без изменений**. Как только начнёшь его переписывать «чуть-чуть по-другому» — стиль поплывёт.

**Шаг 2. Якорь.** Для каждого персонажа сгенерируй нейтральный портрет. Крути, пока не появится ощущение «да, это он». Это займёт 10–30 попыток, и это нормально. Сохрани лучший — он становится референсом.

**Шаг 3. Эмоции.** Загружаешь якорь как reference-картинку и меняешь **только строку эмоции**. Всё остальное — тот же текст. Если сервис умеет сохранять персонажа под именем (`@lei`) — пользуйся, это надёжнее.

**Шаг 4. Фон долой.** Генераторы почти никогда не дают прозрачный фон, даже если попросить. Делай на однотонном зелёном или маджента-фоне, потом убирай через remove.bg, Photopea (бесплатно, в браузере) или встроенное удаление фона в самом сервисе.

**Шаг 5. Складываешь в игру.** Создай в папке с игрой подпапку `art/` и клади файлы с точными именами из таблицы ниже. Игра подхватит их сама — код менять не нужно. Пока файла нет, на его месте остаётся цветная заглушка, так что можно вставлять по одному.

---

## STYLE — вставлять в каждый промпт

```
STYLE: 2000s dress-up game aesthetic meets underground neon, soft cel shading,
clean bold outlines, glossy highlights, pastel base palette (blush pink, lilac,
cream) with electric neon accents (teal, magenta), warm rim light,
flat simple shapes, no photorealism, no texture noise, illustration
```

---

## Спрайты персонажей

Общие требования, добавлять к каждому:

```
TECH: waist-up portrait, three-quarter view, facing slightly left, centered,
head and shoulders fully inside frame, solid flat magenta background,
even lighting, vertical 3:4 composition, no props, no text, no logos, no border
```

Итоговый промпт = `STYLE` + описание персонажа + строка эмоции + `TECH`.

Размер: примерно **900 × 1200 px**. Больше не нужно, меньше будет мылить на телефоне.

---

### ЛЭЙ — `lei` (3 файла)

Описание (не меняется никогда):

```
CHARACTER: Chinese man, 29 years old, sharp angular face, high cheekbones,
narrow dark eyes with visible tiredness under them, straight black hair
falling over forehead, small silver stud earring, all-black oversized hoodie,
thin silver chain, single small tattoo on inner wrist
```

| Файл | Строка эмоции |
|---|---|
| `art/lei_neutral.png` | `EXPRESSION: neutral, closed off, looking straight ahead, lips a flat line` |
| `art/lei_cold.png` | `EXPRESSION: cold and dismissive, chin slightly raised, eyes narrowed, faint contempt` |
| `art/lei_tired.png` | `EXPRESSION: exhausted, eyes half-lowered, shoulders dropped, softer and more human` |

---

### ТАНК — `tank` (3 файла)

```
CHARACTER: Chinese man, 26 years old, broad round face, wide jaw, buzzed sides
with short bleached blond hair on top, one gold tooth, thick eyebrows,
bright yellow oversized bomber jacket over white tee, chunky gold rings
```

| Файл | Строка эмоции |
|---|---|
| `art/tank_happy.png` | `EXPRESSION: huge open laugh, eyes squeezed shut, head tilted back, whole body loud` |
| `art/tank_neutral.png` | `EXPRESSION: relaxed friendly half-smile, eyebrows raised, open and easy` |
| `art/tank_angry.png` | `EXPRESSION: serious and hard, no smile at all, jaw set, direct heavy stare` |

Для `tank_angry` смысл именно в контрасте: он всегда ржёт, и когда перестаёт — становится страшновато. Проверь, что лицо реально другое, а не «то же с нахмуренными бровями».

---

### ШЭНЬ КЭ — `shen` (2 файла)

```
CHARACTER: Chinese man, 33 years old, calm composed face, short neat black hair,
clean-shaven, quiet steady gaze, charcoal grey dress shirt with rolled-up
sleeves, no jewelry, no tie, understated expensive minimalism
```

| Файл | Строка эмоции |
|---|---|
| `art/shen_neutral.png` | `EXPRESSION: composed and attentive, unreadable, perfectly still` |
| `art/shen_warm.png` | `EXPRESSION: barely-there smile only in the eyes, mouth almost unchanged, quietly amused` |

`shen_warm` — самый сложный кадр во всём наборе. Улыбка должна быть почти невидимой. Если получается обычная приветливая улыбка — это уже другой персонаж. Пиши `subtle`, `restrained`, `almost imperceptible` и генерируй, пока не станет тонко.

---

### МЭЙМЭЙ — `mei` (1 файл)

```
CHARACTER: Chinese woman, 24 years old, small round face, big expressive eyes,
shoulder-length hair with blunt bangs, pastel office cardigan,
phone in a bunny-shaped case
EXPRESSION: bright conspiratorial grin, leaning in as if sharing gossip,
eyebrows up
```

Файл: `art/mei_happy.png`

---

### ИРИНА ПАВЛОВНА — `irina` (1 файл)

```
CHARACTER: Russian woman, late 40s, sharp practical face, blonde hair in a
tight low bun, minimal makeup, plain dark blazer, reading glasses pushed up
on her head, expression of permanent mild time pressure
EXPRESSION: businesslike and brisk, one eyebrow slightly raised, mid-sentence
```

Файл: `art/irina_neutral.png`

---

## Фоны (7 файлов)

Другие технические требования:

```
TECH: wide establishing shot, no people, no characters, empty scene,
horizontal 16:9 composition, slightly desaturated so text stays readable,
no text, no logos, no watermark
```

Размер: **1920 × 1080 px**, сохранять в **.jpg** (фоны тяжёлые, png тут не нужен).

Важно: фон не должен перетягивать внимание. Он живёт под текстовым окном и за персонажем. Если картинка получилась слишком красивой и пёстрой — она будет мешать читать.

| Файл | Промпт (после STYLE) |
|---|---|
| `art/bg_airport.jpg` | `SCENE: modern Chinese airport arrivals hall, polished marble floor, tall glass walls, empty baggage carousel, cool grey-blue daylight, bilingual signage suggested but unreadable` |
| `art/bg_taxi.jpg` | `SCENE: view from inside a taxi back seat at night, rain-streaked side window, blurred green and neon city lights outside, wet asphalt reflections, warm dashboard glow` |
| `art/bg_hotel.jpg` | `SCENE: small tidy hotel room at pre-dawn, unmade bed, open suitcase on the floor, thin light through curtains, muted purple shadows, lonely and quiet` |
| `art/bg_office.jpg` | `SCENE: bright corporate office corridor, glass partitions, elevator doors at the end, potted plants, pale lilac and cream tones, clean and impersonal` |
| `art/bg_meeting.jpg` | `SCENE: glass-walled meeting room high above a city, long table, chairs, projector screen, city skyline through the window, cool daylight` |
| `art/bg_elevator.jpg` | `SCENE: interior of a brushed steel elevator, mirrored back wall, floor number panel glowing, tight enclosed space, cold grey light` |
| `art/bg_city.jpg` | `SCENE: Kunming street at night after rain, neon signs in Chinese characters, wet pavement reflecting magenta and teal, flower stalls, blooming trees, humid warm air` |

---

## Проверка перед тем, как вставлять в игру

- Спрайты — **png с прозрачным фоном**. Открой файл на тёмном фоне: если по краям белая или зелёная кайма, обрезка неаккуратная.
- Все три эмоции одного персонажа — рядом друг с другом на одном экране. Это точно один человек? Причёска та же? Одежда та же? Если нет — перегенерируй по якорю, не оставляй «почти похоже», в игре это будет бросаться в глаза при каждой смене эмоции.
- Голова не обрезана сверху, плечи не обрезаны по бокам.
- Фоны — jpg, не больше ~400 КБ каждый, иначе игра будет долго грузиться с телефона.

---

## Порядок, который сэкономит время

Не генерируй всё подряд. Сделай сначала **одного Лэя в нейтрале и один фон аэропорта**, вставь в игру, открой на телефоне и посмотри, как это выглядит вместе с текстовым окном. Почти наверняка что-то захочется поменять глобально — яркость, кадрирование, насыщенность. Лучше узнать это на двух картинках, чем на семнадцати.

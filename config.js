/* Настройки игры. */
const CONFIG = {

  /* Supabase — аккаунты и облачные сохранения.
     Пока стоят заглушки, игра работает локально. */
  supabaseUrl: 'https://xmgyqucozetjvljjphby.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ3lxdWNvemV0anZsampwaGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3OTgyMzksImV4cCI6MjEwMDM3NDIzOX0.aqWmuO2vpF_8hmUPnY8z_sHiC0jh2qDQdSStrnhVPdY',

  /* Откуда игра берёт картинки.
     Пусто  -> из папки art/ рядом с index.html (обычный вариант).
     Ссылка -> из интернета, например из Supabase Storage.
     В конце обязательно слэш! Пример:
     artBase: 'https://xxxx.supabase.co/storage/v1/object/public/art/', */
  artBase: '',

};

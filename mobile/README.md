# SAVEAT Mobile

Мобильное приложение SAVEAT для iOS и Android на React Native + Expo.

Это **не отдельный продукт**: приложение работает с тем же backend
(`../backend`, FastAPI), той же базой, той же системой пользователей и
тем же JWT, что и веб-версия (`../frontend`, Next.js).

```
Next.js web ─┐
             ├─► FastAPI API ─► PostgreSQL / Supabase
React Native ┘
```

---

## Установка

```bash
cd mobile
npm install
```

## Запуск

```bash
npx expo start
```

Отдельные платформы:

```bash
npx expo start --android
npx expo start --ios
```

Для iOS-симулятора нужен macOS с Xcode. На Windows и Linux используйте
Android-эмулятор или приложение **Expo Go** на реальном телефоне.

> Карта (`react-native-maps`) и сканер QR (`expo-camera`) — нативные
> модули. В Expo Go они работают; для собственной сборки используйте
> `npx expo run:android` / `npx expo run:ios` или EAS Build.

---

## EXPO_PUBLIC_API_URL

Адрес SAVEAT API приложение берёт из переменной окружения
`EXPO_PUBLIC_API_URL`. Скопируйте пример и подставьте свой адрес:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:8001
```

Какой адрес указывать:

| Где запускаете приложение | Что писать в `EXPO_PUBLIC_API_URL` |
| --- | --- |
| iOS-симулятор или `--web` на том же компьютере | `http://127.0.0.1:8001` |
| Android-эмулятор (AVD) | `http://10.0.2.2:8001` |
| Реальный телефон в той же Wi-Fi сети | `http://<IP-компьютера>:8001` |

**Для физического телефона `127.0.0.1` не подходит** — для телефона это
он сам, а не ваш компьютер. Нужен адрес компьютера в локальной сети.
Узнать его можно так:

```bash
# Windows
ipconfig

# macOS / Linux
ifconfig | grep "inet "
```

Возьмите адрес вида `192.168.x.x` или `10.x.x.x` и укажите порт backend:
`http://192.168.x.x:8001`.

Телефон и компьютер должны быть в одной сети, а backend — слушать не
только localhost:

```bash
cd ../backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Если `EXPO_PUBLIC_API_URL` не задана, в режиме разработки приложение
подставит хост, с которого телефон уже качает бандл Metro (тот же
компьютер), и порт `8001`. Это удобно для быстрого старта, но для
стабильной работы переменную лучше задать явно.

Текущий используемый адрес API виден внизу экрана «Профиль».

### Файлы окружения

`.env` и `.env.local` в `.gitignore` — в репозитории лежит только
`.env.example`. Секреты backend (пароль базы, `JWT_SECRET_KEY`, ключи
Supabase) в мобильное приложение **не попадают**: приложение знает
только публичный адрес API.

### GOOGLE_MAPS_API_KEY

Нужен только для собственных Android-сборок (`npx expo run:android`,
EAS Build): Google Maps на Android требует ключ. В Expo Go и на iOS не
требуется. Ключ читается из окружения в `app.config.ts` и в репозиторий
не коммитится.

---

## Проверки

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

---

## Структура

```
mobile/
├── app/                        # маршруты Expo Router
│   ├── _layout.tsx             # провайдеры + корневой Stack
│   ├── (tabs)/                 # нижняя навигация покупателя
│   │   ├── index.tsx           # Главная — витрина предложений
│   │   ├── map.tsx             # Карта заведений
│   │   ├── orders.tsx          # Мои заказы
│   │   └── profile.tsx         # Профиль
│   ├── login.tsx
│   ├── register.tsx
│   ├── cart.tsx
│   ├── orders/[id].tsx         # Заказ: состав, код и QR
│   └── business/               # кабинет заведения
│       ├── index.tsx           # вход в кабинет
│       ├── login.tsx
│       ├── register.tsx
│       ├── dashboard.tsx
│       ├── orders.tsx
│       ├── pickup.tsx          # выдача по коду или QR
│       ├── branches/
│       ├── products/
│       └── offers/
├── components/                 # переиспользуемый UI
├── contexts/                   # Auth, Business, Cart
├── hooks/                      # useApiResource, useUserLocation
├── lib/                        # api, storage, format, geo, validation
├── types/api.ts                # типы, зеркалящие Pydantic-схемы
└── constants/theme.ts          # палитра SAVEAT
```

## Хранение данных

| Что | Где | Почему |
| --- | --- | --- |
| JWT (`access_token`) | `expo-secure-store` | Keychain на iOS, EncryptedSharedPreferences на Android |
| Корзина | `AsyncStorage` | не секрет, должна переживать перезапуск |
| Выбранный бизнес | `AsyncStorage` | не секрет, просто удобство |

Токен никогда не попадает в обычное хранилище на мобильных платформах и
не логируется.

## Работа с API

Весь сетевой код — в [`lib/api.ts`](lib/api.ts):

- берёт базовый адрес из `EXPO_PUBLIC_API_URL`;
- сам подставляет `Authorization: Bearer <token>`;
- разбирает ошибки FastAPI (`detail` строкой и списком ошибок валидации);
- при `401` чистит токен и разлогинивает приложение из одного места.

Бизнес-логика (проверка остатков, расчёт суммы, генерация `pickup_code`,
смена статусов, права ролей, tenant isolation) целиком живёт в backend.
Приложение только отображает результат и скрывает недоступные кнопки —
настоящая авторизация всегда на сервере.

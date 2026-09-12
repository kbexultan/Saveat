# SAVEAT — как запустить проект

Этот файл для команды SAVEAT.  
Здесь написано, что установить, куда положить креды и какие команды запустить.

---

## 1. Что нужно установить

Перед запуском проекта должны быть установлены:

- Git
- Node.js 20+
- Python 3.13+
- uv

Проверить можно командами:

```bash
git --version
node --version
npm --version
python --version
uv --version
```

---

# 2. Скачать проект

Открой терминал и выполни:

```bash
git clone https://github.com/kbexultan/Saveat.git
cd Saveat
```

После этого структура будет примерно такой:

```text
Saveat/
├── backend/
├── frontend/
└── README.md
```

---

# 3. ВАЖНО — файлы с кредами от Бекса

Некоторых файлов специально НЕТ в GitHub, потому что внутри находятся приватные данные.

Бекс отдельно скинет тебе файлы с кредами.

## Куда положить скачанные файлы от Бекса

### Файл №1

Скачанный файл:

```text
.env
```

положить сюда:

```text
Saveat/backend/.env
```

То есть должно получиться:

```text
Saveat/
└── backend/
    ├── app/
    ├── alembic/
    ├── .env          ← СЮДА ФАЙЛ ОТ БЕКСА
    ├── pyproject.toml
    └── uv.lock
```

---

### Файл №2

Скачанный файл:

```text
.env.local
```

положить сюда:

```text
Saveat/frontend/.env.local
```

То есть:

```text
Saveat/
└── frontend/
    ├── app/
    ├── components/
    ├── .env.local    ← СЮДА ФАЙЛ ОТ БЕКСА
    ├── package.json
    └── package-lock.json
```

---

## Почему этих файлов нет в GitHub

Потому что внутри могут находиться:

- доступ к Supabase/PostgreSQL
- JWT secret
- backend URL
- другие приватные настройки

Эти файлы НЕ надо коммитить и пушить в GitHub.

Проверка:

```bash
git check-ignore -v backend/.env
git check-ignore -v frontend/.env.local
```

---

# 4. Установка Backend

Перейди в backend:

```bash
cd backend
```

Установи Python-зависимости:

```bash
uv sync
```

После этого примени миграции базы данных:

```bash
uv run alembic upgrade head
```

---

# 5. Запуск Backend

Находясь в папке:

```text
Saveat/backend
```

запусти:

```bash
uv run uvicorn app.main:app --reload --port 8001
```

Если всё нормально, backend будет доступен здесь:

```text
http://127.0.0.1:8001
```

Swagger:

```text
http://127.0.0.1:8001/docs
```

Проверка базы:

```text
http://127.0.0.1:8001/health/database
```

Backend-терминал НЕ закрывай.

---

# 6. Установка Frontend

Открой второй терминал.

Перейди в frontend.

Если ты находишься в корне проекта:

```bash
cd frontend
```

Если ты сейчас находишься в `backend`, сначала:

```bash
cd ..
cd frontend
```

Установи зависимости:

```bash
npm install
```

---

# 7. Запуск Frontend

Находясь в:

```text
Saveat/frontend
```

запусти:

```bash
npm run dev -- -p 3001
```

Открой сайт:

```text
http://localhost:3001
```

Frontend-терминал тоже оставь открытым.

---

# 8. Как должно быть запущено

Нужно два терминала.

## Терминал 1 — Backend

```bash
cd Saveat/backend
uv run uvicorn app.main:app --reload --port 8001
```

## Терминал 2 — Frontend

```bash
cd Saveat/frontend
npm run dev -- -p 3001
```

## Терминал 3 — Mobile (по желанию)

```bash
cd Saveat/mobile
npx expo start
```

После этого:

```text
Frontend:
http://localhost:3001

Backend:
http://127.0.0.1:8001

Swagger:
http://127.0.0.1:8001/docs

Mobile (Metro):
http://localhost:8081
```

---

# 9. Первый запуск — Windows

Пример для PowerShell:

```powershell
git clone https://github.com/kbexultan/Saveat.git
cd Saveat
```

Потом положи скачанные файлы от Бекса:

```text
.env       → Saveat/backend/.env
.env.local → Saveat/frontend/.env.local
```

Backend:

```powershell
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8001
```

Открой второй PowerShell:

```powershell
cd путь\к\Saveat\frontend
npm install
npm run dev -- -p 3001
```

Открыть:

```text
http://localhost:3001
```

---

# 10. Первый запуск — macOS

В Terminal:

```bash
git clone https://github.com/kbexultan/Saveat.git
cd Saveat
```

Потом положи скачанные файлы от Бекса:

```text
.env       → Saveat/backend/.env
.env.local → Saveat/frontend/.env.local
```

Backend:

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8001
```

Открой вторую вкладку Terminal:

```bash
cd /путь/к/Saveat/frontend
npm install
npm run dev -- -p 3001
```

Открыть:

```text
http://localhost:3001
```

---

# 11. Если `uv` не установлен

## Windows

```powershell
winget install --id=astral-sh.uv -e
```

После установки перезапусти терминал.

Проверка:

```powershell
uv --version
```

## macOS

Если установлен Homebrew:

```bash
brew install uv
```

Проверка:

```bash
uv --version
```

---

# 12. Если `npm` не работает

Проверь:

```bash
node --version
npm --version
```

Если команды не работают — установи Node.js.

После установки перезапусти VS Code или Terminal.

---

# 13. Если backend не запускается

Убедись, что ты находишься именно здесь:

```text
Saveat/backend
```

Потом:

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8001
```

---

# 14. Если ошибка подключения к базе

Проверь, что файл от Бекса лежит именно здесь:

```text
Saveat/backend/.env
```

Не здесь:

```text
Saveat/.env
```

Нужный путь:

```text
Saveat/backend/.env
```

Если файл лежит правильно, но база всё равно не подключается — напиши Бексу.

Не отправляй креды в общий чат и не пушь их в GitHub.

---

# 15. Если frontend не видит backend

Проверь, что backend запущен:

```text
http://127.0.0.1:8001
```

Проверь, что файл:

```text
Saveat/frontend/.env.local
```

находится именно во frontend.

После изменения `.env.local` frontend нужно перезапустить:

```text
Ctrl + C
```

потом:

```bash
npm run dev -- -p 3001
```

---

# 16. Если Next.js странно работает после обновления

Останови frontend:

```text
Ctrl + C
```

## Windows PowerShell

```powershell
Remove-Item -Recurse -Force .next
npm run dev -- -p 3001
```

## macOS

```bash
rm -rf .next
npm run dev -- -p 3001
```

---

# 17. Как получить последние изменения команды

Перед началом работы:

```bash
git pull origin main
```

Если изменились зависимости:

Backend:

```bash
cd backend
uv sync
```

Frontend:

```bash
cd frontend
npm install
```

Если появились новые миграции:

```bash
cd backend
uv run alembic upgrade head
```

---

# 18. Как отправить свои изменения в GitHub

Из корня проекта:

```bash
git status
git add .
git status
git commit -m "Описание изменений"
git push origin main
```

Перед commit убедись, что среди изменений нет:

```text
backend/.env
frontend/.env.local
backend/.venv
frontend/node_modules
frontend/.next
```

---

# 19. Очень коротко

Если проект уже скачан, креды от Бекса уже лежат на месте и зависимости установлены:

## Backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8001
```

## Frontend

В другом терминале:

```bash
cd frontend
npm run dev -- -p 3001
```

Открыть:

```text
http://localhost:3001
```

---

# 20. Мобильное приложение (iOS / Android)

Мобильное приложение живёт в папке `mobile/` — это React Native + Expo.

Оно **не отдельный проект**: работает с тем же backend, той же базой,
теми же пользователями и тем же JWT, что и сайт.

```text
Next.js web ─┐
             ├─► FastAPI (backend) ─► PostgreSQL / Supabase
React Native ┘
```

## Установка

```bash
cd Saveat/mobile
npm install
```

## Запуск

```bash
cd Saveat/mobile
npx expo start
```

Дальше:

- нажать `a` — Android-эмулятор
- нажать `i` — iOS-симулятор (только macOS)
- отсканировать QR приложением **Expo Go** — реальный телефон

## Адрес backend для телефона

Скопируйте пример окружения:

```bash
cd Saveat/mobile
cp .env.example .env
```

И укажите адрес API:

| Где запускаете | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| iOS-симулятор на том же компьютере | `http://127.0.0.1:8001` |
| Android-эмулятор | `http://10.0.2.2:8001` |
| Реальный телефон в той же Wi-Fi | `http://<IP-компьютера>:8001` |

**Для реального телефона `127.0.0.1` не работает** — это адрес самого
телефона. Нужен IP компьютера в локальной сети (`ipconfig` на Windows,
`ifconfig` на macOS), например `http://192.168.1.50:8001`.

Чтобы телефон видел backend, запускайте его не только на localhost:

```bash
cd Saveat/backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Подробности — в [`mobile/README.md`](mobile/README.md).

---

# 21. Чек-лист

- [ ] Проект скачан через Git
- [ ] `.env` от Бекса лежит в `backend/.env`
- [ ] `.env.local` от Бекса лежит в `frontend/.env.local`
- [ ] Выполнен `uv sync`
- [ ] Выполнен `uv run alembic upgrade head`
- [ ] Выполнен `npm install`
- [ ] Backend запущен на `8001`
- [ ] Frontend запущен на `3001`
- [ ] Открываешь `http://localhost:3001`

Если работаешь с мобильным приложением:

- [ ] Выполнен `npm install` в `mobile/`
- [ ] `mobile/.env` создан из `mobile/.env.example`
- [ ] `EXPO_PUBLIC_API_URL` указывает на backend (для телефона — IP компьютера)
- [ ] Backend запущен с `--host 0.0.0.0`
- [ ] `npx expo start` работает

---

# SAVEAT

**Save food. Save money.**

Если проблема именно с кредами или доступом к базе — пиши Бексу.

# SAVEAT — аудит кода и исправления для MVP

> Follow-up от 7 ноября 2026: [стабилизация CI, US8 и повторная проверка безопасности](SAVEAT_STABILIZATION_2026-11-07.md). Результаты ниже относятся к предыдущему этапу.

**Дата:** 2026-11-06, Asia/Qyzylorda. Исходный commit: `492de99`.
Проверен существующий локальный проект: backend, web, mobile, миграции,
конфигурация, тесты и прежние критерии Assignment 8–9 / US3 / US5.
Production Supabase не использовался и не изменялся. Все SQL-проверки
проводились на отдельном Docker PostgreSQL 17, `127.0.0.1:54329/saveat_test`.

Внесены исправления checkout, корзины, push, авторизации и валидации;
добавлены миграции, CI и регрессии. Публичный запуск пока нельзя считать
полностью подготовленным: остаются уязвимые зависимости Expo, web JWT
в localStorage и обязательные проверки подписанных мобильных сборок.

## 1. Результаты проверки

| Проверка | Исходное состояние | Итог |
| --- | --- | --- |
| Backend Pytest | 49 passed | **107 passed, 0 failed** |
| Frontend Node tests | 27 passed | **32 passed, 0 failed** |
| Mobile Node tests | 13 passed | **24 passed, 0 failed** |
| Browser Chrome/CDP | прежний журнал 18 checks | **19 passed, 0 failed** в этой работе |
| Frontend TypeScript | — | PASS, 0 errors |
| Mobile TypeScript | — | PASS, 0 errors |
| Frontend lint | прежние warnings | PASS, 0 errors / 7 warnings |
| Expo lint | — | PASS, 0 errors / 0 warnings |
| Web production build | — | PASS на Next.js 16.4.5 |
| Expo SDK dependency check | обнаружены 3 несовпадения | PASS после совместимых patch updates |
| npm audit web, omit=dev | 1 critical / 2 high | **0** |
| npm audit mobile, omit=dev | 1 critical / 8 high / 10 moderate / 1 low | **3 high / 4 moderate**, exit 1 |
| Миграции | прежняя цепочка | upgrade с нуля, соответствие моделям и downgrade/upgrade с сохранением заказа — PASS |
| iOS/Android, реальные push, production/staging deploy | — | **NOT TESTED** |
| GitHub Actions удалённо | workflow отсутствовал | workflow добавлен; **NOT EXECUTED** удалённо |

Исходный browser log не выдаётся за новый запуск. Новые screenshots и
`browser-results.json` находятся в `backend/tests/acceptance-evidence/2026-11-06/`.
Там же сохранены итоговые JSON-отчёты npm audit. npm считает уязвимые пакеты,
включая цепочки зависимостей; это не число отдельных эксплойтов приложения.

Backend выводит 3 предупреждения: два deprecation от Starlette TestClient /
AnyIO и одно предупреждение SQLAlchemy/Alembic при сравнении отражённого
CHECK-ограничения. Metadata comparison при этом не находит различий.
Node сообщает прежнее предупреждение MODULE_TYPELESS_PACKAGE_JSON.
Build успешно завершается, но логирует существующий перехват Next dynamic
rendering и недоступность API :8001 во время prerender; публичный backend
для сборки не запускался. Это не подтверждение работоспособности production URL.

## 2. Подтверждённые проблемы и исправления

### DEP-01

ID: DEP-01

Severity: Critical

Affected files: `frontend/package.json`, `frontend/package-lock.json`, `frontend/AGENTS.md`

Problem: Next.js 16.3.4 и транзитивные sharp/source-map-js попадают в опубликованные уязвимые диапазоны.

Root cause: закреплённая версия Next и старый lockfile. Наличие уязвимой зависимости подтверждено npm; эксплуатация конкретных функций SAVEAT не воспроизводилась.

Implemented fix: Next и eslint-config-next закреплены на 16.4.5; совместимые исправления lockfile. Автоматически обновлённый блок AGENTS сохранён.

Verification: npm audit production = 0; 32 web tests, TypeScript, lint, production build и browser regression.

Status: FIXED

Первичные источники: [Next.js release](https://github.com/vercel/next.js/releases/tag/v16.4.5),
[image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[use cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr).

### CART-01

ID: CART-01

Severity: High

Affected files: `mobile/contexts/CartContext.tsx`, `mobile/app/cart.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/lib/cartAvailability.ts`

Problem: после 409/404 и при пустой витрине мобильная корзина продолжала показывать прежний остаток.

Root cause: пустой ответ игнорировался, отсутствующий offer сохранялся без изменений, checkout не инициировал refresh.

Implemented fix: общий чистый helper; отсутствующие/paused/sold_out/expired офферы получают 0 доступных; корзина сохраняет строки. Свежие цены и лимиты обновляются; checkout блокируется для недоступного товара. Остаток свыше 20 отображается точно, лимит заказа остаётся 20. Refresh при открытии, после 409/404 и вручную; неудачный refresh закрывает checkout, не удаляя корзину. Стабильные callback и сохранение identity при одинаковых данных предотвращают циклы render.

Verification: mobile unit regressions, TypeScript, Expo lint. A забирает последнюю штуку → B получает пустую витрину → строка остаётся, доступность 0, checkout запрещён. Реальный UI на телефоне NOT TESTED.

Status: FIXED

### ORDER-01

ID: ORDER-01

Severity: High

Affected files: `backend/app/routers/orders.py`, `models/order.py`, `schemas/order.py`, новая миграция `6ab12d901e34`, оба checkout-клиента и `lib/checkoutAttempt.ts`

Problem: повтор запроса после потерянного ответа мог создать ещё один заказ.

Root cause: блокировка остатков не распознаёт повтор бизнес-операции.

Implemented fix: необязательный `idempotency_key` в JSON checkout, привязка к user_id, SHA-256 нормализованных позиций/количеств/payment_method, UNIQUE(user_id,key), транзакционная advisory lock до проверки исходного заказа. Совпадающий повтор возвращает исходный заказ с прежним 201; другой состав с тем же ключом — 409. Сортированный FOR UPDATE по offers сохранён. Клиенты сохраняют ключ до успеха: sessionStorage на web, AsyncStorage на mobile; другой пользователь или состав создаёт другую попытку.

Verification: 8 одновременных повторов → 1 заказ/1 списание; retry после sold_out; конфликт содержимого; изоляция пользователей; rollback не расходует ключ. Прежние гонки US5 и negative control проходят.

Status: FIXED

Старые клиенты и POST /orders без ключа сохраняют прежнее поведение и не получают
идемпотентность. После закрытия web-вкладки sessionStorage не сохраняется;
при неопределённом результате следует проверить историю заказов. Сетевая ошибка
не удаляет корзину. Это не глобальное распознавание одинаковых намерений пользователя.

### PUSH-01

ID: PUSH-01

Severity: High

Affected files: backend `auth.py`, `routers/auth.py`, `routers/push.py`, `models/push_subscription.py`, `push.py`; оба AuthProvider, mobile `lib/push.ts`, `lib/api.ts`, web `lib/pushSession.ts`, `components/PushSubscription.tsx`, `public/sw.js`

Problem: logout оставлял подписку старого аккаунта; web видел существующую browser-подписку и не перепривязывал её новому пользователю.

Root cause: отсутствовали server logout, связь подписки с JWT-сессией и проверка владельца в момент отправки.

Implemented fix: подписка хранит хеш JWT и срок; logout отзывает JWT и удаляет устройства только этой сессии; upsert исключает дубли endpoint. Новый вход перепривязывает устройство, очередь повторно проверяет user/session/expiry под блокировкой. Старые unbound-подписки не отправляют push. Mobile отменяет запоздавшую регистрацию и не очищает новый JWT из-за 401 старого запроса. Web сериализует logout и регистрацию. Внешние payload больше не содержат частных данных заказа, клиенты очищают показанные уведомления при logout.

Verification: A subscribe → A logout → B subscribe; недействительность JWT A, сохранение второго устройства A, отсутствие доставки старой очереди B, безопасный поздний unsubscribe A. Web test проверяет отказ logout-сети и последующую регистрацию B.

Status: FIXED

Offline logout не может гарантировать немедленный отзыв JWT на сервере и не
может отозвать уже принятый ОС push. Общий текст push — намеренное изменение
для защиты данных на общем устройстве. Полные уведомления остаются в личном
списке API. Фактическая доставка и очистка баннеров на устройстве NOT TESTED.

### PUSH-02

ID: PUSH-02

Severity: High

Affected files: `backend/app/schemas/notification.py`, `routers/push.py`, `push.py`, `config.py`

Problem: произвольный web endpoint позволял направлять серверный HTTP-клиент на внутренние адреса.

Root cause: endpoint/platform были неограниченными строками; при отправке URL не перепроверялся.

Implemented fix: HTTPS, точный allowlist push-hostnames, запрет credentials/нестандартного порта/fragment, проверка web keys и Expo token, Literal platform. При отправке повторная проверка; requests Session запрещает redirects. Unsubscribe использует отдельную совместимую схему.

Verification: localhost, IP, поддельный suffix, credentials и порт 8443 → 422; sender не обращается к запрещённому адресу; тест запрещённых redirects и web 410. Реальная SSRF-сеть не использовалась.

Status: FIXED

### AUTH-01

ID: AUTH-01

Severity: High

Affected files: `backend/app/routers/auth.py`, `routers/business_auth.py`, `security.py`, `auth.py`, `rate_limit.py`, `models/auth_state.py`, миграция `72c98b6a10de`

Problem: отсутствовали лимиты auth; подписанный JWT без exp принимался; отсутствующий email обходил Argon2.

Root cause: проверки exp выполнялись только при наличии claim; попытки не учитывались.

Implemented fix: атомарные общие PostgreSQL-счётчики по IP/email для обоих auth-router; Retry-After; обязательные sub/exp и безопасная обработка неверного UUID; уникальный jti новых токенов, отзыв сессии, dummy Argon2-проверка неизвестного email. Пароли по-прежнему Argon2id, mobile JWT/SecureStore сохранены.

Verification: лимиты login/register, обход через второй auth-router, истёкший/неполный/неверно подписанный JWT, Argon2 и revoked JWT — automated tests.

Status: FIXED

### BIZ-01

ID: BIZ-01

Severity: High

Affected files: backend `routers/business_auth.py`, `routers/businesses.py`, `approve_business.py`, `config.py`; web dashboard и mobile BusinessGuard

Problem: оба пути регистрации сразу создавали публичный active-бизнес без проверки права представлять пекарню.

Root cause: status="active" задавался непосредственно при создании.

Implemented fix: по умолчанию новый бизнес pending, существующие записи не изменяются. Действующие централизованные проверки роли/status закрывают управление и checkout; витрина скрывает pending. UI показывает ожидание. Минимальный административный workflow — доверенный CLI с точным UUID/name и блокировкой строки. Для отдельного demo окружения есть явный opt-out.

Verification: оба registration paths, скрытие pending, 403 при управлении, сохранение active seed, проверки CLI. UI/device approval workflow вручную NOT TESTED.

Status: FIXED

### PUSH-03

ID: PUSH-03

Severity: Medium

Affected files: `backend/app/push.py`, `push_worker.py`, `models/push_delivery.py`, `notifications.py`, `main.py`, миграция `83fd02a14b7c`

Problem: daemon thread мог потерять push при завершении процесса; временная ошибка не имела устойчивого retry.

Root cause: очередь существовала в памяти Session/потока.

Implemented fix: per-device outbox в той же транзакции, что и уведомление; отдельный poller API либо standalone worker; SKIP LOCKED, уникальность notification/subscription, до 8 повторов, backoff и last_error. Чтение нового процесса восстанавливает очередь. Provider-сеть не блокирует checkout; ошибка отправки не отменяет заказ.

Verification: rollback не оставляет доставки; новая Session подбирает запись; два worker не отправляют её одновременно; retry, startup/shutdown poller, Expo tickets и web 410 покрыты тестами.

Status: PARTIALLY FIXED

Потеря очереди при restart устранена, но доставка остаётся at-least-once.
Crash после provider acceptance до commit может дать повтор. Конечные Expo
delivery receipts не опрашиваются, ticket success не доказывает доставку
на телефон. [Expo описывает различие tickets/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

### DB-01

ID: DB-01

Severity: Medium

Affected files: `backend/app/models/offer.py`, миграция `6ab12d901e34`

Problem: инвариант неотрицательных остатков не защищался самой БД.

Root cause: отсутствие CHECK, несмотря на правильные блокировки API.

Implemented fix: CHECK 0 <= remaining <= total, NOT VALID для сохранения исторических данных без автоматической корректировки.

Verification: отрицательная запись отвергается PostgreSQL; API concurrency и rollback проходят. Historical production rows не проверялись; VALIDATE описан в rollout.

Status: FIXED

### VALIDATION-01

ID: VALIDATION-01

Severity: Medium

Affected files: `backend/app/schemas/patch.py`, `offer.py`, `product.py`, `branch.py`, `business.py`, `auth.py`

Problem: явный null в PATCH non-nullable полей доходил до Python-сравнения или NOT NULL в БД и приводил к 500. Для части строк и ProductCreate цены отсутствовали ограничения модели БД.

Root cause: Optional использовался одновременно для «не передано» и «очистить поле».

Implemented fix: общий PatchModel запрещает null только для NOT NULL полей; nullable description/координаты/часы можно очистить. Добавлены ограничения длины и положительной product price.

Verification: 12 параметризованных PATCH-регрессий → 422 с доступной исходной записью; очистка description → 200; неверные product price/length → 422.

Status: FIXED

### CLIENT-01

ID: CLIENT-01

Severity: Medium

Affected files: оба CartProvider, web AuthProvider, mobile API client, оба pickup-экрана, `lib/pickupErrors.ts`

Problem: при смене владельца save-effect мог записать прежнюю корзину на нового user_id; ранний ownerRef мешал восстановлению при повторном mount effect. Временный 5xx удалял web JWT. Pickup показывал сырой английский текст и допускал быстрые повторные нажатия.

Root cause: ownerRef изменялся до завершения restore; сохранение не проверяло владельца загруженных данных; общая обработка всех non-2xx auth.

Implemented fix: сохранение только после restore конкретного владельца, скрытие старых items; JWT удаляется только по 401 своей сессии; мобильный timeout и безопасные 5xx/429; synchronous ref при pickup, русские сообщения, mobile повторно читает заказ после потерянного ответа.

Verification: browser account-switch check; pickup API race и message helpers; TypeScript/lint. Полное восстановление после сетевого разрыва на устройстве NOT TESTED.

Status: FIXED

### CONFIG-01

ID: CONFIG-01

Severity: Medium

Affected files: backend `config.py`, `main.py`, `database.py`, `.env.example`; `frontend/next.config.ts`; `.github/workflows/ci.yml`; browser runner

Problem: deployment origins зашиты в код; отсутствовал CI; browser runner сохранял fail в JSON, но не устанавливал failing exit code.

Root cause: конфигурация рассчитана на dev; существующие acceptance checks запускались только вручную.

Implemented fix: JSON CORS allowlist с запретом wildcard, localhost defaults; timeout подключения, hide_parameters, sanitized readiness 503; web security headers; CI с отдельной PostgreSQL и клиентскими проверками; browser failing exit code и уникальный временный Chrome profile.

Verification: CORS/readiness tests; локальные checks и 19 browser checks. Workflow создан, remote CI/deployment не запускались.

Status: PARTIALLY FIXED

### DEP-02

ID: DEP-02

Severity: High

Affected files: `mobile/package.json`, `mobile/package-lock.json`; остаточный web dev dependency tree

Problem: npm audit обнаруживает уязвимые Expo/transitive packages.

Root cause: SDK 57 использует query-string/decode-uri-component и tooling glob/minimatch; безопасного предложенного npm обновления в этой SDK-ветке нет.

Implemented fix: применены совместимые audit fixes; критический shell-quote и часть high устранены. expo-camera/location/notifications выровнены по SDK 57 через expo install.

Verification: Expo dependency check, 24 mobile tests, TypeScript и lint проходят. Итог omit=dev: 7 пакетов, 3 high / 4 moderate, 0 critical. Full audit дополнительно учитывает dev tooling; после исправлений web full audit содержит 8 moderate, mobile full audit — 16 (13 moderate/3 high).

Status: PARTIALLY FIXED

Оставшаяся high-цепочка: expo-router → query-string → decode-uri-component.
Остальные production-scope findings: expo / @expo/fingerprint / glob /
minimatch. Часть этих модулей — tooling, хотя установлены через dependencies.
Эксплуатация через конкретный маршрут SAVEAT не проверена. npm предлагает
expo-router 58 и даже downgrade Expo 52; `--force` не применялся. Прямая
подмена decode-uri-component на 0.5.1 меняет CommonJS на ESM, поэтому без
SDK/device regression такой override не добавлен. Следующий шаг — отдельная
совместимая SDK migration с проверкой deep links/Metro/native build.
[Decode advisory](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

### AUTH-02

ID: AUTH-02

Severity: Medium

Affected files: web `components/AuthProvider.tsx` и страницы с bearer fetch

Problem: XSS может прочитать JWT из localStorage.

Root cause: прямые web → API запросы и JavaScript-доступное хранилище. Подтверждено хранение; XSS-эксплойт не обнаружен и не воспроизводился.

Implemented fix: добавлены безопасный logout/revocation и security headers; cookie migration спланирована в PILOT_DEPLOYMENT.md, но не внедрена частично.

Verification: JWT/logout regressions и web checks. HttpOnly/CSRF migration NOT IMPLEMENTED.

Status: PARTIALLY FIXED

Нужен закреплённый web/API origin либо BFF, перевод всех web-запросов,
HttpOnly/Secure/SameSite, Origin/CSRF-защита и multi-tab QA. Mobile остаётся
на JWT. Существующий bearer-контракт сохранён.

### LEGACY-01

ID: LEGACY-01

Severity: Low

Affected files: `backend/app/models/order.py`, `routers/orders.py`, `routers/business_orders.py`

Problem: неполные старые заказы скрываются из истории и возвращают 409 при прямом чтении.

Root cause: нет снимка филиала/адреса/окна выдачи; достоверные исторические значения неизвестны.

Implemented fix: поля и исторические строки сохранены; автоматическое заполнение вымышленными текущими данными не делалось.

Verification: прежний legacy test и новый migration round trip проходят. Production-анализ старых строк NOT EXECUTED.

Status: NOT FIXED

## 3. Что проверено и не требует переписывания

- Checkout и изменение offer блокируют строку; offers берутся в одинаковом
  порядке. US5 negative control по-прежнему доказывает, что снятие FOR UPDATE
  допускает oversell. Защита не заменена клиентской проверкой.
- Отмена блокирует Order, возвращает товары атомарно и не проходит дважды.
- Выдача блокирует Order и проверяет принадлежность филиала бизнесу;
  роли owner/manager/staff проверяются через business_access. Два подтверждения
  дают 200 + 409 и одно уведомление, другая пекарня не получает заказ.
- Код/адрес/цена/время сохраняются snapshot; после бронирования заказ виден
  только владельцу. US3/US5 проходят API и browser acceptance.
- Текущее правило выдачи: reserved/ready/paid можно выдать вне pickup window.
  Нового правила истечения заказа не добавлено; тест закрепляет прежнее поведение.
- Уведомления в приложении уже транзакционные и привязаны к user_id.
  Favorites/subscriptions и изменения branch/product используют ownership checks.
- Список позиций заказов уже загружается пачкой, публичная витрина использует
  join, а не отдельный запрос для каждого offer. Неподтверждённые оптимизации,
  новая пагинация и изменение API без необходимости не вводились.

## 4. Миграции и rollout

1. `6ab12d901e34`: nullable checkout identity и UNIQUE, stock CHECK NOT VALID.
2. `72c98b6a10de`: counters/revoked_sessions, nullable push session hash/expiry.
3. `83fd02a14b7c`: durable push_deliveries.

Все добавлены после прежнего head `a91f37c4e6b2`. Тесты создают схему с нуля,
проверяют metadata и откатывают новые миграции с уже существующим заказом,
после чего восстанавливают head. Код/заказ/остаток сохраняются.
Production миграций не было. Резервная копия, staging, точный порядок выкладки,
VALIDATE CHECK, ограничения rollback и административное одобрение описаны в
[PILOT_DEPLOYMENT.md](PILOT_DEPLOYMENT.md).

Важно: rollback удаляет служебные данные revocation/idempotency/outbox;
без остановки записей и ротации JWT это небезопасный production rollback.
Исторические order columns не удаляются. Новые зависимости backend не добавлялись.

## 5. Добавленные автоматические проверки

- `backend/tests/test_idempotency.py`: 7 тестов checkout identity, гонок, rollback и CHECK.
- `backend/tests/test_security.py`: 13 auth/business/config тестов, включая parametrization.
- `backend/tests/test_push_sessions.py`: 17 transport/session/outbox тестов, включая parametrization.
- `backend/tests/test_pickup_flow.py`: 6 тестов end-to-end API, доступа, race и approval.
- `backend/tests/test_validation.py`: 14 PATCH/price/length тестов.
- `backend/tests/test_migrations.py`: добавлен 1 обратимый round trip.
- Mobile: 9 cart/attempt tests и 2 pickup message tests.
- Web: 2 attempt tests, 2 pickup message tests, 1 logout/account-switch test.
- Browser: сохранены 18 исходных checks, добавлен 1 shared-device cart check.

Совокупно backend вырос на 58 тестов, web на 5, mobile на 11.
Существующие acceptance критерии и прежний журнал не изменены.

## 6. Команды, реально выполненные

Команды ниже запускались из указанных каталогов, некоторые неоднократно
после исправления ошибок. Секреты и действующие .env в отчёт не включены.

```text
# корень
git status --short
git log -3 --oneline
docker info --format '{{.ServerVersion}}'
docker compose -f docker-compose.test.yml up -d --wait
git diff --check

# backend
uv run pytest -q
uv run pytest tests/test_idempotency.py tests/test_concurrent_reservation.py tests/test_migrations.py -q --tb=short
uv run pytest tests/test_security.py tests/test_push_sessions.py -q --tb=short
uv run pytest tests/test_pickup_flow.py -q --tb=short
uv run pytest tests/test_validation.py tests/test_migrations.py tests/test_push_sessions.py -q --tb=short
uv run pytest -v --tb=short
uv run alembic heads
uv run python -m tests.serve
uv run python -c "import inspect; from pywebpush import webpush; print(inspect.signature(webpush))"

# frontend
npm test
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev --json
npm install next@16.4.5 eslint-config-next@16.4.5
npm audit fix
npm install --save-exact next@16.4.5 eslint-config-next@16.4.5 --ignore-scripts
# PowerShell: $env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8011'
npm run dev -- -p 3001

# mobile
npm test
npx tsc --noEmit
npx expo lint
npm audit --omit=dev --json
npm audit fix
npx expo install --check
npx expo install expo-camera expo-location expo-notifications
npm view decode-uri-component@0.5.1 engines type exports repository --json
npm view query-string@9.4.2 engines type exports dependencies --json

# корень, browser на изолированной БД
node backend/tests/browser/run_acceptance.mjs C:\Users\Bexul\Desktop\Saveat backend/tests/acceptance-evidence/2026-11-06
```

Alembic downgrade/upgrade дополнительно выполнялись из автоматического
round-trip test, не через production CLI. Сервисы тестов запускались локально.
Пользовательские untracked каталог Radiance-Cascades… и backend/scripts/seed_offers.py
не изменялись и не добавлялись в commits.

Промежуточные неуспехи: Docker сначала не был запущен (затем запущен);
первая новая миграция ссылалась не на последний head (16 setup errors,
исправлено на a91f37c4e6b2); один pytest запуск из корня не нашёл pytest;
один frontend tsc совпал с регенерацией .next/dev/types при запуске dev
(последовательный повтор PASS); Expo dependency check сначала нашёл 3
несовпадения (исправлены); npm view query-string@9.4.2 вернул 404, пакет
не устанавливался. npm audit fix возвращал exit 1 из-за остаточных advisory,
не из-за падения тестов; --force не использовался. Эти попытки не скрыты
и не считаются успешными итоговыми проверками.

## 7. Оставшиеся ограничения, долг и следующие шаги

1. **До публичного mobile pilot:** устранить DEP-02 через совместимую SDK
   migration и проверить native build/permissions/deep links на iOS/Android.
   Не использовать автоматический downgrade Expo 52 из рекомендации npm.
2. Выполнить полный manual checklist из PILOT_DEPLOYMENT.md. Реальные push,
   камера/QR, maps, offline logout и сетевые разрывы на устройствах NOT TESTED.
3. Проверить deployment origins, TLS, pooler/prepared statements, миграции и
   rollback на staging. Production DB, deployment и нагрузочное тестирование
   не выполнялись. Нет доказательства полной готовности к публичному запуску.
4. Согласовать web-auth cookie/BFF architecture и внедрить AUTH-02 целиком.
   В этой работе localStorage не заменён и полноценный CSP не вводился;
   CSP требует проверки Leaflet, стилей и внешних изображений.
5. Добавить опрос Expo receipts, мониторинг dead-letter outbox и политику
   retention доставок/revoked sessions/counters. Завершённые delivery rows
   пока не очищаются автоматически; revoked rows чистятся при logout,
   просроченные auth buckets — при auth-запросах.
6. Согласовать продуктовые правила окончания pickup window и стратегию
   достоверного восстановления старых snapshots. Старые записи сохранены.
7. Расширить web/mobile component integration tests: сейчас mobile checkout
   UI проверен helper tests/типами, но не renderer/emulator тестом 409.
   CI workflow требует первого запуска на GitHub; мобильный bundle/native
   build в CI пока не включён. Python dependency advisory scan не проводился.
8. Остался известный долг: 7 frontend lint warnings, шум prerender ошибок,
   повторяющиеся web fetch/error handlers, дубли чистых helpers между пакетами,
   списки заказов/витрины без пагинации. Вводить пагинацию после измерения
   объёмов/latency с обновлением обоих клиентов, не менять контракты вслепую.

## 8. Изменённые файлы

Ниже перечислены исходники/конфигурация; новые browser screenshots и JSON
находятся отдельно в evidence-каталоге, указанном выше.
- .github/workflows/ci.yml
- PILOT_DEPLOYMENT.md
- SAVEAT_CODE_AUDIT_AND_FIX_REPORT.md
- backend/.env.example
- backend/alembic/versions/6ab12d901e34_checkout_idempotency.py
- backend/alembic/versions/72c98b6a10de_auth_and_push_sessions.py
- backend/alembic/versions/83fd02a14b7c_push_outbox.py
- backend/app/approve_business.py
- backend/app/auth.py
- backend/app/config.py
- backend/app/database.py
- backend/app/main.py
- backend/app/models/__init__.py
- backend/app/models/auth_state.py
- backend/app/models/offer.py
- backend/app/models/order.py
- backend/app/models/push_delivery.py
- backend/app/models/push_subscription.py
- backend/app/notifications.py
- backend/app/push.py
- backend/app/push_worker.py
- backend/app/rate_limit.py
- backend/app/routers/auth.py
- backend/app/routers/business_auth.py
- backend/app/routers/businesses.py
- backend/app/routers/orders.py
- backend/app/routers/push.py
- backend/app/schemas/auth.py
- backend/app/schemas/branch.py
- backend/app/schemas/business.py
- backend/app/schemas/business_auth.py
- backend/app/schemas/notification.py
- backend/app/schemas/offer.py
- backend/app/schemas/order.py
- backend/app/schemas/patch.py
- backend/app/schemas/product.py
- backend/app/security.py
- backend/tests/README.md
- backend/tests/browser/run_acceptance.mjs
- backend/tests/safety.py
- backend/tests/test_idempotency.py
- backend/tests/test_migrations.py
- backend/tests/test_pickup_flow.py
- backend/tests/test_push_sessions.py
- backend/tests/test_security.py
- backend/tests/test_validation.py
- frontend/AGENTS.md
- frontend/app/business/dashboard/page.tsx
- frontend/app/business/pickup/page.tsx
- frontend/app/cart/page.tsx
- frontend/components/AuthProvider.tsx
- frontend/components/CartProvider.tsx
- frontend/components/PushSubscription.tsx
- frontend/lib/checkoutAttempt.test.ts
- frontend/lib/checkoutAttempt.ts
- frontend/lib/pickupErrors.test.ts
- frontend/lib/pickupErrors.ts
- frontend/lib/pushSession.test.ts
- frontend/lib/pushSession.ts
- frontend/next.config.ts
- frontend/package-lock.json
- frontend/package.json
- frontend/public/sw.js
- mobile/app/(tabs)/index.tsx
- mobile/app/business/pickup.tsx
- mobile/app/cart.tsx
- mobile/components/BusinessGuard.tsx
- mobile/contexts/AuthContext.tsx
- mobile/contexts/CartContext.tsx
- mobile/lib/api.ts
- mobile/lib/cartAvailability.test.ts
- mobile/lib/cartAvailability.ts
- mobile/lib/checkoutAttempt.ts
- mobile/lib/pickupErrors.test.ts
- mobile/lib/pickupErrors.ts
- mobile/lib/push.ts
- mobile/lib/storage.ts
- mobile/package-lock.json
- mobile/package.json
- mobile/types/api.ts

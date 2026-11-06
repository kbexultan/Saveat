# SAVEAT — follow-up stabilization, 7 ноября 2026

Дата: 2026-11-07, Asia/Qyzylorda (UTC+5). Основа: актуальный `main`
`10d0aa3`, содержащий merged PR #3. Ветка: `fix/ci-cancellation-stabilization`.
**Pull Request:** https://github.com/kbexultan/Saveat/pull/4 (не слит).
Предыдущий отчёт сохраняет исторические результаты; этот файл описывает новые проверки.

## Результат

| Проверка | Passed | Failed | Skipped / ограничения |
| --- | ---: | ---: | --- |
| Backend Pytest | 117 | 0 | 0; 3 прежних warnings |
| Web Node tests | 33 | 0 | 0 |
| Mobile Node tests | 25 | 0 | 0 |
| Expo fingerprint compatibility | 3 | 0 | 0; отдельно от mobile unit tests |
| Chrome browser acceptance | 30 | 0 | 0; сохранены все 19 прежних проверок |
| Web/mobile TypeScript | PASS | 0 errors | — |
| Web lint | PASS | 0 errors | 7 прежних warnings |
| Expo lint / Expo dependency check | PASS | 0 errors | SDK 57 совместим |
| Web production build | PASS | — | 23 routes; прежние диагностические сообщения prerender |
| Web npm audit, omit=dev | 0 findings | — | exit 0 |
| Mobile npm audit, omit=dev | 3 High / 0 Moderate | — | exit 1; было 3 High / 4 Moderate |
| Полный npm audit web / mobile | 8 Moderate / 3 High + 10 Moderate | — | dev tooling включён, exit 1 |

Локальная проверка выполнена после `npm ci` в обоих клиентах. Тестовая БД:
изолированный Docker PostgreSQL 17, `127.0.0.1:54329/saveat_test`, через guard
`tests.safety`. Подключений к production Supabase не было.

Скриншоты и четыре полных JSON-аудита: `backend/tests/acceptance-evidence/2026-11-07/`.
`browser-results.json` содержит 30 успешных assertions. Скриншоты исходного CI
скачаны и просмотрены; новые screenshots выдачи и отказа отмены также проверены.

## CI-01 — гонка восстановления web-корзины

**Severity: High. Status: FIXED AND TESTED.**

Исходный [run 42277263641](https://github.com/kbexultan/Saveat/actions/runs/42277263641)
прошёл 107 API tests, frontend и mobile jobs, затем завершился таймаутом ожидания
«Подтвердить бронирование» во втором браузерном сценарии. Полный job log и ZIP
artifact `13534585181` изучены: 8 успешных US3 assertions, 5 screenshots и RUN failure.
Снимка страницы непосредственно в момент сбоя не было. Сбор текстового snapshot
сам содержал ошибку экранирования перевода строки и возвращал пустой результат.

Локально обычный запуск проходил. При CPU throttling Chrome x6 получен тот же
таймаут; исправленная диагностика показала `/cart` и «Корзина пустая» при успешных
`/auth/login` и `/auth/me` (HTTP 200). Это гонка клиента: `OfferCard` мог вызвать
`addItem` до окончания auth/cart restore, затем отложенный restore заменял новую
позицию сохранённой пустой корзиной. Тест дополнительно начинал навигацию сразу
после появления JWT, до завершения `/auth/me` и `router.replace`; `goto` мог
прочитать readyState предыдущего документа. Быстрый full reload после добавления
также обходил обычный клиентский переход. Это не ошибка кириллицы в кнопке.
Точную последовательность планировщика исходного GitHub run восстановить нельзя;
воспроизведён тот же симптом, а причинная гонка проверена управляемым запросом.

Исправления:

- CartProvider публикует `ready` только после восстановления владельца; `addItem`
  отвергает раннее добавление. OfferCard блокирует кнопку до готовности.
- Cart page показывает загрузку, пока состояние не восстановлено.
- Browser login ждёт завершения redirect и профиля; навигация ждёт нового loaderId,
  нужного URL и документа. Переход в корзину проходит через реальную кнопку UI.
- Тест удерживает `/auth/me` через CDP Fetch, проверяет невозможность преждевременного
  добавления, отпускает запрос, затем проверяет добавление и full reload.
- Ошибки сохраняют текст, URL, screenshots, console и HTTP statuses; CI сохраняет
  API/Next logs. CDP-команды ограничены временем, контексты закрываются до reseed.
  Старые acceptance assertions сохранены; увеличения таймаутов нет.

Контроль регрессии: временный возврат старой OfferCard сделал новую проверку
`CART-RESTORE` красной. Исправленная версия проходит локально и в Linux GitHub CI.
Повтор CI с одной диагностикой тоже прошёл, подтверждая непостоянство исходного сбоя.

## CANCEL-01 — US8-AC2

**Severity: High. Backend/web: FIXED AND TESTED. Mobile: FIXED BUT NOT DEVICE-TESTED.**

Прочитан исходный `IT_PM_A6_A7_Saveat_Report.docx` из Downloads. В backlog US8/F8:
“As a customer, I want to cancel a booking before the pickup time starts, so that
the item becomes available to others.” В этом документе подробная Section 3
раскрывает US3/US5; точная формулировка US8-AC2 дана в задании от 7 ноября.
Она совпадает с исходной US8. Противоречия требований не найдено. Старый код,
разрешавший любой `reserved`, расходился с этой историей.

Теперь разрешён только `reserved` с `database_time < order.pickup_start`.
На границе и после неё ответ `409` с detail
`Order cannot be cancelled once pickup has started`. Авторизация, order lock и
сортированные offer locks сохранены. Проверка идёт **после всех блокировок**,
перед изменениями, по PostgreSQL `clock_timestamp()`: `now()` вернул бы время
начала транзакции и мог бы разрешить позднюю отмену после ожидания блокировки.
При отсутствии pickup_start применяется отказ. Отклонённая отмена не возвращает
stock, не меняет статус и не создаёт уведомления/outbox. Повторная отмена и уже
полученный заказ сохраняют прежние 409. Правила выдачи вне pickup window не менялись.

В обеих web-страницах и mobile detail кнопка разрешена только до начала выдачи
для reserved; время обновляется на открытом экране. Mobile больше не предлагает
отменять paid/ready, которые API и раньше отклонял. Решение API окончательное при
расхождении часов/устаревшем экране. Отказ по времени показывается по-русски.

8 новых API checks: до/ровно/после границы, double cancel, после pickup, два случая
cancel-vs-pickup и пересечение границы во время реального ожидания row lock.
Проверяются stock, status, Notification и PushDelivery. Гонки подтверждаются
`pg_stat_activity`, а не случайными задержками. Pure helper tests покрывают
границу, timezone offsets, статусы и некорректные даты в обоих клиентах.
Браузер проверяет отказ на открытом устаревшем экране и отсутствие кнопки после
загрузки актуального заказа в confirmation/history.

## CHECKOUT / PICKUP / DB / PUSH — повторная проверка

**Status: FIXED AND TESTED для автоматизированных гарантий.**

Сохранены US3/US5, sorted row locking, atomic checkout, CHECK stock bounds,
user-scoped idempotency и контроль доступа к истории. Прежние concurrent tests,
включая negative control без блокировки, проходят. Новый браузерный тест получает
реальный 201, проверяет наличие заказа в PostgreSQL, затем обрывает **ответ** через
CDP. После reload корзина и ключ остаются; retry возвращает тот же заказ,
orders=1 и stock списан один раз. Ошибка не симулируется до commit.

Новые API tests проходят регистрацию, login, публичную витрину, checkout,
pickup и историю, а также запрещают pending-бизнесу POST /offers и публичную
видимость. Сохранены проверки чужой пекарни, неактивного сотрудника, customer
без роли, duplicate pickup и cancelled order. Browser проходит реальный staff
lookup/confirm и обновление customer history до «Получен».

Проверены миграции PR #3: `a91f37c4e6b2 → 6ab12d901e34 → 72c98b6a10de → 83fd02a14b7c`.
Новых миграций нет. Fresh upgrade, metadata comparison, downgrade/upgrade с
сохранением заказа, pickup code и остатков проходят. CHECK остаётся NOT VALID
для исторических строк; UNIQUE idempotency, revoked sessions и outbox сохранены.
Production rollout и backup/restore не выполнялись; процедура в PILOT_DEPLOYMENT.md.

17 push/session tests подтверждают rollback без delivery, durable outbox,
изоляцию A/B, logout/expiry, SKIP LOCKED, retry, отсутствие provider-сети в checkout,
обработку web 410 и Expo tickets. **PARTIALLY FIXED:** Expo final receipts пока не
опрашиваются; delivery at-least-once может повториться после crash между приёмом
провайдером и commit. Offline logout не отзывает уже принятый OS banner; generic
payload не раскрывает заказ. Реальная доставка на устройство **NOT TESTED**.

## DEP-03 — совместимые исправления mobile dependencies

**Status: PARTIALLY FIXED.** Production audit: 7 → 3 затронутых пакета.

SDK остаётся 57 (lock: Expo 57.0.32, Router 57.0.30). Обновлены только зависимости
`@expo/fingerprint`: scoped overrides `glob=14.0.4`, `minimatch=11.0.5`. Эти версии
сохраняют CommonJS exports, используемые fingerprint; glob 14 уже применяется
остальными Expo tools в этом lockfile. Проверены реальные вызовы `glob`, Minimatch
pattern/negation/match, ignore files и стабильное fingerprint generation проекта
до и после изменения. 3 compatibility tests добавлены в CI, плюс Expo install check.
`npm ci` и `npm ls` подтверждают корректное разрешение без invalid dependencies.
Native modules, camera, maps, notifications и Router не обновлялись через override.

Закрыты production [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
и [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Оставшиеся advisories (полные цепочки и ranges сохранены в audit JSON):

| Advisory | Где остаётся | Решение / статус |
| --- | --- | --- |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), malformed percent decoding | Mobile production decode-uri-component 0.2.2 через query-string 7.1.3 / Expo Router 57 | NOT FIXED |
| [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f), quadratic decoding DoS | Та же цепочка, 3 High затронутых пакета | NOT FIXED; нужен совместимый SDK migration |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), globparts amplification | Web и mobile dev ESLint / typescript-eslint цепочки | NOT FIXED в dev tooling; production fingerprint исправлен |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), uuid buffer bounds | Mobile dev @expo/ngrok → uuid 3 | NOT FIXED; npm fixAvailable=false |

Нельзя подменять decoder 0.2 на 0.5.1 без адаптации: исправленный пакет ESM, а
query-string 7 вызывает CommonJS require как функцию. Все опубликованные Router 57
patches сохраняют query-string ^7.1.3. npm предлагает Router 58; перенос только
Router без согласованного SDK/native набора не выполнен. `npm audit fix --force`
и downgrade Expo не применялись. План SDK 57→58 и device matrix — в deployment doc;
опора: [официальный Expo upgrade workflow](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## AUTH-02 — web HttpOnly/BFF

**Status: BLOCKED BY DEPLOYMENT DECISIONS; localStorage risk NOT FIXED.**

Проверены AuthProvider, login/register, customer/business consumers, cart, push и
конфигурация API origins. Web использует прямые cross-origin bearer fetch; в
репозитории нет утверждённых production web/API origins, reverse-proxy/BFF route
contract и server runtime topology. Прочитано локальное руководство Next 16.4.5
по server sessions/cookies. Одна замена localStorage на cookie сломала бы запросы.
Полная миграция требует выбранного same-origin BFF либо точной cookie/CORS policy,
CSRF, expiry, server logout/revocation, account switch и multi-tab протокола.
Конкретный контракт и проверки добавлены в PILOT_DEPLOYMENT.md. Миграция и её
HTTPS/multi-tab acceptance **не выполнены**; текущий browser account isolation
не является доказательством полной multi-tab безопасности. Mobile SecureStore
и bearer API сохранены.

## Коммиты и GitHub

- `7dddd86`: диагностические артефакты CI; первоначальный повтор прошёл случайно.
- `a9f7a28`: US8 API/clients и boundary/concurrency tests.
- `a92b0a4`: cart restore и детерминированные browser journeys.
- `e17b5e0`: scoped dependency fixes и fingerprint CI checks.
- `de94a4d`: registration/pending business tests и дополнительные screenshots.
- Отчёт и evidence добавлены отдельным заключительным коммитом в той же ветке.

Проверенные полные CI runs:
[a92b0a4](https://github.com/kbexultan/Saveat/actions/runs/42299526493),
[e17b5e0](https://github.com/kbexultan/Saveat/actions/runs/42300090281),
последний коммит с кодом `de94a4d` — push
[42300348699](https://github.com/kbexultan/Saveat/actions/runs/42300348699) и pull_request
[42300412092](https://github.com/kbexultan/Saveat/actions/runs/42300412092): все 3 jobs
(`backend-and-browser`, `clients (frontend)`, `clients (mobile)`) PASS.
Заключительный коммит меняет только документацию и evidence; его CI-статус виден в
[PR #4 / checks](https://github.com/kbexultan/Saveat/pull/4/checks).
PR не сливается автоматически. GitHub connector вернул 422 `must be a collaborator`
при создании PR; PR создан через уже настроенную Git-авторизацию, без вывода токена.

## Воспроизведение и ограничения

```text
docker compose -f docker-compose.test.yml up -d --wait
# backend
uv run pytest -v --tb=short
# frontend
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
# mobile
npm ci
npm test
npm run test:fingerprint
npx tsc --noEmit
npx expo lint
npx expo install --check
npm audit --omit=dev
# browser: команды запуска двух guarded test servers — backend/tests/README.md
node backend/tests/browser/run_acceptance.mjs <repo> backend/tests/acceptance-evidence/<date>
```

Промежуточные неуспехи зафиксированы: исходная гонка на CPU x6; отрицательный
контроль старой кнопки; первая версия response interception захватила OPTIONS 200
(исправлено на настоящий POST 201); один US8 browser run использовал ещё старый
API-процесс без autoreload (перезапущен); новая registration fixture сначала не
передавала обязательный phone; первоначальные ожидания fingerprint fixture не
соответствовали старому glob/ignore поведению (исправлены и проверены до upgrade).
Обычные npm install/update/dedupe оставляли прежний вложенный glob invalid; lock
переразрешён в отдельном временном каталоге и проверен чистым npm ci. В финальном
lock нет invalid dependencies. Это не успешные проверки, итоговые counts — выше.

Физических устройств/эмуляторов нет (adb/emulator не найдены). Подписанные
Android/iOS builds, камера/QR scan, карты, deep links, реальные push, offline logout,
production/staging rollout, production backup/restore и нагрузочное тестирование
**NOT TESTED**. Python dependency advisory scan не выполнялся. Старые legacy orders
сохранены, их backfill не выполнялся. Полной готовности к публичному pilot этот
отчёт не утверждает. Academic Excel/презентации и пользовательские untracked файлы
не изменялись.

Изменённые области: `.github/workflows/ci.yml`; `backend/app/routers/orders.py`;
`backend/tests/test_cancellation_window.py`, `test_pickup_flow.py`, `browser/*`,
`tests/README.md`, новый evidence-каталог; web `CartProvider`, `OfferCard`,
`app/cart`, обе `app/orders` pages, `lib/orders.ts`, `lib/cancellation*`, `hooks/useNow`;
mobile `app/orders/[id].tsx`, `lib/cancellation*`, `hooks/useNow`, `package*.json`,
`tests/fingerprint-compat.test.cjs`; два отчёта и `PILOT_DEPLOYMENT.md`.

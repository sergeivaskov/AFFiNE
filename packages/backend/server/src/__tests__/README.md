# Тестовое покрытие AFFiNE Backend (EPIC-01)

## Обзор

Unit-тесты для функциональности correlation_id в AFFiNE backend.

## Тесты

### `base/utils/__tests__/request.spec.ts`

Проверяет корректность обработки `X-Correlation-ID` header в утилитных функциях.

**Тест-кейсы:**

1. `getRequestIdFromRequest uses X-Correlation-ID header if present` - приоритет X-Correlation-ID
2. `getRequestIdFromRequest falls back to x-cloud-trace-context if no X-Correlation-ID` - fallback логика
3. `getRequestIdFromRequest generates new ID if no headers present` - генерация нового ID
4. `genRequestId generates ID with correct format` - проверка формата `affine:http:UUID`
5. `getRequestIdFromRequest prioritizes X-Correlation-ID over trace context` - проверка приоритетов

## Запуск тестов

### Через mcp-tester

```bash
mcp-tester run_tests_and_analyze --target_path "apps/web-app/packages/backend/server/src/base/utils/__tests__/request.spec.ts"
```

### Напрямую в контейнере

```bash
docker-compose exec affine-server yarn ava src/base/utils/__tests__/request.spec.ts
```

### С покрытием кода

```bash
docker-compose exec affine-server yarn ava --coverage src/base/utils/__tests__/request.spec.ts
```

## Результаты

✅ Все 7 тестов проходят успешно

## Интеграция с ClsModule

Тесты проверяют утилитные функции. Интеграция с `ClsModule` (в `app.module.ts`) покрыта через:

- Настройку middleware для extraction correlation_id из headers
- Проброс correlation_id в response headers (`X-Correlation-ID`, `X-Request-Id`)

## Связанные компоненты

- `apps/web-app/packages/backend/server/src/base/utils/request.ts` - утилиты для работы с request
- `apps/web-app/packages/backend/server/src/app.module.ts` - конфигурация ClsModule
- `apps/web-app/packages/backend/server/src/base/logger/service.ts` - logger с correlation_id

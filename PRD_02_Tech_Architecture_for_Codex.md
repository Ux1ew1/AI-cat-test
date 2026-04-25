# PRD 02 — Technical PRD / Architecture для Codex

## 1. Техническая цель
Собрать единый кодовый базис для приложения с поддержкой:
- iOS
- Android
- Web

Приложение должно быть **mobile-first**, с возможностью запуска в браузере и последующей упаковки в мобильные приложения.

## 2. Рекомендуемый стек технологий

### Frontend
- **React**
- **TypeScript**
- **Ionic React** для mobile-first UI и веб-совместимого интерфейса
- **Capacitor** для сборки iOS/Android приложений
- **React Router** для маршрутизации
- **Zustand** для UI/state management
- **TanStack Query** для работы с async-состояниями и будущим серверным слоем
- **React Hook Form + Zod** для форм и валидации
- **i18next / react-i18next** для RU/EN локализации
- **Framer Motion** для мягких анимаций и page transitions

### Локальное хранение
MVP:
- **IndexedDB** для Web
- **Capacitor Preferences** для простых настроек
- **локальная абстракция storage adapter** для заметок и чатов

Рекомендуемая реализация:
- использовать общий repository layer;
- в MVP можно начать с **Dexie** на Web и web-friendly abstraction;
- для мобильных сборок держать storage API абстрактным, чтобы позже перейти к SQLite-based слою без переписывания UI.

### Голосовой ввод
- Web Speech API для браузера, где доступно
- Capacitor/native speech recognition plugin для мобильных платформ
- единый `speechService` интерфейс

### Backend / Server Proxy
- **Node.js**
- **TypeScript**
- **Fastify** или **Hono**
- API proxy для OpenRouter
- отдельные endpoints:
  - `POST /ai/summarize-note`
  - `POST /ai/chat`

### Внешний ИИ
- **OpenRouter API**
- модель выбирается через `.env`

### Будущий backend для синхронизации
Рекомендуемый путь:
- **Supabase** как основной backend для auth + Postgres + storage + realtime
- если позже действительно понадобится сильный offline-first sync между устройствами с локальной SQLite-моделью, рассмотреть **PowerSync поверх Supabase**

## 3. Почему именно такой стек

### Почему Ionic React + Capacitor
Этот вариант лучше подходит под задачу «сначала mobile-first, но обязательно браузер тоже», потому что:
- один веб-ориентированный UI-слой;
- быстрый старт;
- хорошая адаптация под мобильные паттерны;
- упаковка в iOS/Android через Capacitor;
- удобно делать мягкие переходы между экранами и декоративные UI-эффекты.

### Почему не хранить OpenRouter ключ на клиенте
Потому что приложение работает в браузере. Любой ключ, попавший в frontend, можно извлечь. Поэтому ключ должен лежать только на сервере, а frontend должен обращаться к своему proxy.

### Почему Supabase на будущее
Для второй фазы Supabase удобен как базовый backend с Postgres, Auth и сопутствующими сервисами. Если в будущем критично понадобится выраженный local-first/offline-first sync, PowerSync документирует интеграцию с Supabase и клиентские SDK для React Native и JavaScript Web. Appwrite тоже документирует offline sync и интеграции с RxDB, но для данного проекта старт с Supabase выглядит более прямым вариантом, особенно если сначала нужен MVP с локальным хранением и простой путь к облачной синхронизации. 

## 4. Архитектурные модули

### 4.1 Frontend app shell
Содержит:
- layout;
- tab navigation;
- theme provider;
- i18n provider;
- route transitions;
- cat widget placeholder.

### 4.2 Feature modules
#### Notes
- notes list
- note editor
- note detail
- AI processing state
- original/processed toggle

#### Chat
- chat list
- create chat
- rename chat
- delete chat
- conversation screen
- message composer

#### Settings
- language switch
- AI model label display
- future sync settings placeholder

### 4.3 Services
- `aiService`
- `notesService`
- `chatService`
- `speechService`
- `storageService`
- `i18nService`

### 4.4 Repositories
- `notesRepository`
- `chatsRepository`
- `messagesRepository`
- later: `syncRepository`

### 4.5 Backend proxy
- request validation
- prompt templates
- OpenRouter auth
- rate limiting
- logging without leaking private content
- safe error mapping for client

## 5. Предлагаемая структура проекта

```text
/apps
  /client
    /src
      /app
      /pages
      /features
        /notes
        /chat
        /settings
      /components
      /services
      /repositories
      /store
      /i18n
      /theme
      /types
      /utils
  /server
    /src
      /routes
      /services
      /prompts
      /schemas
      /lib
/packages
  /shared
    /types
    /constants
    /schemas
```

## 6. Модели данных

### Note
```ts
interface Note {
  id: string;
  title: string;
  originalText: string;
  processedText: string;
  summary: string;
  language: 'ru' | 'en';
  sourceType: 'text' | 'voice';
  status: 'draft' | 'processed' | 'error';
  createdAt: string;
  updatedAt: string;
}
```

### Chat
```ts
interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messageCount: number;
}
```

### Message
```ts
interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sourceType: 'text' | 'voice';
  model?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}
```

## 7. API contract для proxy

### POST `/ai/summarize-note`
Request:
```json
{
  "text": "user raw note",
  "language": "ru"
}
```

Response:
```json
{
  "summary": "short summary",
  "processedText": "clean rewritten version",
  "title": "optional generated title",
  "model": "model-name"
}
```

### POST `/ai/chat`
Request:
```json
{
  "chatId": "uuid",
  "message": "user message",
  "language": "ru",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response:
```json
{
  "reply": "assistant text response",
  "model": "model-name"
}
```

## 8. Prompt strategy

### 8.1 Prompt for notes
Цель:
- сохранить смысл оригинала;
- сделать текст чище и понятнее;
- вернуть короткое резюме;
- не придумывать факты.

### 8.2 Prompt for chat
Цель:
- давать дружелюбный, понятный, текстовый ответ;
- отвечать на языке пользователя;
- не быть излишне многословным без причины.

## 9. UX-технические детали

### Переходы между вкладками
- tabs switch анимируется горизонтальным slide;
- при смене вкладки направление вычисляется по индексу таба;
- кот получает `direction: left | right` и `state: idle | moving`.

### Placeholder кота
Пока сделать:
- спрайт/контейнер с состояниями;
- пропсы для будущей анимации;
- возможность легко заменить заглушку на sprite-sheet / Lottie / canvas animation позже.

## 10. Локальное хранение — правила
- запись в хранилище после каждого значимого изменения;
- optimistic UI;
- миграции структуры данных через версию схемы;
- no data loss при падении ответа API.

## 11. Синхронизация в Phase 2

### Рекомендуемый путь
#### Phase 2A
- Supabase Auth
- Supabase Postgres
- профили пользователей
- таблицы notes/chats/messages
- синхронизация только после логина

#### Phase 2B
- если нужен сильный offline-first опыт на нескольких устройствах, добавить PowerSync поверх Supabase
- локальная БД на клиенте становится основой UX, а сервер — источником синхронизации

### Почему не делать облако сразу
- MVP быстрее и дешевле;
- меньше точек отказа;
- проще проверить полезность продукта;
- можно не тратить время на auth/sync до появления реальной потребности.

## 12. Безопасность
- ключ OpenRouter только на сервере;
- `.env` не коммитить;
- `.env.example` коммитить;
- базовая rate limit защита на proxy;
- логировать только технические метаданные;
- не логировать полные пользовательские тексты без явной необходимости.

## 13. Производительность
- lazy loading экранов;
- мемоизация тяжёлых списков;
- виртуализация списков при необходимости;
- дебаунс не нужен для обычного чата, но нужен для поиска в будущем;
- минимизировать лишние re-render при печати.

## 14. Тестирование

### Unit
- repositories
- prompt mappers
- response parsers
- validation schemas

### Integration
- note summarize flow
- chat send/reply flow
- local persistence flow

### E2E
- create note
- toggle original text
- create chat
- rename chat
- delete chat
- switch language

## 15. Пошаговая последовательность разработки

### Этап 1 — Foundation
1. Поднять monorepo или простой repo с `client` и `server`.
2. Настроить TypeScript.
3. Настроить lint/format.
4. Подключить Ionic React и базовый layout.
5. Подключить Capacitor.
6. Настроить i18n.
7. Подключить тему в кремовых тонах.

### Этап 2 — Navigation shell
1. Реализовать tab navigation.
2. Создать маршруты Notes / Chat / Settings.
3. Добавить базовые page transitions.
4. Встроить placeholder кота.

### Этап 3 — Domain models & storage
1. Создать shared types.
2. Реализовать repository interfaces.
3. Сделать local adapters.
4. Подключить CRUD для notes.
5. Подключить CRUD для chats/messages.

### Этап 4 — Notes feature
1. Экран списка заметок.
2. Экран деталки заметки.
3. Создание заметки.
4. Редактирование заметки.
5. UI блока summary.
6. UI блока processed text.
7. UI блока original text toggle.

### Этап 5 — Chat feature
1. Список чатов.
2. Новый чат.
3. Rename/delete chat.
4. Экран сообщений.
5. Composer.
6. Loading/error/retry states.

### Этап 6 — Speech input
1. Абстракция speech provider.
2. Web speech implementation.
3. Mobile speech implementation.
4. Предпросмотр распознанного текста.

### Этап 7 — AI backend proxy
1. Поднять Fastify/Hono сервер.
2. Подключить `.env`.
3. Сделать OpenRouter client.
4. Реализовать route summarize-note.
5. Реализовать route chat.
6. Добавить schema validation.
7. Добавить error mapping.

### Этап 8 — Connect frontend to AI
1. Подключить note summarize flow.
2. Подключить chat flow.
3. Сохранять результаты локально.
4. Не удалять пользовательский raw text при ошибках.

### Этап 9 — QA polish
1. Проверить браузер.
2. Проверить Android shell.
3. Проверить iOS shell.
4. Проверить локализацию.
5. Проверить пустые состояния.
6. Проверить удаление и rename.
7. Проверить длинные тексты.

### Этап 10 — Prepare for sync
1. Выделить `syncAdapter` interface.
2. Не смешивать local storage с UI напрямую.
3. Подготовить серверные DTO под будущую синхронизацию.
4. Оставить feature flag для cloud sync.

## 16. Требования к результату от Codex
Codex должен выдать:
- рабочую структуру проекта;
- клиент и сервер;
- безопасное подключение OpenRouter;
- mobile-first UI;
- заметки и чат с локальным хранением;
- RU/EN локализацию;
- заготовку для котика и будущих анимаций;
- код, который можно расширить до Supabase sync без полной переделки.

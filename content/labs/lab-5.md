## Тема, Мета, Місце розташування

**Тема:** Безпека та продуктивність серверних додатків: безпека Node.js-додатків, оптимізація запитів і кешування, тестування API.

**Мета:** посилити безпеку серверної частини застосунку StudySpace, реалізувати Redis-кешування для REST API, оптимізувати маршрут отримання курсів, додати валідацію даних для контентних маршрутів, підготувати автоматизовані тести та перевірити роботу застосунку в умовах кешування й обмеження запитів.

**Місце розташування:**
- Репозиторій власного веб-застосунку (GitHub): [посилання](https://github.com/awwsonny26/StudySpace)
- Репозиторій звітного HTML-документа (GitHub): [посилання](https://github.com/awwsonny26/IO-35_appRECORD-NovakivskaSofia-FIOT-2026)
- Звітний HTML-документ (Жива сторінка): [посилання](https://awwsonny26.github.io/IO-35_appRECORD-NovakivskaSofia-FIOT-2026/)

---

## Опис середовища розробки

Для виконання п'ятої лабораторної роботи було використано Node.js, Express.js, MySQL, Sequelize ORM, Redis, Docker Compose, а також пакети `helmet`, `cors`, `redis`, `jest` і `supertest`. За основу взято вже розширений серверний застосунок StudySpace, у якому після попереднього етапу були наявні логування, завантаження файлів, моніторинг стану сервера та структурована middleware-архітектура.

У межах цієї роботи сервер було посилено одразу в кількох напрямах. На рівні безпеки додано `helmet`, контроль CORS, загальний API rate limiting, зменшено довірений розмір JSON-запитів і доповнено серверну валідацію для маршрутів категорій та курсів. На рівні продуктивності реалізовано Redis-кешування, оптимізовано маршрут отримання курсів за рахунок пагінації, фільтрації та індексів у моделях, а також розширено діагностику сервера інформацією про стан кешу. Для автоматизованої перевірки було підготовлено тести на `jest` і `supertest`.

---

## Основні можливості реалізованого застосунку

- захисні HTTP-заголовки через `helmet`;
- контроль доступних origin через `cors`;
- глобальне обмеження кількості API-запитів через `express-rate-limit`;
- обмеження розміру JSON-запиту через `express.json({ limit: '100kb' })`;
- серверна валідація параметрів `page`, `limit`, `search`, `categoryId`;
- окрема валідація для створення та редагування курсів і категорій;
- підключення Redis через `docker-compose` і окремий cache-service;
- кешування результатів `GET /api/courses`;
- кешування результатів `GET /api/categories`;
- заголовок `X-Cache: MISS/HIT` для наочного контролю роботи кешу;
- автоматичне очищення кешу після `POST`, `PUT` і `DELETE`;
- оптимізація `GET /api/courses` через пагінацію, фільтри та вибір тільки потрібних полів;
- індекси в Sequelize-моделях для `categoryId`, `title` і `name`;
- маршрут `GET /api/status`, який тепер повертає також діагностику Redis-кешу;
- автоматизовані тести безпеки і кешування через `jest` та `supertest`.

---

## Хід виконання

### Підготовка проєкту та залежностей

На першому етапі до проєкту StudySpace було додано пакети `helmet`, `cors` і `redis`, а також `jest` і `supertest` для автоматизованого тестування. Окремо в `package.json` було додано сценарій запуску тестів.

```json
{
  "scripts": {
    "test": "NODE_ENV=test jest --runInBand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "helmet": "^8.1.0",
    "redis": "^5.8.2"
  },
  "devDependencies": {
    "jest": "^30.4.2",
    "supertest": "^7.2.2"
  }
}
```

Також файл `.env.example` було доповнено параметрами `REDIS_HOST`, `REDIS_PORT`, `REDIS_ENABLED`, `API_WINDOW_MS`, `API_MAX_REQUESTS` і `CACHE_TTL_SECONDS`, щоб керування безпекою та кешуванням виконувалося через змінні середовища.

### Додавання Redis у docker-compose

Для виконання вимоги щодо Redis-кешування конфігурацію `docker-compose.yml` було розширено новим сервісом `redis`, який запускається поряд з MySQL та має власну healthcheck-перевірку.

```yaml
redis:
  image: redis:7.4-alpine
  container_name: studyspace-redis
  restart: unless-stopped
  ports:
    - "${REDIS_PORT:-6379}:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
```

Такий підхід дозволяє піднімати базу даних і кешуючий шар однією командою `docker compose up -d`, що зручно для локального тестування та демонстрації роботи застосунку.

### Посилення безпеки застосунку через Helmet і CORS

У файлі `server/app.js` до застосунку було підключено `helmet`, який додає захисні HTTP-заголовки, а також `cors` із дозволом лише для configured frontend origin або запитів без заголовка `Origin`.

```js
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === allowedOrigin) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin is not allowed.'));
    },
    credentials: true
  })
);
```

Завдяки цьому сервер почав повертати заголовки безпеки на кшталт `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` і `Strict-Transport-Security`, що підвищує базовий рівень захисту Node.js-додатку.

### Глобальний API rate limiting і контроль розміру запитів

Окрім наявного rate limit для логіну, у проєкті було додано ще й загальний `apiLimiter`, який застосовується до всіх маршрутів `/api`. Це допомагає зменшити ризик flood-запитів і демонструє ще один практичний рівень захисту backend-застосунку.

```js
const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.API_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false
});
```

Окремо JSON-parser було обмежено значенням `100kb`, щоб сервер не приймав надмірно великі JSON-запити без потреби.

```js
app.use(express.json({ limit: '100kb' }));
```

### Створення Redis cache-service

Для роботи з кешем було винесено окремий модуль `server/services/cache.service.js`. У ньому реалізовано підключення до Redis, читання JSON-даних, запис із TTL, очищення груп ключів за префіксом і повернення поточного стану кешу.

```js
const connectCache = async () => {
  const cacheClient = ensureClient();

  try {
    await cacheClient.connect();
    cacheReady = true;
    lastError = null;
  } catch (error) {
    cacheReady = false;
    lastError = error.message;
  }
};
```

Для запису кешованих відповідей використовується TTL, який задається через `CACHE_TTL_SECONDS`:

```js
await client.set(key, JSON.stringify(value), {
  EX: ttlSeconds
});
```

Якщо Redis недоступний, застосунок не завершує роботу аварійно, а продовжує працювати без кешу, що робить сервер більш стійким до локальних проблем інфраструктури.

### Оптимізація маршруту GET /api/courses

Головним маршрутом для оптимізації було обрано `GET /api/courses`. У попередній реалізації він повертав повний список курсів без пагінації й без окремого керування обсягом вибірки. У межах цієї роботи маршрут було змінено так, щоб він підтримував параметри `page`, `limit`, `search` і `categoryId`.

```js
const page = Number(req.query.page) || 1;
const limit = Number(req.query.limit) || 10;
const search = req.query.search?.trim() || '';
const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
```

Запит до бази тепер виконується через `findAndCountAll`, що дозволяє повертати і самі записи, і дані для пагінації.

```js
const { count, rows } = await Course.findAndCountAll({
  where,
  attributes: courseAttributes,
  include: [
    {
      model: Category,
      as: 'category',
      attributes: ['id', 'name']
    }
  ],
  limit,
  offset,
  order: [['id', 'ASC']]
});
```

У відповіді додатково формується блок `pagination`, а також невеликий блок `performance`, який містить час виконання запиту до БД.

### Реалізація Redis-кешування для курсів і категорій

Результат оптимізованого маршруту `GET /api/courses` кешується в Redis окремо для кожної комбінації параметрів пагінації та фільтрів. Для цього формується cache key з урахуванням `page`, `limit`, `search` і `categoryId`.

```js
const cacheKey = `${courseCachePrefix}:page=${page}:limit=${limit}:search=${search || 'all'}:category=${categoryId || 'all'}`;
```

Якщо дані вже є в Redis, сервер повертає їх без повторного звернення до MySQL і додає заголовок:

```js
res.set('X-Cache', 'HIT');
```

У випадку відсутності запису в Redis маршрут звертається до бази даних, записує результат у кеш і повертає:

```js
res.set('X-Cache', 'MISS');
```

Аналогічний підхід було застосовано і до маршруту `GET /api/categories`, хоча головний акцент оптимізації зроблено саме на маршруті курсів.

### Інвалідація кешу після зміни даних

Щоб уникнути застарілих відповідей, після створення, оновлення або видалення курсу, а також після створення категорії, пов'язані кеш-ключі видаляються за префіксом.

```js
await deleteByPrefix(courseCachePrefix);
await deleteByPrefix('categories:list');
```

Така інвалідація забезпечує коректне поєднання продуктивності та актуальності даних: повторні GET-запити прискорюються кешем, але після змін інформація не залишається застарілою.

### Додаткова валідація маршрутів курсів і категорій

У межах цієї роботи було додано окремі валідатори `server/validators/course.validator.js` і `server/validators/category.validator.js`. Вони перевіряють довжину полів, числові параметри, коректність `page`, `limit`, `categoryId` та ідентифікаторів маршрутів.

```js
query('limit')
  .optional()
  .isInt({ min: 1, max: 50 })
  .withMessage('Limit must be between 1 and 50.');

body('categoryId')
  .isInt({ min: 1 })
  .withMessage('Category id must be a positive integer.')
```

У разі помилки користувач отримує структуровану JSON-відповідь із переліком полів, які не пройшли перевірку. Це є важливим як з точки зору безпеки, так і з точки зору передбачуваності роботи API.

### Індекси в моделях Sequelize

Ще одним кроком оптимізації стало додавання індексів у Sequelize-моделях для тих полів, які найімовірніше використовуються під час фільтрації та зв'язків між таблицями.

```js
indexes: [
  {
    fields: ['categoryId']
  },
  {
    fields: ['title']
  }
]
```

Для категорій окремо було додано індекс на поле `name`. Це не створює різкої різниці на малій навчальній БД, але демонструє правильний підхід до оптимізації на рівні схеми даних.

### Розширення маршруту моніторингу стану сервера

Маршрут `GET /api/status`, створений на попередньому етапі, було розширено інформацією про кеш. Тепер він повертає не лише дані про uptime, CPU та пам'ять, а й інформацію про Redis: чи ввімкнений кеш, чи готове з'єднання, який provider використовується та який TTL встановлено.

```js
cache: getCacheStatus()
```

Це дозволяє перевіряти стан кешуючого шару без входу до Redis-контейнера та зручно демонструвати роботу інфраструктурної частини прямо через API.

### Автоматизоване тестування через Jest і Supertest

Для лабораторної роботи було створено два окремі набори тестів:

- `app.security.test.js` - перевірка заголовків безпеки та маршруту статусу;
- `courses.cache.test.js` - перевірка сценаріїв `X-Cache: HIT` і `X-Cache: MISS` на маршруті курсів.

```js
const response = await request(app).get('/api/health');

expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
expect(response.headers['x-content-type-options']).toBe('nosniff');
```

```js
expect(response.headers['x-cache']).toBe('HIT');
expect(mockFindAndCountAll).not.toHaveBeenCalled();
```

Тести не вимагають піднятої реальної БД, оскільки використовують mock-об'єкти для моделей і cache-service, що робить перевірку швидкою й стабільною.

---

## Скріншоти

### Запуск Redis-контейнера

На скріншоті нижче показано запуск Redis через Docker та активний контейнер `studyspace-redis` у стані `healthy`.

![Запуск Redis-контейнера](/assets/labs/lab-5/screen-redis-container.png)

### Перевірка захисних HTTP-заголовків

Нижче наведено приклад звернення до API-маршруту, у відповіді якого видно заголовки `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` та інші заголовки, додані через `helmet`.

![Перевірка захисних HTTP-заголовків](/assets/labs/lab-5/screen-security-headers.png)

### Перевірка маршруту status з даними про Redis

На цьому скріншоті показано відповідь `GET /api/status`, у якій присутній блок `cache` з ознаками `enabled`, `ready`, `provider` та `ttlSeconds`.

![Перевірка маршруту status з даними про Redis](/assets/labs/lab-5/screen-status-cache.png)

### Отримання курсів без кешу

Нижче показано перше звернення до маршруту `GET /api/courses?page=1&limit=5`, у відповіді на яке сервер повертає заголовок `X-Cache: MISS`.

![Отримання курсів без кешу](/assets/labs/lab-5/screen-courses-cache-miss.png)

### Отримання курсів із Redis-кешу

На цьому прикладі показано повторне звернення до того самого маршруту `GET /api/courses?page=1&limit=5`, де вже видно заголовок `X-Cache: HIT`.

![Отримання курсів із Redis-кешу](/assets/labs/lab-5/screen-courses-cache-hit.png)

### Валідація неправильного запиту на створення курсу

Нижче наведено результат виконання `POST /api/courses` з некоректними даними та JSON-відповіддю `Validation failed` із деталями перевірки.

![Валідація неправильного запиту на створення курсу](/assets/labs/lab-5/screen-course-validation.png)

### Автоматизоване тестування через Jest

Останній скріншот демонструє запуск `npm test`, у якому видно успішне проходження тестів безпеки та кешування.

![Автоматизоване тестування через Jest](/assets/labs/lab-5/screen-jest-tests.png)

---

## Висновки

У ході виконання лабораторної роботи було посилено безпеку та продуктивність серверної частини застосунку StudySpace. У проєкті реалізовано захисні HTTP-заголовки через `helmet`, контроль CORS, глобальне rate limiting, валідацію вхідних даних для контентних маршрутів, Redis-кешування результатів API та автоматичну інвалідацію кешу після зміни даних. Основний маршрут `GET /api/courses` було оптимізовано за рахунок пагінації, фільтрації, вибору лише потрібних полів і додавання індексів у моделях. Додатково було підготовлено автоматизовані тести через `jest` і `supertest`, що дозволяє перевіряти безпеку та логіку кешування без ручного прогону кожного сценарію. Отриманий результат демонструє практичний підхід до захисту та прискорення REST API в навчальному Node.js-проєкті.

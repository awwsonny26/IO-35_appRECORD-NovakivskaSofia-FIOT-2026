## Тема, Мета, Місце розташування

**Тема:** Створення бази даних MySQL для вебзастосунку StudySpace, підключення Node.js до MySQL, використання `mysql2` і Sequelize ORM, реалізація моделей та зв'язку One-to-Many.

**Мета:** створити серверну частину застосунку StudySpace з підключенням до MySQL, налаштувати роботу з базою даних через Sequelize ORM і `mysql2`, описати моделі категорій і курсів, реалізувати між ними зв'язок один-до-багатьох та побудувати REST API для роботи з даними.

**Місце розташування:**
- Репозиторій власного веб-застосунку (GitHub): [посилання](https://github.com/awwsonny26/StudySpace)
- Репозиторій звітного HTML-документа (GitHub): [посилання](https://github.com/awwsonny26/IO-35_appRECORD-NovakivskaSofia-FIOT-2026)
- Звітний HTML-документ (Жива сторінка): [посилання](https://awwsonny26.github.io/IO-35_appRECORD-NovakivskaSofia-FIOT-2026/)

---

## Опис середовища розробки

Для виконання другої лабораторної роботи було використано Node.js, Express.js, MySQL, пакет `mysql2`, ORM Sequelize, Docker Compose та Postman. Такий набір інструментів дав змогу підняти локальну базу даних, підключити до неї серверний застосунок і реалізувати два підходи до роботи з даними: через ORM-моделі та через прямі SQL-запити.

У проєкті StudySpace серверна частина запускається через файл `server.js`, а конфігурація бази даних винесена в окремі модулі каталогу `server/config`. Для зберігання даних було створено сутності `categories` і `courses`, між якими реалізовано зв'язок One-to-Many: одна категорія може містити багато курсів, а кожен курс належить лише одній категорії.

---

## Основні можливості реалізованого застосунку

- запуск Express-сервера з попередньою ініціалізацією бази даних;
- підключення до MySQL через Sequelize;
- окреме підключення до MySQL через `mysql2/promise` для демонстрації сирих SQL-запитів;
- створення моделей `Category` і `Course`;
- реалізація зв'язку One-to-Many між категоріями та курсами;
- автоматичне створення таблиць і початкове заповнення даних під час запуску сервера;
- отримання та створення категорій через маршрути `/api/categories`;
- отримання, створення, оновлення та видалення курсів через маршрути `/api/courses`;
- виконання демонстраційного сценарію `INSERT`, `SELECT`, `UPDATE`, `DELETE` через маршрут `/api/mysql-demo/demo`.

---

## Хід виконання

### Підготовка проєкту та залежностей

На початку роботи було підготовлено серверний проєкт StudySpace та встановлено необхідні залежності. У файлі `package.json` визначено пакети `express`, `dotenv`, `mysql2` і `sequelize`, а також сценарії запуску звичайного та дев-режиму.

```json
{
  "name": "studyspace",
  "version": "1.0.0",
  "description": "StudySpace lab 2 backend with Express, MySQL, mysql2, and Sequelize.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "mysql2": "^3.11.3",
    "sequelize": "^6.37.3"
  }
}
```

Для локального запуску бази даних у проєкті також використано `docker-compose.yml`, що піднімає контейнер MySQL із параметрами з файлу `.env`.

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: studyspace-mysql
    restart: unless-stopped
    ports:
      - "${DB_PORT:-3306}:3306"
    environment:
      MYSQL_ROOT_PASSWORD: "${DB_PASSWORD}"
      MYSQL_DATABASE: "${DB_NAME}"
```

### Запуск сервера та ініціалізація бази даних

У файлі `server.js` реалізовано старт застосунку. Перед запуском HTTP-сервера викликається функція `initializeDatabase()`, яка перевіряє з'єднання з БД, синхронізує моделі та додає початкові записи до таблиць, якщо база ще порожня.

```js
require('dotenv').config();

const app = require('./server/app');
const { initializeDatabase } = require('./server/config/init-db');

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`StudySpace server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start StudySpace server:', error.message);
    process.exit(1);
  }
};
```

Такий підхід забезпечує автоматичну підготовку структури БД під час кожного запуску сервера та зменшує кількість ручних дій під час тестування.

### Налаштування Express-застосунку та маршрутів

Основний Express-застосунок описано у файлі `server/app.js`. У ньому підключено обробку JSON-запитів, налаштовано віддачу статичних файлів і зареєстровано серверні маршрути API.

```js
app.use(express.json());
app.use('/css', express.static(path.join(__dirname, '..', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'js')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

app.get('/api/health', (req, res) => {
  res.json({ message: 'StudySpace API is working.' });
});

app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/mysql-demo', rawQueryRoutes);
```

У межах лабораторної роботи реалізовано такі маршрути:

- `GET /api/health` - перевірка працездатності API;
- `GET /api/categories` - отримання списку категорій разом із курсами;
- `POST /api/categories` - створення нової категорії;
- `GET /api/courses` - отримання списку курсів разом із категорією;
- `POST /api/courses` - створення нового курсу;
- `PUT /api/courses/:id` - оновлення наявного курсу;
- `DELETE /api/courses/:id` - видалення курсу;
- `POST /api/mysql-demo/demo` - демонстрація роботи SQL-запитів через `mysql2`.

### Підключення до MySQL через Sequelize

Для роботи з ORM було створено окремий модуль `server/config/database.js`, у якому формується екземпляр Sequelize на основі змінних середовища. Підключення виконується до MySQL-сервера із вимкненим логуванням SQL-запитів.

```js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false
  }
);
```

Окрім ORM-підключення, у файлі `server/config/mysql.js` додатково створено пул з'єднань `mysql2/promise`, який використовується для окремої демонстрації сирих SQL-запитів.

```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### Створення моделей Category і Course

Для опису структури даних було створено дві Sequelize-моделі: `Category` та `Course`. Модель категорії містить поля `id`, `name` і `description`, а модель курсу - поля `id`, `title`, `description`, `author`, `duration` і `categoryId`.

```js
const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    tableName: 'categories'
  }
);
```

```js
const Course = sequelize.define(
  'Course',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: false
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    tableName: 'courses'
  }
);
```

### Реалізація зв'язку One-to-Many

У файлі `server/models/index.js` між моделями реалізовано зв'язок один-до-багатьох. Категорія містить багато курсів, а курс належить одній категорії. Саме завдяки цьому у відповідях API можна повертати пов'язані дані через `include`.

```js
Category.hasMany(Course, {
  foreignKey: 'categoryId',
  as: 'courses'
});

Course.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category'
});
```

Такий зв'язок відповідає предметній області застосунку StudySpace, де кожен курс відноситься до певного напряму навчання.

### Ініціалізація таблиць і початкових даних

Після встановлення з'єднання сервер виконує синхронізацію моделей через `sequelize.sync()` та перевіряє, чи є в таблиці `categories` хоча б один запис. Якщо таблиця порожня, до неї автоматично додаються стартові категорії, а потім - курси, пов'язані з цими категоріями.

```js
await sequelize.authenticate();
await sequelize.sync();

const categoryCount = await Category.count();

if (categoryCount > 0) {
  return;
}
```

Початкове заповнення дозволяє одразу отримати коректні результати від маршрутів API без ручного додавання тестових записів після кожного запуску проєкту.

### Реалізація REST API для категорій і курсів

Для категорій реалізовано контролер, який повертає всі категорії разом із вкладеними курсами та дозволяє створювати нові записи після базової перевірки полів.

```js
const categories = await Category.findAll({
  include: [
    {
      model: Course,
      as: 'courses'
    }
  ],
  order: [['id', 'ASC']]
});
```

Для курсів реалізовано повний базовий набір операцій CRUD. Під час створення або оновлення виконується перевірка існування категорії, а результат повертається разом із пов'язаним об'єктом категорії.

```js
const createdCourse = await Course.findByPk(course.id, {
  include: [
    {
      model: Category,
      as: 'category'
    }
  ]
});
```

Приклад JSON-запиту для створення нового курсу:

```json
{
  "title": "Sequelize Basics",
  "description": "Introduction to ORM models and associations.",
  "author": "Sofia Novakivska",
  "duration": "3 weeks",
  "categoryId": 2
}
```

### Використання mysql2 для демонстрації сирих SQL-запитів

Окремо у файлі `server/controllers/raw-query.controller.js` реалізовано маршрут `POST /api/mysql-demo/demo`. У ньому послідовно виконуються SQL-операції `INSERT`, `SELECT`, `UPDATE` та `DELETE` над тимчасово створеними записами категорії та курсу. Після завершення тесту записи видаляються з бази даних.

```js
const [insertCategoryResult] = await pool.execute(
  'INSERT INTO categories (name, description, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
  ['SQL Demo Category', 'Temporary category created to demonstrate raw mysql2 INSERT.']
);

const [selectRows] = await pool.execute(
  'SELECT c.id, c.title, c.author, c.duration, cat.name AS categoryName FROM courses c JOIN categories cat ON c.categoryId = cat.id WHERE c.id = ?',
  [demoCourseId]
);

await pool.execute('DELETE FROM courses WHERE id = ?', [demoCourseId]);
await pool.execute('DELETE FROM categories WHERE id = ?', [demoCategoryId]);
```

Такий приклад демонструє, що в одному проєкті можна поєднувати ORM-підхід і роботу з базою даних через прямі SQL-запити.

### SQL-скрипт для створення структури бази даних

У каталозі `server/sql` розміщено файл `studyspace_lab2.sql`, який містить SQL-команди для створення бази даних `studyspace_lab2`, таблиць `categories` і `courses`, а також приклади запитів `INSERT`, `SELECT`, `UPDATE`, `DELETE`.

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  author VARCHAR(255) NOT NULL,
  duration VARCHAR(255) NOT NULL,
  categoryId INT NOT NULL,
  CONSTRAINT fk_courses_category
    FOREIGN KEY (categoryId) REFERENCES categories(id)
);
```

Наявність такого файлу є корисною для окремої перевірки структури БД і демонстрації ручної роботи з SQL поза ORM.

---

## Скріншоти

### Запуск MySQL і сервера StudySpace

Скріншот демонструє успішний запуск контейнера MySQL через `docker compose up -d` і запуск сервера командою `npm start`, після чого в консолі відображається повідомлення `StudySpace server is running on port 3000`.

![Запуск MySQL і сервера StudySpace](/assets/labs/lab-2/screen-docker-server-start.png)

### Перевірка працездатності API

Нижче наведено результат виконання запиту `GET /api/health` та JSON-відповідь з повідомленням `StudySpace API is working.`

![Перевірка працездатності API](/assets/labs/lab-2/screen-api-health.png)

### Отримання списку категорій із вкладеними курсами

У цьому фрагменті відображено результат виконання запиту `GET /api/categories`, у відповіді якого кожна категорія містить масив `courses`.

![Отримання списку категорій із вкладеними курсами](/assets/labs/lab-2/screen-get-categories.png)

### Отримання списку курсів разом із категоріями

Приклад нижче ілюструє результат виконання запиту `GET /api/courses`, у відповіді якого для кожного курсу присутній пов'язаний об'єкт `category`.

![Отримання списку курсів разом із категоріями](/assets/labs/lab-2/screen-get-courses.png)

### Створення нового курсу

У цьому прикладі наведено перевірку маршруту `POST /api/courses` з тілом запиту та JSON-відповіддю сервера після успішного створення нового запису.

![Створення нового курсу](/assets/labs/lab-2/screen-course-post.png)

### Оновлення наявного курсу

Нижче показано перевірку маршруту `PUT /api/courses/:id`, який дозволяє змінити дані раніше створеного курсу та отримати оновлений результат у відповіді сервера.

![Оновлення наявного курсу](/assets/labs/lab-2/screen-course-put.png)

### Видалення курсу

Окремо наведено перевірку маршруту `DELETE /api/courses/:id`, після виконання якого сервер повертає повідомлення про успішне видалення запису.

![Видалення курсу](/assets/labs/lab-2/screen-course-delete.png)

### Демонстрація SQL-операцій через mysql2

Окремо показано виконання запиту `POST /api/mysql-demo/demo` та JSON-відповідь, у якій присутні результати `insert`, `select`, `update` і повідомлення про видалення тимчасових записів.

![Демонстрація SQL-операцій через mysql2](/assets/labs/lab-2/screen-mysql-demo.png)

### Структура таблиць бази даних

Останній скріншот відображає створену базу даних `studyspace_lab2`, таблиці `categories` і `courses`, а також зовнішній ключ `categoryId`, який пов'язує курс із категорією.

![Структура таблиць бази даних](/assets/labs/lab-2/screen-database-structure.png)

---

## Висновки

У ході виконання лабораторної роботи було створено серверну частину вебзастосунку StudySpace з підключенням до MySQL, налаштовано роботу з базою даних через Sequelize ORM та `mysql2`, описано моделі категорій і курсів та реалізовано між ними зв'язок One-to-Many. Також було побудовано REST API для перегляду, додавання, оновлення та видалення даних, а окремий маршрут продемонстрував виконання сирих SQL-запитів. Отриманий результат показує практичне використання MySQL у Node.js-застосунку та створює основу для подальшого розвитку серверної логіки в наступних лабораторних роботах.

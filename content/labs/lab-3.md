## Тема, Мета, Місце розташування

**Тема:** Функціональний REST API. Реєстрація та авторизація користувачів. Валідація даних і обробка помилок.

**Мета:** розширити серверну частину застосунку StudySpace засобами автентифікації та авторизації, реалізувати збереження користувачів у базі даних, захищені маршрути, перевірку вхідних даних, централізовану обробку помилок та базові механізми захисту під час входу в систему.

**Місце розташування:**
- Репозиторій власного веб-застосунку (GitHub): [посилання](https://github.com/awwsonny26/StudySpace)
- Репозиторій звітного HTML-документа (GitHub): [посилання](https://github.com/awwsonny26/IO-35_appRECORD-NovakivskaSofia-FIOT-2026)
- Звітний HTML-документ (Жива сторінка): [посилання](https://awwsonny26.github.io/IO-35_appRECORD-NovakivskaSofia-FIOT-2026/)

---

## Опис середовища розробки

Для виконання третьої лабораторної роботи було використано Node.js, Express.js, Sequelize ORM, MySQL, а також бібліотеки `bcryptjs`, `jsonwebtoken`, `express-validator`, `express-rate-limit` і `cookie-parser`. Такий набір інструментів дав змогу побудувати повноцінний модуль автентифікації та авторизації поверх уже реалізованого серверного застосунку StudySpace.

У межах роботи до наявної структури Lab 2 було додано модель користувача, маршрути для реєстрації та входу, механізм доступу до захищених ресурсів за JWT-токеном, оновлення профілю, зміну пароля, вихід із системи, оновлення токена доступу та обмеження кількості спроб входу. Окремо було підготовлено полегшені механізми підтвердження електронної пошти, відновлення пароля та структуру інтеграції з Google OAuth.

---

## Основні можливості реалізованого застосунку

- збереження користувачів у таблиці `users` бази даних MySQL;
- реєстрація нового користувача з перевіркою підтвердження пароля;
- вхід у систему з перевіркою email і пароля;
- хешування паролів за допомогою `bcryptjs`;
- генерація JWT access token і refresh token;
- оновлення access token через окремий маршрут;
- вихід із системи з очищенням refresh token;
- доступ до захищеного профілю лише за дійсним токеном;
- оновлення профілю користувача та зміна пароля;
- підтримка ролей `admin` і `user`;
- видалення користувача лише для адміністратора;
- валідація вхідних даних на рівні маршрутів;
- централізована обробка помилок і базове логування серверних збоїв;
- обмеження кількості спроб входу через rate limiting;
- полегшені механізми підтвердження email і скидання пароля;
- підготовлена структура маршрутів для інтеграції Google OAuth.

---

## Хід виконання

### Підготовка залежностей для автентифікації

На початку роботи до проєкту StudySpace було додано бібліотеки, необхідні для реалізації Lab 3. У файлі `package.json` з'явилися залежності для хешування паролів, генерації токенів, перевірки вхідних даних, обмеження кількості спроб входу та роботи з cookie.

```json
{
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "express-rate-limit": "^8.3.2",
    "express-validator": "^7.3.2",
    "jsonwebtoken": "^9.0.3",
    "mysql2": "^3.11.3",
    "sequelize": "^6.37.3"
  }
}
```

Такий склад залежностей дав змогу реалізувати основний набір механізмів без ускладнення архітектури проєкту.

### Створення моделі користувача

Для зберігання даних автентифікації було створено модель `User`, що описує структуру таблиці `users`. У ній передбачено email, ім'я користувача, хеш пароля, роль, ознаку підтвердження електронної пошти, refresh token, а також токени для підтвердження email і скидання пароля.

```js
const User = sequelize.define(
  'User',
  {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user'
    },
    isEmailConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: 'users'
  }
);
```

Така модель є достатньою для навчального проєкту та покриває основні потреби Lab 3.

### Ініціалізація адміністратора та збереження користувачів у базі даних

Під час запуску сервера виконується синхронізація моделей із базою даних. У файлі `server/config/init-db.js` також реалізовано створення адміністратора за замовчуванням, якщо запис із відповідним email ще не існує.

```js
const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@studyspace.local';
const adminExists = await User.findOne({ where: { email: adminEmail } });

if (!adminExists) {
  await User.create({
    email: adminEmail,
    name: process.env.DEFAULT_ADMIN_NAME || 'StudySpace Admin',
    passwordHash: await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10),
    role: 'admin',
    isEmailConfirmed: true
  });
}
```

Завдяки цьому маршрути з рольовим доступом можна одразу перевіряти вручну після запуску проєкту.

### Реалізація реєстрації та входу користувача

Основна логіка автентифікації винесена до `server/controllers/auth.controller.js`. Під час реєстрації перевіряється унікальність email, паролі хешуються через `bcryptjs`, а користувач після створення одразу отримує access token і refresh token.

```js
const passwordHash = await bcrypt.hash(password, 10);

const user = await User.create({
  email,
  name,
  passwordHash,
  role: requestedRole,
  emailConfirmationToken,
  isEmailConfirmed: requestedRole === 'admin'
});
```

Під час входу виконується пошук користувача за email та порівняння введеного пароля з хешем, що зберігається в базі даних.

```js
const user = await User.findOne({ where: { email } });

const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
if (!isPasswordValid) {
  throw new AppError(401, 'Invalid email or password.');
}
```

### Генерація access token і refresh token

Для роботи з токенами було створено окремий модуль `server/utils/tokens.js`. У ньому реалізовано генерацію access token і refresh token за допомогою `jsonwebtoken`, а також їх перевірку.

```js
const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    accessTokenSecret,
    { expiresIn: getJwtConfig().accessExpiresIn }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user.id
    },
    refreshTokenSecret,
    { expiresIn: getJwtConfig().refreshExpiresIn }
  );
```

Refresh token зберігається в базі даних і додатково записується в cookie, що дає змогу оновлювати access token через окремий маршрут `/api/auth/refresh`.

### Реалізація виходу з системи та оновлення токена

Для завершення сесії реалізовано маршрут `POST /api/auth/logout`, який очищає refresh token у базі даних і видаляє відповідну cookie. Окремо маршрут `POST /api/auth/refresh` перевіряє отриманий refresh token і, якщо він дійсний, повертає нову пару токенів.

```js
const refreshToken = tokenFromBody || tokenFromCookie;

if (!refreshToken) {
  throw new AppError(401, 'Refresh token is required.');
}

const user = await User.findByPk(payload.sub);
if (!user || user.refreshToken !== refreshToken) {
  throw new AppError(401, 'Refresh token is not recognized.');
}
```

Такий підхід дозволяє розділити короткоживучий токен доступу та довший refresh token, не ускладнюючи реалізацію надмірно.

### Захищені маршрути та перевірка ролей

Для перевірки токена доступу створено middleware `authenticate`, який витягує Bearer token із заголовка `Authorization`, перевіряє його та знаходить відповідного користувача в базі даних.

```js
const token = getBearerToken(req);

if (!token) {
  throw new AppError(401, 'Access token is required.');
}

const payload = verifyAccessToken(token);
const user = await User.findByPk(payload.sub);
```

Окремий middleware `requireRole` використовується для обмеження доступу за роллю. Саме через нього маршрут `DELETE /api/users/:id` доступний лише адміністратору.

```js
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to perform this action.'));
  }
};
```

### Профіль користувача та зміна пароля

Для роботи з профілем було створено окремі маршрути `GET /api/profile`, `PATCH /api/profile` і `PATCH /api/profile/change-password`. Вони дозволяють отримувати поточні дані користувача, змінювати ім'я або email, а також оновлювати пароль після перевірки поточного значення.

```js
const isPasswordValid = await bcrypt.compare(currentPassword, req.user.passwordHash);
if (!isPasswordValid) {
  throw new AppError(400, 'Current password is incorrect.');
}

req.user.passwordHash = await bcrypt.hash(newPassword, 10);
req.user.refreshToken = null;
await req.user.save();
```

У разі зміни email для користувача також генерується новий токен підтвердження електронної пошти.

### Валідація даних і централізована обробка помилок

Для перевірки коректності вхідних даних використано `express-validator`. Окремі набори правил було винесено у файли `server/validators/auth.validator.js` і `server/validators/profile.validator.js`.

```js
body('email').trim().isEmail().withMessage('A valid email is required.'),
body('password')
  .isLength({ min: 6 })
  .withMessage('Password must contain at least 6 characters.'),
body('confirmPassword')
  .custom((value, { req }) => value === req.body.password)
  .withMessage('Password confirmation does not match.')
```

Усі помилки обробляються централізовано через `errorHandler`, який формує JSON-відповідь із повідомленням та, за потреби, з деталями валідації. Для серверних збоїв також реалізовано запис у файл журналу.

```js
const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    logError(error, {
      method: req.method,
      path: req.originalUrl
    });
  }

  res.status(statusCode).json({
    message: error.message || 'Internal server error.',
    ...(error.details ? { details: error.details } : {})
  });
};
```

### Захист від надмірної кількості спроб входу

Для маршруту входу реалізовано обмеження кількості запитів через `express-rate-limit`. Це дає змогу зменшити ризик масового перебору паролів і є базовим практичним кроком для захисту API.

```js
const authLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  standardHeaders: true,
  legacyHeaders: false
});
```

Middleware підключено саме до маршруту `POST /api/auth/login`.

### Відновлення пароля та підтвердження email

Окремо у проєкті реалізовано полегшені механізми відновлення пароля та підтвердження електронної пошти. Під час звернення до маршруту `POST /api/auth/forgot-password` для користувача генерується токен і формується посилання для скидання пароля, яке повертається у відповіді та виводиться в консоль сервера.

```js
const token = createRandomToken();
user.passwordResetToken = token;
user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
await user.save();
```

Аналогічно під час реєстрації або зміни email формується посилання для підтвердження адреси. У межах лабораторної роботи ці механізми реалізовано без реального надсилання листів, що є достатнім для навчального демонстраційного прикладу.

### Структура інтеграції Google OAuth

У модулі автентифікації також підготовлено маршрути `GET /api/auth/google` і `GET /api/auth/google/callback` для інтеграції з Google OAuth. Ця частина коду призначена для перенаправлення користувача на Google-авторизацію, обміну authorization code на токен і отримання профілю користувача.

```js
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
```

Повноцінна перевірка цього сценарію вимагає зовнішнього налаштування Google Cloud Console, тому в межах цієї лабораторної роботи він представлений як реалізована структура інтеграції, але не використовується як обов'язковий сценарій ручного тестування.

---

## Скріншоти

### Перевірка працездатності API

Тут показано звернення до маршруту `GET /api/health`, який використовується для швидкої перевірки працездатності серверної частини застосунку.

![Перевірка працездатності API](/assets/labs/lab-3/screen-health.png)

### Реєстрація нового користувача

Тут показано виконання запиту `POST /api/auth/register` у Postman із тілом запиту, підтвердженням пароля та JSON-відповіддю сервера після успішного створення користувача.

![Реєстрація нового користувача](/assets/labs/lab-3/screen-register.png)

### Вхід у систему та отримання токенів

Цей приклад ілюструє виконання запиту `POST /api/auth/login`, у відповіді якого повертаються дані користувача, access token і refresh token.

![Вхід у систему та отримання токенів](/assets/labs/lab-3/screen-login.png)

### Перевірка захищеного маршруту профілю

Приклад нижче показує звернення до маршруту `GET /api/profile` з Bearer token у заголовку `Authorization` та успішну відповідь із даними поточного користувача.

![Перевірка захищеного маршруту профілю](/assets/labs/lab-3/screen-get-profile.png)

### Оновлення профілю користувача

Тут відображено виконання запиту `PATCH /api/profile`, який дозволяє змінити ім'я або email користувача та отримати оновлені дані у відповіді сервера.

![Оновлення профілю користувача](/assets/labs/lab-3/screen-update-profile.png)

### Зміна пароля користувача

Цей фрагмент ілюструє перевірку маршруту `PATCH /api/profile/change-password`, у межах якого перевіряється поточний пароль і зберігається новий хеш пароля.

![Зміна пароля користувача](/assets/labs/lab-3/screen-change-password.png)

### Оновлення access token через refresh token

Окремо наведено виконання запиту `POST /api/auth/refresh`, який повертає нову пару токенів за наявності дійсного refresh token.

![Оновлення access token через refresh token](/assets/labs/lab-3/screen-refresh-token.png)

### Вихід із системи

Тут наведено виконання маршруту `POST /api/auth/logout`, після якого refresh token очищується, а сервер повертає повідомлення про успішний вихід.

![Вихід із системи](/assets/labs/lab-3/screen-logout.png)

### Відновлення пароля

Цей приклад показує роботу маршруту `POST /api/auth/forgot-password`, який формує посилання для скидання пароля та повертає його у відповіді сервера для подальшої перевірки.

![Відновлення пароля](/assets/labs/lab-3/screen-forgot-password.png)

### Скидання пароля за токеном

Тут показано виконання запиту `POST /api/auth/reset-password` із токеном відновлення та новим паролем.

![Скидання пароля за токеном](/assets/labs/lab-3/screen-reset-password.png)

### Підтвердження електронної пошти

Цей фрагмент відображає виконання маршруту `GET /api/auth/confirm-email?token=...` та успішну відповідь сервера після підтвердження адреси користувача.

![Підтвердження електронної пошти](/assets/labs/lab-3/screen-confirm-email.png)

### Обмеження кількості спроб входу

Останній приклад показує спрацювання rate limiting після кількох невдалих спроб входу на маршруті `POST /api/auth/login`.

![Обмеження кількості спроб входу](/assets/labs/lab-3/screen-rate-limit.png)

### Вхід адміністратора в систему

Окремо наведено виконання входу під обліковим записом адміністратора, що використовується для перевірки маршрутів із рольовим доступом.

![Вхід адміністратора в систему](/assets/labs/lab-3/screen-login-admin.png)

### Видалення користувача адміністратором

Цей приклад показує виконання маршруту `DELETE /api/users/:id`, який доступний лише користувачу з роллю `admin`.

![Видалення користувача адміністратором](/assets/labs/lab-3/screen-delete-user.png)

---

## Висновки

У ході виконання лабораторної роботи було розширено серверну частину застосунку StudySpace засобами реєстрації, автентифікації та авторизації користувачів. У проєкті реалізовано збереження користувачів у MySQL, JWT-токени доступу, refresh token, захищені маршрути, зміну профілю та пароля, рольову модель доступу, валідацію запитів, централізовану обробку помилок і базовий захист від надмірної кількості спроб входу. Додатково було підготовлено полегшені механізми підтвердження email, відновлення пароля та структуру інтеграції з Google OAuth. Отриманий результат демонструє практичний підхід до побудови функціонального REST API з модулем користувацької автентифікації в межах навчального вебпроєкту.

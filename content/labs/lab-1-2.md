## Тема, Мета, Місце розташування

**Тема:** Встановлення та налаштування середовища Node.js. Основи роботи з Express.js.

**Мета:** встановити та налаштувати середовище Node.js, створити серверний проєкт із використанням Express.js, реалізувати базовий HTTP-сервер і REST-маршрути для роботи зі списком студентів.

**Місце розташування:**
- Репозиторій власного веб-застосунку (GitHub): [посилання](https://github.com/awwsonny26/WEB-Lab1)
- Репозиторій звітного HTML-документа (GitHub): [посилання](https://github.com/awwsonny26/IO-35_appRECORD-NovakivskaSofia-FIOT-2026)
- Звітний HTML-документ (Жива сторінка): [посилання](https://awwsonny26.github.io/IO-35_appRECORD-NovakivskaSofia-FIOT-2026/)

---

## Опис середовища розробки

Для виконання другої частини лабораторної роботи було використано платформу Node.js та фреймворк Express.js. Node.js дає змогу виконувати JavaScript-код на стороні сервера, а Express.js спрощує створення HTTP-сервера, маршрутизацію запитів та обробку JSON-даних. Такий підхід є зручним для побудови невеликих серверних застосунків і REST API.

У межах роботи було створено простий серверний проєкт, який запускається локально на порту 3000. Сервер обробляє базовий маршрут `/`, що повертає текстове повідомлення, а також набір маршрутів `/students` для перегляду, додавання, оновлення та видалення даних про студентів.

---

## Основні можливості реалізованого застосунку

- запуск HTTP-сервера на базі Node.js та Express.js;
- обробка кореневого маршруту `/` з відповіддю `Hello from Node.js server`;
- отримання списку студентів через маршрут `GET /students`;
- додавання нового студента через маршрут `POST /students`;
- оновлення даних студента через маршрут `PUT /students/:id`;
- видалення студента через маршрут `DELETE /students/:id`.

---

## Хід виконання

### Встановлення та налаштування середовища

На початку роботи було підготовлено окрему папку серверного проєкту та встановлено залежності за допомогою менеджера пакетів npm. Після цього проєкт було запущено командою `npm start`, а сервер успішно стартував на локальному порту 3000.

```bash
npm install
npm start
```

### Ініціалізація серверного застосунку

Для реалізації лабораторної роботи було створено файл `server.js`, у якому підключено Express.js, налаштовано обробку JSON-тіла запиту та визначено порт, на якому запускається сервер. Також було створено початковий масив студентів, що використовується для демонстрації роботи REST-маршрутів.

```js
const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json());

let students = [
  { id: 1, name: 'Andrii Savchenko', group: 'IO-35' },
  { id: 2, name: 'Olena Marchenko', group: 'IO-35' },
  { id: 3, name: 'Maksym Bondarenko', group: 'IO-35' }
];
```

### Реалізація базового маршруту сервера

Для перевірки коректного запуску сервера було реалізовано маршрут `/`, який повертає просте текстове повідомлення. Це дало змогу швидко переконатися, що сервер працює та доступний у браузері.

```js
app.get('/', (req, res) => {
  res.send('Hello from Node.js server');
});
```

### Реалізація маршруту отримання списку студентів

Наступним кроком було створено маршрут `GET /students`, який повертає список студентів у форматі JSON. Саме цей маршрут використовується для перегляду поточного вмісту масиву без зміни даних.

```js
app.get('/students', (req, res) => {
  res.json(students);
});
```

### Реалізація маршрутів POST, PUT та DELETE

Після цього було реалізовано маршрути для зміни даних. Маршрут `POST /students` додає нового студента до масиву, `PUT /students/:id` оновлює ім’я та групу студента за ідентифікатором, а `DELETE /students/:id` видаляє відповідний запис. У кожному випадку передбачено базову перевірку вхідних даних і формування JSON-відповіді з результатом виконання операції.

```js
app.post('/students', (req, res) => {
  const { id, name, group } = req.body;

  if (id === undefined || !name || !group) {
    return res.status(400).json({
      message: 'Fields id, name and group are required.'
    });
  }

  const newStudent = { id: Number(id), name, group };
  students.push(newStudent);

  return res.status(201).json({
    message: 'Student added successfully.',
    student: newStudent
  });
});

app.put('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, group } = req.body;
  const student = students.find((item) => item.id === id);

  if (!student) {
    return res.status(404).json({ message: 'Student not found.' });
  }

  student.name = name;
  student.group = group;

  return res.json({
    message: 'Student updated successfully.',
    student
  });
});

app.delete('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const studentIndex = students.findIndex((student) => student.id === id);

  if (studentIndex === -1) {
    return res.status(404).json({ message: 'Student not found.' });
  }

  const deletedStudent = students[studentIndex];
  students.splice(studentIndex, 1);

  return res.json({
    message: 'Student deleted successfully.',
    student: deletedStudent
  });
});
```

### Запуск сервера

Після реалізації маршрутів сервер було запущено стандартною командою `npm start`. У консолі з’явилося повідомлення про успішний старт на порту 3000, що підтвердило готовність застосунку до тестування.

```json
{
  "name": "lab1-rest-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
```

---

## Скріншоти

### Встановлення залежностей та запуск сервера
На зображенні показано успішне встановлення залежностей проєкту через `npm install` та запуск сервера командою `npm start`.

![Встановлення залежностей та запуск сервера](/assets/labs/lab-1-2/screen-install-start.png)

### Перевірка базового маршруту в браузері
На скріншоті продемонстровано результат звернення до кореневого маршруту сервера, який повертає текстове повідомлення `Hello from Node.js server`.

![Перевірка базового маршруту в браузері](/assets/labs/lab-1-2/screen-browser-root.png)

### Перевірка маршрутів POST, PUT та DELETE
На зображенні показано виконання запитів `POST /students`, `PUT /students/:id` та `DELETE /students/:id` через термінал із виведенням JSON-відповідей сервера.

![Перевірка маршрутів POST, PUT та DELETE](/assets/labs/lab-1-2/screen-post-put-delete.png)


---

## Висновки

У ході виконання другої частини лабораторної роботи було встановлено та налаштовано середовище Node.js, створено серверний застосунок із використанням Express.js та реалізовано базовий набір REST-маршрутів для роботи зі списком студентів. Під час роботи було відпрацьовано запуск локального сервера, обробку HTTP-запитів, повернення текстових і JSON-відповідей, а також зміну даних за допомогою методів GET, POST, PUT і DELETE. Отриманий результат демонструє базові принципи побудови серверної частини вебзастосунку та створює основу для подальшого ускладнення функціональності в наступних лабораторних роботах.

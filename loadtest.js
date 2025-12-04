import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// 1. КОНФИГУРАЦИЯ И МЕТРИКИ
// УКАЖИТЕ АДРЕС ВАШЕГО API (возможно, потребуется изменить порт)
const BASE_URL = 'http://dzitskiy.ru:5000';

// Объявление пользовательских метрик для глубокого анализа[citation:7]
const requestDuration = new Trend('http_req_duration_custom');
const requestFailureRate = new Rate('http_req_failed_custom');
const successfulChecks = new Counter('checks_succeeded');

// 2. ОСНОВНЫЕ ОПЦИИ ТЕСТА (конфигурация сценариев)
export const options = {
    // Пороги производительности (performance thresholds). Тест "провалится", если условия не выполнены[citation:2][citation:7].
    thresholds: {
        'http_req_duration{scenario:smoke}': ['p(95) < 1000'], // Для сценария "smoke": 95% запросов должны быть быстрее 1с
        'http_req_duration{scenario:load}': ['p(95) < 2000'],  // Для сценария "load": 95% запросов быстрее 2с
        'http_req_failed': ['rate < 0.05'],                     // Менее 5% запросов могут завершиться с ошибкой
        'checks_succeeded': ['count > 0']                      // Должна быть пройдена хотя бы одна проверка (check)
    },
    // Определение сценариев[citation:9]
    scenarios: {
        // СЦЕНАРИЙ 1: Дымовое тестирование (проверка работоспособности)[citation:2][citation:6]
        smoke: {
            executor: 'shared-iterations',
            vus: 2,                     // 2 виртуальных пользователя
            iterations: 5,              // Всего 5 итераций (выполнений default-функции)
            maxDuration: '1m',
            tags: { scenario: 'smoke' }, // Тег для фильтрации результатов[citation:4]
        },
        // СЦЕНАРИЙ 2: Нагрузочное тестирование (имитация реалистичной нагрузки)[citation:1][citation:2]
        load: {
            executor: 'ramping-vus',
            stages: [
                { duration: '30s', target: 10 },  // Плавный рост до 10 пользователей за 30 секунд
                { duration: '1m', target: 10 },   // Удержание нагрузки в 10 пользователей 1 минуту
                { duration: '20s', target: 0 },   // Плавный спад до 0
            ],
            tags: { scenario: 'load' },
        },
        // СЦЕНАРИЙ 3: Стресс-тестирование (поиск предела)[citation:2]
        stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 20 },
                { duration: '1m', target: 20 },
                { duration: '30s', target: 40 }, // Повышаем нагрузку
                { duration: '30s', target: 0 },
            ],
            tags: { scenario: 'stress' },
        },
    },
    // Общие системные теги для всех запросов[citation:7]
    systemTags: ['url', 'name', 'status', 'method', 'scenario']
};

// 3. ОСНОВНАЯ ФУНКЦИЯ ТЕСТА (выполняется каждым виртуальным пользователем)[citation:3][citation:9]
export default function () {
    // Используем group для логической группировки запросов[citation:4]
    group('API Health and Simple Requests', function () {
        // Запрос 1: Проверка доступности API (например, через эндпоинт /swagger)
        let res = http.get(`${BASE_URL}/swagger/v1/swagger.json`);
        
        // Проверка (Check) ответа[citation:3]
        let checkResult = check(res, {
            'Главная страница доступна (status 200)': (r) => r.status === 200,
            'Ответ пришел быстро (<3s)': (r) => r.timings.duration < 3000
        });
        if (checkResult) successfulChecks.add(1);
        
        // Регистрация метрик[citation:7]
        requestDuration.add(res.timings.duration);
        requestFailureRate.add(res.status !== 200);
        sleep(0.5); // Имитация раздумий пользователя[citation:6]
    });
}

// 4. ФУНКЦИИ SETUP И TEARDOWN (опционально)[citation:9]
export function setup() {
    // Выполняется один раз перед началом теста.
    // Можно использовать для предварительной настройки (аутентификация, создание тестовых данных).
    console.log('Настройка тестового окружения...');
    return { startTime: new Date().toISOString() };
}

export function teardown(data) {
    // Выполняется один раз после завершения теста.
    // Можно использовать для очистки (удаление тестовых данных, отправка уведомления).
    console.log(`Тест запускался в: ${data.startTime}`);
    console.log('Очистка тестового окружения...');
}
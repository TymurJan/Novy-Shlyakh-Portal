document.addEventListener('DOMContentLoaded', () => {
    // Екрани
    const screenLogin = document.getElementById('screen-login');
    const screenNda = document.getElementById('screen-nda');
    const screenDashboard = document.getElementById('screen-dashboard');

    // Кнопки
    const btnLogin = document.getElementById('btnLogin');
    const tokenInput = document.getElementById('tokenInput');
    const loginError = document.getElementById('loginError');

    const btnSignDiia = document.getElementById('btnSignDiia');
    const btnSignKep = document.getElementById('btnSignKep');
    const signatureStatus = document.getElementById('signatureStatus');

    // Дашборд елементи
    const statusCheckbox = document.getElementById('statusCheckbox');
    const statusText = document.getElementById('statusText');
    const requestsTableBody = document.getElementById('requestsTableBody');

    // Фейкові дані заявок
    const mockRequests = [
        { id: "REQ-001", type: "Юридична", desc: "Допомога в отриманні УБД", date: "Сьогодні, 10:45" },
        { id: "REQ-002", type: "Психологічна", desc: "ПТСР, сімейний конфлікт", date: "Сьогодні, 09:15" },
        { id: "REQ-003", type: "Кар'єра", desc: "Грант на власний бізнес", date: "Вчора, 18:30" },
    ];

    // Авто-авторизація при переході з Telegram бота по tg_id або token
    const urlParams = new URLSearchParams(window.location.search);
    const tgId = urlParams.get('tg_id') || urlParams.get('token');
    if (tgId) {
        if (tokenInput) tokenInput.value = tgId;
        // Одразу ховаємо екран логіну
        screenLogin.classList.remove('active');
        
        // Перевіряємо чи підписано NDA раніше в цій сесії/пам'яті
        const ndaSigned = localStorage.getItem(`nda_signed_${tgId}`);
        if (ndaSigned === 'true') {
            screenDashboard.classList.add('active');
            renderRequests();
        } else {
            // Переходимо на Юридичний шлюз NDA
            screenNda.classList.add('active');
        }
    }

    // Логіка Логіну
    btnLogin.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token.length > 3) {
            // Успішно. Переходимо до NDA
            screenLogin.classList.remove('active');
            screenNda.classList.add('active');
        } else {
            loginError.style.display = 'block';
        }
    });

    // Логіка Підпису NDA (Імітація)
    function simulateSignature() {
        btnSignDiia.style.display = 'none';
        btnSignKep.style.display = 'none';
        signatureStatus.style.display = 'block';

        setTimeout(() => {
            signatureStatus.textContent = "КЕП успішно верифіковано. Завантаження даних...";
            
            setTimeout(() => {
                if (tgId) localStorage.setItem(`nda_signed_${tgId}`, 'true');
                screenNda.classList.remove('active');
                screenDashboard.classList.add('active');
                renderRequests();
            }, 1000);
        }, 1500);
    }

    btnSignDiia.addEventListener('click', simulateSignature);
    btnSignKep.addEventListener('click', simulateSignature);

    // Логіка Дашборду
    statusCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            statusText.textContent = "Статус: Готовий до роботи";
            statusText.style.color = "var(--primary-green)";
        } else {
            statusText.textContent = "Статус: Не приймаю заявки";
            statusText.style.color = "#888";
        }
    });

    function renderRequests() {
        requestsTableBody.innerHTML = '';
        mockRequests.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${req.id}</td>
                <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">${req.type}</span></td>
                <td>${req.desc}</td>
                <td>${req.date}</td>
                <td><button class="btn-take" onclick="alert('Запит ${req.id} взято в роботу!')">Взяти в роботу</button></td>
            `;
            requestsTableBody.appendChild(tr);
        });
    }

    // Навігація в кабінеті
    const navRequests = document.getElementById('nav-requests');
    const navSettings = document.getElementById('nav-settings');
    const requestsSection = document.getElementById('requestsSection');
    const settingsSection = document.getElementById('settingsSection');

    if (navRequests && navSettings) {
        navRequests.addEventListener('click', (e) => {
            e.preventDefault();
            navRequests.classList.add('active');
            navSettings.classList.remove('active');
            requestsSection.style.display = 'block';
            settingsSection.style.display = 'none';
        });

        navSettings.addEventListener('click', (e) => {
            e.preventDefault();
            navRequests.classList.remove('active');
            navSettings.classList.add('active');
            requestsSection.style.display = 'none';
            settingsSection.style.display = 'block';
        });
    }

    // Видалення власного профілю
    const btnDelete = document.getElementById('btnDeleteSpecialistSelf');
    const deleteConfirmToken = document.getElementById('deleteConfirmToken');

    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            const idToken = deleteConfirmToken.value.trim();
            if (!idToken) {
                alert('Будь ласка, введіть ваш Telegram ID або системний ID для підтвердження.');
                return;
            }

            const sure = confirm('УВАГА: Ця дія повністю анонімізує вашу анкету та видалить усі завантажені вами документи назавжди. Продовжити?');
            if (!sure) return;

            try {
                btnDelete.disabled = true;
                btnDelete.textContent = 'Видалення...';
                
                const response = await fetch(`/api/specialists/${idToken}?requester_tg_id=${idToken}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (response.ok && result.status === 'success') {
                    alert('Ваш профіль успішно видалено з системи (дані анонімізовано).');
                    window.location.href = 'index.html';
                } else {
                    alert('Помилка: ' + (result.detail || 'Не вдалося виконати видалення. Перевірте правильність введеного ID.'));
                }
            } catch (e) {
                console.error(e);
                alert('Помилка з\'єднання з сервером.');
            } finally {
                btnDelete.disabled = false;
                btnDelete.textContent = 'Видалити мій профіль та всі дані';
            }
        });
    }
});

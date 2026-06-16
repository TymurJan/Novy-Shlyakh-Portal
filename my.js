// my.js - Логіка Кабінету «Новий Шлях»

document.addEventListener('DOMContentLoaded', () => {

    // --- Перемикання табів: Вхід / Реєстрація ---
    const tabLogin    = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin   = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');

    function resetTabs() {
        [tabLogin, tabRegister].forEach(t => { if (t) t.classList.remove('active'); });
        [formLogin, formRegister].forEach(f => { if (f) f.classList.remove('active'); });
    }

    if (tabLogin) tabLogin.addEventListener('click', () => {
        resetTabs();
        tabLogin.classList.add('active');
        if (formLogin) formLogin.classList.add('active');
    });

    if (tabRegister) tabRegister.addEventListener('click', () => {
        resetTabs();
        tabRegister.classList.add('active');
        if (formRegister) formRegister.classList.add('active');
    });

    // --- База даних (Mock в localStorage) ---
    // Формат: { login: { name, password, questionId, answer } }
    function getDB() {
        const db = localStorage.getItem('veteran_db');
        return db ? JSON.parse(db) : {};
    }
    function saveDB(db) {
        localStorage.setItem('veteran_db', JSON.stringify(db));
    }

    // --- Дія.Підпис Імітація (Mock OAuth Gateway) ---
    const diiaBtn = document.getElementById('diia-verify-btn');
    const diiaTokenInput = document.getElementById('diia-verified-token');
    const diiaStatusText = document.getElementById('diia-status-text');

    diiaBtn.addEventListener('click', () => {
        diiaBtn.disabled = true;
        diiaBtn.style.background = '#ffc107';
        diiaBtn.style.color = '#000';
        diiaBtn.innerHTML = '⏳ Перенаправлення на портал Дія...';
        
        // Імітація OAuth2 редиректу
        setTimeout(() => {
            // В реальності тут буде window.location.href = 'https://diia.gov.ua/api/oauth2/...';
            // І після повернення URL матиме ?token=xxxxxx
            diiaTokenInput.value = 'DIIA_VERIFIED_JWT_MOCK_12345';
            
            diiaBtn.style.background = '#28a745';
            diiaBtn.style.color = '#fff';
            diiaBtn.innerHTML = '✅ Верифікацію успішно пройдено';
            
            diiaStatusText.style.color = 'var(--success)';
            diiaStatusText.textContent = 'Особу підтверджено державним реєстром. Можете завершити реєстрацію.';
        }, 3000);
    });

    // --- Перемикач 5 гілок реєстрації ---
    const roleSelector = document.getElementById('reg-role-selector');
    const roleSections = {
        'veteran':    document.getElementById('reg-veteran-section'),
        'specialist': document.getElementById('reg-specialist-section'),
        'partner':    document.getElementById('reg-partner-section'),
        'ngo':        document.getElementById('reg-ngo-section'),
        'state':      document.getElementById('reg-state-section'),
    };

    function showRoleSection(role) {
        Object.entries(roleSections).forEach(([key, el]) => {
            if (el) el.style.display = (key === role) ? 'block' : 'none';
        });
    }

    if (roleSelector) {
        roleSelector.addEventListener('change', () => showRoleSection(roleSelector.value));
        // Показуємо секцію за замовчуванням
        showRoleSection(roleSelector.value || 'veteran');
    }

    // --- Перемикач методу підписання (Файловий КЕП ↔ Дія.Підпис для ФОП) ---
    const signMethodFile = document.getElementById('sign-method-file');
    const signMethodDiia = document.getElementById('sign-method-diia');
    const panelFile = document.getElementById('panel-sign-file');
    const panelDiia = document.getElementById('panel-sign-diia');
    const labelFile = document.getElementById('kep-method-file-label');
    const labelDiia = document.getElementById('kep-method-diia-label');

    function switchSignMethod(method) {
        const isFile = method === 'file';
        // Показати/сховати панелі
        if (panelFile) panelFile.style.display = isFile ? 'block' : 'none';
        if (panelDiia) panelDiia.style.display = isFile ? 'none' : 'block';
        // Підсвітка активної кнопки
        if (labelFile) {
            labelFile.style.border = isFile ? '2px solid var(--primary-color)' : '2px solid var(--border-color)';
            labelFile.style.background = isFile ? 'rgba(46,139,87,0.06)' : 'transparent';
        }
        if (labelDiia) {
            labelDiia.style.border = isFile ? '2px solid var(--border-color)' : '2px solid #111';
            labelDiia.style.background = isFile ? 'transparent' : 'rgba(0,0,0,0.03)';
        }
    }

    if (signMethodFile) {
        signMethodFile.addEventListener('change', () => switchSignMethod('file'));
    }
    if (signMethodDiia) {
        signMethodDiia.addEventListener('change', () => switchSignMethod('diia'));
    }
    // Ініціалізація
    switchSignMethod('file');

    // --- Дія.Підпис для ФОП (Mock) ---
    const diiaSignBtn = document.getElementById('diia-sign-btn');
    const diiaSignToken = document.getElementById('diia-sign-token');
    const diiaSignStatus = document.getElementById('diia-sign-status');
    const edrpouInput = document.getElementById('spec-edrpou');

    if (diiaSignBtn) {
        diiaSignBtn.addEventListener('click', () => {
            const edrpou = edrpouInput ? edrpouInput.value.trim() : '';
            // Валідація ЄДРПОУ — 8-10 цифр
            if (!/^\d{8,10}$/.test(edrpou)) {
                if (edrpouInput) {
                    edrpouInput.style.border = '2px solid var(--danger)';
                    edrpouInput.focus();
                }
                if (diiaSignStatus) {
                    diiaSignStatus.style.color = 'var(--danger)';
                    diiaSignStatus.textContent = '❌ Введіть коректний ЄДРПОУ / ІПН (8–10 цифр)';
                }
                return;
            }
            if (edrpouInput) edrpouInput.style.border = '';

            diiaSignBtn.disabled = true;
            diiaSignBtn.style.background = '#ffc107';
            diiaSignBtn.style.color = '#000';
            diiaSignBtn.innerHTML = '⏳ Перевірка реєстрації ФОП в ЄДРПОУ...';

            // Mock: імітація запиту до Дія API
            setTimeout(() => {
                // В реальності: window.location.href = `https://diia.gov.ua/api/sign?edrpou=${edrpou}&callback=...`
                diiaSignToken.value = `DIIA_FOP_SIGN_MOCK_${edrpou}_OK`;

                diiaSignBtn.style.background = '#28a745';
                diiaSignBtn.style.color = '#fff';
                diiaSignBtn.innerHTML = '✅ ФОП верифіковано. Підпис отримано';

                if (diiaSignStatus) {
                    diiaSignStatus.style.color = 'var(--success, #28a745)';
                    diiaSignStatus.textContent = `✅ ФОП (ЄДРПОУ: ${edrpou}) підтверджено в державному реєстрі. Угода підписана.`;
                }
            }, 3000);
        });
    }


    if (formRegister) formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();

        const role = roleSelector ? roleSelector.value : 'veteran';
        const submitBtn = formRegister.querySelector('button[type="submit"]');

        if (role === 'veteran') {
            // ===================== РЕЄСТРАЦІЯ ВЕТЕРАНА =====================
            const diiaTokenInput = document.getElementById('diia-verified-token');
            const diiaToken   = diiaTokenInput ? diiaTokenInput.value : '';
            const checkVerify = document.getElementById('reg-verify')?.checked;
            const checkNda    = document.getElementById('reg-nda')?.checked;

            if (!diiaToken) {
                alert('Будь ласка, пройдіть верифікацію особи через Дію перед реєстрацією.');
                return;
            }
            if (!checkVerify || !checkNda) {
                alert('Необхідно погодитись із умовами перед реєстрацією.');
                return;
            }

            const name       = document.getElementById('reg-name')?.value;
            const email      = document.getElementById('reg-email')?.value;
            const password   = document.getElementById('reg-password')?.value;
            const questionId = document.getElementById('reg-question')?.value;
            const answer     = document.getElementById('reg-answer')?.value;

            const db = getDB();
            if (db[email]) {
                alert('Користувач з таким логіном вже існує!');
                return;
            }
            db[email] = {
                name, password, questionId,
                answer: answer.toLowerCase(),
                role: 'veteran',
                verified_by: 'DIIA_REGISTRY',
                token: diiaToken
            };
            saveDB(db);

            alert('✅ Профіль ветерана створено! Усі дані захищені та підтверджені. Тепер ви можете увійти.');
            if (tabLogin) tabLogin.click();
            formRegister.reset();

            // Скидання кнопки Дія.Підпис
            const diiaBtn_v       = document.getElementById('diia-verify-btn');
            const diiaStatusText_v = document.getElementById('diia-status-text');
            if (diiaBtn_v) {
                diiaBtn_v.disabled = false;
                diiaBtn_v.style.background = '#111';
                diiaBtn_v.innerHTML = '<span style="font-weight:900;font-family:Outfit;font-size:18px;letter-spacing:1px">Дія.Підпис</span> Пройти верифікацію';
            }
            if (diiaStatusText_v) {
                diiaStatusText_v.textContent = '⚠️ Очікування верифікації...';
                diiaStatusText_v.style.color = 'var(--danger)';
            }
            if (diiaTokenInput) diiaTokenInput.value = '';
            showRoleSection('veteran');

        } else {
            // ====== РЕЄСТРАЦІЯ: Спеціаліст / Партнер / ГО_БФ / Держструктура ======
            const endpointMap = {
                'specialist': '/api/register-specialist',
                'partner':    '/api/register-partner',
                'ngo':        '/api/register-ngo',
                'state':      '/api/register-state',
            };
            const endpoint = endpointMap[role] || '/api/register';

            const formData = new FormData();
            formData.append('role', role);

            // Збираємо поля активної секції автоматично
            const activeSection = roleSections[role];
            if (activeSection) {
                activeSection.querySelectorAll('input, select, textarea').forEach(field => {
                    if (!field.name) return;
                    if (field.type === 'file') {
                        if (field.files && field.files[0]) formData.append(field.name, field.files[0]);
                    } else if (field.type === 'checkbox') {
                        formData.append(field.name, field.checked ? '1' : '0');
                    } else {
                        formData.append(field.name, field.value);
                    }
                });
            }

            // Для спеціаліста — додаткова логіка КЕП / Дія.Підпис
            if (role === 'specialist') {
                const chosenMethod = document.querySelector('input[name="sign-method"]:checked')?.value || 'file';
                formData.append('sign_method', chosenMethod);

                if (chosenMethod === 'file') {
                    const kepInput = document.getElementById('spec-kep');
                    const kepPwd   = document.getElementById('spec-kep-password');
                    if (!kepInput || kepInput.files.length === 0) {
                        alert('⚠️ Для реєстрації спеціаліста необхідно завантажити файл КЕП (.p12/.pfx/.jks).\n\nЯкщо у вас немає файлового КЕП — оберіть метод "Дія.Підпис" (тільки для ФОП).');
                        return;
                    }
                    formData.append('kep_file', kepInput.files[0]);
                    formData.append('kep_password', kepPwd ? kepPwd.value : '');
                } else {
                    const signToken = document.getElementById('diia-sign-token')?.value;
                    const edrpou    = document.getElementById('spec-edrpou')?.value.trim();
                    if (!signToken) {
                        alert('⚠️ Будь ласка, натисніть "Підписати через Дія.Підпис" та дочекайтеся підтвердження вашого статусу ФОП в ЄДРПОУ.');
                        return;
                    }
                    formData.append('diia_sign_token', signToken);
                    formData.append('edrpou', edrpou || '');
                }
            }

            const origBtnText = submitBtn ? submitBtn.textContent : '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Надсилаємо...'; }

            try {
                const response = await fetch(endpoint, { method: 'POST', body: formData });
                const result   = await response.json();
                if (result.status === 'success') {
                    const kepMsg = result.kep_signed ? ' Угода підписана вашим КЕПом.' : '';
                    alert('✅ Заявку надіслано на модерацію. Ми зв\'яжемося через Telegram-бот.' + kepMsg);
                    formRegister.reset();
                    window.location.href = 'index.html';
                } else {
                    alert('Помилка: ' + (result.detail || 'Невідома помилка'));
                }
            } catch (err) {
                console.error('Помилка відправки:', err);
                alert('Помилка з\'єднання з сервером. Спробуйте пізніше.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origBtnText; }
            }
        }
    });

    // --- Вхід ---
    formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const db = getDB();
        const user = db[email];

        if (user && user.password === password) {
            // Успішний вхід
            localStorage.setItem('current_veteran', email);
            showDashboard(user.name);
        } else {
            alert('Невірний логін або пароль.');
        }
    });

    // --- Відновлення паролю ---
    const modal = document.getElementById('recovery-modal');
    const closeBtn = document.querySelector('.close-btn');
    const forgotLink = document.getElementById('forgot-password-link');
    const recForm = document.getElementById('recovery-form');
    const recLoginInput = document.getElementById('recovery-login');
    const recQuestionBlock = document.getElementById('recovery-question-block');
    const recQuestionText = document.getElementById('recovery-question-text');
    const recAnswerInput = document.getElementById('recovery-answer');
    const recBtn = document.getElementById('recovery-btn');

    const questionsMap = {
        "1": "Дівоче прізвище матері",
        "2": "Позивний вашого першого командира",
        "3": "Назва вулиці, де ви виросли"
    };

    let recoveryState = 0; // 0 - введення логіну, 1 - відповідь на питання

    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('active');
        recoveryState = 0;
        recLoginInput.parentElement.style.display = 'block';
        recQuestionBlock.style.display = 'none';
        recBtn.textContent = 'Далі';
        recForm.reset();
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    // --- Модальні вікна Юридичного протоколу ---
    const verifyModal = document.getElementById('legal-verify-modal');
    const ndaModal = document.getElementById('legal-nda-modal');
    const linkVerify = document.getElementById('linkVerification');
    const linkNDA = document.getElementById('linkNDA');
    const closeVerifyBtn = document.getElementById('close-verify-modal');
    const closeNdaBtn = document.getElementById('close-nda-modal');

    const specPrivacyModal = document.getElementById('spec-legal-privacy-modal');
    const specAgreementModal = document.getElementById('spec-legal-agreement-modal');
    const linkSpecPrivacy = document.getElementById('spec-linkPrivacy');
    const linkSpecAgreement = document.getElementById('spec-linkAgreement');
    const closeSpecPrivacyBtn = document.getElementById('close-spec-privacy-modal');
    const closeSpecAgreementBtn = document.getElementById('close-spec-agreement-modal');

    if (linkVerify) {
        linkVerify.addEventListener('click', (e) => {
            e.preventDefault();
            verifyModal.classList.add('active');
        });
    }
    if (linkNDA) {
        linkNDA.addEventListener('click', (e) => {
            e.preventDefault();
            ndaModal.classList.add('active');
        });
    }
    if (closeVerifyBtn) {
        closeVerifyBtn.addEventListener('click', () => verifyModal.classList.remove('active'));
    }
    if (closeNdaBtn) {
        closeNdaBtn.addEventListener('click', () => ndaModal.classList.remove('active'));
    }

    if (linkSpecPrivacy) {
        linkSpecPrivacy.addEventListener('click', (e) => {
            e.preventDefault();
            specPrivacyModal.classList.add('active');
        });
    }
    if (linkSpecAgreement) {
        linkSpecAgreement.addEventListener('click', (e) => {
            e.preventDefault();
            specAgreementModal.classList.add('active');
        });
    }
    if (closeSpecPrivacyBtn) {
        closeSpecPrivacyBtn.addEventListener('click', () => specPrivacyModal.classList.remove('active'));
    }
    if (closeSpecAgreementBtn) {
        closeSpecAgreementBtn.addEventListener('click', () => specAgreementModal.classList.remove('active'));
    }

    // Закриття модалок при кліку поза вікном
    window.addEventListener('click', (e) => {
        if (e.target === verifyModal) verifyModal.classList.remove('active');
        if (e.target === ndaModal) ndaModal.classList.remove('active');
        if (e.target === specPrivacyModal) specPrivacyModal.classList.remove('active');
        if (e.target === specAgreementModal) specAgreementModal.classList.remove('active');
    });

    recForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        
        if (recoveryState === 0) {
            const login = recLoginInput.value;
            if (db[login]) {
                const qId = db[login].questionId;
                recQuestionText.textContent = questionsMap[qId];
                recLoginInput.parentElement.style.display = 'none';
                recQuestionBlock.style.display = 'block';
                recBtn.textContent = 'Перевірити';
                recoveryState = 1;
            } else {
                alert('Логін не знайдено.');
            }
        } else if (recoveryState === 1) {
            const login = recLoginInput.value;
            const answer = recAnswerInput.value.toLowerCase();
            
            if (db[login].answer === answer) {
                alert(`Ваш пароль: ${db[login].password}`);
                modal.classList.remove('active');
            } else {
                alert('Невірна відповідь на секретне питання.');
            }
        }
    });

    // --- Перемикання екранів ---
    const authScreen = document.getElementById('auth-screen');
    const dashScreen = document.getElementById('dashboard-screen');
    const displayUserName = document.getElementById('display-user-name');
    const logoutBtn = document.getElementById('logout-btn');

    // --- Керування даними (Право на забуття) ---
    const deleteBtn = document.getElementById('delete-profile-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const confirm1 = confirm('Ви впевнені, що хочете назавжди видалити свій профіль? Всі ваші дані, документи та історія консультацій будуть стерті без можливості відновлення.');
            if (confirm1) {
                const email = localStorage.getItem('current_veteran');
                const db = getDB();
                const user = db[email];
                const confirm2 = prompt('Для підтвердження введіть ваш пароль:');
                if (confirm2 === user.password) {
                    delete db[email];
                    saveDB(db);
                    localStorage.removeItem('current_veteran');
                    alert('Ваш профіль та всі пов\'язані дані успішно видалено з системи. Дякуємо, що були з нами.');
                    window.location.reload();
                } else {
                    alert('Невірний пароль. Видалення скасовано.');
                }
            }
        });
    }

    function showDashboard(name) {
        authScreen.classList.remove('active');
        dashScreen.classList.add('active');
        displayUserName.textContent = name;
    }

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('current_veteran');
        dashScreen.classList.remove('active');
        authScreen.classList.add('active');
        formLogin.reset();
    });

    // Перевірка сесії при завантаженні
    const currentUser = localStorage.getItem('current_veteran');
    if (currentUser) {
        const db = getDB();
        if (db[currentUser]) {
            showDashboard(db[currentUser].name);
        }
    }

    // --- Обробка параметрів URL та хешу (pre-select tab/role) ---
    function applyUrlParams() {
        const hash   = window.location.hash;
        const search = window.location.search;

        let path      = hash || '';
        let paramsStr = search || '';

        if (path.includes('?')) {
            const parts = path.split('?');
            path      = parts[0];
            paramsStr = '?' + parts[1];
        }

        if (path === '#register') {
            resetTabs();
            if (tabRegister) tabRegister.classList.add('active');
            if (formRegister) formRegister.classList.add('active');
        } else if (path === '#login') {
            resetTabs();
            if (tabLogin) tabLogin.classList.add('active');
            if (formLogin) formLogin.classList.add('active');
        }

        const urlParams = new URLSearchParams(paramsStr);
        const role = urlParams.get('role');
        if (role && roleSelector) {
            roleSelector.value = role;
            showRoleSection(role);
        }
    }

    applyUrlParams();
    window.addEventListener('hashchange', applyUrlParams);

    // --- Навігація в Дашборді ---
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Зміна активного табу
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Зміна контенту
            const targetId = 'view-' + item.getAttribute('data-target');
            viewSections.forEach(sec => {
                if (sec.id === targetId) sec.classList.add('active');
                else sec.classList.remove('active');
            });
        });
    });

    // --- Імітація Сейфу (Upload) ---
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');

    uploadZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            const date = new Date().toLocaleDateString();
            
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <span class="file-name">${fileName}</span>
                </div>
                <span class="file-date">${date}</span>
            `;
            fileList.appendChild(li);
            alert('Файл успішно зашифровано та збережено у Сейф.');
        }
    });

});

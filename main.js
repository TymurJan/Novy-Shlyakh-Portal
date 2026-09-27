document.addEventListener('DOMContentLoaded', () => {
    const specTabs = document.querySelectorAll('.tab-btn');
    const specialistGrid = document.getElementById('specialistGrid');
    const btnJoin = document.getElementById('btn-join-specialist');

    // База даних спеціалістів (тепер завантажується асинхронно з JSON)
    let specialists = [];
    window.portalSpecialists = specialists;

    async function loadSpecialists() {
        try {
            const [respSpecs, respOrgs] = await Promise.all([
                fetch('backend/data/specialists.json'),
                fetch('backend/data/organizations.json')
            ]);
            
            const specs = respSpecs.ok ? await respSpecs.json() : [];
            const orgs = respOrgs.ok ? await respOrgs.json() : [];
            
            specialists = [...specs, ...orgs];
            window.portalSpecialists = specialists;
            
            // Сортуємо в пам'яті: спочатку рейтинг DESC, потім наявність відео DESC
            specialists.sort((a, b) => {
                const ratA = parseFloat(a.rating) || 0;
                const ratB = parseFloat(b.rating) || 0;
                if (ratB !== ratA) return ratB - ratA;
                
                const hasVidA = a.video_url ? 1 : 0;
                const hasVidB = b.video_url ? 1 : 0;
                return hasVidB - hasVidA;
            });
            
            // Рендеримо тільки верифікованих для публічного списку
            renderSpecialists();
            initNetworkMap();
        } catch (error) {
            console.warn("Локальний запуск (без сервера), використовуємо fallback дані", error);
            specialists = [
                { id: "f1", category: "legal", name: "Олександр Іваненко (Fallback)", role: "Юрист (Земельні питання)", phone: "+380671112233", address: "м. Черкаси, вул. Смілянська, 10", status: "verified", coordinates: [49.4444, 32.0597], rating: "4.9", bio: "Експерт з виплат.", photo_path: null, video_url: null },
                { id: "f2", category: "psychology", name: "Марія Ковальчук (Fallback)", role: "Психолог (ПТСР)", phone: "+380634445566", address: "м. Черкаси, б-р Шевченка, 205", status: "verified", coordinates: [49.4411, 32.0622], rating: "5.0", bio: "Кризова допомога.", photo_path: null, video_url: "https://youtube.com" }
            ];
            renderSpecialists();
            initNetworkMap();
        }
    }

    // --- ЛОГІКА МЕРЕЖЕВОЇ МАПИ ---
    function initNetworkMap() {
        const mapContainer = document.getElementById('networkMap');
        if (!mapContainer) return;

        const map = L.map('networkMap').setView([49.4444, 32.0597], 13);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        specialists.filter(s => s.status === 'verified').forEach(spec => {
            const marker = L.marker(spec.coordinates).addTo(map);
            marker.bindPopup(`
                <div style="color: #333; font-family: 'Inter', sans-serif;">
                    <b style="color: var(--primary-green);">${spec.name}</b><br>
                    <small>${spec.role || spec.category}</small><br>
                    <p style="margin: 5px 0; font-size: 12px;">📍 ${spec.address}</p>
                    <a href="tel:${spec.phone}" class="btn-primary" style="display:block; text-align:center; padding: 5px; font-size: 11px; margin-top: 5px;">Зателефонувати</a>
                </div>
            `);
        });
    }

    // --- ТЕЛЕГРАМ MINI APP ДЕТЕКЦІЯ ---
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
        
        const desktopPlatforms = ['tdesktop', 'macos', 'weba', 'webk', 'web'];
        if (desktopPlatforms.includes(tg.platform)) {
            if (tg.requestFullscreen) {
                tg.requestFullscreen();
            }
            document.body.classList.add('is-desktop-tg');
        } else {
            document.body.classList.add('is-tg-app');
        }
        // Змінюємо колір хедера під тему Telegram
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#0d110d');
        }
    }

    const isUserLoggedIn = (window.NovyShlyakh && window.NovyShlyakh.Auth) 
        ? window.NovyShlyakh.Auth.isAuthenticated() 
        : !!(localStorage.getItem('novy_shlyakh_user_profile') || localStorage.getItem('current_veteran'));

    let currentCategoryFilter = 'all';

    function renderSpecialists(categoryFilter = 'all') {
        if (!specialistGrid) return;
        specialistGrid.innerHTML = '';
        currentCategoryFilter = categoryFilter;

        const genderFilter = document.getElementById('filterGender')?.value || 'all';
        const priceFilter = document.getElementById('filterPrice')?.value || 'all';
        const locationFilter = document.getElementById('filterLocation')?.value || 'all';
        const specQuery = document.getElementById('filterSpecialization')?.value.toLowerCase().trim() || '';

        let filtered = specialists;

        // 1. Фільтрація по категорії (вкладки)
        if (categoryFilter !== 'all') {
            if (categoryFilter === 'legal') {
                filtered = filtered.filter(s => ['lawyer_consult', 'lawyer_docs', 'advocate'].includes(s.category));
            } else if (categoryFilter === 'psychology') {
                filtered = filtered.filter(s => ['psychologist', 'narcologist'].includes(s.category));
            } else if (categoryFilter === 'rehab') {
                filtered = filtered.filter(s => ['rehabilitation', 'prosthetist'].includes(s.category));
            } else {
                filtered = filtered.filter(s => s.category === categoryFilter);
            }
        }

        // 2. Фільтрація по статі
        if (genderFilter !== 'all') {
            filtered = filtered.filter(s => s.gender === genderFilter);
        }

        // 3. Фільтрація по вартості
        if (priceFilter !== 'all') {
            if (priceFilter === 'free') {
                filtered = filtered.filter(s => s.tariff_plan === 'grant_standard' || parseFloat(s.tariff_fixed_fee) === 0);
            } else if (priceFilter === 'discount') {
                filtered = filtered.filter(s => (s.discount && s.discount !== '') || s.tariff_plan?.includes('flexible') || s.tariff_plan?.includes('stable'));
            }
        }

        // 4. Фільтрація по локації
        if (locationFilter !== 'all') {
            if (locationFilter === 'cherkasy') {
                filtered = filtered.filter(s => s.address?.toLowerCase().includes('черкаси') && !s.address?.toLowerCase().includes('район'));
            } else if (locationFilter === 'raions') {
                filtered = filtered.filter(s => !s.address?.toLowerCase().includes('черкаси') || s.address?.toLowerCase().includes('область') || s.address?.toLowerCase().includes('район'));
            } else if (locationFilter === 'online') {
                filtered = filtered.filter(s => s.address?.toLowerCase().includes('онлайн') || s.address?.toLowerCase().includes('дистанційно'));
            }
        }

        // 5. Пошуковий запит спеціалізації (підкатегорії)
        if (specQuery !== '') {
            filtered = filtered.filter(s => 
                s.name?.toLowerCase().includes(specQuery) ||
                s.bio?.toLowerCase().includes(specQuery) ||
                s.sub_specialties?.toLowerCase().includes(specQuery) ||
                s.role?.toLowerCase().includes(specQuery)
            );
        }

        // --- НОВА ЛОГІКА ТОР-СПЕЦІАЛІСТІВ ---
        if (!isUserLoggedIn) {
            // Сортуємо за рейтингом (Top)
            filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
            // Показуємо лише топ-3 для неавторизованих
            filtered = filtered.slice(0, 3);
            
            // Додаємо інфо-плашку
            if (specialists.length > 3) {
                const info = document.createElement('div');
                info.style.gridColumn = "1 / -1";
                info.style.textAlign = "center";
                info.style.padding = "20px";
                info.style.color = "var(--primary-green)";
                info.innerHTML = `💡 Це список ТОП-фахівців. Відкрийте <a href="https://t.me/Veteran_NovyShlyakh_Bot" style="color:white; text-decoration:underline;">Telegram-бота</a>, щоб побачити повний перелік (${specialists.length}+)`;
                specialistGrid.appendChild(info);
            }
        }

        filtered.forEach(spec => {
            const card = document.createElement('div');
            card.className = 'spec-card';
            
            // Визначаємо фото профілю або колір-заглушку
            let imgStyle = 'background-color: var(--deep-teal)';
            if (spec.photo_path) {
                // Переконуємось у правильному шляху (сервер запускається з папки Novy_Shlyakh_Portal, uploads знаходиться там)
                imgStyle = `background-image: url('backend/${spec.photo_path}'); background-size: cover; background-position: center;`;
            } else if (spec.photo_url) {
                imgStyle = `background-image: url('backend/${spec.photo_url}'); background-size: cover; background-position: center;`;
            }
            
            // Кнопка відео-презентації (якщо вказано URL)
            let videoBtnHtml = '';
            if (spec.video_url) {
                videoBtnHtml = `
                    <div style="margin-top: 10px;">
                        <a href="${spec.video_url}" target="_blank" onclick="trackClick('${spec.id}', 'video_view', '${spec.category}', '${spec.sub_specialties || ''}')" class="btn-card" style="text-align:center; display: flex; align-items: center; justify-content: center; text-decoration: none; border: 1.5px solid var(--primary-green); color: var(--primary-green); background: transparent; font-weight: 600; font-size: 13px; gap: 8px;">
                            ▶️ Відео-презентація
                        </a>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="spec-img" style="${imgStyle}">
                    <div class="spec-rating">⭐ ${spec.rating || '5.0'}</div>
                </div>
                <div class="spec-info">
                    <span class="spec-tag">${spec.role || spec.category}</span>
                    <h4>${spec.name}</h4>
                    <p class="spec-power">${spec.bio || spec.power || ''}</p>
                    <div class="spec-stats" style="display: flex; justify-content: space-between; align-items: center; gap: 5px; width: 100%;">
                        <span>📍 ${spec.address || 'Черкаси'}</span>
                        <button class="btn-reviews" onclick="openReviewsModal('${spec.id}', '${spec.name}')" style="background: transparent; border: none; color: var(--primary-green); cursor: pointer; text-decoration: underline; font-size: 13px; padding: 0; font-weight: 600;">
                            💬 Відгуки
                        </button>
                    </div>
                    ${videoBtnHtml}
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        ${isUserLoggedIn 
                            ? `<a href="tel:${spec.phone}" onclick="trackClick('${spec.id}', 'call', '${spec.category}', '${spec.sub_specialties || ''}')" class="btn-card" style="text-align:center; display: flex; align-items: center; justify-content: center; text-decoration: none;">
                                📞 ${spec.phone}
                               </a>`
                            : `<button type="button" class="btn-card js-requires-auth" data-spec-id="${spec.id}" data-spec-name="${spec.name}" data-phone="${spec.phone}" style="text-align:center; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                📞 Показати телефон
                               </button>`
                        }
                        <button class="btn-card ${isUserLoggedIn ? '' : 'js-requires-auth'}" data-spec-id="${spec.id}" data-spec-name="${spec.name}" onclick="${isUserLoggedIn ? `handleBookingClick('${spec.id}', '${spec.category}', '${spec.sub_specialties || ''}')` : ''}" style="flex: 1;">
                            Записатися на прийом
                        </button>
                    </div>
                </div>
            `;
            specialistGrid.appendChild(card);
        });
    }

    // Глобальна функція обробки запису — deep link до конкретного спеціаліста
    window.handleBooking = (specId) => {
        window.open(`https://t.me/Veteran_NovyShlyakh_Bot?start=spec_${specId}`, '_blank');
    };

    // Глобальна функція для трекінгу кліків на спеціалістів
    window.trackClick = async (specId, clickType, category, subSpecialties) => {
        try {
            const raion = localStorage.getItem('filter_raion') || null;
            const otg = localStorage.getItem('filter_otg') || null;
            const cityDistrict = localStorage.getItem('filter_city_district') || null;
            const issueTag = subSpecialties ? subSpecialties.split(',')[0].trim() : null;

            await fetch('/api/track-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    specialist_id: specId,
                    click_type: clickType,
                    raion: raion,
                    otg: otg,
                    city_district: cityDistrict,
                    category: category,
                    issue_tag: issueTag
                })
            });
        } catch (e) {
            console.warn('Помилка трекінгу кліку:', e);
        }
    };

    window.handleBookingClick = (specId, category, subSpecialties) => {
        window.trackClick(specId, 'bot_booking', category, subSpecialties);
        window.handleBooking(specId);
    };

    window.trackSearchFilter = async (category) => {
        try {
            const raion = localStorage.getItem('filter_raion') || null;
            const otg = localStorage.getItem('filter_otg') || null;
            const cityDistrict = localStorage.getItem('filter_city_district') || null;
            
            await fetch('/api/track-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    click_type: 'search_filter',
                    raion: raion,
                    otg: otg,
                    city_district: cityDistrict,
                    category: category
                })
            });
        } catch (e) {
            console.warn('Помилка трекінгу фільтра:', e);
        }
    };

    // Обробка кліків по табам
    specTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            specTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSpecialists(btn.dataset.category);
            window.trackSearchFilter(btn.dataset.category);
        });
    });

    // Обробка додаткових фільтрів (стать, ціна, локація, спеціалізація)
    const filterGender = document.getElementById('filterGender');
    const filterPrice = document.getElementById('filterPrice');
    const filterLocation = document.getElementById('filterLocation');
    const filterSpecialization = document.getElementById('filterSpecialization');
    const btnClearFilters = document.getElementById('btnClearFilters');

    const triggerFilterUpdate = () => {
        renderSpecialists(currentCategoryFilter);
    };

    if (filterGender) filterGender.addEventListener('change', triggerFilterUpdate);
    if (filterPrice) filterPrice.addEventListener('change', triggerFilterUpdate);
    if (filterLocation) filterLocation.addEventListener('change', triggerFilterUpdate);
    if (filterSpecialization) filterSpecialization.addEventListener('input', triggerFilterUpdate);

    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            if (filterGender) filterGender.value = 'all';
            if (filterPrice) filterPrice.value = 'all';
            if (filterLocation) filterLocation.value = 'all';
            if (filterSpecialization) filterSpecialization.value = '';
            renderSpecialists(currentCategoryFilter);
        });
    }

    // Обробка кнопки приєднання
    if (btnJoin) {
        btnJoin.addEventListener('click', () => {
            window.location.href = "my.html#register?role=specialist";
        });
    }

    // Плавний скрол
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Education Hub Logic ---
    const eduTabs = document.querySelectorAll('#eduTabs .tab-btn');
    const trainingGrid = document.getElementById('trainingGrid');
    let education = [];

    async function loadEducation() {
        try {
            const response = await fetch('backend/data/education.json');
            if (!response.ok) throw new Error('Error loading education');
            education = await response.json();
            renderEducation();
        } catch (error) {
            console.warn("Education fallback used");
            education = [
                { id: 1, category: "vouchers", institution: "Держслужба зайнятості", title: "Ваучер на навчання", desc: "Безоплатне навчання за 70+ професіями.", price: "Безкоштовно", link: "#", deadline: "Постійно" }
            ];
            renderEducation();
        }
    }

    function renderEducation(filter = 'all') {
        if (!trainingGrid) return;
        trainingGrid.innerHTML = '';
        const filtered = filter === 'all' ? education : education.filter(e => e.category === filter);

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'edu-card';
            card.innerHTML = `
                <div class="edu-content">
                    <span class="edu-badge">${item.category}</span>
                    <p class="edu-inst">${item.institution}</p>
                    <h4>${item.title}</h4>
                    <p class="edu-desc">${item.desc}</p>
                </div>
                <div class="edu-footer">
                    <span class="edu-price">${item.price}</span>
                    <a href="${item.link}" target="_blank" class="btn-primary" style="font-size: 12px; padding: 8px 15px;">Детальніше</a>
                </div>
            `;
            trainingGrid.appendChild(card);
        });
    }

    eduTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            eduTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderEducation(btn.dataset.edu);
        });
    });

    // Перший рендер (завантаження даних)
    loadSpecialists();
    loadEducation();
    loadPortalStats();

    async function loadPortalStats() {
        try {
            const response = await fetch('/api/portal-stats');
            if (!response.ok) throw new Error('Помилка завантаження статистики');
            const data = await response.json();
            
            if (data.status === 'success') {
                const specEl = document.getElementById('stat-specialists');
                const intakeEl = document.getElementById('stat-intake');
                const vetsEl = document.getElementById('stat-veterans');
                
                if (specEl) specEl.textContent = data.specialists_count;
                if (intakeEl) intakeEl.textContent = data.intake_count;
                if (vetsEl) vetsEl.textContent = data.veterans_count;
            }
        } catch (error) {
            console.warn("Помилка завантаження статистики з сервера, використовуємо fallback значення", error);
            const specEl = document.getElementById('stat-specialists');
            const intakeEl = document.getElementById('stat-intake');
            const vetsEl = document.getElementById('stat-veterans');
            
            // Заглушки для локальної розробки
            if (specEl) specEl.textContent = "12";
            if (intakeEl) intakeEl.textContent = "142";
            if (vetsEl) vetsEl.textContent = "87";
        }
    }
});

// Глобальні функції (поза DOMContentLoaded для виклику з HTML)
function openCharityModal() {
    // В реальному проекті тут буде виклик модалки з IBAN/WayForPay
    alert('Дякуємо за вашу підтримку! Система благодійних внесків на створення та облаштування заміського реабілітаційного простору «Ашрам» зараз інтегрується. \nВи можете зв’язатися з нами в Telegram для прямої підтримки: @Talan_UA_Admin');
}



// --- AI Search Logic (Knowledge Base) ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('aiSearchInput');
    const searchBtn   = document.getElementById('aiSearchBtn');
    const responseArea = document.getElementById('aiSearchResponse');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    // ═══════════════════════════════════════════════════
    // БАЗА ЗНАНЬ ТА НОРМАТИВНИЙ ШІ-КОНСУЛЬТАНТ ПОРТАЛУ
    // Глибока правова аналітика: закони, повні переліки
    // документів, строки, алгоритми дій та живі діалоги
    // ═══════════════════════════════════════════════════
    const KNOWLEDGE_BASE = [
        {
            keywords: ['влк', 'мсек', 'оскарження влк', 'інвалідність', 'втрата працездатності', 'довідка влк', 'висновок влк', 'розклад хвороб', 'цвлк', 'рвлк', 'придатний', 'непридатний', 'обмежено'],
            title: '🏥 Проходження ВЛК, оскарження постанов та встановлення втрати працездатності',
            answer: `<b>📌 Нормативно-правова база:</b>
• Наказ Міністерства оборони України №402 «Про затвердження Положення про військово-лікарську експертизу в ЗСУ» (зі змінами)
• Закон України «Про військовий обов'язок і військову службу»
• Постанова Кабінету Міністрів України №1317 (Положення про медико-соціальну експертизу та оцінювання втрати працездатності)

<b>📋 Повний перелік необхідних документів:</b>
1. <b>Направлення на медичний огляд ВЛК</b> — видається командиром військової частини (за рапортом) або начальником ТЦК та СП за місцем лікування/обліку.
2. <b>Довідка про обставини травми / поранення / контузії (Додаток 5 / Форма 5)</b> — обов'язковий документ! Саме він засвідчує причинний зв'язок: <i>«Поранення (травма, контузія), пов'язане із захистом Батьківщини»</i>, а не звичайне <i>«проходження військової служби»</i> (від цього залежить розмір Одноразової грошової допомоги та пенсії).
3. <b>Первинна медична картка (Форма 100)</b> — заповнюється на передовій / етапі медичної евакуації.
4. <b>Медична книжка військовослужбовця</b> та оригінали/завірені копії виписних епікризів з військових госпіталів та цивільних лікарень.
5. <b>Результати об'єктивних інструментальних обстежень:</b> диски/знімки МРТ, КТ, рентгенографії, ЕКГ, висновки профільних лікарів.
6. <b>Паспорт громадянина України</b> та військовий квиток / посвідчення офіцера.

<b>⚖️ Порядок та строки оскарження неправомірного висновку ВЛК:</b>
• <b>Досудовий порядок:</b> Подання мотивованої скарги до <b>Регіональної ВЛК (РВЛК)</b> або безпосередньо до <b>Центральної ВЛК (ЦВЛК МО України, м. Київ, вул. Госпітальна, 16)</b>.
  - <i>Строк звернення:</i> до <b>30 календарних днів</b> з моменту отримання свідоцтва про хворобу / довідки ВЛК.
  - <i>Що додається:</i> копія постанови ВЛК, завірені копії медичних виписок, що підтверджують невідповідність діагнозу статтям Розкладу хвороб.
• <b>Судовий порядок:</b> Подання адміністративного позову до Окружного адміністративного суду за місцем проживання.
  - <i>Строк:</i> <b>6 місяців</b> (або <b>3 місяці</b>, якщо попередньо подавалася скарга до ЦВЛК).

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Чи маєте ви зараз на руках Довідку про обставини травми (Форма 5) та який саме висновок придатності винесла комісія? Розкажіть деталі — я допоможу проаналізувати конкретні статті Розкладу хвороб або зорієнтую, як скласти заяву на перегляд постанови.»</i>`,
            links: [
                { text: '⚖️ Знайти юриста у кабінеті', href: 'cabinet.html#tab-specialists' },
                { text: '📞 Гаряча лінія МОЗ: 0 800 60 20 19', href: 'tel:0800602019' }
            ],
            followups: [
                'Де взяти Довідку про обставини поранення (Форма 5)?',
                'Як скласти скаргу до Центральної ВЛК (ЦВЛК)?',
                'Які виплати належать при встановленні групи інвалідності?'
            ]
        },
        {
            keywords: ['убд', 'учасник бойових', 'статус ветерана', 'оформити статус', 'посвідчення', 'убд статус', 'як отримати статус убд', 'додаток 6'],
            title: '⚖️ Отримання статусу Учасника бойових дій (УБД): процедура, документи та строки',
            answer: `<b>📌 Нормативно-правова база:</b>
• Закон України «Про статус ветеранів війни, гарантії їх соціального захисту» (стаття 6)
• Постанова Кабінету Міністрів України від 20 серпня 2014 р. №413 (зі змінами та спрощеним порядком)

<b>📋 Повний перелік необхідних документів:</b>
1. <b>Довідка про безпосередню участь у заходах із забезпечення оборони України (Додаток 6 до Постанови №413)</b> — обов'язково зазначаються точні періоди та райони виконання бойових завдань (не менше 30 календарних днів або факт виконання завдань незалежно від тривалості, якщо отримано поранення/контузію).
2. <b>Витяги з бойових наказів / розпоряджень командира</b> (журналів бойових дій, бойових донесень, оперативних директив).
3. <b>Копії польотних листів, вахтових журналів</b> або довідок про виконання спецзавдань (для відповідних родів військ).
4. <b>Матеріали службових розслідувань</b> за фактами поранень чи контузій (за наявності).
5. <b>Копія паспорта (сторінки 1, 2 та місце реєстрації або ID-картка з витягом)</b>, копія реєстраційного номера ІПН.
6. <b>2 кольорові фотокартки 3×4 см</b> на матовому папері.

<b>🚀 Способи подання документів:</b>
• <b>Через військову частину (автоматично):</b> Командир підрозділу зобов'язаний сформувати пакет та направити до відомчої комісії протягом <b>30 днів</b> після завершення виконання завдань.
• <b>Самостійно військовослужбовцем / ветераном:</b> Звернення до відомчої комісії (МОУ, МВС, СБУ, ДПСУ, Нацгвардія) через ТЦК та СП, ЦНАП або Ветеранський простір громади.
• <b>Онлайн:</b> Через портал <b>Дія</b> або сервіс <b>єВетеран</b> Мінветеранів.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Підкажіть, ви зараз продовжуєте службу в лавах Сил оборони чи вже звільнені у запас? Чи надала військова частина Довідку за Додатком 6, чи потрібно підготувати офіційний рапорт на її витребування?»</i>`,
            links: [
                { text: '⚖️ Консультація юриста по рапортах', href: 'cabinet.html#tab-specialists' },
                { text: '🌐 Портал Мінветеранів (mva.gov.ua)', href: 'https://mva.gov.ua' }
            ],
            followups: [
                'Що робити, якщо військова частина ігнорує рапорт на УБД?',
                'Які пільги на комуналку та транспорт дає посвідчення УБД?',
                'Як оформити статус через портал Дія?'
            ]
        },
        {
            keywords: ['ваучер', 'ваучер на навчання', 'ваучер 30 280', '30 280', 'навчання', 'курси', 'освіта', 'перекваліфікація', 'професія', 'дцз', 'центр зайнятості'],
            title: '📜 Державний ваучер на 100% безкоштовне навчання (до 30 280 грн)',
            answer: `<b>📌 Нормативно-правова база:</b>
• Закон України «Про зайнятість населення» (стаття 30)
• Постанова Кабінету Міністрів України від 20 березня 2013 р. №207 «Про затвердження Порядку видачі ваучерів»

<b>💰 Сума покриття та фінансування:</b>
• До <b>30 280 грн</b> (10 прожиткових мінімумів для працездатних осіб) повністю сплачує Державна служба зайнятості.

<b>📋 Повний перелік документів для отримання:</b>
1. <b>Паспорт громадянина України</b> та довідка про присвоєння ІПН.
2. <b>Посвідчення УБД</b> або посвідчення особи з інвалідністю внаслідок війни.
3. <b>Документ про освіту</b> (диплом кваліфікованого робітника, молодшого спеціаліста, бакалавра або магістра з додатком). <i>Важливо: наявність хоча б професійно-технічної або вищої освіти є обов'язковою вимогою закону.</i>
4. <b>Трудова книжка</b> (за наявності) або витяг з Реєстру застрахованих осіб Пенсійного фонду (довідка за формою <b>ОК-5 / ОК-7</b> через Дію).
5. <b>Заява на видачу ваучера</b> (подається онлайн на сайті ДСЗ або особисто в будь-якому відділенні Центру зайнятості).

<b>🎯 Доступні напрями (понад 70 затверджених спеціальностей):</b>
• <b>IT та High-Tech:</b> Інженерія програмного забезпечення, Кібербезпека, Комп'ютерні науки, Системне адміністрування.
• <b>Безпілотні системи:</b> Оператор БПЛА / агродронів, технічне обслуговування дронів.
• <b>Транспорт та логістика:</b> Водій автотранспортних засобів категорій C, D, CE, машиніст спецтехніки, автослюсар.
• <b>Психологія та соціальна сфера:</b> Практична психологія, Соціальна робота, Фізична реабілітація.
• <b>Будівництво та енергетика:</b> Електрогазозварник, монтажник систем відновлювальної енергетики (сонячні панелі).

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Яка професія чи сфера вас цікавить найбільше (IT, керування дронами, транспорт, психологія чи агросфера)? Чи маєте ви вже базовий диплом (ПТУ, коледж або виш)?»</i>`,
            links: [
                { text: '📚 Вибрати курс у кабінеті', href: 'cabinet.html#tab-education' },
                { text: '🌐 Реєстр ваучерів ДСЗ (dcz.gov.ua)', href: 'https://www.dcz.gov.ua/storinka/vauchery' }
            ],
            followups: [
                'Як отримати довідку ОК-5 або ОК-7 у Дії?',
                'Скільки часу діє виданий ваучер для вступу?',
                'Чи можна обрати навчання в університеті Черкас?'
            ]
        },
        {
            keywords: ['грант', 'єробота', 'гранти єробота', 'власна справа', 'бізнес', 'підприємництво', 'стартап', 'відкрити бізнес', '1000000', '250000', '500000'],
            title: '🏆 Грантова програма «єРобота: Грант для ветеранів та другого з подружжя» (до 1 000 000 грн)',
            answer: `<b>📌 Нормативно-правова база:</b>
• Постанова Кабінету Міністрів України від 21 червня 2022 р. №738 «Деякі питання надання грантів бізнесу» (зі змінами щодо ветеранського компоненту)

<b>💰 Градація сум та обов'язкові вимоги створення робочих місць:</b>
• <b>До 250 000 грн</b> — для учасника бойових дій або особи з інвалідністю внаслідок війни. <i>Вимога:</i> створення <b>1 робочого місця</b>.
• <b>До 500 000 грн</b> — для другого з подружжя ветерана (дружини/чоловіка). <i>Вимога:</i> створення <b>2 робочих місць</b>.
• <b>До 1 000 000 грн</b> — для ветерана, зареєстрованого як ФОП не менше 36 місяців. <i>Вимога:</i> створення <b>4 робочих місць</b> (співфінансування: 70% коштів надає держава, 30% — власні кошти отримувача).

<b>📋 Етапи та перелік документів для подання:</b>
1. <b>Розробка бізнес-плану</b> за затвердженою формою Мінекономіки (детальний помісячний розрахунок доходів, витрат на оренду, закупівлю обладнання, виплату зарплат та податків).
2. <b>Подання онлайн-заяви через портал «Дія»</b> (розділ «Грант для ветеранів») із підписанням Кваліфікованим електронним підписом (КЕП).
3. <b>Скоринг та перевірка ділової репутації АТ «Ощадбанк»</b> (відсутність відкритих судових проваджень, арештів майна, боргів перед бюджетом чи критичних прострочень за кредитами).
4. <b>Захист бізнес-плану (співбесіда):</b> очна або онлайн-співбесіда у Регіональному центрі зайнятості.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Який напрям підприємництва ви плануєте розвивати (виробництво, сфера послуг, агробізнес, торгівля) і на яку суму гранту розраховуєте? Чи потрібен вам типовий шаблон бізнес-плану та підготовка до співбесіди?»</i>`,
            links: [
                { text: '💼 Кар\'єрна та бізнес-консультація', href: 'cabinet.html#tab-specialists' },
                { text: '🌐 Подати заявку в Дія', href: 'https://diia.gov.ua/services/grant-dlya-veteraniv-ta-chleniv-yihnih-simej' }
            ],
            followups: [
                'На що саме дозволено витрачати кошти гранту?',
                'Які типові помилки в бізнес-плані ведуть до відмови?',
                'Як повернути грант податками без повернення коштів готівкою?'
            ]
        },
        {
            keywords: ['виплати', 'грошова допомога', 'пільги', 'одноразова виплата', 'компенсація', 'допомога', 'пільги громади', 'муніципальні пільги', 'жкп', 'комунальні'],
            title: '💰 Пільги, грошові виплати та соціальні гарантії ветеранів (державні та місцеві)',
            answer: `<b>📌 Нормативно-правова база:</b>
• Закон України «Про статус ветеранів війни, гарантії їх соціального захисту» (статті 12–15)
• Постанова КМУ №1045 (порядок надання житлових субсидій та пільг на ЖКП)
• Міські та обласні програми комплексної підтримки Захисників і Захисниць Черкащини

<b>📋 Комплекс державних пільг та гарантій:</b>
1. <b>Знижка на житлово-комунальні послуги (ЖКП):</b>
   • <b>75% знижка</b> — для Учасників бойових дій (УБД)
   • <b>100% знижка</b> — для осіб з інвалідністю внаслідок війни
   • <b>50% знижка</b> — для членів сімей загиблих Захисників
   <i>Куди звертатися:</i> Сервісні центри Пенсійного фонду України (ПФУ), ЦНАП або через особистий вебпортал ПФУ.
2. <b>Безоплатний проїзд:</b> Усіма видами міського та приміського пасажирського транспорту на підставі посвідчення встановленого зразка.
3. <b>Медичні гарантії:</b> Безоплатне одержання ліків за рецептами лікарів, першочергове зубопротезування, щорічне диспансерне обстеження та безоплатне санаторно-курортне лікування.
4. <b>Одноразова грошова допомога (ОГД):</b> При звільненні за станом здоров'я або встановленні групи інвалідності/відсотка втрати працездатності внаслідок бойових дій.

<b>🏛️ Муніципальні програми громад Черкаської області:</b>
• Додаткові щомісячні стипендії та виплати дітям Захисників
• Компенсація витрат на дороговартісне лікування та ендопротезування
• Звільнення від сплати місцевих зборів та пільгове харчування дітей у дитсадках і школах.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«У якій саме громаді Черкащини (Черкаси, Умань, Сміла, Золотоноша тощо) ви зареєстровані? Яку саме пільгу чи виплату ви бажаєте оформити першочергово?»</i>`,
            links: [
                { text: '⚖️ Юридична допомога з оформлення пільг', href: 'cabinet.html#tab-specialists' },
                { text: '🏛️ Портал Пенсійного фонду України', href: 'https://portal.pfu.gov.ua' }
            ],
            followups: [
                'Які документи потрібні до Пенсійного фонду на знижку 75%?',
                'Як отримати одноразову допомогу при демобілізації?',
                'Які місцеві виплати діють у місті Черкаси?'
            ]
        },
        {
            keywords: ['форма 5', 'довідка про поранення', 'додаток 5', 'обставини поранення', 'розслідування', 'командир не дає', 'не видають довідку'],
            title: '📄 Довідка про обставини травми / поранення (Форма 5 / Додаток 5): як отримати та що робити при затримці',
            answer: `<b>📌 Чому це найважливіший медико-юридичний документ:</b>
Без Довідки про обставини травми ВЛК та МСЕК мають право встановити формулювання <i>«Захворювання, пов'язане з проходженням служби»</i> замість <i>«Поранення, пов'язане із захистом Батьківщини»</i>. Це зменшує розмір виплат у кілька разів.

<b>📋 Порядок видачі:</b>
1. Начальник медичної служби частини складає сповіщення про поранення на підставі первинної медичної картки (Форма 100).
2. Командир військової частини призначає службове розслідування (строк: до 15–30 діб).
3. За результатами розслідування видається наказ командира та оформлюється <b>Довідка про обставини травми (Додаток 5)</b> у 4 примірниках (до особової справи, до шпиталю, до ТЦК та на руки бійцю).

<b>🚨 Що робити, якщо військові частина ігнорує або затягує розслідування:</b>
1. Подати письмовий <b>Рапорт на ім'я командира військової частини</b> з вимогою завершити розслідування та надати Довідку (рекомендованим листом з описом вкладення або через ТЦК/шпиталь).
2. У разі бездіяльності понад 30 днів — подати скаргу до:
   • <b>Оперативного командування (ОК)</b>, якому підпорядкована частина
   • <b>Військової служби правопорядку (ВСП)</b>
   • <b>Спеціалізованої прокуратури у сфері оборони</b>
   • <b>Уповноваженого ВРУ з прав людини</b> (гаряча лінія: 0 800 50 17 20).

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Чи подавали ви вже офіційний рапорт на отримання Довідки Форма 5 і де ви зараз перебуваєте (у шпиталі, частині чи вдома)? Я можу надати юридичний шаблон рапорту та скарги на бездіяльність частини.»</i>`,
            links: [
                { text: '⚖️ Звернутися до військового юриста', href: 'cabinet.html#tab-specialists' },
                { text: '📞 Гаряча лінія Міноборони: 1512', href: 'tel:1512' }
            ],
            followups: [
                'Надати зразок рапорту на Довідку Форма 5',
                'Як зв\'язатися зі Спеціалізованою прокуратурою у сфері оборони?',
                'Що робити, якщо свідки поранення відсутні?'
            ]
        },
        {
            keywords: ['житло', 'квартира', 'субвенція', 'постанова 719', 'постанова 280', 'грошова компенсація на житло', 'квартирний облік'],
            title: '🏠 Грошова компенсація на придбання житла для ветеранів (Постанови КМУ №719, №280, №214)',
            answer: `<b>📌 Нормативно-правова база:</b>
• Постанова Кабінету Міністрів України №719 (для осіб з інвалідністю внаслідок війни I-II групи та сімей загиблих Захисників)
• Постанова КМУ №280 (для ветеранів з-поміж ВПО)

<b>📋 Хто має право та обов'язкові критерії:</b>
1. Особи з інвалідністю внаслідок війни 1–2 групи, інвалідність яких настала внаслідок безпосередньої участі в АТО/ООС/відсічі збройної агресії РФ.
2. Члени сімей загиблих (померлих) Захисників і Захисниць України.
3. <b>Головна умова:</b> Обов'язкове перебування на <b>квартирному обліку</b> (в черзі на житло) у міській, селищній або районній раді за місцем реєстрації.

<b>🏦 Механізм виплати:</b>
• Кошти субвенції розраховуються за державною формулою (з урахуванням опосередкованої вартості квадратного метра та кількості членів сім'ї).
• Держава перераховує кошти на спеціальний рахунок ветерана в АТ «Ощадбанк».
• Ветеран самостійно обирає будь-яке житло (квартиру, будинок) на первинному чи вторинному ринку в будь-якому регіоні України протягом 1 року.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Чи перебуваєте ви вже на квартирному обліку у своїй громаді та яку групу інвалідності маєте? Підказати вам точний перелік документів для взяття на квартирний облік?»</i>`,
            links: [
                { text: '⚖️ Консультація з житлового права', href: 'cabinet.html#tab-specialists' },
                { text: '🌐 Розділ житла Мінветеранів', href: 'https://mva.gov.ua' }
            ],
            followups: [
                'Як стати на квартирний облік у ЦНАП?',
                'Як розраховується сума компенсації на житло?',
                'Скільки часу діє спеціальний рахунок в Ощадбанку?'
            ]
        },
        {
            keywords: ['психолог', 'птср', 'психологічна', 'стрес', 'депресія', 'тривога', 'адаптація', 'реабілітація', 'ашрам', 'сон', 'кошмари', 'паніка'],
            title: '🧠 Психологічна підтримка та декомпресія',
            answer: `<b>📌 Конфіденційність та стандарти допомоги:</b>
Усі психологічні консультації на порталі «Новий Шлях» надаються <b>100% безкоштовно</b> для ветеранів та їхніх родин сертифікованими кризовими психологами та військовими терапевтами.

<b>📋 Доступні формати підтримки:</b>
1. <b>Індивідуальні конфіденційні онлайн-сесії:</b> робота з бойовою психічною травмою, наслідками акубаротравм (контузій), тривожністю, розладами сну та панічними станами.
2. <b>Сімейні консультації:</b> психологічний супровід подружжя, подолання комунікаційних бар'єрів після повернення з фронту.
3. <b>Групи взаємодопомоги за принципом «Рівний — Рівному»:</b> зустрічі ветеранів у безпечному колі побратимів у громадах Черкащини.
4. <b>Заміський реабілітаційний простір «Ашрам»:</b> у процесі створення. Триває благодійний збір на його будівництво та облаштування.
5. <b>Кризові гарячі лінії 24/7:</b> цілодобова безоплатна підтримка Українського ветеранського фонду (0 800 33 20 29) та урядова гаряча лінія 1545.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Який формат спілкування для вас зараз найбільш комфортний (онлайн-сесія з психологом, текстовий чат чи участь у живій групі підтримки ветеранів у Черкасах)?»</i>`,
            links: [
                { text: '🧠 Обрати психолога у кабінеті', href: 'cabinet.html#tab-specialists' },
                { text: '🌿 Підтримати збір на простір «Ашрам»', href: 'javascript:openCharityModal()' },
                { text: '📞 Гаряча лінія підтримки УВФ', href: 'tel:0800332029' }
            ],
            followups: [
                'Як записатися на безкоштовну онлайн-сесію?',
                'Чи є допомога для дружини та дітей військового?',
                'Як підтримати будівництво центру «Ашрам»?'
            ]
        },
        {
            keywords: ['земля', 'земельна ділянка', 'пай', 'безоплатно земля', 'виділення землі'],
            title: '🌱 Право на безоплатне отримання земельної ділянки для ветеранів (ст. 12 ЗУ «Про статус ветеранів війни»)',
            answer: `<b>📌 Нормативна база та поточний правовий стан:</b>
• Стаття 12 Закону України «Про статус ветеранів війни, гарантії їх соціального захисту»
• <b>Важливе юридичне застереження:</b> Згідно з підпунктом 5 пункту 27 Перехідних положень Земельного кодексу України, на період дії воєнного стану безоплатна передача земель державної та комунальної власності у приватну власність <b>тимчасово призупинена</b> (крім випадків оформлення землі під уже збудованою нерухомістю, що перебуває у власності).

<b>📋 Норми площі ділянок після відновлення процедури:</b>
• До <b>2,0 га</b> — для ведення особистого селянського господарства (ОСГ)
• До <b>0,12 га</b> — для індивідуального садівництва
• До <b>0,10 га</b> (у селах), до <b>0,15 га</b> (у селищах), до <b>0,25 га</b> (у містах) — під будівництво та обслуговування житлового будинку.

<b>💬 Уточнююче запитання від ШІ-Асистента:</b>
<i>«Чи є у вас у власності житловий будинок, під яким потрібно приватизувати присадибну ділянку (це дозволено під час воєнного стану), чи ви плануєте стати на першочергову чергу в громаді?»</i>`,
            links: [
                { text: '⚖️ Консультація земельного юриста', href: 'cabinet.html#tab-specialists' }
            ],
            followups: [
                'Чи можна оформити землю під власним будинком зараз?',
                'Як стати у першочергову чергу на землю в міськраді?',
                'Чи виплачується грошова компенсація за неотриману землю?'
            ]
        }
    ];

    // ═══════════════════════════════════════════════
    // ІНТЕРАКТИВНИЙ ШІ-ЧАТ НА ГОЛОВНІЙ СТОРІНЦІ
    // ═══════════════════════════════════════════════
    let heroChatHistory = [];

    function renderHeroChat() {
        const targetArea = document.getElementById('aiSearchResponse') || responseArea;
        if (!targetArea) return;
        targetArea.style.display = 'block';

        let messagesHtml = heroChatHistory.map((m, idx) => {
            if (m.role === 'user') {
                return `<div style="display: flex; justify-content: flex-end; margin-bottom: 14px;">
                    <div style="background: rgba(46, 139, 87, 0.3); border: 1px solid rgba(46, 139, 87, 0.5); color: #fff; padding: 11px 18px; border-radius: 20px 20px 4px 20px; max-width: 82%; font-size: 13.5px; line-height: 1.5; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        ${m.text}
                    </div>
                </div>`;
            } else {
                return `<div style="display: flex; gap: 12px; margin-bottom: 18px; align-items: flex-start;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, rgba(46,139,87,0.4), rgba(20,60,30,0.8)); border: 1px solid var(--primary-green); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; box-shadow: 0 0 10px rgba(46,139,87,0.3);">🛡️</div>
                    <div style="flex: 1; background: rgba(14, 18, 14, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px 20px 20px 20px; padding: 16px 20px; color: #e5e7eb; font-size: 13.5px; line-height: 1.7; box-shadow: 0 8px 24px rgba(0,0,0,0.35);">
                        ${m.text}
                        ${m.sourcesHtml || ''}
                        ${m.linksHtml ? `<div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">${m.linksHtml}</div>` : ''}
                    </div>
                </div>`;
            }
        }).join('');

        const closeBtnHtml = `<button onclick="document.getElementById('aiSearchResponse').style.display='none'" style="position: absolute; top: 12px; right: 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #aaa; font-size: 16px; cursor: pointer; padding: 3px 8px; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.color='#aaa'; this.style.background='rgba(255,255,255,0.06)'" title="Згорнути чат">✕</button>`;

        targetArea.innerHTML = `
            ${closeBtnHtml}
            <div style="font-size: 13.5px; font-weight: 700; letter-spacing: 0.5px; color: var(--primary-green); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">🤖</span>
                    <span>ШІ-Асистент «Новий Шлях» • Нормативний Консультант</span>
                </span>
                <span style="font-size: 11px; color: #888; font-weight: normal; margin-right: 32px;">База законів та супроводу</span>
            </div>
            
            <div id="heroChatMessages" style="max-height: 380px; overflow-y: auto; padding-right: 6px; margin-bottom: 14px; scroll-behavior: smooth;">
                ${messagesHtml}
            </div>

            <!-- Поле введення уточнюючого запитання внизу чату -->
            <div style="display: flex; gap: 8px; background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(46, 139, 87, 0.45); border-radius: 50px; padding: 5px 8px 5px 18px; align-items: center; box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);">
                <input type="text" id="heroChatFollowupInput" placeholder="Поставте будь-яке запитання або уточніть вашу ситуацію..." style="flex: 1; background: transparent; border: none; color: white; font-size: 13.5px; outline: none;" onkeydown="if(event.key==='Enter') sendHeroFollowup();">
                <button onclick="sendHeroFollowup();" style="background: var(--primary-green); border: none; color: white; border-radius: 50px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    <span>Запитати</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        `;

        const msgContainer = document.getElementById('heroChatMessages');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    window.handleUserQuery = async function(queryText) {
        if (!queryText || !queryText.trim()) return;
        queryText = queryText.trim();
        
        const respArea = document.getElementById('aiSearchResponse') || responseArea;
        if (respArea) respArea.style.display = 'block';

        // 1. Додаємо повідомлення користувача
        heroChatHistory.push({ role: 'user', text: queryText });

        // Показуємо індикатор генерації відповіді
        heroChatHistory.push({
            role: 'assistant',
            text: '<div style="display: flex; align-items: center; gap: 8px; color: #a3e635;"><span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #a3e635; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></span> <span>ШІ формує відповідь згідно із законодавством...</span></div>',
            isTyping: true
        });
        renderHeroChat();

        const text = queryText.toLowerCase();
        let botReplyText = '';
        let sourcesHtml = '';
        let linksHtml = '';

        // 2. Спроба запиту до живого OpenAI бекенду (/api/ai/chat)
        let openAiSuccess = false;
        try {
            const apiResp = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: queryText,
                    history: heroChatHistory.filter(h => !h.isTyping)
                })
            });

            if (apiResp.ok) {
                const apiData = await apiResp.json();
                if (apiData && apiData.reply) {
                    botReplyText = apiData.reply.replace(/\n/g, '<br>');
                    openAiSuccess = true;

                    let followupsHtml = '';
                    if (apiData.followups && apiData.followups.length) {
                        followupsHtml = `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.15);">
                            <div style="font-size: 11.5px; font-weight: 600; color: #a3e635; margin-bottom: 8px;">💡 Швидкі уточнення (натисніть для відповіді):</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${apiData.followups.map(q => {
                                    const safeQ = encodeURIComponent(q);
                                    return `<button type="button" onclick="window.handleUserQuery(decodeURIComponent('${safeQ}'))" style="background: rgba(46,139,87,0.18); border: 1px solid rgba(46,139,87,0.45); color: #a3e635; padding: 5px 12px; border-radius: 20px; font-size: 11.5px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(46,139,87,0.35)'" onmouseout="this.style.background='rgba(46,139,87,0.18)'">💬 ${q}</button>`;
                                }).join('')}
                            </div>
                        </div>`;
                    }

                    linksHtml = `<a href="cabinet.html#tab-specialists" style="display: inline-block; padding: 6px 14px; border: 1px solid var(--primary-green); border-radius: 50px; color: #fff; background: var(--primary-green); text-decoration: none; font-size: 12px; font-weight: 600;">🔑 Відкрити базу фахівців у кабінеті</a>` + followupsHtml;
                }
            }
        } catch (e) {
            // Бекенд тимчасово недоступний, перемикаємось на локальний RAG
            console.log('OpenAI API endpoint offline, using local expert database.');
        }

        // 3. Fallback: Локальна експертна база знань
        if (!openAiSuccess) {
            try {
                const currentSpecialists = (window.portalSpecialists && Array.isArray(window.portalSpecialists)) 
                    ? window.portalSpecialists 
                    : [];
                    
                let matchedSpec = null;
                if (currentSpecialists.length > 0) {
                    matchedSpec = currentSpecialists.find(s => {
                        if (!s) return false;
                        const nameMatch = s.name && text.includes(s.name.toLowerCase());
                        const roleMatch = s.role && text.includes(s.role.toLowerCase());
                        let subMatch = false;
                        if (s.sub_specialties) {
                            const subs = Array.isArray(s.sub_specialties) 
                                ? s.sub_specialties 
                                : String(s.sub_specialties).split(',');
                            subMatch = subs.some(k => text.includes(String(k).trim().toLowerCase()));
                        }
                        return nameMatch || (roleMatch && text.length > 15) || subMatch;
                    });
                }

                if (matchedSpec && (text.includes('знайди') || text.includes('контакт') || text.includes('телефон') || text.includes(matchedSpec.name.toLowerCase()))) {
                    botReplyText = `<b>👤 Верифікований фахівець платформи: ${matchedSpec.name}</b><br><br>
                    <b>Спеціалізація:</b> ${matchedSpec.role || 'Фахівець з ветеранського супроводу'}<br>
                    ⭐ <b>Рейтинг довіри:</b> ${matchedSpec.rating || '5.0'} / 5.0 (перевірено модерацією)<br>
                    📍 <b>Локація / Громада:</b> ${matchedSpec.address || 'Черкаська область / Онлайн'}<br><br>
                    ${matchedSpec.bio ? '<i>«' + matchedSpec.bio + '»</i><br><br>' : ''}
                    🛡️ <b>Доступ до прямих контактів:</b> Оскільки ви є користувачем порталу «Новий Шлях», ви можете відкрити повний профіль фахівця та надіслати йому пряме звернення у кабінеті.`;
                    
                    linksHtml = `<a href="cabinet.html#tab-specialists" style="display: inline-block; padding: 6px 16px; border: 1px solid var(--primary-green); border-radius: 50px; color: #fff; background: var(--primary-green); text-decoration: none; font-size: 12px; font-weight: 600;">🔑 Відкрити картку та записатися</a>`;
                } else {
                    let bestMatch = null;
                    let bestScore = 0;

                    const queryWords = text.split(/\s+/).filter(w => w.length > 1);

                    KNOWLEDGE_BASE.forEach(entry => {
                        let score = 0;
                        (entry.keywords || []).forEach(kw => {
                            const kwLower = kw.toLowerCase();
                            if (text.includes(kwLower)) {
                                score += kwLower.length * 4;
                            } else {
                                queryWords.forEach(word => {
                                    if (kwLower.includes(word) || word.includes(kwLower)) {
                                        score += word.length * 2;
                                    }
                                });
                            }
                        });
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = entry;
                        }
                    });

                    if (bestMatch && bestScore > 0) {
                        botReplyText = bestMatch.answer.replace(/\n/g, '<br>');
                        
                        let followupsHtml = '';
                        if (bestMatch.followups && bestMatch.followups.length) {
                            followupsHtml = `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.15);">
                                <div style="font-size: 11.5px; font-weight: 600; color: #a3e635; margin-bottom: 8px;">💡 Швидкі уточнення (натисніть для відповіді):</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${bestMatch.followups.map(q => {
                                        const safeQ = encodeURIComponent(q);
                                        return `<button type="button" onclick="window.handleUserQuery(decodeURIComponent('${safeQ}'))" style="background: rgba(46,139,87,0.18); border: 1px solid rgba(46,139,87,0.45); color: #a3e635; padding: 5px 12px; border-radius: 20px; font-size: 11.5px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(46,139,87,0.35)'" onmouseout="this.style.background='rgba(46,139,87,0.18)'">💬 ${q}</button>`;
                                    }).join('')}
                                </div>
                            </div>`;
                        }

                        linksHtml = (bestMatch.links || []).map(l =>
                            `<a href="${l.href}" style="display: inline-block; padding: 6px 14px; border: 1px solid var(--primary-green); border-radius: 50px; color: var(--primary-green); text-decoration: none; font-size: 12px; font-weight: 600; margin-right: 6px; margin-top: 4px;">${l.text}</a>`
                        ).join('') + followupsHtml;
                    }
                }

                if (!botReplyText) {
                    botReplyText = `<b>💡 Аналіз вашого запиту:</b> <i>«${queryText}»</i><br><br>
                    Я можу надати детальну юридичну або практичну довідку з будь-якого ветеранського питання згідно із законодавством України:<br><br>
                    • <b>Медико-юридичний супровід:</b> Порядок проходження ВЛК, оскарження постанов до ЦВЛК, отримання Довідки Форма 5 (про обставини травми), оцінювання втрати працездатності / МСЕК.<br>
                    • <b>Статуси та пільги:</b> Отримання статусу УБД (Додаток 6), оформлення знижки 75% на комунальні послуги через Пенсійний фонд, компенсації на житло (Постанова №719).<br>
                    • <b>Освіта та бізнес:</b> Державний ваучер на навчання до 30 280 грн, гранти на бізнес «єРобота» до 1 млн грн.<br><br>
                    <b>💬 Уточнююче запитання від ШІ-Асистента:</b><br>
                    <i>«Опишіть трохи детальніше вашу поточну ситуацію (наприклад, чи перебуваєте ви на службі, чи є на руках потрібні виписки/довідки) — і я надам точний покроковий алгоритм дій.»</i>`;
                    
                    const defaultFollowups = [
                        'Оскарження висновку ВЛК та оцінка втрати працездатності',
                        'Як отримати статус УБД та Довідку Додаток 6?',
                        'Державний ваучер на навчання 30 280 грн',
                        'Гранти на бізнес для ветеранів єРобота'
                    ];
                    const followupsHtml = `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.15);">
                        <div style="font-size: 11.5px; font-weight: 600; color: #a3e635; margin-bottom: 8px;">💡 Оберіть основну тему або продовжіть діалог:</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${defaultFollowups.map(q => {
                                const safeQ = encodeURIComponent(q);
                                return `<button type="button" onclick="window.handleUserQuery(decodeURIComponent('${safeQ}'))" style="background: rgba(46,139,87,0.18); border: 1px solid rgba(46,139,87,0.45); color: #a3e635; padding: 5px 12px; border-radius: 20px; font-size: 11.5px; cursor: pointer; transition: all 0.2s;">💬 ${q}</button>`;
                            }).join('')}
                        </div>
                    </div>`;

                    linksHtml = `<a href="cabinet.html#tab-specialists" style="display: inline-block; padding: 6px 14px; border: 1px solid var(--primary-green); border-radius: 50px; color: #fff; background: var(--primary-green); text-decoration: none; font-size: 12px; font-weight: 600;">👤 Залучити юриста з кабінету</a>` + followupsHtml;
                }
            } catch (err) {
                console.error('Error in local fallback:', err);
                botReplyText = `За вашим запитом доступні інструкції з питань УБД, ВЛК/МСЕК, пільг та навчання. Оберіть тему нижче:`;
                linksHtml = `<a href="cabinet.html#tab-specialists" style="display: inline-block; padding: 6px 14px; border: 1px solid var(--primary-green); border-radius: 50px; color: var(--primary-green); text-decoration: none; font-size: 12px; font-weight: 600;">👤 Знайти фахівця</a>`;
            }
        }

        // 4. Прибираємо тимчасовий індикатор "друкує" та додаємо справжню відповідь ШІ
        heroChatHistory = heroChatHistory.filter(h => !h.isTyping);
        heroChatHistory.push({
            role: 'assistant',
            text: botReplyText,
            sourcesHtml: sourcesHtml,
            linksHtml: linksHtml
        });

        // 5. Рендеримо чат
        renderHeroChat();
    };

    async function performSearch() {
        const queryText = searchInput.value.trim();
        if (!queryText) return;
        searchInput.value = '';
        await window.handleUserQuery(queryText);
    }

    window.sendHeroFollowup = function() {
        const followInput = document.getElementById('heroChatFollowupInput');
        if (followInput && followInput.value.trim()) {
            const val = followInput.value.trim();
            followInput.value = '';
            window.handleUserQuery(val);
        }
    };

    window.applyHeroPrompt = function(promptText) {
        window.handleUserQuery(promptText);
        if (responseArea) {
            responseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };
});

    // --- ЛОГІКА РЕЄСТРАЦІЇ СПЕЦІАЛІСТА (WIZARD FLOW) ---
    const regModal = document.getElementById('registration-modal');
    const closeRegBtn = document.getElementById('closeRegModal');
    const regForm = document.getElementById('specRegistrationForm');

    const privacyModal = document.getElementById('legal-privacy-modal');
    const agreementModal = document.getElementById('legal-agreement-modal');
    const linkPrivacy = document.getElementById('linkPrivacy');
    const linkAgreement = document.getElementById('linkAgreement');

    let currentStep = 1;
    const totalSteps = 4;

    function toggleModal(modal, show) {
        if (!modal) return;
        if (show) {
            modal.classList.add('active');
            showStep(1);
        } else {
            modal.classList.remove('active');
        }
    }

    function showStep(stepNum) {
        currentStep = stepNum;
        for (let i = 1; i <= totalSteps; i++) {
            const stepEl = document.getElementById(`wizard-step-${i}`);
            if (stepEl) {
                stepEl.style.display = i === stepNum ? 'block' : 'none';
            }
        }
        
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        const submitBtn = document.getElementById('submitRegBtn');

        if (prevBtn) prevBtn.style.display = stepNum === 1 ? 'none' : 'block';
        if (nextBtn) nextBtn.style.display = stepNum === totalSteps ? 'none' : 'block';
        if (submitBtn) submitBtn.style.display = stepNum === totalSteps ? 'block' : 'none';
    }

    function validateStep(stepNum) {
        if (stepNum === 1) {
            const specField = document.getElementById('regSpecialistField');
            if (!specField || !specField.value) {
                alert('Будь ласка, оберіть вашу спеціалізацію.');
                return false;
            }
            return true;
        }
        if (stepNum === 2) {
            const address = document.getElementById('regAddress');
            const bio = document.getElementById('regBio');
            if (!address || !address.value.trim()) {
                alert('Будь ласка, вкажіть адресу кабінету або "Онлайн".');
                return false;
            }
            if (!bio || !bio.value.trim()) {
                alert('Будь ласка, заповніть інформацію про ваш професійний досвід.');
                return false;
            }
            return true;
        }
        if (stepNum === 3) {
            const tariff = document.getElementById('regTariffPlan');
            if (!tariff || !tariff.value) {
                alert('Будь ласка, оберіть тарифний план.');
                return false;
            }
            // Дата гранту обовязкова для ВСІХ Зони 1 на грантовому тарифі
            const specField = document.getElementById('regSpecialistField')?.value || '';
            const isZone1 = ['psychologist', 'rehabilitation', 'narcologist', 'lawyer_consult'].includes(specField);
            if (tariff.value === 'grant_standard' && isZone1) {
                const endDate = document.getElementById('regContractEndDate');
                if (!endDate || !endDate.value) {
                    alert('⚠️ Для психологів та реабілітологів на грантовому тарифі обов’язково вказати кінцеву дату завершення договору.');
                    return false;
                }
            }
            return true;
        }
        if (stepNum === 4) {
            const photoInput = document.getElementById('regPhoto');
            if (!photoInput || !photoInput.files || photoInput.files.length === 0) {
                const specField = document.getElementById('regSpecialistField')?.value || '';
                const isZone1 = ['psychologist', 'rehabilitation', 'narcologist', 'lawyer_consult'].includes(specField);
                const msg = isZone1 ? 'Будь ласка, обов’язково завантажте фото для вашого профілю.' : 'Будь ласка, обов’язково завантажте логотип вашої організації.';
                alert(msg);
                return false;
            }
            return true;
        }
        return true;
    }

    function updateStepFlow() {
        const specField = document.getElementById('regSpecialistField')?.value || '';

        // Зона 1: приватні фахівці (сесійна модель) — БЕЗ анкети юриста
        const isZone1 = ['psychologist', 'rehabilitation', 'narcologist', 'lawyer_consult'].includes(specField);
        // Зона 2 юристи (потребують анкети)
        const isLawyerZone2 = ['lawyer_docs', 'advocate'].includes(specField);
        // Зона 2 протезист (фіксована підписка, без анкети)
        const isProsthetist = specField === 'prosthetist';

        const lawyerQuestions = document.getElementById('lawyer-questions-block');
        const recommendedBox = document.getElementById('lawyer-tariff-recommendation');
        const grantDateContainer = document.getElementById('grant-date-container');
        const tariffSelect = document.getElementById('regTariffPlan');

        // Анкета тільки для lawyer_docs та advocate (Зона 2)
        if (lawyerQuestions) lawyerQuestions.style.display = isLawyerZone2 ? 'block' : 'none';
        if (recommendedBox) recommendedBox.style.display = isLawyerZone2 ? 'block' : 'none';

        // Передвибір тарифу залежно від зони
        if (tariffSelect) {
            if (isZone1) {
                tariffSelect.value = 'grant_standard';
            } else if (isLawyerZone2) {
                updateLawyerTariffRecommendation();
            } else if (isProsthetist) {
                // Протезист = Зона 2в (адвокатське бюро / протезний центр)
                tariffSelect.value = 'zone2c_bureau';
            }
        }

        // Дата завершення договору — тільки для всіх Зони 1 (грантовий тариф)
        if (grantDateContainer) {
            grantDateContainer.style.display = isZone1 ? 'block' : 'none';
        }
    }

    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                if (currentStep < totalSteps) {
                    showStep(currentStep + 1);
                }
            }
        });
    }

    const specSelect = document.getElementById('regSpecialistField');
    if (specSelect) {
        specSelect.addEventListener('change', updateStepFlow);
    }

    function updateLawyerTariffRecommendation() {
        const tariffSelect = document.getElementById('regTariffPlan');
        if (tariffSelect) tariffSelect.value = 'grant_standard';
    }

    // Додамо прослуховування змін в анкеті юриста
    setTimeout(() => {
        document.querySelectorAll('input[name="court-cases"]').forEach(el => {
            el.addEventListener('change', updateLawyerTariffRecommendation);
        });
        document.querySelectorAll('input[name="team-work"]').forEach(el => {
            el.addEventListener('change', updateLawyerTariffRecommendation);
        });
        const avgPriceEl = document.getElementById('avg-price-select');
        if (avgPriceEl) {
            avgPriceEl.addEventListener('change', updateLawyerTariffRecommendation);
        }
    }, 500);

    function checkRegistrationHash() {
        if (window.location.hash === '#registration') {
            const params = new URLSearchParams(window.location.search);
            const category = params.get('cat');
            
            const specSelect = document.getElementById('regSpecialistField');
            if (specSelect) {
                if (category === 'legal') {
                    specSelect.value = 'lawyer_consult';
                } else if (category === 'psychology') {
                    specSelect.value = 'psychologist';
                } else if (category === 'rehab') {
                    specSelect.value = 'rehabilitation';
                } else if (category === 'narcologist') {
                    specSelect.value = 'narcologist';
                }
            }
            
            updateStepFlow();

            if (params.get('name') || params.get('cat') || params.get('phone')) {
                toggleModal(regModal, true);
            }
        }
    }

    if (closeRegBtn) closeRegBtn.onclick = () => toggleModal(regModal, false);
    if (linkPrivacy) linkPrivacy.onclick = (e) => { e.preventDefault(); toggleModal(privacyModal, true); };
    if (linkAgreement) linkAgreement.onclick = (e) => { e.preventDefault(); toggleModal(agreementModal, true); };

    const closePrivacyBtn = document.getElementById('closePrivacyModal');
    const closeAgreementBtn = document.getElementById('closeAgreementModal');
    if (closePrivacyBtn) closePrivacyBtn.onclick = () => toggleModal(privacyModal, false);
    if (closeAgreementBtn) closeAgreementBtn.onclick = () => toggleModal(agreementModal, false);

    // --- Ініціалізація перемикача методу підписання (index.html) ---
    const idxMethodFile = document.getElementById('idx-sign-method-file');
    const idxMethodDiia = document.getElementById('idx-sign-method-diia');
    const idxPanelFile  = document.getElementById('idx-panel-sign-file');
    const idxPanelDiia  = document.getElementById('idx-panel-sign-diia');
    const idxLabelFile  = document.getElementById('idx-kep-method-file-label');
    const idxLabelDiia  = document.getElementById('idx-kep-method-diia-label');

    function idxSwitchSignMethod(method) {
        const isFile = method === 'file';
        if (idxPanelFile) idxPanelFile.style.display = isFile ? 'block' : 'none';
        if (idxPanelDiia) idxPanelDiia.style.display = isFile ? 'none' : 'block';
        if (idxLabelFile) {
            idxLabelFile.style.border = isFile ? '2px solid #2e8b57' : '2px solid #ddd';
            idxLabelFile.style.background = isFile ? 'rgba(46,139,87,0.08)' : '#fff';
            idxLabelFile.style.boxShadow = isFile ? '0 2px 8px rgba(46,139,87,0.15)' : 'none';
        }
        if (idxLabelDiia) {
            idxLabelDiia.style.border = isFile ? '2px solid #ddd' : '2px solid #111';
            idxLabelDiia.style.background = isFile ? '#fff' : 'rgba(0,0,0,0.03)';
            idxLabelDiia.style.boxShadow = isFile ? 'none' : '0 2px 8px rgba(0,0,0,0.1)';
        }
    }

    if (idxMethodFile) idxMethodFile.addEventListener('change', () => idxSwitchSignMethod('file'));
    if (idxMethodDiia) idxMethodDiia.addEventListener('change', () => idxSwitchSignMethod('diia'));
    idxSwitchSignMethod('file'); // за замовчуванням — файловий КЕП

    // Mock handler для Дія.Підпис (ФОП верифікація через ЄДРПОУ)
    const idxDiiaBtn    = document.getElementById('idx-diia-sign-btn');
    const idxDiiaToken  = document.getElementById('idx-diia-sign-token');
    const idxDiiaStatus = document.getElementById('idx-diia-sign-status');
    const idxEdrpou     = document.getElementById('idx-spec-edrpou');

    if (idxDiiaBtn) {
        idxDiiaBtn.addEventListener('click', () => {
            const edrpou = idxEdrpou ? idxEdrpou.value.trim() : '';
            if (!/^\d{8,10}$/.test(edrpou)) {
                if (idxEdrpou) { idxEdrpou.style.border = '2px solid #dc3545'; idxEdrpou.focus(); }
                if (idxDiiaStatus) { idxDiiaStatus.style.color = '#dc3545'; idxDiiaStatus.textContent = '❌ Введіть коректний ЄДРПОУ / ІПН (8–10 цифр)'; }
                return;
            }
            if (idxEdrpou) idxEdrpou.style.border = '';
            idxDiiaBtn.disabled = true;
            idxDiiaBtn.style.background = '#ffc107';
            idxDiiaBtn.style.color = '#000';
            idxDiiaBtn.innerHTML = '⏳ Перевірка реєстрації ФОП в ЄДРПОУ...';
            setTimeout(() => {
                if (idxDiiaToken) idxDiiaToken.value = `DIIA_FOP_SIGN_MOCK_${edrpou}_OK`;
                idxDiiaBtn.style.background = '#28a745';
                idxDiiaBtn.style.color = '#fff';
                idxDiiaBtn.innerHTML = '✅ ФОП верифіковано. Підпис отримано';
                if (idxDiiaStatus) {
                    idxDiiaStatus.style.color = '#28a745';
                    idxDiiaStatus.textContent = `✅ ФОП (ЄДРПОУ: ${edrpou}) підтверджено в державному реєстрі. Угода підписана.`;
                }
            }, 3000);
        });
    }

    // --- ВІДПРАВКА ФОРМИ РЕЄСТРАЦІЇ (з підтримкою КЕП — ЗУ №852-IV) ---
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();

            if (!document.getElementById('consentPrivacy').checked ||
                !document.getElementById('consentAgreement').checked) {
                alert('Будь ласка, погодьтеся з Політикою конфіденційності та Угодою про співпрацю.');
                return;
            }

            const params = new URLSearchParams(window.location.search);
            const formData = new FormData();
            const category = params.get('cat') || 'other';

            formData.append('name', params.get('name') || 'Не вказано');
            formData.append('category', category);
            formData.append('phone', params.get('phone') || '');
            formData.append('tg_id', params.get('tg_id') || '');
            formData.append('address', document.getElementById('regAddress').value);
            formData.append('bio', document.getElementById('regBio').value);
            formData.append('photo', document.getElementById('regPhoto').files[0]);
            formData.append('document', document.getElementById('regDoc').files[0]);
            formData.append('video_url', document.getElementById('regVideoUrl')?.value || '');
            formData.append('gender', document.getElementById('regGender')?.value || 'org');

            // Анкетні дані для юристів
            if (category === 'legal') {
                const courtCases = document.querySelector('input[name="court-cases"]:checked')?.value || '0';
                const teamWork = document.querySelector('input[name="team-work"]:checked')?.value || '0';
                const avgPrice = document.getElementById('avg-price-select')?.value || 'under_2000';
                formData.append('court_cases', courtCases);
                formData.append('team_work', teamWork);
                formData.append('avg_service_price', avgPrice);
            }

            // Обраний тарифний план та дата
            const tariffPlan = document.getElementById('regTariffPlan')?.value || 'grant_standard';
            formData.append('tariff_plan', tariffPlan);
            
            const contractEndDate = document.getElementById('regContractEndDate')?.value || '';
            formData.append('contract_end_date', contractEndDate);

            // Визначаємо метод підписання (обов'язково)
            const chosenMethod = document.querySelector('input[name="idx-sign-method"]:checked')?.value || 'file';
            formData.append('sign_method', chosenMethod);

            if (chosenMethod === 'file') {
                const kepInput = document.getElementById('regKep');
                const kepPwd   = document.getElementById('regKepPassword');
                if (!kepInput || kepInput.files.length === 0) {
                    alert('⚠️ Для реєстрації необхідно завантажити файл КЕП (.p12/.pfx/.jks).\n\nЯкщо у вас немає файлового КЕП — оберіть "Дія.Підпис" (тільки для ФОП).');
                    return;
                }
                formData.append('kep_file', kepInput.files[0]);
                formData.append('kep_password', kepPwd ? kepPwd.value : '');
            } else {
                const signToken = document.getElementById('idx-diia-sign-token')?.value;
                const edrpou    = document.getElementById('idx-spec-edrpou')?.value.trim();
                if (!signToken) {
                    alert('⚠️ Будь ласка, натисніть "Підписати через Дія.Підпис" та дочекайтеся підтвердження вашого статусу ФОП в ЄДРПОУ.');
                    return;
                }
                formData.append('diia_sign_token', signToken);
                formData.append('edrpou', edrpou || '');
            }

            const submitBtn = regForm.querySelector('button[type="submit"]');
            const origBtnText = submitBtn ? submitBtn.textContent : '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Надсилаємо...'; }

            try {
                const response = await fetch('/api/register-specialist', { method: 'POST', body: formData });
                const result = await response.json();
                if (result.status === 'success') {
                    const kepMsg = result.kep_signed ? ' Угода підписана вашим КЕПом.' : (result.diia_signed ? ' Угода підписана через Дія.Підпис (ФОП).' : '');
                    alert('Дякуємо! Заявку надіслано на модерацію. Ми зв\'яжемося через Telegram-бот.' + kepMsg);
                    toggleModal(regModal, false);
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
        };
    }


    checkRegistrationHash();

    // --- ЛОГІКА МОДАЛЬНОГО ВІКНА ВІДГУКІВ ---
    const reviewsModal = document.getElementById('reviews-modal');
    const closeReviewsBtn = document.getElementById('closeReviewsModal');
    const reviewsList = document.getElementById('reviews-list');
    const reviewsTitle = document.getElementById('reviews-title');
    const reviewsForm = document.getElementById('addReviewForm');
    const reviewsLoginWarning = document.getElementById('reviews-login-warning');
    
    let activeReviewSpecId = null;

    window.openReviewsModal = async (specId, specName) => {
        activeReviewSpecId = specId;
        if (reviewsTitle) reviewsTitle.textContent = `💬 Відгуки про фахівця: ${specName}`;
        if (reviewsModal) reviewsModal.classList.add('active');
        
        // Завантажуємо відгуки
        await fetchReviews(specId);
        
        // Перевіряємо авторизацію для показу форми
        const currentUserStr = localStorage.getItem('current_veteran');
        if (currentUserStr) {
            if (reviewsForm) reviewsForm.style.display = 'flex';
            if (reviewsLoginWarning) reviewsLoginWarning.style.display = 'none';
        } else {
            if (reviewsForm) reviewsForm.style.display = 'none';
            if (reviewsLoginWarning) reviewsLoginWarning.style.display = 'block';
        }
    };

    const fetchReviews = async (specId) => {
        if (!reviewsList) return;
        reviewsList.innerHTML = '<div style="color: var(--primary-green); text-align:center;">Завантаження відгуків...</div>';
        
        try {
            const response = await fetch(`/api/specialists/${specId}/reviews`);
            const data = await response.json();
            
            if (data.status === 'success' && data.reviews && data.reviews.length > 0) {
                reviewsList.innerHTML = '';
                data.reviews.forEach(rev => {
                    const revItem = document.createElement('div');
                    revItem.style.background = 'rgba(255,255,255,0.03)';
                    revItem.style.padding = '15px';
                    revItem.style.borderRadius = '12px';
                    revItem.style.border = '1px solid rgba(255,255,255,0.05)';
                    
                    const dateFormatted = rev.created_at ? rev.created_at.split(' ')[0] : '';
                    
                    revItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                            <strong style="color: var(--primary-green);">${rev.veteran_name}</strong>
                            <span style="color: #666;">${dateFormatted}</span>
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 8px; font-size: 11px; color: #aaa;">
                            <span>🤝 Якість: ${'⭐'.repeat(rev.rating_quality)}</span>
                            <span>🌿 Етика: ${'⭐'.repeat(rev.rating_ethics)}</span>
                            <span>⚖️ Чесність: ${'⭐'.repeat(rev.rating_honesty)}</span>
                        </div>
                        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #eee;">${rev.comment}</p>
                    `;
                    reviewsList.appendChild(revItem);
                });
            } else {
                reviewsList.innerHTML = '<div style="color: #666; text-align:center; padding: 20px;">Ще немає жодного відгуку. Будьте першим, хто залишить відгук!</div>';
            }
        } catch (e) {
            console.warn('Помилка завантаження відгуків:', e);
            reviewsList.innerHTML = '<div style="color: #ff4d4f; text-align:center;">Помилка завантаження відгуків з сервера.</div>';
        }
    };

    if (closeReviewsBtn) {
        closeReviewsBtn.onclick = () => {
            if (reviewsModal) reviewsModal.classList.remove('active');
            activeReviewSpecId = null;
            if (reviewsForm) reviewsForm.reset();
        };
    }

    if (reviewsForm) {
        reviewsForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!activeReviewSpecId) return;
            
            const currentUserStr = localStorage.getItem('current_veteran');
            if (!currentUserStr) {
                alert('Помилка: Ви не авторизовані!');
                return;
            }
            
            const currentUser = JSON.parse(currentUserStr);
            const tgId = currentUser.tg_id;
            
            const submitData = {
                veteran_tg_id: String(tgId),
                rating_quality: parseInt(document.getElementById('revQuality').value),
                rating_ethics: parseInt(document.getElementById('revEthics').value),
                rating_honesty: parseInt(document.getElementById('revHonesty').value),
                comment: document.getElementById('revComment').value.trim(),
                is_anonymous: document.getElementById('revAnonymous').checked ? 1 : 0
            };

            const submitBtn = reviewsForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const response = await fetch(`/api/specialists/${activeReviewSpecId}/reviews`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData)
                });
                
                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert('Дякуємо! Ваш відгук успішно додано.');
                    reviewsForm.reset();
                    await fetchReviews(activeReviewSpecId);
                } else {
                    alert(result.detail || 'Помилка збереження відгуку');
                }
            } catch (err) {
                console.error('Помилка відправки відгуку:', err);
                alert('Помилка з\'єднання з сервером при відправці відгуку.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Надіслати'; }
            }
        };
    }

    // ─── Публічний Дашборд Прозорості (ГО «Талан ЮА») ───────────────────────
    function animateValue(elem, start, end, duration, suffix = '', isFormatted = false) {
        if (!elem) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            elem.textContent = (isFormatted ? current.toLocaleString('uk-UA') : current) + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                elem.textContent = (isFormatted ? end.toLocaleString('uk-UA') : end) + suffix;
            }
        };
        window.requestAnimationFrame(step);
    }

    async function loadPublicDashboardStats() {
        const statCommunities = document.getElementById('pdbStatCommunities');
        const statSpecialists = document.getElementById('pdbStatSpecialists');
        const statTickets = document.getElementById('pdbStatTickets');
        const statSatisfaction = document.getElementById('pdbStatSatisfaction');

        if (!statCommunities) return;

        try {
            const res = await fetch('/api/v1/analytics/public-summary');
            const data = await res.json();
            if (data && data.status === 'success' && data.data) {
                const metrics = data.data.metrics || {};
                const cov = data.data.coverage || {};

                if (statCommunities && cov.all_ukraine_communities) {
                    animateValue(statCommunities, 0, cov.all_ukraine_communities, 1200, '', true);
                }
                if (statSpecialists && metrics.verified_specialists) {
                    animateValue(statSpecialists, 0, metrics.verified_specialists, 1000, '+');
                }
                if (statTickets && metrics.processed_tickets) {
                    animateValue(statTickets, 0, metrics.processed_tickets, 1200, '+');
                }
                if (statSatisfaction && metrics.satisfaction_rate) {
                    statSatisfaction.textContent = metrics.satisfaction_rate;
                }
            }
        } catch (e) {
            console.warn('[Public Dashboard Stats Fallback]', e);
        }
    }

    loadPublicDashboardStats();


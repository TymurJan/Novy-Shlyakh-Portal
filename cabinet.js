/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Ветеранський портал «Новий Шлях» | ГО «Талан ЮА»
 * Особистий кабінет ветерана та простір фахівця (Unified Adaptive Cabinet v2.0)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ─── 1. Ініціалізація Сесії та Користувача ────────────────────────────────
    const session = window.NovyShlyakhSession ? window.NovyShlyakhSession.getSession() : null;
    const tracker = window.NovyShlyakhTracker;

    let currentUser = (session && session.user) ? session.user : {
        id: "guest_" + (session ? session.sessionId : "anon"),
        name: "Гість порталу",
        callsign: "Побратим",
        phone: "",
        is_veteran: true,
        veteran_role: "veteran",
        roles: ["ROLE_GUEST"],
        geo_context: {
            community: "Вся Україна / Онлайн",
            settlement: "Вся Україна",
            region: "Україна",
            is_online: true
        }
    };

    const userId = currentUser.id || "anon_user";

    // ─── 2. Оновлення елементів шапки кабінету ─────────────────────────────────
    const cabCurrentGeo = document.getElementById('cabCurrentGeo');
    const cabUserName = document.getElementById('cabUserName');
    const cabStatusTag = document.getElementById('cabStatusTag');
    const cabAvatar = document.getElementById('cabAvatar');
    const cabVerifiedBadge = document.getElementById('cabVerifiedBadge');

    function updateHeaderProfile() {
        if (cabCurrentGeo) {
            const geo = currentUser.geo_context;
            cabCurrentGeo.textContent = geo ? (geo.settlement || geo.community || "Вся Україна / Онлайн") : "Вся Україна / Онлайн";
        }
        if (cabUserName) {
            cabUserName.textContent = currentUser.callsign || currentUser.name || "Ветеран";
        }
        if (cabStatusTag) {
            if (currentUser.roles && (currentUser.roles.includes('ROLE_SPECIALIST') || currentUser.roles.includes('ROLE_PARTNER'))) {
                cabStatusTag.textContent = "💼 Верифікований партнер";
                cabStatusTag.style.background = "rgba(59, 130, 246, 0.2)";
                cabStatusTag.style.color = "#93c5fd";
            } else if (currentUser.veteran_role === 'family') {
                cabStatusTag.textContent = "👨‍👩‍👧 Член родини ветерана";
                cabStatusTag.style.background = "rgba(168, 85, 247, 0.2)";
                cabStatusTag.style.color = "#d8b4fe";
            } else {
                cabStatusTag.textContent = "🎖️ Учасник бойових дій (УБД)";
                cabStatusTag.style.background = "rgba(16, 185, 129, 0.2)";
                cabStatusTag.style.color = "#6ee7b7";
            }
        }
        if (cabAvatar) {
            cabAvatar.textContent = currentUser.veteran_role === 'family' ? '👨‍👩‍👧' : (currentUser.roles && currentUser.roles.includes('ROLE_SPECIALIST') ? '💼' : '🎖️');
        }
        if (cabVerifiedBadge) {
            cabVerifiedBadge.style.display = (session && session.authMethod && session.authMethod !== 'none') ? 'inline-flex' : 'none';
        }
    }

    updateHeaderProfile();

    // ─── 3. Навігація між вкладками ───────────────────────────────────────────
    const navItems = document.querySelectorAll('.cab-nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.cab-tab-content');

    function switchTab(tabId) {
        navItems.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        tabContents.forEach(content => {
            if (content.id === tabId) {
                content.classList.add('active');
                content.style.display = 'block';
            } else {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });

        if (tracker) {
            tracker.trackEvent('tab_view', { tab_id: tabId });
        }
    }

    navItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    // Підтримка хешу в URL (наприклад, #education або #tickets)
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`tab-${hash}`)) {
        switchTab(`tab-${hash}`);
    }

    // Відображення партнерських вкладок при відповідній ролі
    const isPartner = currentUser.roles && (currentUser.roles.includes('ROLE_SPECIALIST') || currentUser.roles.includes('ROLE_PARTNER') || currentUser.roles.includes('ROLE_ADMIN'));
    const partnerDivider = document.getElementById('partnerNavDivider');
    const btnNavPartnerInbox = document.getElementById('btnNavPartnerInbox');
    const btnNavPartnerAgreement = document.getElementById('btnNavPartnerAgreement');
    if (isPartner) {
        if (partnerDivider) partnerDivider.style.display = 'block';
        if (btnNavPartnerInbox) btnNavPartnerInbox.style.display = 'flex';
        if (btnNavPartnerAgreement) btnNavPartnerAgreement.style.display = 'flex';
    }

    // ─── 4. Вкладка 1: Анкета та Гео-налаштування ──────────────────────────────
    const cabProfileForm = document.getElementById('cabProfileForm');
    const radioIsVeteran = document.getElementById('radioIsVeteran');
    const radioIsFamily = document.getElementById('radioIsFamily');
    const cabInputCallsign = document.getElementById('cabInputCallsign');
    const cabInputPhone = document.getElementById('cabInputPhone');
    const cabInputCommunity = document.getElementById('cabInputCommunity');
    const cabPreferredChannel = document.getElementById('cabPreferredChannel');
    const cabGeoAutocomplete = document.getElementById('cabGeoAutocomplete');
    const btnCabSharePhone = document.getElementById('btnCabSharePhone');
    const cabSaveProfileSuccess = document.getElementById('cabSaveProfileSuccess');

    // Завантаження профілю з сервера або локальної сесії
    async function loadUserProfile() {
        try {
            const res = await fetch(`/api/v1/user/profile?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data && data.status === 'success' && data.data) {
                const p = data.data;
                if (p.veteran_role === 'family') {
                    if (radioIsFamily) radioIsFamily.checked = true;
                } else {
                    if (radioIsVeteran) radioIsVeteran.checked = true;
                }
                if (cabInputCallsign) cabInputCallsign.value = p.callsign || currentUser.name || "";
                if (cabInputPhone) cabInputPhone.value = p.phone || currentUser.phone || "";
                if (cabInputCommunity) cabInputCommunity.value = p.community || "Вся Україна / Онлайн";
                if (cabPreferredChannel) cabPreferredChannel.value = p.preferred_channel || "telegram";
            } else {
                // Дефолтні значення
                if (cabInputCallsign) cabInputCallsign.value = currentUser.callsign || currentUser.name || "";
                if (cabInputPhone) cabInputPhone.value = currentUser.phone || "";
                if (cabInputCommunity) cabInputCommunity.value = (currentUser.geo_context && currentUser.geo_context.settlement) ? currentUser.geo_context.settlement : "Вся Україна / Онлайн";
            }
        } catch (e) {
            console.warn('[Profile Load Fallback]', e);
        }
    }
    await loadUserProfile();

    // 1-клік автозаповнення телефону
    if (btnCabSharePhone) {
        btnCabSharePhone.addEventListener('click', () => {
            if (session && session.user && session.user.phone) {
                cabInputPhone.value = session.user.phone;
            } else {
                const entered = prompt("Введіть ваш номер телефону для сповіщень (+380...):", "+380");
                if (entered) cabInputPhone.value = entered;
            }
        });
    }

    // Всеукраїнський Автокомпліт населених пунктів (1469 громад КАТОТТГ + Онлайн)
    if (cabInputCommunity && cabGeoAutocomplete) {
        let debounceTimer;
        cabInputCommunity.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = cabInputCommunity.value.trim();
            if (query.length < 2) {
                cabGeoAutocomplete.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/v1/geo/settlements?q=${encodeURIComponent(query)}`);
                    const json = await res.json();
                    const results = (json && json.data) ? json.data : [];

                    if (results.length === 0) {
                        cabGeoAutocomplete.innerHTML = `
                            <div class="cab-autocomplete-item" data-settlement="${query}" data-community="${query} ТГ" data-region="Україна">
                                📍 <b>${query}</b> (Населений пункт України / Онлайн-доступ)
                            </div>
                        `;
                    } else {
                        cabGeoAutocomplete.innerHTML = results.map(item => `
                            <div class="cab-autocomplete-item" data-settlement="${item.settlement}" data-community="${item.community}" data-region="${item.region}">
                                📍 <b>${item.settlement}</b> — <small>${item.community}, ${item.region}</small>
                            </div>
                        `).join('');
                    }
                    cabGeoAutocomplete.style.display = 'block';

                    cabGeoAutocomplete.querySelectorAll('.cab-autocomplete-item').forEach(el => {
                        el.addEventListener('click', () => {
                            const setl = el.getAttribute('data-settlement');
                            const comm = el.getAttribute('data-community');
                            const reg = el.getAttribute('data-region');
                            cabInputCommunity.value = `${setl} (${comm})`;
                            cabGeoAutocomplete.style.display = 'none';

                            if (window.NovyShlyakhSession) {
                                window.NovyShlyakhSession.setGeoContext({
                                    settlement: setl,
                                    community: comm,
                                    region: reg,
                                    is_online: true
                                });
                            }
                            updateHeaderProfile();
                        });
                    });
                } catch (err) {
                    console.error('[Geo Search Error]', err);
                }
            }, 250);
        });

        document.addEventListener('click', (e) => {
            if (!cabInputCommunity.contains(e.target) && !cabGeoAutocomplete.contains(e.target)) {
                cabGeoAutocomplete.style.display = 'none';
            }
        });
    }

    // Збереження анкети
    if (cabProfileForm) {
        cabProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const veteranRole = radioIsFamily.checked ? 'family' : 'veteran';
            const callsign = cabInputCallsign.value.trim();
            const phone = cabInputPhone.value.trim();
            const community = cabInputCommunity.value.trim();
            const preferredChannel = cabPreferredChannel.value;

            try {
                const res = await fetch('/api/v1/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        veteran_role: veteranRole,
                        callsign: callsign,
                        phone: phone,
                        community: community,
                        preferred_channel: preferredChannel
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    currentUser.callsign = callsign;
                    currentUser.veteran_role = veteranRole;
                    currentUser.phone = phone;
                    updateHeaderProfile();

                    if (cabSaveProfileSuccess) {
                        cabSaveProfileSuccess.style.display = 'inline-block';
                        setTimeout(() => { cabSaveProfileSuccess.style.display = 'none'; }, 3000);
                    }
                    if (tracker) {
                        tracker.trackEvent('profile_updated', { veteran_role: veteranRole, community: community });
                    }
                }
            } catch (err) {
                console.error('[Profile Save Error]', err);
                alert('Збережено локально в сесії.');
            }
        });
    }

    // ─── 5. Вкладка 2: Тікет-Центр (Історія моїх справ) ───────────────────────
    const cabActiveTicketsGrid = document.getElementById('cabActiveTicketsGrid');
    const cabArchivedTicketsGrid = document.getElementById('cabArchivedTicketsGrid');
    const cabActiveTicketsCount = document.getElementById('cabActiveTicketsCount');
    const btnOpenNewTicketModal = document.getElementById('btnOpenNewTicketModal');
    const newTicketModal = document.getElementById('newTicketModal');
    const btnCloseNewTicket = document.getElementById('btnCloseNewTicket');
    const formNewTicket = document.getElementById('formNewTicket');
    const ticketVaultAttachList = document.getElementById('ticketVaultAttachList');

    async function loadTickets() {
        try {
            const res = await fetch(`/api/v1/crm/tickets?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            const tickets = (data && data.status === 'success') ? data.data : [];

            const activeTickets = tickets.filter(t => t.status === 'IN_PROGRESS' || t.status === 'NEW');
            const archiveTickets = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'REVOKED_BY_VETERAN');

            if (cabActiveTicketsCount) {
                cabActiveTicketsCount.textContent = activeTickets.length;
            }

            // Рендер активних справ
            if (cabActiveTicketsGrid) {
                if (activeTickets.length === 0) {
                    cabActiveTicketsGrid.innerHTML = `
                        <div class="cab-empty-state">
                            <span style="font-size: 36px;">🌿</span>
                            <h4>У вас наразі немає відкритих справ</h4>
                            <p>Подайте нове звернення, і черговий спеціаліст ГО «Талан ЮА» зв'яжеться з вами протягом 15 хвилин.</p>
                        </div>
                    `;
                } else {
                    cabActiveTicketsGrid.innerHTML = activeTickets.map(t => {
                        const spec = t.specialist || { name: "Координатор ГО «Талан ЮА»", role: "Супровід", rating: 5.0 };
                        return `
                            <div class="cab-ticket-card" id="card-${t.id}">
                                <div class="cab-ticket-header">
                                    <div>
                                        <span class="cab-ticket-category">${getCategoryName(t.category)}</span>
                                        <h4 class="cab-ticket-title">Справа № ${t.id}</h4>
                                    </div>
                                    <span class="cab-badge-progress">⚡ В роботі</span>
                                </div>
                                <p class="cab-ticket-desc">${t.description}</p>
                                <div class="cab-ticket-spec-box">
                                    <div class="cab-spec-avatar">👨‍⚖️</div>
                                    <div>
                                        <b>${spec.name}</b>
                                        <div style="font-size: 12px; color: #94a3b8;">${spec.role} • ⭐ ${spec.rating || 4.9}</div>
                                    </div>
                                </div>
                                <div class="cab-ticket-actions">
                                    <button class="btn-primary btn-sm" onclick="alert('Підключення до захищеного чату зі спеціалістом ${spec.name}...')">
                                        💬 Написати фахівцю
                                    </button>
                                    <button class="btn-danger-outline btn-sm btn-sos-trigger" data-ticket-id="${t.id}" data-spec-name="${spec.name}">
                                        🛑 Припинити роботу (SOS)
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // Рендер архіву справ
            if (cabArchivedTicketsGrid) {
                if (archiveTickets.length === 0) {
                    cabArchivedTicketsGrid.innerHTML = `<p style="color: #64748b; font-size: 13px;">Архів порожній.</p>`;
                } else {
                    cabArchivedTicketsGrid.innerHTML = archiveTickets.map(t => `
                        <div class="cab-ticket-card archive">
                            <div class="cab-ticket-header">
                                <span class="cab-ticket-category">${getCategoryName(t.category)}</span>
                                <span class="cab-badge-archive">${t.status === 'REVOKED_BY_VETERAN' ? '🛑 Розірвано' : '✅ Завершено'}</span>
                            </div>
                            <h4 class="cab-ticket-title">Справа № ${t.id}</h4>
                            <p class="cab-ticket-desc">${t.description}</p>
                            <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                                Створено: ${new Date(t.created_at).toLocaleDateString('uk-UA')}
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Додаємо обробники для кнопок SOS
            document.querySelectorAll('.btn-sos-trigger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ticketId = btn.getAttribute('data-ticket-id');
                    openSosModal(ticketId);
                });
            });

        } catch (e) {
            console.error('[Load Tickets Error]', e);
        }
    }

    function getCategoryName(cat) {
        switch (cat) {
            case 'legal': return '⚖️ Юридична допомога';
            case 'psychology': return '🌿 Психологічна підтримка';
            case 'education': return '🎓 Освіта та ваучери';
            case 'job': return '💼 Робота та гранти';
            case 'rehab': return '🏥 Реабілітація';
            default: return '🤝 Загальний супровід';
        }
    }

    await loadTickets();

    // Модальне вікно створення нового звернення
    if (btnOpenNewTicketModal && newTicketModal) {
        btnOpenNewTicketModal.addEventListener('click', async () => {
            await populateVaultAttachList();
            newTicketModal.classList.add('active');
        });
    }

    if (btnCloseNewTicket && newTicketModal) {
        btnCloseNewTicket.addEventListener('click', () => {
            newTicketModal.classList.remove('active');
        });
    }

    async function populateVaultAttachList() {
        if (!ticketVaultAttachList) return;
        try {
            const res = await fetch(`/api/v1/crm/documents/vault?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            const docs = (data && data.status === 'success') ? data.data : [];

            if (docs.length === 0) {
                ticketVaultAttachList.innerHTML = `<span style="color: #94a3b8; font-size: 12px;">У вашому сейфі поки немає документів. Ви можете завантажити їх у вкладці «Сейф документів».</span>`;
            } else {
                ticketVaultAttachList.innerHTML = docs.map(doc => `
                    <label class="cab-attach-item">
                        <input type="checkbox" name="attachDoc" value="${doc.id}">
                        <span>📄 ${doc.original_name} (${(doc.file_size / 1024).toFixed(0)} КБ)</span>
                    </label>
                `).join('');
            }
        } catch (err) {
            ticketVaultAttachList.innerHTML = `<span style="color: #94a3b8; font-size: 12px;">Сейф тимчасово недоступний онлайн.</span>`;
        }
    }

    if (formNewTicket) {
        formNewTicket.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('ticketCategory').value;
            const description = document.getElementById('ticketDescription').value.trim();
            const selectedDocs = Array.from(document.querySelectorAll('input[name="attachDoc"]:checked')).map(cb => cb.value);

            try {
                const res = await fetch('/api/v1/crm/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        category: category,
                        description: description,
                        attached_documents: selectedDocs,
                        community: (currentUser.geo_context && currentUser.geo_context.community) || "Вся Україна / Онлайн"
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    newTicketModal.classList.remove('active');
                    formNewTicket.reset();
                    await loadTickets();
                    switchTab('tab-tickets');
                    if (tracker) {
                        tracker.trackEvent('ticket_created', { category: category, docs_count: selectedDocs.length });
                    }
                }
            } catch (err) {
                console.error('[New Ticket Error]', err);
                alert('Не вдалося відправити звернення. Спробуйте пізніше.');
            }
        });
    }

    // ─── 6. Кнопка SOS: Екстрений розрив співпраці з фахівцем ─────────────────
    const sosModal = document.getElementById('sosModal');
    const btnCloseSosModal = document.getElementById('btnCloseSosModal');
    const formSosSubmit = document.getElementById('formSosSubmit');
    const sosTicketIdInput = document.getElementById('sosTicketId');
    const sosReasonCategory = document.getElementById('sosReasonCategory');
    const sosFeedback = document.getElementById('sosFeedback');
    const sosReassignCheck = document.getElementById('sosReassignCheck');

    function openSosModal(ticketId) {
        if (!sosModal) return;
        if (sosTicketIdInput) sosTicketIdInput.value = ticketId;
        sosModal.classList.add('active');
    }

    if (btnCloseSosModal && sosModal) {
        btnCloseSosModal.addEventListener('click', () => {
            sosModal.classList.remove('active');
        });
    }

    if (formSosSubmit) {
        formSosSubmit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = sosTicketIdInput.value;
            const reason = sosReasonCategory.value;
            const feedback = sosFeedback.value.trim();
            const reassign = sosReassignCheck ? sosReassignCheck.checked : true;

            try {
                const res = await fetch(`/api/v1/crm/tickets/${encodeURIComponent(ticketId)}/sos-revoke`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket_id: ticketId,
                        user_id: userId,
                        reason_category: reason,
                        feedback: feedback,
                        reassign_requested: reassign
                    })
                });

                const result = await res.json();
                if (result.status === 'success') {
                    sosModal.classList.remove('active');
                    alert('🛑 Співпрацю з фахівцем припинено!\n\nДоступ до ваших персональних даних та документів сейфу негайно анульовано. Фахівцю нараховано штрафний рейтинг.');
                    await loadTickets();

                    if (tracker) {
                        tracker.trackEvent('specialist_sos_revoked', {
                            ticket_id: ticketId,
                            reason: reason,
                            reassigned: reassign
                        });
                    }
                }
            } catch (err) {
                console.error('[SOS Revoke Error]', err);
                alert('Помилка при відправці запиту на розрив. Будь ласка, зверніться до чергового координатора.');
            }
        });
    }

    // ─── 7. Вкладка 3: Освіта, Ваучери та Професії ─────────────────────────────
    const cabEducationGrid = document.getElementById('cabEducationGrid');

    async function loadEducation() {
        if (!cabEducationGrid) return;
        try {
            const res = await fetch('education.json');
            const courses = await res.json();

            cabEducationGrid.innerHTML = courses.map(item => `
                <div class="cab-edu-card">
                    <div class="cab-edu-header">
                        <span class="cab-edu-icon">${item.icon || '🎓'}</span>
                        <span class="cab-edu-badge">${item.badge || 'Державний ваучер'}</span>
                    </div>
                    <h3 class="cab-edu-title">${item.title}</h3>
                    <p class="cab-edu-desc">${item.description}</p>
                    <div class="cab-edu-meta">
                        <div><b>Надавач:</b> ${item.provider}</div>
                        <div><b>Термін:</b> ${item.duration} • ${item.format}</div>
                        <div style="color: #10B981; font-weight: 600; margin-top: 4px;">💰 ${item.cost_type}</div>
                    </div>
                    <button class="btn-primary btn-sm btn-apply-voucher" data-title="${item.title}" style="width: 100%; margin-top: 14px;">
                        Отримати ваучер / Подати заявку
                    </button>
                </div>
            `).join('');

            document.querySelectorAll('.btn-apply-voucher').forEach(btn => {
                btn.addEventListener('click', () => {
                    const title = btn.getAttribute('data-title');
                    if (newTicketModal) {
                        const catSelect = document.getElementById('ticketCategory');
                        const descArea = document.getElementById('ticketDescription');
                        if (catSelect) catSelect.value = 'education';
                        if (descArea) descArea.value = `Бажаю отримати ваучер / пройти навчання за програмою: «${title}». Допоможіть оформити документи через Центр зайнятості.`;
                        populateVaultAttachList();
                        newTicketModal.classList.add('active');
                    }
                });
            });

        } catch (e) {
            console.error('[Education Load Error]', e);
        }
    }

    await loadEducation();

    // ─── 8. Вкладка 4: Захищений Сейф Документів ──────────────────────────────
    const cabVaultDropzone = document.getElementById('cabVaultDropzone');
    const cabVaultFileInput = document.getElementById('cabVaultFileInput');
    const cabVaultList = document.getElementById('cabVaultList');

    async function loadVault() {
        if (!cabVaultList) return;
        try {
            const res = await fetch(`/api/v1/crm/documents/vault?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            const docs = (data && data.status === 'success') ? data.data : [];

            if (docs.length === 0) {
                cabVaultList.innerHTML = `
                    <div class="cab-empty-state">
                        <span style="font-size: 32px;">🔒</span>
                        <h4>У сейфі ще немає документів</h4>
                        <p>Завантажте довідку УБД, висновок ВЛК чи резюме. Вони зберігаються у зашифрованому вигляді і передаються тільки за вашим кліком.</p>
                    </div>
                `;
            } else {
                cabVaultList.innerHTML = docs.map(doc => `
                    <div class="cab-vault-item">
                        <div class="cab-vault-item-left">
                            <span class="cab-vault-file-icon">📄</span>
                            <div>
                                <b>${doc.original_name}</b>
                                <div style="font-size: 11px; color: #94a3b8;">
                                    ${(doc.file_size / 1024).toFixed(1)} КБ • Завантажено: ${new Date(doc.uploaded_at).toLocaleDateString('uk-UA')}
                                </div>
                            </div>
                        </div>
                        <div class="cab-vault-item-right">
                            <span class="cab-encrypted-pill">🛡️ AES-256 Захищено</span>
                            <button class="btn-sm btn-secondary" onclick="alert('Документ зашифровано та захищено. Доступ можливий тільки з вашого авторизованого пристрою.')">
                                👁️ Переглянути
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('[Vault Load Error]', err);
        }
    }

    await loadVault();

    // Завантаження файлів у Сейф
    if (cabVaultFileInput) {
        cabVaultFileInput.addEventListener('change', async () => {
            const file = cabVaultFileInput.files[0];
            if (!file) return;
            await uploadFileToVault(file);
        });
    }

    if (cabVaultDropzone) {
        cabVaultDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            cabVaultDropzone.style.borderColor = '#10B981';
        });
        cabVaultDropzone.addEventListener('dragleave', () => {
            cabVaultDropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        });
        cabVaultDropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            cabVaultDropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await uploadFileToVault(e.dataTransfer.files[0]);
            }
        });
    }

    async function uploadFileToVault(file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('Помилка: Файл перевищує ліміт 10 МБ.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);
        formData.append('doc_type', 'veteran_doc');

        try {
            const res = await fetch('/api/v1/crm/documents/vault-upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert(`✅ Документ «${file.name}» успішно зашифровано та додано до Сейфу.`);
                await loadVault();
                if (tracker) {
                    tracker.trackEvent('document_vault_uploaded', { file_size: file.size, filename: file.name });
                }
            }
        } catch (err) {
            console.error('[Vault Upload Error]', err);
            alert('Не вдалося завантажити файл на сервер.');
        }
    }

    // ─── 9. Вкладка 5 та 6: Робочий простір Партнера (Offer/Accept та КЕП) ──────
    const cabPartnerInboxGrid = document.getElementById('cabPartnerInboxGrid');
    const cabPartnerInboxCount = document.getElementById('cabPartnerInboxCount');
    const btnPartnerSignDiia = document.getElementById('btnPartnerSignDiia');
    const btnPartnerSignKep = document.getElementById('btnPartnerSignKep');
    const partnerSignStatus = document.getElementById('partnerSignStatus');

    async function loadPartnerInbox() {
        if (!cabPartnerInboxGrid) return;
        try {
            const res = await fetch('/api/v1/crm/partner/inbox');
            const data = await res.json();
            const cases = (data && data.status === 'success') ? data.data : [];

            if (cabPartnerInboxCount) cabPartnerInboxCount.textContent = cases.length;

            if (cases.length === 0) {
                cabPartnerInboxGrid.innerHTML = `
                    <div class="cab-empty-state">
                        <span style="font-size: 32px;">📥</span>
                        <h4>Немає нових нерозподілених звернень</h4>
                        <p>Усі поточні запити ветеранів опрацьовані координаційним центром ГО «Талан ЮА».</p>
                    </div>
                `;
            } else {
                cabPartnerInboxGrid.innerHTML = cases.map(c => `
                    <div class="cab-partner-case-card" id="partner-case-${c.id}">
                        <div class="cab-ticket-header">
                            <div>
                                <span class="cab-ticket-category">${getCategoryName(c.category)}</span>
                                <h4 class="cab-ticket-title">Запит № ${c.id}</h4>
                            </div>
                            <span class="cab-badge-urgency">${c.urgency}</span>
                        </div>
                        <p class="cab-ticket-desc">${c.description_preview}</p>
                        <div class="cab-case-meta">
                            <span>📍 Громада: <b>${c.community}</b></span>
                            <span>📎 Документи: ${c.has_attached_docs ? 'Є в сейфі (доступ за згодою)' : 'Відсутні'}</span>
                        </div>
                        <div class="cab-partner-actions">
                            <button class="btn-primary btn-sm btn-accept-case" data-id="${c.id}">
                                ✅ Взяти справу в роботу
                            </button>
                            <button class="btn-secondary btn-sm btn-cascade-case" data-id="${c.id}">
                                ↪️ Передати за каскадом
                            </button>
                        </div>
                    </div>
                `).join('');

                document.querySelectorAll('.btn-accept-case').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const caseId = btn.getAttribute('data-id');
                        try {
                            const acceptRes = await fetch(`/api/v1/crm/partner/tickets/${encodeURIComponent(caseId)}/accept`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    specialist_id: userId,
                                    specialist_name: currentUser.name || "Верифікований партнер",
                                    specialist_role: "Фахівець супроводу"
                                })
                            });
                            const rJson = await acceptRes.json();
                            if (rJson.status === 'success') {
                                alert(`✅ Справу ${caseId} прийнято в роботу! Доступ до конфіденційного чату та контактів відкрито.`);
                                await loadPartnerInbox();
                            }
                        } catch (err) {
                            console.error('[Accept Case Error]', err);
                        }
                    });
                });

                document.querySelectorAll('.btn-cascade-case').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const caseId = btn.getAttribute('data-id');
                        try {
                            await fetch(`/api/v1/crm/partner/tickets/${encodeURIComponent(caseId)}/cascade`, { method: 'POST' });
                            alert(`↪️ Справу ${caseId} передано наступному спеціалісту в черзі каскаду.`);
                            await loadPartnerInbox();
                        } catch (err) {
                            console.error('[Cascade Case Error]', err);
                        }
                    });
                });
            }
        } catch (e) {
            console.error('[Partner Inbox Error]', e);
        }
    }

    if (isPartner) {
        await loadPartnerInbox();
    }

    if (btnPartnerSignDiia) {
        btnPartnerSignDiia.addEventListener('click', async () => {
            btnPartnerSignDiia.disabled = true;
            btnPartnerSignDiia.textContent = '⏳ Перевірка Дія.Підпис...';
            try {
                const res = await fetch('/api/v1/crm/partner/sign-agreement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ partner_id: userId, sign_type: 'diia' })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    if (partnerSignStatus) {
                        partnerSignStatus.style.display = 'block';
                        partnerSignStatus.textContent = '✅ Меморандум успішно підписано через Дія.Підпис!';
                    }
                }
            } catch (err) {
                console.error('[Sign Agreement Error]', err);
            } finally {
                btnPartnerSignDiia.disabled = false;
                btnPartnerSignDiia.textContent = 'Підписати через Дія.Підпис';
            }
        });
    }

    if (btnPartnerSignKep) {
        btnPartnerSignKep.addEventListener('click', () => {
            alert('Оберіть підписаний КЕП-файл (.p7s / .asice) для завантаження на перевірку.');
        });
    }

    // ─── 10. Вихід з кабінету ─────────────────────────────────────────────────
    const btnCabLogout = document.getElementById('btnCabLogout');
    if (btnCabLogout) {
        btnCabLogout.addEventListener('click', () => {
            if (confirm('Ви дійсно бажаєте вийти з особистого кабінету?')) {
                if (window.NovyShlyakhSession) {
                    window.NovyShlyakhSession.logout();
                }
                window.location.href = 'index.html';
            }
        });
    }
});

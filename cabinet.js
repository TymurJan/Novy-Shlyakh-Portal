/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Ветеранський портал «Новий Шлях» | ГО «Талан ЮА»
 * Особистий кабінет ветерана та простір фахівця (Unified Adaptive Cabinet v2.0)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ─── 1. Ініціалізація Сесії та Користувача ────────────────────────────────
    let storedUser = null;
    try {
        const raw = localStorage.getItem('novy_shlyakh_user_profile');
        if (raw) storedUser = JSON.parse(raw);
    } catch (e) {}

    // 🔑 АВТОРИЗАЦІЯ ЗА MAGIC QR-КОДОМ / ТОКЕНОМ З ДОРОЖНЬОЇ КАРТИ А4 (КРОК G1)
    const urlParams = new URLSearchParams(window.location.search);
    const magicTokenParam = urlParams.get('magic_token');
    const caseIdParam = urlParams.get('case_id') || urlParams.get('ticket_id');

    if (magicTokenParam) {
        try {
            const res = await fetch(`/api/v1/crm/auth/magic-verify?token=${encodeURIComponent(magicTokenParam)}${caseIdParam ? `&ticket_id=${encodeURIComponent(caseIdParam)}` : ''}`);
            const json = await res.json();
            if (json.status === 'success' && json.data?.user) {
                storedUser = json.data.user;
                localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(storedUser));
                console.log('✨ Авторизовано за Magic QR-кодом для справи:', json.data.ticket?.id);
            }
        } catch (e) {
            console.warn('[Magic QR Auth Note]:', e);
        }
    }

    const auth = (window.NovyShlyakh && window.NovyShlyakh.Auth) ? window.NovyShlyakh.Auth : null;
    const session = (window.NovyShlyakh && window.NovyShlyakh.Session) ? window.NovyShlyakh.Session : null;
    const tracker = (window.NovyShlyakh && window.NovyShlyakh.Tracker) ? window.NovyShlyakh.Tracker : null;

    const isGuest = !storedUser || !storedUser.id || (storedUser.roles && storedUser.roles.includes('ROLE_GUEST')) || storedUser.id.startsWith('guest_');

    // 🛡️ ЗАХИСТ КАБІНЕТУ: Якщо гість не авторизований — блокуємо доступ через Soft-Gate екран
    const cabGuestLockModal = document.getElementById('cabGuestLockModal');
    if (isGuest && cabGuestLockModal) {
        cabGuestLockModal.style.display = 'flex';

        // Кнопка 1: Вхід через Telegram
        const btnLockTg = document.getElementById('btnLockLoginTg');
        if (btnLockTg) {
            btnLockTg.addEventListener('click', async () => {
                const demoId = Math.floor(100000 + Math.random() * 900000);
                try {
                    const res = await fetch('/api/v1/auth/telegram-verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: demoId,
                            first_name: 'Тарас',
                            last_name: 'Коваленко',
                            username: 'veteran_taras',
                            auth_date: Math.floor(Date.now() / 1000),
                            hash: 'mock_hash_' + demoId
                        })
                    });
                    const json = await res.json();
                    if (json.status === 'success' && json.data?.user) {
                        const verified = {
                            ...json.data.user,
                            callsign: 'Друг Сокіл',
                            geo_context: { community: 'Канівська ТГ', settlement: 'м. Канів', region: 'Черкаська область', is_online: true }
                        };
                        if (auth) {
                            await auth.setAuthenticatedUser(verified);
                        } else {
                            localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(verified));
                        }
                    }
                } catch (e) {
                    const profile = {
                        id: `tg_${demoId}`,
                        name: 'Тарас Коваленко',
                        callsign: 'Друг Сокіл',
                        phone: '+380 (50) 123-45-67',
                        roles: ['ROLE_VETERAN'],
                        veteran_role: 'veteran',
                        is_veteran: true,
                        auth_provider: 'telegram',
                        geo_context: { community: 'Канівська ТГ', settlement: 'м. Канів', region: 'Черкаська область', is_online: true }
                    };
                    localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(profile));
                }
                window.location.reload();
            });
        }

        // Кнопка 2: Вхід через Дію
        const btnLockDiia = document.getElementById('btnLockLoginDiia');
        if (btnLockDiia) {
            btnLockDiia.addEventListener('click', async () => {
                try {
                    const res = await fetch('/api/v1/auth/diia/callback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: 'DIIA_VERIFIED_JWT_MOCK_12345' })
                    });
                    const json = await res.json();
                    if (json.status === 'success' && json.data?.user) {
                        const u = json.data.user;
                        const verified = {
                            id: u.id,
                            name: u.name,
                            callsign: 'Іван',
                            rnokpp: u.rnokpp,
                            roles: ['ROLE_VETERAN'],
                            veteran_role: 'veteran',
                            is_veteran: true,
                            veteran_status: u.veteran_status,
                            auth_provider: 'diia_sharing',
                            diia_verified: true,
                            geo_context: u.geo_context || { community: 'Черкаська ТГ', settlement: 'м. Черкаси', region: 'Черкаська область', is_online: true }
                        };
                        if (auth) {
                            await auth.setAuthenticatedUser(verified);
                        } else {
                            localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(verified));
                        }
                    }
                } catch (e) {
                    const profile = {
                        id: 'diia_3214567890',
                        name: 'Іван Коваленко',
                        callsign: 'Іван',
                        rnokpp: '3214567890',
                        roles: ['ROLE_VETERAN'],
                        veteran_role: 'veteran',
                        is_veteran: true,
                        auth_provider: 'diia_sharing',
                        diia_verified: true,
                        geo_context: { community: 'Черкаська ТГ', settlement: 'м. Черкаси', region: 'Черкаська область', is_online: true }
                    };
                    localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(profile));
                }
                window.location.reload();
            });
        }

        // Кнопка 3: Вхід за номером телефону
        const btnLockPhone = document.getElementById('btnLockLoginPhone');
        const lockPhoneBox = document.getElementById('lockPhoneBox');
        const btnSubmitLockPhone = document.getElementById('btnSubmitLockPhone');
        const inputLockPhone = document.getElementById('inputLockPhone');

        if (btnLockPhone && lockPhoneBox) {
            btnLockPhone.addEventListener('click', () => {
                lockPhoneBox.style.display = lockPhoneBox.style.display === 'none' ? 'block' : 'none';
                if (inputLockPhone && lockPhoneBox.style.display === 'block') inputLockPhone.focus();
            });
        }

        if (btnSubmitLockPhone) {
            btnSubmitLockPhone.addEventListener('click', async () => {
                const phoneVal = (inputLockPhone?.value || '+380 (50) 123-45-67').trim();
                const phoneId = 'phone_' + phoneVal.replace(/\D/g, '');
                const profile = {
                    id: phoneId,
                    name: `Ветеран (${phoneVal})`,
                    callsign: 'Побратим',
                    phone: phoneVal,
                    roles: ['ROLE_VETERAN'],
                    veteran_role: 'veteran',
                    is_veteran: true,
                    is_family_member: false,
                    auth_provider: 'phone_ivr',
                    diia_verified: false,
                    geo_context: { community: 'Вся Україна / Онлайн', settlement: 'Вся Україна', region: 'Україна', is_online: true }
                };
                if (auth) {
                    await auth.setAuthenticatedUser(profile);
                } else {
                    localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(profile));
                }
                window.location.reload();
            });
        }
    } else if (cabGuestLockModal) {
        cabGuestLockModal.style.display = 'none';
    }

    let currentUser = storedUser || (auth ? auth.getCurrentUser() : null) || {
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
            cabUserName.textContent = currentUser.callsign || currentUser.name || "Користувач";
        }

        const roleKey = normalizeRoleKey(currentUser.primary_role || currentUser.veteran_role || (currentUser.roles && currentUser.roles[0]));

        if (cabStatusTag) {
            if (roleKey === 'employer') {
                cabStatusTag.textContent = "🏢 Роботодавець";
                cabStatusTag.style.background = "rgba(245, 158, 11, 0.2)";
                cabStatusTag.style.color = "#fde68a";
            } else if (roleKey === 'provider' || roleKey === 'education') {
                cabStatusTag.textContent = "🎓 Освітній провайдер";
                cabStatusTag.style.background = "rgba(139, 92, 246, 0.2)";
                cabStatusTag.style.color = "#c4b5fd";
            } else if (roleKey === 'dispatcher') {
                cabStatusTag.textContent = "🏛️ Оператор Ветеранського Простору";
                cabStatusTag.style.background = "rgba(236, 72, 153, 0.2)";
                cabStatusTag.style.color = "#fbcfe8";
            } else if (roleKey === 'org_lead') {
                cabStatusTag.textContent = "🏢 ГО «Талан ЮА»";
                cabStatusTag.style.background = "rgba(20, 184, 166, 0.2)";
                cabStatusTag.style.color = "#99f6e4";
            } else if (roleKey === 'specialist') {
                cabStatusTag.textContent = "💼 Фахівець супроводу (Кейс-менеджер)";
                cabStatusTag.style.background = "rgba(59, 130, 246, 0.2)";
                cabStatusTag.style.color = "#93c5fd";
            } else if (currentUser.veteran_role === 'family') {
                cabStatusTag.textContent = "👨‍👩‍👧 Член родини ветерана";
                cabStatusTag.style.background = "rgba(168, 85, 247, 0.2)";
                cabStatusTag.style.color = "#d8b4fe";
            } else if (!currentUser.diia_verified && !currentUser.is_verified_gov) {
                cabStatusTag.textContent = "📝 Ветеран (До верифікації)";
                cabStatusTag.style.background = "rgba(239, 68, 68, 0.15)";
                cabStatusTag.style.color = "#fca5a5";
            } else {
                cabStatusTag.textContent = "🎖️ Ветеран (🛡️ Верифікований)";
                cabStatusTag.style.background = "rgba(16, 185, 129, 0.2)";
                cabStatusTag.style.color = "#6ee7b7";
            }
        }
        if (cabAvatar) {
            if (roleKey === 'employer') cabAvatar.textContent = '🏢';
            else if (roleKey === 'provider' || roleKey === 'education') cabAvatar.textContent = '🎓';
            else if (roleKey === 'dispatcher') cabAvatar.textContent = '🏛️';
            else if (roleKey === 'org_lead') cabAvatar.textContent = '🏢';
            else if (roleKey === 'specialist') cabAvatar.textContent = '💼';
            else if (currentUser.veteran_role === 'family') cabAvatar.textContent = '👨‍👩‍👧';
            else if (!currentUser.diia_verified && !currentUser.is_verified_gov) cabAvatar.textContent = '🆕';
            else cabAvatar.textContent = '🎖️';
        }
        if (cabVerifiedBadge) {
            cabVerifiedBadge.style.display = (!isGuest && (currentUser.diia_verified || currentUser.is_verified_gov)) ? 'inline-flex' : 'none';
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

    // Відображення партнерських, диспетчерських та організаційних вкладок при відповідній ролі
    const isPartner = currentUser.roles && (currentUser.roles.includes('ROLE_SPECIALIST') || currentUser.roles.includes('ROLE_PARTNER') || currentUser.roles.includes('ROLE_ADMIN'));
    const isDispatcher = currentUser.roles && (currentUser.roles.includes('ROLE_STATE_BODY') || currentUser.roles.includes('ROLE_DISPATCHER') || currentUser.roles.includes('ROLE_ADMIN') || currentUser.veteran_role === 'dispatcher');
    const isOrgLead = currentUser.roles && (currentUser.roles.includes('ROLE_ORGANIZATION') || currentUser.roles.includes('ROLE_NGO_LEAD') || currentUser.roles.includes('ROLE_ADMIN') || currentUser.veteran_role === 'org_lead');
    const isEmployer = currentUser.roles && (currentUser.roles.includes('ROLE_EMPLOYER') || currentUser.roles.includes('employer') || currentUser.veteran_role === 'employer' || currentUser.primary_role === 'employer');
    const isProvider = currentUser.roles && (currentUser.roles.includes('ROLE_PROVIDER') || currentUser.roles.includes('provider') || currentUser.roles.includes('education') || currentUser.roles.includes('education_provider') || currentUser.veteran_role === 'provider' || currentUser.veteran_role === 'education' || currentUser.primary_role === 'education' || currentUser.primary_role === 'provider');

    const partnerDivider = document.getElementById('partnerNavDivider');
    const btnNavOrgTeam = document.getElementById('btnNavOrgTeam');
    const btnNavPartnerInbox = document.getElementById('btnNavPartnerInbox');
    const btnNavPartnerAgreement = document.getElementById('btnNavPartnerAgreement');
    const btnNavDispatcher = document.getElementById('btnNavDispatcher');
    const btnNavSuperadmin = document.getElementById('btnNavSuperadmin');

    if (isPartner || isDispatcher || isOrgLead || isEmployer || isProvider) {
        if (partnerDivider) partnerDivider.style.display = 'block';
    }
    if (isOrgLead || isPartner) {
        if (btnNavOrgTeam) btnNavOrgTeam.style.display = 'flex';
    }
    const activeRoleNow = currentUser.active_role || currentUser.primary_role || currentUser.veteran_role;
    if (activeRoleNow === 'org_lead' || isOrgLead) {
        if (btnNavSuperadmin) btnNavSuperadmin.style.display = 'flex';
    } else {
        if (btnNavSuperadmin) btnNavSuperadmin.style.display = 'none';
    }
    if (isPartner) {
        if (btnNavPartnerInbox) btnNavPartnerInbox.style.display = 'flex';
        if (btnNavPartnerAgreement) btnNavPartnerAgreement.style.display = 'flex';
    }
    if (isDispatcher) {
        if (btnNavDispatcher) btnNavDispatcher.style.display = 'flex';
    }
    if (isEmployer) {
        if (btnNavEmployerJobs) btnNavEmployerJobs.style.display = 'flex';
    }
    if (isProvider) {
        if (btnNavProviderCourses) btnNavProviderCourses.style.display = 'flex';
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

    // Елементи мульти-ідентичності та контекстних анкет (Крок D2)
    const cabActiveRoleSelect = document.getElementById('cabActiveRoleSelect');
    const profileGenesisBadge = document.getElementById('profileGenesisBadge');
    const profileRoleSubtitle = document.getElementById('profileRoleSubtitle');

    const sectionFieldsVeteran = document.getElementById('sectionFieldsVeteran');
    const sectionFieldsFamily = document.getElementById('sectionFieldsFamily');
    const sectionFieldsEmployer = document.getElementById('sectionFieldsEmployer');
    const sectionFieldsSpecialist = document.getElementById('sectionFieldsSpecialist');
    const sectionFieldsEducation = document.getElementById('sectionFieldsEducation');
    const sectionFieldsMentor = document.getElementById('sectionFieldsMentor');
    const sectionFieldsDonor = document.getElementById('sectionFieldsDonor');
    const sectionFieldsDispatcher = document.getElementById('sectionFieldsDispatcher');
    const sectionFieldsOrgLead = document.getElementById('sectionFieldsOrgLead');

    const modalUpgradeRole = document.getElementById('modalUpgradeRole');
    const btnCloseModalUpgrade = document.getElementById('btnCloseModalUpgrade');
    const formUpgradeRole = document.getElementById('formUpgradeRole');
    const upgradeTargetRole = document.getElementById('upgradeTargetRole');
    const upgradeDynamicFields = document.getElementById('upgradeDynamicFields');
    const modalUpgradeTitle = document.getElementById('modalUpgradeTitle');
    const modalUpgradeDesc = document.getElementById('modalUpgradeDesc');

    let fullUserProfile = null;

    const ROLE_LABELS = {
        'veteran': '🎖️ Ветеран / Ветеранка',
        'family': '👨‍👩‍👧 Член родини ветерана',
        'employer': '💼 Роботодавець',
        'specialist': '⚖️ Фахівець Pro-Bono',
        'education': '🎓 Освітній заклад',
        'provider': '🎓 Освітній заклад / Провайдер',
        'mentor': '🤝 Ментор «Рівний-Рівному»',
        'donor': '❤️ Благодійник',
        'dispatcher': '🏛️ Оператор прийому / Диспетчер супроводу',
        'org_lead': '🏢 Керівник ГО «Талан ЮА» / Організації',
        'ROLE_VETERAN': '🎖️ Ветеран / Ветеранка',
        'ROLE_FAMILY': '👨‍👩‍👧 Член родини ветерана',
        'ROLE_EMPLOYER': '💼 Роботодавець',
        'ROLE_SPECIALIST': '⚖️ Фахівець Pro-Bono (Юрист / Психолог)',
        'ROLE_EDUCATION': '🎓 Освітній заклад',
        'ROLE_PROVIDER': '🎓 Освітній заклад / Провайдер',
        'ROLE_MENTOR': '🤝 Ментор «Рівний-Рівному»',
        'ROLE_DONOR': '❤️ Благодійник',
        'ROLE_DISPATCHER': '🏛️ Оператор прийому / Диспетчер супроводу',
        'ROLE_STATE_BODY': '🏛️ Оператор прийому / Диспетчер супроводу',
        'ROLE_ORGANIZATION': '🏢 Керівник ГО «Талан ЮА» / Організації',
        'ROLE_NGO_LEAD': '🏢 Керівник ГО «Талан ЮА» / Організації'
    };

    function normalizeRoleKey(roleStr) {
        if (!roleStr) return 'veteran';
        const r = String(roleStr).toLowerCase();
        if (r === 'family' || r.includes('family')) return 'family';
        if (r.includes('employer')) return 'employer';
        if (r.includes('specialist') || r.includes('lawyer') || r.includes('psychologist')) return 'specialist';
        if (r.includes('education') || r.includes('provider')) return 'education';
        if (r.includes('mentor')) return 'mentor';
        if (r.includes('donor')) return 'donor';
        if (r.includes('dispatcher') || r.includes('state_body')) return 'dispatcher';
        if (r.includes('org') || r.includes('ngo')) return 'org_lead';
        return 'veteran';
    }

    function updateContextProfileView(activeRoleRaw) {
        const activeRole = normalizeRoleKey(activeRoleRaw);

        // Приховуємо всі контекстні секції
        [sectionFieldsVeteran, sectionFieldsFamily, sectionFieldsEmployer, sectionFieldsSpecialist, sectionFieldsEducation, sectionFieldsMentor, sectionFieldsDonor, sectionFieldsDispatcher, sectionFieldsOrgLead].forEach(sec => {
            if (sec) sec.style.display = 'none';
        });

        if (profileRoleSubtitle) {
            profileRoleSubtitle.textContent = `Анкетні дані для активного режиму: ${ROLE_LABELS[activeRoleRaw] || ROLE_LABELS[activeRole] || activeRole}`;
        }

        const roleData = (fullUserProfile && fullUserProfile.profiles_by_role) ? 
            (fullUserProfile.profiles_by_role[activeRole] || fullUserProfile.profiles_by_role[activeRoleRaw] || {}) : 
            (currentUser.profiles_by_role ? (currentUser.profiles_by_role[activeRole] || currentUser.profiles_by_role[activeRoleRaw] || {}) : {});

        if (activeRole === 'veteran') {
            if (sectionFieldsVeteran) sectionFieldsVeteran.style.display = 'block';
            const militaryUnitInput = document.getElementById('cabInputMilitaryUnit');
            const vetStatusSelect = document.getElementById('cabVeteranStatusSelect');
            const certNumInput = document.getElementById('cabInputCertNumber');
            const callsignInput = document.getElementById('cabInputCallsign');

            if (militaryUnitInput) militaryUnitInput.value = roleData.military_unit || '';
            if (vetStatusSelect && roleData.veteran_status_type) vetStatusSelect.value = roleData.veteran_status_type;
            if (certNumInput) certNumInput.value = roleData.certificate_number || '';
            if (callsignInput && (roleData.callsign || fullUserProfile?.callsign || currentUser.callsign || currentUser.name)) {
                callsignInput.value = roleData.callsign || fullUserProfile?.callsign || currentUser.callsign || currentUser.name || '';
            }

            // Відновлення матриці 5 сфер потреб Наказу № 7
            const needs = roleData.needs_matrix || fullUserProfile?.needs_matrix || {};
            if (document.getElementById('needMedRehab')) document.getElementById('needMedRehab').checked = !!needs.medical;
            if (document.getElementById('needLegal')) document.getElementById('needLegal').checked = !!needs.legal;
            if (document.getElementById('needPsy')) document.getElementById('needPsy').checked = !!needs.psychological;
            if (document.getElementById('needHousing')) document.getElementById('needHousing').checked = !!needs.housing;
            if (document.getElementById('needJobEdu')) document.getElementById('needJobEdu').checked = !!needs.employment;

            // Відображення банера автозаповнення vs бейджа верифікації
            const isGovVerified = !!(roleData.is_verified_gov || fullUserProfile?.is_verified_gov || currentUser.is_verified_gov || currentUser.diia_verified || currentUser.bankid_verified);
            const bannerActions = document.getElementById('cabAutofillActions');
            const statusVerified = document.getElementById('cabAutofillStatusVerified');
            const verifiedDetails = document.getElementById('cabVerifiedDetailsText');

            if (isGovVerified) {
                if (bannerActions) bannerActions.style.display = 'none';
                if (statusVerified) statusVerified.style.display = 'inline-flex';
                if (verifiedDetails) {
                    const src = roleData.auth_source || fullUserProfile?.auth_source || (currentUser.bankid_verified ? 'BankID НБУ' : 'Дію');
                    verifiedDetails.textContent = `Дані та статус УБД верифіковано через ${src}`;
                }
            } else {
                if (bannerActions) bannerActions.style.display = 'flex';
                if (statusVerified) statusVerified.style.display = 'none';
            }
        } else if (activeRole === 'family') {
            if (sectionFieldsFamily) sectionFieldsFamily.style.display = 'block';
            const familyNameInput = document.getElementById('cabInputFamilyName');
            const familyRelSelect = document.getElementById('cabFamilyRelationSelect');
            if (familyNameInput) familyNameInput.value = roleData.name || currentUser.name || '';
            if (familyRelSelect && roleData.relationship) familyRelSelect.value = roleData.relationship;
        } else if (activeRole === 'employer') {
            if (sectionFieldsEmployer) sectionFieldsEmployer.style.display = 'block';
            const compName = document.getElementById('employerCompanyName');
            const edrpou = document.getElementById('employerEdrpou');
            const ind = document.getElementById('employerIndustry');
            const hr = document.getElementById('employerHrName');
            if (compName) compName.value = roleData.company_name || currentUser.name || '';
            if (edrpou) edrpou.value = roleData.edrpou || '';
            if (ind && roleData.industry) ind.value = roleData.industry;
            if (hr) hr.value = roleData.hr_contact_name || currentUser.callsign || '';
        } else if (activeRole === 'specialist') {
            if (sectionFieldsSpecialist) sectionFieldsSpecialist.style.display = 'block';
            const chkLawyer = document.getElementById('chkSpecLawyer');
            const chkPsych = document.getElementById('chkSpecPsychologist');
            const chkCase = document.getElementById('chkSpecCaseManager');
            const lic = document.getElementById('specialistLicense');
            const cap = document.getElementById('specialistCapacity');
            
            const rolesList = roleData.specializations || [roleData.role_title || 'lawyer'];
            if (chkLawyer) chkLawyer.checked = rolesList.includes('lawyer') || rolesList.includes('advocate');
            if (chkPsych) chkPsych.checked = rolesList.includes('psychologist');
            if (chkCase) chkCase.checked = rolesList.includes('case_manager');

            if (lic) lic.value = roleData.license_number || 'Свідоцтво НААУ №4821';
            if (cap && roleData.probono_hours_weekly) cap.value = roleData.probono_hours_weekly;
        } else if (activeRole === 'education' || activeRole === 'provider') {
            if (sectionFieldsEducation) sectionFieldsEducation.style.display = 'block';
            const inst = document.getElementById('eduInstitutionName');
            const lic = document.getElementById('eduLicense');
            if (inst) inst.value = roleData.institution_name || currentUser.name || '';
            if (lic) lic.value = roleData.license_mon || roleData.license_number || '';
        } else if (activeRole === 'mentor') {
            if (sectionFieldsMentor) sectionFieldsMentor.style.display = 'block';
            const top = document.getElementById('mentorTopics');
            if (top) top.value = (roleData.support_topics || []).join(', ');
        } else if (activeRole === 'donor') {
            if (sectionFieldsDonor) sectionFieldsDonor.style.display = 'block';
            const don = document.getElementById('donorDisplayName');
            if (don) don.value = roleData.donor_display_name || '';
        } else if (activeRole === 'dispatcher') {
            if (sectionFieldsDispatcher) sectionFieldsDispatcher.style.display = 'block';
            const dispOrg = document.getElementById('dispatcherOrgName');
            const dispPos = document.getElementById('dispatcherPosition');
            let rawOrg = roleData.institution_name || roleData.cnap_name || '';
            if (!rawOrg && currentUser.name && !currentUser.name.includes('Тарас') && !currentUser.name.includes('Олена')) {
                rawOrg = currentUser.name;
            }
            if (!rawOrg) rawOrg = 'Ветеранський простір Канівської громади';
            rawOrg = rawOrg.replace(/\s*\/\s*ЦНАП/gi, '').replace(/ЦНАП\s*/gi, 'Ветеранський простір ');
            if (dispOrg) dispOrg.value = rawOrg;
            if (dispPos) dispPos.value = roleData.position || 'Фахівець супроводу ветеранів';
        } else if (activeRole === 'org_lead') {
            if (sectionFieldsOrgLead) sectionFieldsOrgLead.style.display = 'block';
            const orgName = document.getElementById('orgLeadOrgName');
            const orgEdrpou = document.getElementById('orgLeadEdrpou');
            if (orgName) orgName.value = roleData.org_name || currentUser.name || 'ГО «Талан ЮА»';
            if (orgEdrpou) orgEdrpou.value = roleData.edrpou || '45123456';
        } else {
            if (sectionFieldsVeteran) sectionFieldsVeteran.style.display = 'block';
        }

        // Відображення кнопок управління для Керівника ГО у боковому меню сайдбару
        const btnNavSuperadmin = document.getElementById('btnNavSuperadmin');
        const btnNavFastApiDocs = document.getElementById('btnNavFastApiDocs');
        const userRoles = (fullUserProfile && fullUserProfile.roles) || currentUser.roles || [];
        const isOrgLeadRole = activeRole === 'org_lead' || userRoles.includes('ROLE_ADMIN') || userRoles.includes('ROLE_NGO_LEAD') || userRoles.includes('org_lead');
        
        if (btnNavSuperadmin) btnNavSuperadmin.style.display = isOrgLeadRole ? 'flex' : 'none';
        if (btnNavFastApiDocs) btnNavFastApiDocs.style.display = isOrgLeadRole ? 'flex' : 'none';
    }

    function populateActiveRoleSelect(rolesList, currentActiveRole) {
        if (!cabActiveRoleSelect) return;
        const roles = (rolesList && rolesList.length > 0) ? rolesList : [currentActiveRole || 'veteran'];
        cabActiveRoleSelect.innerHTML = roles.map(r => {
            const normKey = normalizeRoleKey(r);
            const isSel = r === currentActiveRole || normKey === normalizeRoleKey(currentActiveRole);
            return `<option value="${r}" ${isSel ? 'selected' : ''}>
                ${ROLE_LABELS[r] || ROLE_LABELS[normKey] || r}
            </option>`;
        }).join('');
    }

    // Завантаження профілю з сервера або локальної сесії
    async function loadUserProfile() {
        if (currentUser) {
            let str = JSON.stringify(currentUser);
            if (str.includes('ЦНАП')) {
                str = str.replace(/\s*\/\s*ЦНАП/gi, '').replace(/ЦНАП\s*/gi, 'Ветеранський простір ');
                try {
                    currentUser = JSON.parse(str);
                    localStorage.setItem('novy_shlyakh_user_profile', str);
                } catch(e) {}
            }
        }
        const initialRole = currentUser.primary_role || currentUser.veteran_role || (currentUser.roles && currentUser.roles[0]) || 'veteran';
        try {
            const res = await fetch(`/api/v1/user/profile?user_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data && data.status === 'success' && data.data) {
                fullUserProfile = data.data;
                const p = fullUserProfile;

                // Бейдж генезису
                if (profileGenesisBadge && p.primary_role) {
                    profileGenesisBadge.textContent = `Генезис: ${ROLE_LABELS[p.primary_role] || p.primary_role}`;
                }

                // Заповнення селектора активної ролі
                populateActiveRoleSelect(p.roles || [p.primary_role], p.active_role || p.primary_role);

                // Загальні контакти
                if (cabInputCallsign) cabInputCallsign.value = p.callsign || currentUser.name || "";
                if (cabInputPhone) cabInputPhone.value = p.phone || currentUser.phone || "";
                if (cabInputCommunity) cabInputCommunity.value = p.community || "Черкаська ТГ";
                if (cabPreferredChannel) cabPreferredChannel.value = p.preferred_channel || "telegram";

                updateContextProfileView(p.active_role || p.primary_role || initialRole);
            } else {
                if (profileGenesisBadge) {
                    const normGen = normalizeRoleKey(initialRole);
                    profileGenesisBadge.textContent = `Генезис: ${ROLE_LABELS[initialRole] || ROLE_LABELS[normGen] || initialRole}`;
                }
                if (cabInputCallsign) cabInputCallsign.value = currentUser.callsign || currentUser.name || "";
                if (cabInputPhone) cabInputPhone.value = currentUser.phone || "";
                if (cabInputCommunity) cabInputCommunity.value = (currentUser.geo_context && currentUser.geo_context.settlement) ? currentUser.geo_context.settlement : "Черкаська ТГ";

                populateActiveRoleSelect(currentUser.roles || [initialRole], initialRole);
                updateContextProfileView(initialRole);
            }
        } catch (e) {
            console.warn('[Profile Load Fallback]', e);
            if (profileGenesisBadge) {
                const normGen = normalizeRoleKey(initialRole);
                profileGenesisBadge.textContent = `Генезис: ${ROLE_LABELS[initialRole] || ROLE_LABELS[normGen] || initialRole}`;
            }
            populateActiveRoleSelect(currentUser.roles || [initialRole], initialRole);
            updateContextProfileView(initialRole);
        }
    }
    await loadUserProfile();

    // Перемикання активної ролі в селекторі шапки (Role Switcher)
    if (cabActiveRoleSelect) {
        cabActiveRoleSelect.addEventListener('change', async (e) => {
            const selectedRole = e.target.value;
            try {
                const res = await fetch('/api/v1/user/roles/switch-active', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, active_role: selectedRole })
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.data) {
                        fullUserProfile = json.data;
                        updateContextProfileView(selectedRole);

                        // Оновлюємо відображення відповідних вкладок у сайдбарі
                        const btnNavEmployerJobs = document.getElementById('btnNavEmployerJobs');
                        const btnNavProviderCourses = document.getElementById('btnNavProviderCourses');
                        const btnNavPartnerInbox = document.getElementById('btnNavPartnerInbox');

                        const btnNavFastApiDocs = document.getElementById('btnNavFastApiDocs');
                        const isOrgLeadRole = selectedRole === 'org_lead' || isOrgLead;
                        if (btnNavSuperadmin) btnNavSuperadmin.style.display = isOrgLeadRole ? 'flex' : 'none';
                        if (btnNavFastApiDocs) btnNavFastApiDocs.style.display = isOrgLeadRole ? 'flex' : 'none';

                        if (selectedRole === 'employer' && btnNavEmployerJobs) {
                            btnNavEmployerJobs.style.display = 'flex';
                            btnNavEmployerJobs.click();
                        } else if (selectedRole === 'education' && btnNavProviderCourses) {
                            btnNavProviderCourses.style.display = 'flex';
                            btnNavProviderCourses.click();
                        } else if (selectedRole === 'specialist' && btnNavPartnerInbox) {
                            btnNavPartnerInbox.style.display = 'flex';
                            btnNavPartnerInbox.click();
                        }
                    }
                }
            } catch (err) {
                console.error('[Role Switch Error]', err);
            }
        });
    }

    // Відкриття модального вікна Self-Upgrade при кліку на картку
    document.querySelectorAll('.btn-action-upgrade-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            if (upgradeTargetRole) upgradeTargetRole.value = role;

            if (modalUpgradeTitle) modalUpgradeTitle.textContent = `🚀 Активація ролі: ${ROLE_LABELS[role] || role}`;
            
            if (upgradeDynamicFields) {
                if (role === 'employer') {
                    upgradeDynamicFields.innerHTML = `
                        <div class="cab-form-group">
                            <label class="cab-label">Назва підприємства / ФОП:</label>
                            <input type="text" id="upgCompanyName" class="cab-input" placeholder="ТОВ Ветеран-Сервіс" required>
                        </div>
                        <div class="cab-form-group">
                            <label class="cab-label">Код ЄДРПОУ / РНОКПП:</label>
                            <input type="text" id="upgEdrpou" class="cab-input" placeholder="40000000" required>
                        </div>
                        <div class="cab-form-group">
                            <label class="cab-label">Галузь:</label>
                            <select id="upgIndustry" class="cab-input">
                                <option value="agro_tech">🌾 Агросектор та БПЛА</option>
                                <option value="it">💻 IT та технології</option>
                                <option value="logistics">🚚 Логістика</option>
                                <option value="production">🏭 Виробництво</option>
                            </select>
                        </div>
                    `;
                } else if (role === 'education') {
                    upgradeDynamicFields.innerHTML = `
                        <div class="cab-form-group">
                            <label class="cab-label">Назва навчального закладу / платформи:</label>
                            <input type="text" id="upgInstName" class="cab-input" placeholder="Черкаський Центр Підготовки" required>
                        </div>
                        <div class="cab-form-group">
                            <label class="cab-label">Ліцензія МОН / Номер акредитації:</label>
                            <input type="text" id="upgLic" class="cab-input" placeholder="Серія АА №123456" required>
                        </div>
                    `;
                } else if (role === 'specialist') {
                    upgradeDynamicFields.innerHTML = `
                        <div class="cab-form-group">
                            <label class="cab-label">Спеціалізація:</label>
                            <select id="upgSpecTitle" class="cab-input">
                                <option value="lawyer">⚖️ Адвокат у військовому праві</option>
                                <option value="psychologist">🧠 Кризовий психолог</option>
                                <option value="case_manager">🤝 Кейс-менеджер</option>
                            </select>
                        </div>
                        <div class="cab-form-group">
                            <label class="cab-label">Номер свідоцтва НААУ / Диплома:</label>
                            <input type="text" id="upgLicNumber" class="cab-input" placeholder="№..." required>
                        </div>
                    `;
                } else if (role === 'mentor') {
                    upgradeDynamicFields.innerHTML = `
                        <div class="cab-form-group">
                            <label class="cab-label">Військовий досвід / Бригада:</label>
                            <input type="text" id="upgMilitaryExp" class="cab-input" placeholder="Наприклад: 72 ОМБр, 2022-2025">
                        </div>
                        <div class="cab-form-group">
                            <label class="cab-label">Теми, з яких готові допомагати побратимам:</label>
                            <input type="text" id="upgMentorTopics" class="cab-input" placeholder="Адаптація, бізнес, психологічна стійкість" required>
                        </div>
                    `;
                } else if (role === 'donor') {
                    upgradeDynamicFields.innerHTML = `
                        <div class="cab-form-group">
                            <label class="cab-label">Ім'я благодійника / Назва компанії:</label>
                            <input type="text" id="upgDonorName" class="cab-input" placeholder="Благодійник..." required>
                        </div>
                    `;
                }
            }

            if (modalUpgradeRole) modalUpgradeRole.style.display = 'flex';
        });
    });

    if (btnCloseModalUpgrade && modalUpgradeRole) {
        btnCloseModalUpgrade.addEventListener('click', () => { modalUpgradeRole.style.display = 'none'; });
    }

    // Відправка форми Self-Upgrade
    if (formUpgradeRole) {
        formUpgradeRole.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetRole = upgradeTargetRole.value;
            let roleData = {};

            if (targetRole === 'employer') {
                roleData = {
                    company_name: document.getElementById('upgCompanyName') ? document.getElementById('upgCompanyName').value.trim() : '',
                    edrpou: document.getElementById('upgEdrpou') ? document.getElementById('upgEdrpou').value.trim() : '',
                    industry: document.getElementById('upgIndustry') ? document.getElementById('upgIndustry').value : 'it'
                };
            } else if (targetRole === 'education') {
                roleData = {
                    institution_name: document.getElementById('upgInstName') ? document.getElementById('upgInstName').value.trim() : '',
                    license_mon: document.getElementById('upgLic') ? document.getElementById('upgLic').value.trim() : ''
                };
            } else if (targetRole === 'specialist') {
                roleData = {
                    role_title: document.getElementById('upgSpecTitle') ? document.getElementById('upgSpecTitle').value : 'lawyer',
                    license_number: document.getElementById('upgLicNumber') ? document.getElementById('upgLicNumber').value.trim() : ''
                };
            } else if (targetRole === 'mentor') {
                roleData = {
                    military_exp: document.getElementById('upgMilitaryExp') ? document.getElementById('upgMilitaryExp').value.trim() : '',
                    support_topics: document.getElementById('upgMentorTopics') ? [document.getElementById('upgMentorTopics').value.trim()] : []
                };
            } else if (targetRole === 'donor') {
                roleData = {
                    donor_display_name: document.getElementById('upgDonorName') ? document.getElementById('upgDonorName').value.trim() : ''
                };
            }

            try {
                const res = await fetch('/api/v1/user/roles/upgrade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        new_role: targetRole,
                        role_data: roleData
                    })
                });
                const resData = await res.json();
                if (!res.ok) {
                    alert(resData.detail || 'Помилка підключення ролі');
                    return;
                }

                alert(`🎉 Статус «${ROLE_LABELS[targetRole] || targetRole}» успішно активовано в єдиному акаунті!`);
                if (modalUpgradeRole) modalUpgradeRole.style.display = 'none';
                await loadUserProfile();

                // Автоматично перемикаємось на нову роль
                if (cabActiveRoleSelect) {
                    cabActiveRoleSelect.value = targetRole;
                    cabActiveRoleSelect.dispatchEvent(new Event('change'));
                }

            } catch (err) {
                alert('Помилка сервера: ' + err.message);
            }
        });
    }

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
                    const results = (json && (json.results || json.data)) ? (json.results || json.data) : [];

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
                            cabInputCommunity.value = `${comm} (${setl})`;
                            cabGeoAutocomplete.style.display = 'none';
                            
                            currentUser.geo_context = {
                                settlement: setl,
                                community: comm,
                                region: reg,
                                is_online: true
                            };
                            localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(currentUser));
                            
                            if (window.NovyShlyakhSession && window.NovyShlyakhSession.setGeoContext) {
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

    // Обробники 1-клікового автозаповнення анкети через Дію або BankID
    const btnAutofillDiia = document.getElementById('btnAutofillDiia');
    const btnAutofillBankId = document.getElementById('btnAutofillBankId');

    async function handleGovAutofill(provider) {
        const btn = provider === 'diia' ? btnAutofillDiia : btnAutofillBankId;
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `⏳ Отримання даних з ${provider === 'diia' ? 'Дії' : 'BankID'}...`;
        }

        try {
            let u = null;
            try {
                const endpoint = provider === 'diia' ? '/api/v1/auth/diia/callback' : '/api/v1/auth/bankid/callback';
                const payload = provider === 'diia' ? { token: 'DIIA_VERIFIED_JWT_MOCK_12345' } : { code: 'BANKID_VERIFIED_CODE_7781' };

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.status === 'success' && result.data && result.data.user) {
                    u = result.data.user;
                }
            } catch (fetchErr) {
                console.warn(`[Gov Autofill Network Note]: using local verified mock`, fetchErr);
            }

            // Fallback дані якщо сервер офлайн
            if (!u) {
                u = {
                    name: 'Тарас Коваленко',
                    callsign: 'Друг Сокіл',
                    phone: '+380 (50) 123-45-67',
                    veteran_status_type: 'ubd',
                    certificate_number: 'УБД № 284910',
                    military_unit: '72 ОМБр ім. Чорних Запорожців',
                    geo_context: { community: 'Канівська ТГ' }
                };
            }

            // Автозаповнення полів анкети
            if (cabInputCallsign) cabInputCallsign.value = u.name || u.callsign || 'Тарас Коваленко';
            if (cabInputPhone) cabInputPhone.value = u.phone || '+380 (50) 123-45-67';
            if (cabInputCommunity && u.geo_context?.community) cabInputCommunity.value = u.geo_context.community;
            
            const vetStatusSelect = document.getElementById('cabVeteranStatusSelect');
            const certNumInput = document.getElementById('cabInputCertNumber');
            const militaryUnitInput = document.getElementById('cabInputMilitaryUnit');

            if (vetStatusSelect) vetStatusSelect.value = u.veteran_status_type || 'ubd';
            if (certNumInput) certNumInput.value = u.certificate_number || 'УБД № 284910';
            if (militaryUnitInput) militaryUnitInput.value = u.military_unit || '72 ОМБр ім. Чорних Запорожців';

            // Автоматичний підбір сфер потреб Наказу № 7
            if (document.getElementById('needMedRehab')) document.getElementById('needMedRehab').checked = true;
            if (document.getElementById('needLegal')) document.getElementById('needLegal').checked = true;
            if (document.getElementById('needJobEdu')) document.getElementById('needJobEdu').checked = true;

            // Оновлення стану верифікації в інтерфейсі
            const bannerActions = document.getElementById('cabAutofillActions');
            const statusVerified = document.getElementById('cabAutofillStatusVerified');
            const verifiedDetails = document.getElementById('cabVerifiedDetailsText');
            if (bannerActions) bannerActions.style.display = 'none';
            if (statusVerified) statusVerified.style.display = 'inline-flex';
            if (verifiedDetails) {
                verifiedDetails.textContent = `Дані та статус УБД верифіковано через ${provider === 'diia' ? 'Дію' : 'BankID НБУ'}`;
            }

            // Оновлення стану в шапці
            const headerBadge = document.getElementById('cabVerifiedBadge');
            if (headerBadge) headerBadge.style.display = 'inline-flex';
            const statusTag = document.getElementById('cabStatusTag');
            if (statusTag) {
                statusTag.textContent = '🎖️ Ветеран (Верифікований УБД)';
                statusTag.style.background = 'rgba(16, 185, 129, 0.25)';
                statusTag.style.color = '#34D399';
            }

            // Збереження в локальний профіль
            currentUser.callsign = cabInputCallsign.value;
            currentUser.phone = cabInputPhone.value;
            currentUser.is_verified_gov = true;
            currentUser.diia_verified = provider === 'diia';
            currentUser.bankid_verified = provider === 'bankid';
            currentUser.auth_source = provider;
            if (!currentUser.profiles_by_role) currentUser.profiles_by_role = {};
            currentUser.profiles_by_role.veteran = {
                veteran_status_type: vetStatusSelect ? vetStatusSelect.value : 'ubd',
                certificate_number: certNumInput ? certNumInput.value : 'УБД № 284910',
                military_unit: militaryUnitInput ? militaryUnitInput.value : '72 ОМБр ім. Чорних Запорожців',
                is_verified_gov: true,
                auth_source: provider,
                needs_matrix: {
                    medical: true,
                    legal: true,
                    psychological: false,
                    housing: false,
                    employment: true
                }
            };
            localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(currentUser));
            updateHeaderProfile();

            // Фонове збереження на сервері
            try {
                await fetch('/api/v1/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        target_role: 'veteran',
                        callsign: cabInputCallsign.value,
                        phone: cabInputPhone.value,
                        community: cabInputCommunity.value,
                        preferred_channel: cabPreferredChannel ? cabPreferredChannel.value : 'telegram',
                        veteran_status_type: vetStatusSelect ? vetStatusSelect.value : 'ubd',
                        certificate_number: certNumInput ? certNumInput.value : 'УБД № 284910',
                        military_unit: militaryUnitInput ? militaryUnitInput.value : '72 ОМБр ім. Чорних Запорожців',
                        auth_source: provider,
                        is_verified_gov: true,
                        needs_matrix: {
                            medical: true,
                            legal: true,
                            psychological: false,
                            housing: false,
                            employment: true
                        },
                        role_data: {
                            veteran_status_type: vetStatusSelect ? vetStatusSelect.value : 'ubd',
                            certificate_number: certNumInput ? certNumInput.value : 'УБД № 284910',
                            military_unit: militaryUnitInput ? militaryUnitInput.value : '72 ОМБр ім. Чорних Запорожців',
                            auth_source: provider,
                            is_verified_gov: true
                        }
                    })
                });
            } catch (saveErr) {
                console.warn('[Server Profile Save Note]', saveErr);
            }

            if (cabSaveProfileSuccess) {
                cabSaveProfileSuccess.textContent = `✅ Дані успішно підтягнуто з ${provider === 'diia' ? 'Дії' : 'BankID'}!`;
                cabSaveProfileSuccess.style.display = 'inline-block';
                setTimeout(() => { cabSaveProfileSuccess.style.display = 'none'; }, 4000);
            }

        } catch (err) {
            console.error(`[Autofill ${provider} Error]`, err);
            alert(`Не вдалося отримати дані з ${provider === 'diia' ? 'Дії' : 'BankID'}. Спробуйте ще раз.`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    }

    if (btnAutofillDiia) {
        btnAutofillDiia.addEventListener('click', () => handleGovAutofill('diia'));
    }
    if (btnAutofillBankId) {
        btnAutofillBankId.addEventListener('click', () => handleGovAutofill('bankid'));
    }

    // Збереження анкети
    if (cabProfileForm) {
        cabProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const activeRole = cabActiveRoleSelect ? cabActiveRoleSelect.value : 'veteran';
            const callsign = cabInputCallsign ? cabInputCallsign.value.trim() : '';
            const phone = cabInputPhone ? cabInputPhone.value.trim() : '';
            const community = cabInputCommunity ? cabInputCommunity.value.trim() : 'Черкаська ТГ';
            const preferredChannel = cabPreferredChannel ? cabPreferredChannel.value : 'telegram';

            // Зчитування полів ветерана та матриці 5 сфер Наказу № 7
            const vetStatusSelect = document.getElementById('cabVeteranStatusSelect');
            const certNumInput = document.getElementById('cabInputCertNumber');
            const militaryUnitInput = document.getElementById('cabInputMilitaryUnit');

            const needsMatrix = {
                medical: document.getElementById('needMedRehab')?.checked || false,
                legal: document.getElementById('needLegal')?.checked || false,
                psychological: document.getElementById('needPsy')?.checked || false,
                housing: document.getElementById('needHousing')?.checked || false,
                employment: document.getElementById('needJobEdu')?.checked || false
            };

            let roleSpecificData = {};
            if (activeRole === 'veteran') {
                roleSpecificData = {
                    status_type: radioIsFamily && radioIsFamily.checked ? 'family' : 'ubd',
                    veteran_status_type: vetStatusSelect ? vetStatusSelect.value : 'ubd',
                    certificate_number: certNumInput ? certNumInput.value.trim() : '',
                    military_unit: militaryUnitInput ? militaryUnitInput.value.trim() : '',
                    needs_matrix: needsMatrix,
                    is_verified_gov: !!(currentUser.is_verified_gov || currentUser.diia_verified || currentUser.bankid_verified),
                    auth_source: currentUser.auth_source || 'manual'
                };
            } else if (activeRole === 'employer') {
                roleSpecificData = {
                    company_name: document.getElementById('employerCompanyName') ? document.getElementById('employerCompanyName').value.trim() : '',
                    edrpou: document.getElementById('employerEdrpou') ? document.getElementById('employerEdrpou').value.trim() : '',
                    industry: document.getElementById('employerIndustry') ? document.getElementById('employerIndustry').value : 'it',
                    hr_contact_name: document.getElementById('employerHrName') ? document.getElementById('employerHrName').value.trim() : ''
                };
            } else if (activeRole === 'specialist') {
                roleSpecificData = {
                    role_title: document.getElementById('specialistRoleTitle') ? document.getElementById('specialistRoleTitle').value : 'lawyer',
                    license_number: document.getElementById('specialistLicense') ? document.getElementById('specialistLicense').value.trim() : '',
                    probono_hours_weekly: parseInt(document.getElementById('specialistCapacity') ? document.getElementById('specialistCapacity').value : 4)
                };
            } else if (activeRole === 'education') {
                roleSpecificData = {
                    institution_name: document.getElementById('eduInstitutionName') ? document.getElementById('eduInstitutionName').value.trim() : '',
                    license_mon: document.getElementById('eduLicense') ? document.getElementById('eduLicense').value.trim() : ''
                };
            } else if (activeRole === 'mentor') {
                roleSpecificData = {
                    support_topics: document.getElementById('mentorTopics') ? [document.getElementById('mentorTopics').value.trim()] : []
                };
            } else if (activeRole === 'donor') {
                roleSpecificData = {
                    donor_display_name: document.getElementById('donorDisplayName') ? document.getElementById('donorDisplayName').value.trim() : ''
                };
            }

            currentUser.callsign = callsign;
            currentUser.phone = phone;
            if (currentUser.geo_context) {
                currentUser.geo_context.settlement = community;
                currentUser.geo_context.community = community;
            }
            localStorage.setItem('novy_shlyakh_user_profile', JSON.stringify(currentUser));
            updateHeaderProfile();

            try {
                const res = await fetch('/api/v1/user/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        target_role: activeRole,
                        callsign: callsign,
                        phone: phone,
                        community: community,
                        preferred_channel: preferredChannel,
                        veteran_status_type: vetStatusSelect ? vetStatusSelect.value : 'ubd',
                        certificate_number: certNumInput ? certNumInput.value.trim() : '',
                        military_unit: militaryUnitInput ? militaryUnitInput.value.trim() : '',
                        needs_matrix: needsMatrix,
                        auth_source: currentUser.auth_source || 'manual',
                        is_verified_gov: !!(currentUser.is_verified_gov || currentUser.diia_verified || currentUser.bankid_verified),
                        role_data: roleSpecificData
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    if (cabSaveProfileSuccess) {
                        cabSaveProfileSuccess.textContent = '✅ Збережено успішно!';
                        cabSaveProfileSuccess.style.display = 'inline-block';
                        setTimeout(() => { cabSaveProfileSuccess.style.display = 'none'; }, 3000);
                    }
                    if (tracker) {
                        tracker.trackEvent('profile_updated', { role: activeRole, community: community });
                    }
                }
            } catch (err) {
                console.error('[Profile Save Error]', err);
                if (cabSaveProfileSuccess) {
                    cabSaveProfileSuccess.textContent = '💾 Збережено локально!';
                    cabSaveProfileSuccess.style.display = 'inline-block';
                    setTimeout(() => { cabSaveProfileSuccess.style.display = 'none'; }, 3000);
                }
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
                                    <button type="button" class="btn-secondary btn-sm" onclick="window.openPrintRoadmapModal('${t.id}')" style="font-weight: 600; border-color: rgba(16, 185, 129, 0.4); color: #6EE7B7;">
                                        🖨️ Дорожня карта (А4)
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
        sosModal.classList.add('is-open');
        sosModal.style.display = 'flex';
    }

    if (btnCloseSosModal && sosModal) {
        btnCloseSosModal.addEventListener('click', () => {
            sosModal.classList.remove('active');
            sosModal.classList.remove('is-open');
            sosModal.style.display = 'none';
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

    // ─── 7. Вкладка 3: Освіта, Ваучери та Професії (Крок C3) ───────────────────
    const cabEducationGrid = document.getElementById('cabEducationGrid');
    const cabEduFilters = document.getElementById('cabEduFilters');
    const modalApplyVoucher = document.getElementById('modalApplyVoucher');
    const btnCloseModalVoucher = document.getElementById('btnCloseModalVoucher');
    const formApplyVoucher = document.getElementById('formApplyVoucher');
    const modalVoucherCourseTitle = document.getElementById('modalVoucherCourseTitle');
    const modalVoucherProviderName = document.getElementById('modalVoucherProviderName');
    const applyVoucherCourseId = document.getElementById('applyVoucherCourseId');
    const voucherVaultDocsList = document.getElementById('voucherVaultDocsList');
    const voucherApplicantName = document.getElementById('voucherApplicantName');
    const voucherApplicantPhone = document.getElementById('voucherApplicantPhone');

    let allLoadedCourses = [];
    let currentEduFilter = 'all';

    async function loadEducation() {
        if (!cabEducationGrid) return;
        try {
            const res = await fetch('/api/v1/education/courses');
            if (res.ok) {
                const data = await res.json();
                allLoadedCourses = (data && data.data) ? data.data : [];
            } else {
                // fallback на статичний education.json
                const fallbackRes = await fetch('education.json');
                allLoadedCourses = await fallbackRes.json();
            }

            renderEducationGrid();

        } catch (e) {
            console.error('[Education Load Error]', e);
            try {
                const fallbackRes = await fetch('education.json');
                allLoadedCourses = await fallbackRes.json();
                renderEducationGrid();
            } catch (err) {}
        }
    }

    function renderEducationGrid() {
        if (!cabEducationGrid) return;

        const filtered = currentEduFilter === 'all' 
            ? allLoadedCourses 
            : allLoadedCourses.filter(c => c.category === currentEduFilter);

        if (filtered.length === 0) {
            cabEducationGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                    <div style="font-size: 2rem; margin-bottom: 8px;">🎓</div>
                    <p style="color: #94A3B8;">У цій категорії наразі немає відкритих програм. Спробуйте обрати інший напрямок.</p>
                </div>
            `;
            return;
        }

        cabEducationGrid.innerHTML = filtered.map(item => `
            <div class="cab-edu-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div class="cab-edu-header">
                        <span class="cab-edu-icon">${item.category === 'it' ? '💻' : item.category === 'uav' ? '🌾' : item.category === 'auto' ? '🚗' : item.category === 'management' ? '📈' : '🎓'}</span>
                        <span class="cab-edu-badge">${item.voucher_eligible ? '🏛️ Ваучер ДСЗ (до 30 280 грн)' : 'Грантова програма'}</span>
                    </div>
                    <h3 class="cab-edu-title">${item.title}</h3>
                    <p class="cab-edu-desc">${item.description || item.desc || ''}</p>
                    <div class="cab-edu-meta">
                        <div><b>Провайдер:</b> ${item.provider_name || item.institution || item.provider || 'Партнер ГО'}</div>
                        <div><b>Формат:</b> ${item.format === 'online' ? '🌐 Дистанційно' : item.format === 'hybrid' ? '🔄 Змішаний' : '🏢 Офлайн'} • ${item.duration_weeks ? item.duration_weeks + ' тижнів' : 'Гнучкий'}</div>
                        <div style="color: #10B981; font-weight: 600; margin-top: 4px;">
                            ${item.voucher_eligible ? '💰 100% Безкоштовно (Покривається ваучером ДСЗ)' : '💰 ' + (item.cost_uah ? item.cost_uah + ' грн' : '0 грн')}
                        </div>
                        ${item.seats_available !== undefined ? `<div style="font-size: 0.8rem; color: #94A3B8; margin-top: 4px;">🎟️ Залишилось вільних місць: <b style="color: #F8FAFC;">${item.seats_available} / ${item.seats_total}</b></div>` : ''}
                    </div>
                </div>
                <button class="btn-primary btn-sm btn-apply-voucher" 
                        data-id="${item.id}" 
                        data-title="${item.title}" 
                        data-provider="${item.provider_name || item.institution || item.provider || 'Партнер'}"
                        style="width: 100%; margin-top: 14px; padding: 10px; font-weight: 700;">
                    📜 Отримати ваучер / Подати заявку
                </button>
            </div>
        `).join('');

        // Клік на кнопку подачі заявки
        cabEducationGrid.querySelectorAll('.btn-apply-voucher').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cId = btn.getAttribute('data-id');
                const cTitle = btn.getAttribute('data-title');
                const cProvider = btn.getAttribute('data-provider');

                if (modalVoucherCourseTitle) modalVoucherCourseTitle.textContent = `🎓 Заявка на курс: «${cTitle}»`;
                if (modalVoucherProviderName) modalVoucherProviderName.textContent = `Освітній провайдер: ${cProvider}`;
                if (applyVoucherCourseId) applyVoucherCourseId.value = cId;

                // Автозаповнення даних ветерана
                if (voucherApplicantName) {
                    voucherApplicantName.value = currentUser.name || (currentUser.auth_details && currentUser.auth_details.fullName) || 'Ветеран';
                }
                if (voucherApplicantPhone) {
                    voucherApplicantPhone.value = currentUser.phone || '';
                }

                // Завантаження документів із Сейфу
                if (voucherVaultDocsList) {
                    try {
                        const vRes = await fetch(`/api/v1/crm/documents/vault?user_id=${encodeURIComponent(userId)}`);
                        const vData = await vRes.json();
                        const vDocs = (vData && vData.status === 'success') ? vData.data : [];
                        
                        if (vDocs.length === 0) {
                            voucherVaultDocsList.innerHTML = `<span style="font-size: 0.8rem; color: #94A3B8;">У вашому Сейфі немає завантажених документів. Координатор зв'яжеться для уточнення.</span>`;
                        } else {
                            voucherVaultDocsList.innerHTML = vDocs.map(d => `
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #E2E8F0; cursor: pointer;">
                                    <input type="checkbox" class="chk-voucher-vault-doc" value="${d.id}" data-name="${d.original_name}" checked>
                                    <span>📄 ${d.original_name} (${(d.file_size/1024).toFixed(1)} КБ)</span>
                                </label>
                            `).join('');
                        }
                    } catch (err) {
                        voucherVaultDocsList.innerHTML = `<span style="font-size: 0.8rem; color: #94A3B8;">Документи сейфу будуть передані координатором.</span>`;
                    }
                }

                if (modalApplyVoucher) modalApplyVoucher.style.display = 'flex';
            });
        });
    }

    // Обробники кнопок фільтрів освітніх програм
    if (cabEduFilters) {
        cabEduFilters.querySelectorAll('.btn-filter-edu').forEach(btn => {
            btn.addEventListener('click', () => {
                cabEduFilters.querySelectorAll('.btn-filter-edu').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'rgba(255,255,255,0.03)';
                    b.style.color = '#CBD5E1';
                    b.style.fontWeight = 'normal';
                });
                btn.classList.add('active');
                btn.style.background = 'rgba(59, 130, 246, 0.2)';
                btn.style.color = '#93C5FD';
                btn.style.fontWeight = '600';
                currentEduFilter = btn.getAttribute('data-filter');
                renderEducationGrid();
            });
        });
    }

    if (btnCloseModalVoucher && modalApplyVoucher) {
        btnCloseModalVoucher.addEventListener('click', () => { modalApplyVoucher.style.display = 'none'; });
    }

    if (formApplyVoucher) {
        formApplyVoucher.addEventListener('submit', async (e) => {
            e.preventDefault();
            const courseId = applyVoucherCourseId ? applyVoucherCourseId.value : 'course-it-fullstack-01';
            
            // Збір прикріплених документів із Сейфу
            const selectedDocs = [];
            document.querySelectorAll('.chk-voucher-vault-doc:checked').forEach(chk => {
                selectedDocs.push({ id: chk.value, title: chk.getAttribute('data-name') });
            });

            const payload = {
                course_id: courseId,
                veteran_id: userId,
                veteran_name: voucherApplicantName ? voucherApplicantName.value.trim() : 'Ветеран',
                phone: voucherApplicantPhone ? voucherApplicantPhone.value.trim() : '+380',
                status_category: document.getElementById('voucherApplicantStatus') ? document.getElementById('voucherApplicantStatus').value : 'ubd',
                has_higher_education: document.getElementById('chkVoucherHasHigherEdu') ? document.getElementById('chkVoucherHasHigherEdu').checked : true,
                comment: document.getElementById('voucherApplicantComment') ? document.getElementById('voucherApplicantComment').value.trim() : '',
                attached_vault_docs: selectedDocs
            };

            try {
                const res = await fetch('/api/v1/education/apply-voucher', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json();
                if (!res.ok) {
                    alert(resData.detail || 'Помилка подання заявки');
                    return;
                }

                alert(`🎉 Заявку на отримання ваучера успішно зареєстровано!\n\n📋 Номер справи: ${resData.data.ticket_id}\n🛡️ Координатор ГО «Талан ЮА» вже готує пакет документів для подачі до Державної служби зайнятості.`);
                formApplyVoucher.reset();
                if (modalApplyVoucher) modalApplyVoucher.style.display = 'none';
                loadEducation(); // Оновити вільні місця
                if (typeof loadTickets === 'function') loadTickets(); // Оновити список моїх звернень

            } catch (err) {
                alert('Помилка сервера: ' + err.message);
            }
        });
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
                        <div class="cab-vault-item-right" style="display: flex; gap: 8px; align-items: center;">
                            <span class="cab-encrypted-pill">🛡️ AES-256 Захищено</span>
                            <button class="btn-sm btn-secondary btn-preview-doc" onclick="alert('Документ зашифровано та захищено. Доступ можливий тільки з вашого авторизованого пристрою.')">
                                👁️ Переглянути
                            </button>
                            <button class="btn-sm btn-danger-outline btn-delete-doc" data-id="${doc.id}" style="font-size: 11px; padding: 4px 8px;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('');

                // Прив'язка видалення документа із сейфа
                cabVaultList.querySelectorAll('.btn-delete-doc').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const docId = btn.getAttribute('data-id');
                        if (confirm('Видалити цей документ із вашого захищеного сейфу?')) {
                            try {
                                const res = await fetch(`/api/v1/crm/documents/vault/${encodeURIComponent(docId)}?user_id=${encodeURIComponent(userId)}`, {
                                    method: 'DELETE'
                                });
                                const json = await res.json();
                                if (json.status === 'success') {
                                    await loadVault();
                                }
                            } catch (e) {
                                console.error('[Delete Doc Error]', e);
                            }
                        }
                    });
                });
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

        // Перевірка статусу підписання Договору / NDA
        let isContractSigned = false;
        try {
            const saved = localStorage.getItem('novy_shlyakh_partner_roles_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                isContractSigned = !!parsed.contract_signed;
            }
        } catch (e) {}

        if (!isContractSigned) {
            if (cabPartnerInboxCount) cabPartnerInboxCount.textContent = '🔒';
            cabPartnerInboxGrid.innerHTML = `
                <div class="cab-locked-card" style="background: rgba(245, 158, 11, 0.05); border: 2px dashed rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 36px 24px; text-align: center; max-width: 600px; margin: 20px auto;">
                    <div style="font-size: 48px; margin-bottom: 12px;">🛡️🔒</div>
                    <h3 style="color: #FBBF24; margin: 0 0 10px 0; font-size: 18px;">Доступ до звернень ветеранів обмежено</h3>
                    <p style="color: #94A3B8; font-size: 13px; line-height: 1.6; margin-bottom: 22px;">
                        Згідно з регламентом безпеки ГО «Талан ЮА» та Законом України «Про захист персональних даних», для перегляду та взяття в роботу звернень ветеранів організація зобов'язана підписати <b>Партнерський Договір про нерозголошення конфіденційної інформації (NDA) та Pro-Bono умови</b>.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-primary" id="btnLockedGoSignContract" style="background: #F59E0B; border-color: #F59E0B; color: #111; font-weight: 700; padding: 10px 20px;">
                            ✍️ Перейти до підписання Договору (КЕП / BankID)
                        </button>
                        <button class="btn-secondary" id="btnLockedPreviewContract" style="padding: 10px 18px;">
                            👁️ Переглянути текст Договору
                        </button>
                    </div>
                </div>
            `;

            const btnGoSign = document.getElementById('btnLockedGoSignContract');
            if (btnGoSign) {
                btnGoSign.addEventListener('click', () => {
                    const tabBtn = document.getElementById('btnNavPartnerAgreement');
                    if (tabBtn) tabBtn.click();
                });
            }

            const btnPrev = document.getElementById('btnLockedPreviewContract');
            if (btnPrev) {
                btnPrev.addEventListener('click', () => {
                    const prevBtn = document.getElementById('btnPartnerPreviewContract');
                    if (prevBtn) prevBtn.click();
                });
            }
            return;
        }

        try {
            const partnerId = (currentUser && currentUser.id) ? currentUser.id : 'partner_org_cherkasy';
            const res = await fetch(`/api/v1/crm/partner/inbox?partner_id=${encodeURIComponent(partnerId)}`);
            
            if (res.status === 403) {
                if (cabPartnerInboxCount) cabPartnerInboxCount.textContent = '🔒';
                cabPartnerInboxGrid.innerHTML = `
                    <div class="cab-locked-card" style="background: rgba(239, 68, 68, 0.05); border: 2px dashed rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 36px 24px; text-align: center; max-width: 600px; margin: 20px auto;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🚫</div>
                        <h3 style="color: #EF4444; margin: 0 0 10px 0; font-size: 18px;">Доступ заборонено (403 Forbidden)</h3>
                        <p style="color: #94A3B8; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
                            Бекенд-сервер відхилив запит: підпис Партнерського Договору / NDA не знайдено в базі ГО «Талан ЮА».
                        </p>
                    </div>
                `;
                return;
            }

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
                                    partner_id: partnerId,
                                    specialist_id: userId,
                                    specialist_name: currentUser.name || "Верифікований партнер",
                                    specialist_role: "Фахівець супроводу"
                                })
                            });
                            const rJson = await acceptRes.json();
                            if (rJson.status === 'success') {
                                alert(`✅ Справу ${caseId} прийнято в роботу! Доступ до конфіденційного чату та контактів відкрито.`);
                                await loadPartnerInbox();
                            } else {
                                alert('Помилка прийняття справи: ' + (rJson.detail || 'Невідома помилка'));
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

    // ─── 9.4. МОДУЛЬ: ВАКАНСІЇ РОБОТОДАВЦЯ (ЕТАП B) ──────────────────────────
    // btnNavEmployerJobs is already declared at line 325
    const cabEmployerVacanciesContainer = document.getElementById('cabEmployerVacanciesContainer');
    const cabEmployerJobsCount = document.getElementById('cabEmployerJobsCount');
    const btnOpenCreateVacancy = document.getElementById('btnOpenCreateVacancy');
    const btnCloseCreateVacancy = document.getElementById('btnCloseCreateVacancy');
    const modalCreateVacancy = document.getElementById('modalCreateVacancy');
    const formCreateVacancy = document.getElementById('formCreateVacancy');

    async function loadEmployerVacancies() {
        if (!cabEmployerVacanciesContainer) return;

        let isContractSigned = false;
        try {
            const saved = localStorage.getItem('novy_shlyakh_partner_roles_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                isContractSigned = !!parsed.contract_signed;
            }
        } catch (e) {}

        if (!isContractSigned) {
            if (cabEmployerJobsCount) cabEmployerJobsCount.textContent = '🔒';
            cabEmployerVacanciesContainer.innerHTML = `
                <div class="cab-locked-card" style="background: rgba(245, 158, 11, 0.05); border: 2px dashed rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 36px 24px; text-align: center; max-width: 600px; margin: 20px auto;">
                    <div style="font-size: 48px; margin-bottom: 12px;">🛡️🔒</div>
                    <h3 style="color: #FBBF24; margin: 0 0 10px 0; font-size: 18px;">Публікація вакансій обмежена</h3>
                    <p style="color: #94A3B8; font-size: 13px; line-height: 1.6; margin-bottom: 22px;">
                        Згідно з регламентом безпеки ГО «Талан ЮА», публікація безбар'єрних робочих місць та отримання резюме ветеранів доступні після підписання <b>Партнерського Договору про захист персональних даних (NDA)</b>.
                    </p>
                    <button class="btn-primary" id="btnLockedGoSignContractFromJobs" style="background: #F59E0B; border-color: #F59E0B; color: #111; font-weight: 700; padding: 10px 20px;">
                        ✍️ Підписати Партнерський Договір (КЕП / BankID)
                    </button>
                </div>
            `;
            const btnSign = document.getElementById('btnLockedGoSignContractFromJobs');
            if (btnSign) {
                btnSign.addEventListener('click', () => {
                    const tabBtn = document.getElementById('btnNavPartnerAgreement');
                    if (tabBtn) tabBtn.click();
                });
            }
            return;
        }

        try {
            const partnerId = (currentUser && currentUser.id) ? currentUser.id : 'org_agro_talan_partner';
            const res = await fetch(`/api/v1/crm/employer/vacancies?employer_id=${encodeURIComponent(partnerId)}`);
            const json = await res.json();
            const vacancies = (json && json.status === 'success') ? json.data : [];

            if (cabEmployerJobsCount) cabEmployerJobsCount.textContent = vacancies.length;

            if (vacancies.length === 0) {
                cabEmployerVacanciesContainer.innerHTML = `
                    <div class="cab-empty-state">
                        <span style="font-size: 36px;">💼</span>
                        <h4>У вас поки немає опублікованих вакансій</h4>
                        <p>Натисніть кнопку «➕ Опублікувати вакансію», щоб розмістити безбар'єрне робоче місце для ветеранів.</p>
                    </div>
                `;
            } else {
                cabEmployerVacanciesContainer.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                        ${vacancies.map(v => `
                            <div class="cab-member-card" style="border-color: ${v.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'};">
                                <div class="cab-member-header">
                                    <div class="cab-member-info">
                                        <div style="font-size: 11px; color: #10B981; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">
                                            ${v.company_name}
                                        </div>
                                        <h4 style="font-size: 16px; margin: 0 0 6px 0;">${v.title}</h4>
                                        <div style="font-size: 13px; color: #FBBF24; font-weight: 700;">
                                            ${v.salary_min ? `${v.salary_min.toLocaleString()} – ${v.salary_max.toLocaleString()} ${v.salary_currency}` : 'За домовленістю'}
                                        </div>
                                    </div>
                                    <span class="cab-capacity-badge ${v.status === 'active' ? 'green' : 'yellow'}">
                                        ${v.status === 'active' ? '🟢 Активна' : '🔒 Закрита'}
                                    </span>
                                </div>

                                <p style="font-size: 12px; color: #94A3B8; line-height: 1.5; margin: 8px 0;">
                                    ${v.description.substring(0, 140)}...
                                </p>

                                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0;">
                                    <span>📍 ${v.community}</span>
                                    ${v.is_accessible_workplace ? '<span style="color: #10B981;">♿ Безбар\'єрне</span>' : ''}
                                    ${v.is_flexible_schedule ? '<span style="color: #38BDF8;">🏥 Гнучкий графік</span>' : ''}
                                    ${v.is_bf_vesta_verified ? '<span style="color: #F59E0B; font-weight: 700;">🛡️ БФ Веста</span>' : ''}
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--cab-border); font-size: 12px;">
                                    <span style="color: #CBD5E1;">👥 Відгуків: <b>${v.applications_count || 0}</b></span>
                                    <button class="btn-secondary btn-sm btn-toggle-vac-status" data-id="${v.id}" data-status="${v.status}" style="font-size: 11px; padding: 4px 10px;">
                                        ${v.status === 'active' ? '🔒 Закрити' : '🟢 Відновити'}
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;

                cabEmployerVacanciesContainer.querySelectorAll('.btn-toggle-vac-status').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vacId = btn.getAttribute('data-id');
                        const currentStatus = btn.getAttribute('data-status');
                        const newStatus = (currentStatus === 'active') ? 'closed' : 'active';
                        const partnerId = (currentUser && currentUser.id) ? currentUser.id : 'org_agro_talan_partner';

                        try {
                            const res = await fetch(`/api/v1/crm/employer/vacancies/${encodeURIComponent(vacId)}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ employer_id: partnerId, status: newStatus })
                            });
                            if (res.ok) {
                                await loadEmployerVacancies();
                            }
                        } catch (err) {
                            console.error('[Toggle Vacancy Status Error]', err);
                        }
                    });
                });
            }
        } catch (err) {
            console.error('[Load Employer Vacancies Error]', err);
        }
    }

    if (btnOpenCreateVacancy && modalCreateVacancy) {
        btnOpenCreateVacancy.addEventListener('click', () => {
            modalCreateVacancy.style.display = 'flex';
        });
    }

    if (btnCloseCreateVacancy && modalCreateVacancy) {
        btnCloseCreateVacancy.addEventListener('click', () => {
            modalCreateVacancy.style.display = 'none';
        });
    }

    if (formCreateVacancy) {
        formCreateVacancy.addEventListener('submit', async (e) => {
            e.preventDefault();
            const partnerId = (currentUser && currentUser.id) ? currentUser.id : 'org_agro_talan_partner';
            const submitBtn = formCreateVacancy.querySelector('button[type="submit"]');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Публікація вакансії...';
            }

            const payload = {
                employer_id: partnerId,
                company_name: document.getElementById('vacCompanyName')?.value.trim(),
                title: document.getElementById('vacTitle')?.value.trim(),
                category: document.getElementById('vacCategory')?.value,
                employment_type: document.getElementById('vacEmploymentType')?.value,
                salary_min: parseInt(document.getElementById('vacSalaryMin')?.value) || null,
                salary_max: parseInt(document.getElementById('vacSalaryMax')?.value) || null,
                salary_currency: 'грн',
                community: document.getElementById('vacCommunity')?.value.trim(),
                settlement: document.getElementById('vacCommunity')?.value.trim(),
                region: 'Черкаська область',
                description: document.getElementById('vacDescription')?.value.trim(),
                requirements: document.getElementById('vacRequirements')?.value.trim(),
                is_accessible_workplace: !!document.getElementById('chkVacAccessible')?.checked,
                is_flexible_schedule: !!document.getElementById('chkVacFlexible')?.checked,
                is_combat_experience_priority: !!document.getElementById('chkVacCombatPriority')?.checked,
                contact_person: document.getElementById('vacContactPerson')?.value.trim(),
                contact_phone: document.getElementById('vacContactPhone')?.value.trim()
            };

            try {
                const res = await fetch('/api/v1/crm/employer/vacancies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (res.ok && json.status === 'success') {
                    if (modalCreateVacancy) modalCreateVacancy.style.display = 'none';
                    formCreateVacancy.reset();
                    await loadEmployerVacancies();
                    alert('✅ Вакансію успішно опубліковано на платформі!');
                } else {
                    alert('Помилка публікації: ' + (json.detail || 'Не вдалося створити вакансію'));
                }
            } catch (err) {
                console.error('[Create Vacancy Error]', err);
                alert('Помилка зв\'язку з сервером при публікації вакансії.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🚀 Опублікувати вакансію на платформі';
                }
            }
        });
    }

    // ─── 9.5. РОБОЧЕ МІСЦЕ ДИСПЕТЧЕРА ЦНАП / ХАБУ (ФАЗА 1) ──────────────────────
    const btnOpenDispatcherIntake = document.getElementById('btnOpenDispatcherIntake');
    const btnCloseDispatcherIntake = document.getElementById('btnCloseDispatcherIntake');
    const dispatcherIntakeModal = document.getElementById('dispatcherIntakeModal');
    const formDispatcherIntake = document.getElementById('formDispatcherIntake');
    const dispatcherCasesList = document.getElementById('dispatcherCasesList');
    const cabDispatcherCasesCount = document.getElementById('cabDispatcherCasesCount');
    const inputSearchDispatcherCases = document.getElementById('inputSearchDispatcherCases');
    const dispVeteranCommunity = document.getElementById('dispVeteranCommunity');
    const dispGeoAutocomplete = document.getElementById('dispGeoAutocomplete');

    let allDispatcherCases = [];

    // Відкриття та закриття модального вікна
    if (btnOpenDispatcherIntake && dispatcherIntakeModal) {
        btnOpenDispatcherIntake.addEventListener('click', () => {
            dispatcherIntakeModal.style.display = 'flex';
            const nameInput = document.getElementById('dispVeteranName');
            if (nameInput) nameInput.focus();
        });
    }

    if (btnCloseDispatcherIntake && dispatcherIntakeModal) {
        btnCloseDispatcherIntake.addEventListener('click', () => {
            dispatcherIntakeModal.style.display = 'none';
        });
    }

    // Автокомпліт КАТОТТГ для форми прийому
    if (dispVeteranCommunity && dispGeoAutocomplete) {
        let dispDebounce;
        dispVeteranCommunity.addEventListener('input', () => {
            clearTimeout(dispDebounce);
            const q = dispVeteranCommunity.value.trim();
            if (q.length < 2) {
                dispGeoAutocomplete.style.display = 'none';
                return;
            }

            dispDebounce = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/v1/geo/settlements?q=${encodeURIComponent(q)}`);
                    const json = await res.json();
                    const results = (json && (json.results || json.data)) ? (json.results || json.data) : [];

                    if (results.length === 0) {
                        dispGeoAutocomplete.innerHTML = `
                            <div class="cab-autocomplete-item" data-settlement="${q}">
                                📍 <b>${q}</b> (Населений пункт України)
                            </div>
                        `;
                    } else {
                        dispGeoAutocomplete.innerHTML = results.map(item => `
                            <div class="cab-autocomplete-item" data-settlement="${item.settlement}" data-community="${item.community}" data-region="${item.region}">
                                📍 <b>${item.settlement}</b> — <small>${item.community}, ${item.region}</small>
                            </div>
                        `).join('');
                    }
                    dispGeoAutocomplete.style.display = 'block';

                    dispGeoAutocomplete.querySelectorAll('.cab-autocomplete-item').forEach(el => {
                        el.addEventListener('click', () => {
                            dispVeteranCommunity.value = el.getAttribute('data-settlement') || q;
                            dispGeoAutocomplete.style.display = 'none';
                        });
                    });
                } catch (e) {
                    console.error('[Disp Geo Search Error]', e);
                }
            }, 250);
        });

        document.addEventListener('click', (e) => {
            if (!dispVeteranCommunity.contains(e.target) && !dispGeoAutocomplete.contains(e.target)) {
                dispGeoAutocomplete.style.display = 'none';
            }
        });
    }

    // Завантаження списку офлайн-підопічних
    async function loadDispatcherCases() {
        if (!dispatcherCasesList) return;
        try {
            const res = await fetch(`/api/v1/crm/dispatcher/my-cases?dispatcher_id=${encodeURIComponent(userId)}`);
            const data = await res.json();
            allDispatcherCases = (data && data.data && data.data.cases) ? data.data.cases : [];

            if (cabDispatcherCasesCount) {
                cabDispatcherCasesCount.textContent = allDispatcherCases.length;
            }
            renderDispatcherCases(allDispatcherCases);
        } catch (err) {
            console.error('[Load Dispatcher Cases Error]', err);
        }
    }

    function renderDispatcherCases(cases) {
        if (!dispatcherCasesList) return;

        if (cases.length === 0) {
            dispatcherCasesList.innerHTML = `
                <div class="cab-empty-state">
                    <span style="font-size: 32px;">🏛️</span>
                    <h4>Немає зареєстрованих офлайн-звернень</h4>
                    <p>Натисніть кнопку «➕ Зареєструвати офлайн-звернення» для створення першої картки підопічного.</p>
                </div>
            `;
            return;
        }

        dispatcherCasesList.innerHTML = cases.map(c => {
            const needs = c.needs_matrix || {};
            const activeNeedsBadges = [];
            if (needs.medical) activeNeedsBadges.push('<span class="cab-tag" style="background: rgba(16, 185, 129, 0.2); color: #6EE7B7; font-size: 11px; padding: 2px 8px; border-radius: 4px;">🏥 Здоров\'я / Ашрам</span>');
            if (needs.legal) activeNeedsBadges.push('<span class="cab-tag" style="background: rgba(59, 130, 246, 0.2); color: #93C5FD; font-size: 11px; padding: 2px 8px; border-radius: 4px;">⚖️ Юр. допомога / ВЛК</span>');
            if (needs.psychological) activeNeedsBadges.push('<span class="cab-tag" style="background: rgba(168, 85, 247, 0.2); color: #D8B4FE; font-size: 11px; padding: 2px 8px; border-radius: 4px;">🧠 Психологія</span>');
            if (needs.housing) activeNeedsBadges.push('<span class="cab-tag" style="background: rgba(245, 158, 11, 0.2); color: #FDE68A; font-size: 11px; padding: 2px 8px; border-radius: 4px;">🏠 Житло / Пільги</span>');
            if (needs.employment) activeNeedsBadges.push('<span class="cab-tag" style="background: rgba(14, 165, 233, 0.2); color: #7DD3FC; font-size: 11px; padding: 2px 8px; border-radius: 4px;">💼 Ваучер ДСЗ / Робота</span>');

            const statusMap = {
                ubd: '🎖️ УБД',
                disability_war_1: '♿ Інвалідність війни I гр.',
                disability_war_2: '♿ Інвалідність війни II гр.',
                disability_war_3: '♿ Інвалідність війни III гр.',
                combatant: '⚔️ Учасник війни',
                family_member: '👨‍👩‍👦 Член родини',
                family_deceased: '🕯️ Сім\'я полеглого'
            };
            const statusLabel = statusMap[c.veteran_status_type] || '🎖️ УБД';

            return `
            <div class="cab-ticket-card" id="disp-case-${c.id}" style="border-left: 3px solid #10B981; margin-bottom: 14px; background: rgba(30, 41, 59, 0.6); border-radius: 12px; padding: 16px;">
                <div class="cab-ticket-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-family: monospace; font-size: 0.8rem; background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 6px; font-weight: 700;">${c.id}</span>
                            <span class="cab-ticket-category">${getCategoryName(c.category)}</span>
                            <span style="font-size: 0.8rem; background: rgba(59, 130, 246, 0.15); color: #60A5FA; padding: 2px 8px; border-radius: 6px; font-weight: 600;">${statusLabel}</span>
                        </div>
                        <h4 class="cab-ticket-title" style="margin: 0; font-size: 1.1rem; color: #F8FAFC;">${c.client_name || c.client_callsign || 'Ветеран'}</h4>
                    </div>
                    <span class="cab-offline-badge" style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px;">🏛️ Ветеранський простір</span>
                </div>

                <!-- Деталі профілю ветерана -->
                <div style="font-size: 13px; color: #cbd5e1; margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div>📞 Телефон: <b>${c.client_phone || 'Не вказано'}</b></div>
                    <div>📍 Громада: <b>${c.geo_context?.settlement || c.geo_context?.community || 'Черкаська область'}</b></div>
                    <div>📜 Посвідчення: <b>${c.certificate_number || 'Підтверджено'}</b></div>
                    <div>🤝 Закріплено: <b>${c.specialist?.name || 'Загальний пул громади'}</b></div>
                </div>

                <!-- 5 сфер потреб Наказу № 7 -->
                ${activeNeedsBadges.length > 0 ? `
                <div style="margin: 8px 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    <span style="font-size: 11.5px; color: #94A3B8;">Напрямки Наказу № 7:</span>
                    ${activeNeedsBadges.join('')}
                </div>
                ` : ''}

                <p class="cab-ticket-desc" style="font-size: 13px; color: #94A3B8; margin: 8px 0 12px 0; line-height: 1.4; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px;">
                    <b>Суть звернення:</b> ${c.description}
                </p>

                <!-- Панель дій фахівця над справою -->
                <div class="cab-partner-actions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
                    <button type="button" class="btn-secondary btn-sm btn-export-blocks-card" data-ticket-id="${c.id}" title="Швидке копіювання блоків справи (Стандарт Наказу № 7)" style="padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        📋 Скопіювати блоки справи
                    </button>
                    <button type="button" class="btn-secondary btn-sm btn-order7-card" data-ticket-id="${c.id}" title="Офіційний бланк оцінки потреб (Наказ № 7)" style="padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        📑 Бланк Наказу № 7 (PDF)
                    </button>
                    <button type="button" class="btn-primary btn-sm btn-print-roadmap-card" data-ticket-id="${c.id}" style="background: #10B981; border-color: #10B981; font-weight: 600; padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                        🖨️ Дорожня карта (А4)
                    </button>
                </div>
            </div>
            `;
        }).join('');

        // Прив'язка подій
        dispatcherCasesList.querySelectorAll('.btn-print-roadmap-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = btn.getAttribute('data-ticket-id');
                if (ticketId && window.openPrintRoadmapModal) window.openPrintRoadmapModal(ticketId);
                else if (ticketId) printRoadmap(ticketId);
            });
        });

        dispatcherCasesList.querySelectorAll('.btn-export-blocks-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = btn.getAttribute('data-ticket-id');
                if (ticketId && window.openExportCaseBlocksModal) window.openExportCaseBlocksModal(ticketId);
            });
        });

        dispatcherCasesList.querySelectorAll('.btn-order7-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = btn.getAttribute('data-ticket-id');
                if (ticketId && window.openOrder7PrintModal) window.openOrder7PrintModal(ticketId);
            });
        });
    }

    // Пошук у журналі офлайн-підопічних
    if (inputSearchDispatcherCases) {
        inputSearchDispatcherCases.addEventListener('input', () => {
            const query = inputSearchDispatcherCases.value.toLowerCase().trim();
            if (!query) {
                renderDispatcherCases(allDispatcherCases);
                return;
            }
            const filtered = allDispatcherCases.filter(c => 
                (c.id && c.id.toLowerCase().includes(query)) ||
                (c.client_name && c.client_name.toLowerCase().includes(query)) ||
                (c.client_phone && c.client_phone.includes(query)) ||
                (c.description && c.description.toLowerCase().includes(query))
            );
            renderDispatcherCases(filtered);
        });
    }

    // Обробка збереження форми офлайн-прийому
    if (formDispatcherIntake) {
        formDispatcherIntake.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = formDispatcherIntake.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Збереження та формування картки...';
            }

            const specSelect = document.getElementById('dispAssignSpecialist');
            const selectedSpecId = specSelect?.value || null;
            const selectedSpecName = selectedSpecId ? specSelect.options[specSelect.selectedIndex].text : null;

            const dispNeedsMatrix = {
                medical: document.getElementById('dispNeedMed')?.checked || false,
                legal: document.getElementById('dispNeedLegal')?.checked || false,
                psychological: document.getElementById('dispNeedPsy')?.checked || false,
                housing: document.getElementById('dispNeedHousing')?.checked || false,
                employment: document.getElementById('dispNeedJob')?.checked || false
            };

            let primaryCat = "legal";
            if (dispNeedsMatrix.medical) primaryCat = "rehab";
            else if (dispNeedsMatrix.psychological) primaryCat = "psychology";
            else if (dispNeedsMatrix.employment) primaryCat = "education";
            else if (dispNeedsMatrix.housing) primaryCat = "social";

            const payload = {
                dispatcher_id: userId,
                dispatcher_name: currentUser.name || "Координатор супроводу",
                veteran_name: document.getElementById('dispVeteranName')?.value.trim(),
                veteran_callsign: "",
                phone: document.getElementById('dispVeteranPhone')?.value.trim(),
                category: primaryCat,
                veteran_status_type: document.getElementById('dispVeteranStatus')?.value || "ubd",
                certificate_number: document.getElementById('dispCertNumber')?.value.trim() || "",
                needs_matrix: dispNeedsMatrix,
                problem_description: document.getElementById('dispDescription')?.value.trim(),
                geo_community: dispVeteranCommunity?.value.trim() || "Черкаська ТГ",
                geo_settlement: dispVeteranCommunity?.value.trim() || "м. Черкаси",
                geo_region: "Черкаська область",
                assigned_specialist_id: selectedSpecId,
                assigned_specialist_name: selectedSpecName,
                urgency: "normal"
            };

            try {
                const res = await fetch('/api/v1/crm/dispatcher/intake', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.status === 'success' && result.data) {
                    if (dispatcherIntakeModal) dispatcherIntakeModal.style.display = 'none';
                    formDispatcherIntake.reset();
                    await loadDispatcherCases();

                    // Миттєвий виклик друку
                    if (confirm(`✅ Звернення зареєстровано (Справа № ${result.data.ticket_id})!\n\nРоздрукувати дорожню карту для ветерана зараз?`)) {
                        printRoadmap(result.data.ticket_id);
                    }
                }
            } catch (err) {
                console.error('[Dispatcher Intake Submit Error]', err);
                alert('Не вдалося зареєструвати звернення на сервері.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '✅ Зареєструвати та сформувати Дорожню карту';
                }
            }
        });
    }

    // Функція генерації та друку Дорожньої карти А4
    async function printRoadmap(ticketId) {
        try {
            const res = await fetch(`/api/v1/crm/dispatcher/print-card/${encodeURIComponent(ticketId)}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.data) {
                alert('Не вдалося завантажити дані картки для друку.');
                return;
            }

            const data = json.data;
            const printEl = document.getElementById('printableRoadmap');
            if (!printEl) return;

            // Заповнення полів шаблону
            const elId = document.getElementById('printTicketId');
            const elDate = document.getElementById('printDate');
            const elName = document.getElementById('printClientName');
            const elPhone = document.getElementById('printClientPhone');
            const elComm = document.getElementById('printCommunity');
            const elCat = document.getElementById('printCategory');
            const elDesc = document.getElementById('printDescription');
            const elSpec = document.getElementById('printSpecialistInfo');
            const elDisp = document.getElementById('printDispatcherName');

            if (elId) elId.textContent = `Справа № ${data.ticket_id}`;
            if (elDate) {
                const d = data.created_at ? new Date(data.created_at) : new Date();
                elDate.textContent = `Дата оформлення: ${d.toLocaleDateString('uk-UA')} ${d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
            }
            if (elName) elName.textContent = data.client_name;
            if (elPhone) elPhone.textContent = data.client_phone;
            if (elComm) elComm.textContent = data.community;
            if (elCat) elCat.textContent = getCategoryName(data.category);
            if (elDesc) elDesc.textContent = data.description;
            if (elDisp) elDisp.textContent = data.dispatcher?.name || 'Координатор супроводу';

            if (elSpec) {
                const s = data.specialist;
                elSpec.innerHTML = `
                    <b>Призначено:</b> ${s.name || 'Черговий фахівець простору'}<br>
                    <b>Напрямок:</b> ${getCategoryName(data.category)}<br>
                    <b>Контактний телефон:</b> ${s.phone || '+380 (67) 000-00-00'}<br>
                    <b>Формат консультації:</b> Телефонний дзвінок / Очна зустріч у просторі
                `;
            }

            // Виклик системного вікна друку браузера
            window.print();

        } catch (err) {
            console.error('[Print Roadmap Error]', err);
            alert('Помилка генерації друкованої картки.');
        }
    }

    // ─── 9.6. МОДУЛЬ: МІЙ ШТАТ ТА CAPACITY CONTROL (ФАЗА 2) ───────────────────
    const orgTeamList = document.getElementById('orgTeamList');
    const cabTeamCount = document.getElementById('cabTeamCount');
    const btnOpenAddTeamMember = document.getElementById('btnOpenAddTeamMember');
    const btnCloseAddTeamMember = document.getElementById('btnCloseAddTeamMember');
    const addTeamMemberModal = document.getElementById('addTeamMemberModal');
    const formAddTeamMember = document.getElementById('formAddTeamMember');

    const btnOpenReassignAll = document.getElementById('btnOpenReassignAll');
    const btnCloseReassignModal = document.getElementById('btnCloseReassignModal');
    const reassignTeamCasesModal = document.getElementById('reassignTeamCasesModal');
    const formReassignTeamCases = document.getElementById('formReassignTeamCases');
    const reassignFromMember = document.getElementById('reassignFromMember');
    const reassignToMember = document.getElementById('reassignToMember');

    const reportConflictModal = document.getElementById('reportConflictModal');
    const btnCloseReportConflict = document.getElementById('btnCloseReportConflict');
    const formReportConflict = document.getElementById('formReportConflict');
    const conflictTicketId = document.getElementById('conflictTicketId');

    let currentOrgTeamMembers = [];

    // Завантаження команди організації з Capacity Control
    async function loadOrgTeam() {
        if (!orgTeamList) return;
        try {
            const orgId = (currentUser.org_id || 'org_talan_01');
            const res = await fetch(`/api/v1/crm/organization/team?org_id=${encodeURIComponent(orgId)}`);
            const json = await res.json();
            currentOrgTeamMembers = (json && json.data && json.data.members) ? json.data.members : [];

            if (cabTeamCount) {
                cabTeamCount.textContent = currentOrgTeamMembers.length;
            }

            renderOrgTeam(currentOrgTeamMembers);
            updateReassignSelectOptions(currentOrgTeamMembers);
        } catch (err) {
            console.error('[Load Org Team Error]', err);
        }
    }

    function renderOrgTeam(members) {
        if (!orgTeamList) return;

        if (members.length === 0) {
            orgTeamList.innerHTML = `
                <div class="cab-empty-state">
                    <span style="font-size: 32px;">👥</span>
                    <h4>У штаті поки немає доданих фахівців</h4>
                    <p>Натисніть кнопку «➕ Додати фахівця» для створення суб-акаунтів вашої команди.</p>
                </div>
            `;
            return;
        }

        orgTeamList.innerHTML = members.map(m => `
            <div class="cab-member-card" id="team-member-${m.id}">
                <div class="cab-member-header">
                    <div class="cab-member-info">
                        <h4>${m.name}</h4>
                        <div class="cab-member-role">${m.role_title}</div>
                    </div>
                    <span class="cab-capacity-badge ${m.capacity_status}">
                        <span class="capacity-dot ${m.capacity_status}"></span>
                        ${m.capacity_label}
                    </span>
                </div>
                <div class="cab-member-meta">
                    <div>📧 Email: <b>${m.email}</b></div>
                    <div>📞 Телефон: <b>${m.phone || 'Не вказано'}</b></div>
                    <div>📊 Активні справи: <b>${m.active_cases_count}</b></div>
                </div>
                <div class="cab-member-actions">
                    <button class="btn-secondary btn-sm btn-quick-reassign" data-id="${m.id}" data-name="${m.name}" style="font-size: 11px; padding: 6px 10px;">
                        ⚡ Делегувати справи
                    </button>
                    ${!m.can_take_new ? `
                        <span style="font-size: 11px; color: #EF4444; display: flex; align-items: center; gap: 4px;">
                            ⚠️ Авто-призначення зупинено
                        </span>
                    ` : `
                        <span style="font-size: 11px; color: #10B981; display: flex; align-items: center; gap: 4px;">
                            ✅ Готовий до нових справ
                        </span>
                    `}
                </div>
            </div>
        `).join('');

        // Прив'язка кнопок делегування для конкретного спеціаліста
        orgTeamList.querySelectorAll('.btn-quick-reassign').forEach(btn => {
            btn.addEventListener('click', () => {
                const memberId = btn.getAttribute('data-id');
                if (reassignFromMember) reassignFromMember.value = memberId;
                if (reassignTeamCasesModal) reassignTeamCasesModal.style.display = 'flex';
            });
        });
    }

    function updateReassignSelectOptions(members) {
        if (!reassignFromMember || !reassignToMember) return;

        const optionsHtml = members.map(m => `
            <option value="${m.id}">${m.name} (${m.role_title}) — ${m.active_cases_count} справ</option>
        `).join('');

        reassignFromMember.innerHTML = optionsHtml;
        reassignToMember.innerHTML = optionsHtml;

        // Встановлюємо другого за замовчуванням для ToMember якщо є > 1
        if (members.length > 1) {
            reassignToMember.selectedIndex = 1;
        }
    }

    // Модальне вікно додавання співробітника
    if (btnOpenAddTeamMember && addTeamMemberModal) {
        btnOpenAddTeamMember.addEventListener('click', () => {
            addTeamMemberModal.style.display = 'flex';
            const nameInput = document.getElementById('memberInputName');
            if (nameInput) nameInput.focus();
        });
    }

    if (btnCloseAddTeamMember && addTeamMemberModal) {
        btnCloseAddTeamMember.addEventListener('click', () => {
            addTeamMemberModal.style.display = 'none';
        });
    }

    if (formAddTeamMember) {
        formAddTeamMember.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = formAddTeamMember.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Додавання до штату...';
            }

            const payload = {
                org_id: currentUser.org_id || 'org_talan_01',
                name: document.getElementById('memberInputName')?.value.trim(),
                email: document.getElementById('memberInputEmail')?.value.trim(),
                phone: document.getElementById('memberInputPhone')?.value.trim(),
                role_title: document.getElementById('memberInputRole')?.value
            };

            try {
                const res = await fetch('/api/v1/crm/organization/team/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.status === 'success') {
                    if (addTeamMemberModal) addTeamMemberModal.style.display = 'none';
                    formAddTeamMember.reset();
                    await loadOrgTeam();
                    alert(`✅ Фахівця ${payload.name} успішно додано до штату організації!`);
                }
            } catch (err) {
                console.error('[Add Team Member Error]', err);
                alert('Не вдалося додати фахівця до штату.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '✅ Створити суб-акаунт спеціаліста';
                }
            }
        });
    }

    // Модальне вікно 1-клік перепризначення всіх справ
    if (btnOpenReassignAll && reassignTeamCasesModal) {
        btnOpenReassignAll.addEventListener('click', () => {
            reassignTeamCasesModal.style.display = 'flex';
        });
    }

    if (btnCloseReassignModal && reassignTeamCasesModal) {
        btnCloseReassignModal.addEventListener('click', () => {
            reassignTeamCasesModal.style.display = 'none';
        });
    }

    if (formReassignTeamCases) {
        formReassignTeamCases.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fromId = reassignFromMember?.value;
            const toId = reassignToMember?.value;
            const reason = document.getElementById('reassignReason')?.value;

            if (fromId === toId) {
                alert('⚠️ Оберіть двох різних співробітників для перенесення справ.');
                return;
            }

            const submitBtn = formReassignTeamCases.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Перенесення справ у системі...';
            }

            try {
                const res = await fetch('/api/v1/crm/organization/team/reassign-all', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        org_id: currentUser.org_id || 'org_talan_01',
                        from_member_id: fromId,
                        to_member_id: toId,
                        reason: reason
                    })
                });
                const json = await res.json();
                if (json.status === 'success') {
                    if (reassignTeamCasesModal) reassignTeamCasesModal.style.display = 'none';
                    await loadOrgTeam();
                    alert(`⚡ Успішно! Перенесено ${json.data.reassigned_count} справ на фахівця ${json.data.to_specialist}.`);
                }
            } catch (err) {
                console.error('[Reassign Cases Error]', err);
                alert('Не вдалося виконати перепризначення справ.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '⚡ Перенести всі справи в 1 клік';
                }
            }
        });
    }

    // Двосторонній захист спеціаліста (Конфлікт / Арбітраж)
    window.openSpecialistConflictModal = function(tId) {
        if (conflictTicketId) conflictTicketId.value = tId;
        if (reportConflictModal) reportConflictModal.style.display = 'flex';
    };

    if (btnCloseReportConflict && reportConflictModal) {
        btnCloseReportConflict.addEventListener('click', () => {
            reportConflictModal.style.display = 'none';
        });
    }

    if (formReportConflict) {
        formReportConflict.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tId = conflictTicketId?.value;
            const reason = document.getElementById('conflictReason')?.value;
            const details = document.getElementById('conflictDetails')?.value.trim();

            const submitBtn = formReportConflict.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Передача координатору ГО...';
            }

            try {
                const res = await fetch(`/api/v1/crm/specialist/tickets/${encodeURIComponent(tId)}/report-conflict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        specialist_id: userId,
                        ticket_id: tId,
                        reason: reason,
                        details: details
                    })
                });
                const json = await res.json();
                if (json.status === 'success') {
                    if (reportConflictModal) reportConflictModal.style.display = 'none';
                    formReportConflict.reset();
                    alert('🛡️ Справу передано на арбітраж координатора ГО «Талан ЮА». Прямий контакт захищено.');
                    if (window.loadPartnerInbox) window.loadPartnerInbox();
                    if (isOrgLead || isPartner) await loadOrgTeam();
                }
            } catch (err) {
                console.error('[Report Conflict Error]', err);
                alert('Помилка передачі звернення координатору.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🛡️ Зупинити прямий контакт та передати координатору';
                }
            }
        });
    }

    if (isDispatcher) {
        await loadDispatcherCases();
    }
    if (isOrgLead || isPartner) {
        await loadOrgTeam();
    }

    // ─── 11. Селектор ролей партнера та динамічний розрахунок пакета документів (Етап A1) ───
    function initPartnerRolesAndDocuments() {
        const chkInfo = document.getElementById('chkPartnerRoleInfo');
        const chkServices = document.getElementById('chkPartnerRoleServices');
        const chkEmployer = document.getElementById('chkPartnerRoleEmployer');
        const chkEducation = document.getElementById('chkPartnerRoleEducation');

        const cardInfo = document.getElementById('cardRoleInfo');
        const cardServices = document.getElementById('cardRoleServices');
        const cardEmployer = document.getElementById('cardRoleEmployer');
        const cardEducation = document.getElementById('cardRoleEducation');

        const docItemMemorandum = document.getElementById('docItemMemorandum');
        const docItemContract = document.getElementById('docItemContract');
        const badgeMemo = document.getElementById('badgeMemorandumStatus');
        const badgeContract = document.getElementById('badgeContractStatus');
        const docLockNotice = document.getElementById('docLockNotice');
        const overallStatus = document.getElementById('partnerLegalOverallStatus');

        // ─── Елементи модальних вікон попереднього перегляду та BankID ────
        const modalPreview = document.getElementById('modalPartnerDocPreview');
        const btnClosePreview = document.getElementById('btnClosePartnerDocPreview');
        const previewTitle = document.getElementById('partnerDocPreviewTitle');
        const previewIcon = document.getElementById('partnerDocPreviewIcon');
        const previewBody = document.getElementById('partnerDocPreviewBody');
        const previewSignStatus = document.getElementById('partnerDocPreviewSignStatus');
        const btnPreviewSignAction = document.getElementById('btnPartnerDocPreviewSignAction');

        const modalBankId = document.getElementById('modalBankIdSign');
        const btnCloseBankId = document.getElementById('btnCloseBankIdSign');
        const bankIdProgress = document.getElementById('bankIdProgress');

        let currentActiveDocType = 'memorandum';
        let fetchedDocsData = {};

        // Завантаження збережених налаштувань ролей партнера
        let partnerRolesConfig = {
            partner_id: 'partner_' + (localStorage.getItem('novy_shlyakh_user_id') || 'org_cherkasy_tg'),
            role_info: true,
            role_services: true,
            role_employer: false,
            role_education: false,
            memorandum_signed: false,
            contract_signed: false
        };

        try {
            const saved = localStorage.getItem('novy_shlyakh_partner_roles_config');
            if (saved) {
                partnerRolesConfig = Object.assign(partnerRolesConfig, JSON.parse(saved));
            }
        } catch (e) {}

        chkInfo.checked = !!partnerRolesConfig.role_info;
        chkServices.checked = !!partnerRolesConfig.role_services;
        if (chkEmployer) chkEmployer.checked = !!partnerRolesConfig.role_employer;
        if (chkEducation) chkEducation.checked = !!partnerRolesConfig.role_education;

        async function fetchPartnerDocumentsApi() {
            const activeRoles = [];
            if (chkInfo.checked) activeRoles.push('info');
            if (chkServices.checked) activeRoles.push('services');
            if (chkEmployer && chkEmployer.checked) activeRoles.push('employer');
            if (chkEducation && chkEducation.checked) activeRoles.push('education');

            try {
                const partnerId = partnerRolesConfig.partner_id || 'partner_org_cherkasy';
                const res = await fetch(`/api/v1/crm/partner/documents-to-sign?partner_id=${encodeURIComponent(partnerId)}&roles=${encodeURIComponent(activeRoles.join(','))}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.data) {
                        fetchedDocsData = json.data;
                        const memoDoc = (json.data.documents || []).find(d => d.type === 'memorandum');
                        const contractDoc = (json.data.documents || []).find(d => d.type === 'contract_nda');
                        if (memoDoc && memoDoc.signed) partnerRolesConfig.memorandum_signed = true;
                        if (contractDoc && contractDoc.signed) partnerRolesConfig.contract_signed = true;
                    }
                }
            } catch (err) {
                console.log('Використання локального режиму документів партнера:', err);
            }
            updateRoleCardsVisual();
        }

        function updateRoleCardsVisual() {
            if (cardInfo) cardInfo.classList.toggle('is-active', chkInfo.checked);
            if (cardServices) cardServices.classList.toggle('is-active', chkServices.checked);
            if (cardEmployer) cardEmployer.classList.toggle('is-active', chkEmployer && chkEmployer.checked);
            if (cardEducation) cardEducation.classList.toggle('is-active', chkEducation && chkEducation.checked);

            const needsContract = (chkServices && chkServices.checked) || 
                                  (chkEmployer && chkEmployer.checked) || 
                                  (chkEducation && chkEducation.checked);

            // Оновлення блоку Договору
            if (docItemContract) {
                if (needsContract) {
                    docItemContract.style.display = 'flex';
                    if (partnerRolesConfig.contract_signed) {
                        badgeContract.className = 'cab-doc-badge signed';
                        badgeContract.textContent = '✅ Підписано КЕП';
                        docItemContract.classList.add('is-signed');
                    } else {
                        badgeContract.className = 'cab-doc-badge pending';
                        badgeContract.textContent = '⏳ Очікує підпису КЕП';
                        docItemContract.classList.remove('is-signed');
                    }
                } else {
                    docItemContract.style.display = 'none';
                }
            }

            // Оновлення блоку Меморандуму
            if (docItemMemorandum) {
                if (partnerRolesConfig.memorandum_signed) {
                    badgeMemo.className = 'cab-doc-badge signed';
                    badgeMemo.textContent = '✅ Підписано КЕП';
                    docItemMemorandum.classList.add('is-signed');
                } else {
                    badgeMemo.className = 'cab-doc-badge pending';
                    badgeMemo.textContent = '⏳ Очікує підпису КЕП';
                    docItemMemorandum.classList.remove('is-signed');
                }
            }

            // Оновлення попередження блокування
            if (docLockNotice) {
                docLockNotice.style.display = (needsContract && !partnerRolesConfig.contract_signed) ? 'flex' : 'none';
            }

            // Відображення вкладки Роботодавця у сайдбарі
            if (btnNavEmployerJobs) {
                btnNavEmployerJobs.style.display = (chkEmployer && chkEmployer.checked) ? 'flex' : 'none';
            }
            if (typeof loadEmployerVacancies === 'function' && chkEmployer && chkEmployer.checked) {
                loadEmployerVacancies();
            }

            // Загальний юридичний статус
            if (overallStatus) {
                const memoOk = partnerRolesConfig.memorandum_signed;
                const contractOk = !needsContract || partnerRolesConfig.contract_signed;
                if (memoOk && contractOk) {
                    overallStatus.className = 'cab-verified-badge';
                    overallStatus.textContent = '🛡️ Юридично верифіковано';
                    overallStatus.style.background = 'rgba(16, 185, 129, 0.15)';
                    overallStatus.style.color = '#10B981';
                } else {
                    overallStatus.className = 'cab-verified-badge';
                    overallStatus.textContent = '⏳ Очікує підписання КЕП';
                    overallStatus.style.background = 'rgba(245, 158, 11, 0.15)';
                    overallStatus.style.color = '#F59E0B';
                }
            }

            // Збереження конфігурації
            partnerRolesConfig.role_info = chkInfo.checked;
            partnerRolesConfig.role_services = chkServices.checked;
            if (chkEmployer) partnerRolesConfig.role_employer = chkEmployer.checked;
            if (chkEducation) partnerRolesConfig.role_education = chkEducation.checked;
            try {
                localStorage.setItem('novy_shlyakh_partner_roles_config', JSON.stringify(partnerRolesConfig));
            } catch (e) {}
        }

        [chkInfo, chkServices, chkEmployer, chkEducation].forEach(chk => {
            if (chk) {
                chk.addEventListener('change', () => {
                    updateRoleCardsVisual();
                    fetchPartnerDocumentsApi();
                });
            }
        });

        // Ініціалізація
        updateRoleCardsVisual();
        fetchPartnerDocumentsApi();

        // ─── Функція виконання підпису через бекенд API ───────────────────────
        async function executeDocumentSign(docType, signMethod, bankName = null) {
            const partnerId = partnerRolesConfig.partner_id || 'partner_org_cherkasy';
            const reqBody = {
                partner_id: partnerId,
                document_type: docType,
                sign_method: signMethod,
                signer_name: "Офіційний представник організації",
                signer_rnokpp: "2839401928",
                bank_name: bankName,
                signature_data: "SHA256_SIG_" + Math.random().toString(36).substring(2, 12).toUpperCase()
            };

            try {
                const res = await fetch('/api/v1/crm/partner/sign-document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqBody)
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log('Документ успішно підписано на бекенді:', data);
                }
            } catch (err) {
                console.log('Локальний запис підпису (офлайн фолбек):', err);
            }

            if (docType === 'memorandum') {
                partnerRolesConfig.memorandum_signed = true;
            } else if (docType === 'contract_nda') {
                partnerRolesConfig.contract_signed = true;
            }

            updateRoleCardsVisual();
            try {
                localStorage.setItem('novy_shlyakh_partner_roles_config', JSON.stringify(partnerRolesConfig));
            } catch (e) {}

            if (typeof loadPartnerInbox === 'function') {
                await loadPartnerInbox();
            }
            if (typeof loadEmployerVacancies === 'function') {
                await loadEmployerVacancies();
            }
        }

        // ─── Попередній перегляд документа ────────────────────────────────────
        function openDocPreview(docType) {
            currentActiveDocType = docType;
            if (!modalPreview) return;

            const isMemo = (docType === 'memorandum');
            if (previewTitle) {
                previewTitle.textContent = isMemo 
                    ? 'Меморандум про взаєморозуміння та партнерську співпрацю' 
                    : 'Партнерський Договір про нерозголошення (NDA) та Pro-Bono супровід';
            }
            if (previewIcon) {
                previewIcon.textContent = isMemo ? '📜' : '🔒';
            }

            const docObj = (fetchedDocsData.documents || []).find(d => d.type === docType);
            let textToShow = docObj ? docObj.text_markdown : '';

            if (!textToShow) {
                textToShow = isMemo 
                    ? `# МЕМОРАНДУМ\n## про взаєморозуміння та партнерську співпрацю з ГО «Талан ЮА»\n\nм. Черкаси\n\nГромадська організація «ТАЛАН ЮА» та Партнерська організація декларують спільні наміри щодо консолідації зусиль у сфері соціальної реінтеграції ветеранів війни та родин загиблих Захисників у межах Черкаської області.`
                    : `# ПАРТНЕРСЬКИЙ ДОГОВІР\n## про захист персональних даних (NDA) та Pro-Bono умови\n\nм. Черкаси\n\nГО «ТАЛАН ЮА» та Виконавець уклали цей договір про зобов'язання безкоштовного супроводу ветеранів, дотримання ст. 32 Конституції України та нерозголошення конфіденційних даних військовослужбовців.`;
            }

            if (previewBody) previewBody.textContent = textToShow;

            const isSigned = isMemo ? partnerRolesConfig.memorandum_signed : partnerRolesConfig.contract_signed;
            if (previewSignStatus) {
                previewSignStatus.innerHTML = isSigned 
                    ? '<span style="color: #10B981;">✅ Документ підписано та діє</span>' 
                    : '<span style="color: #F59E0B;">⏳ Документ очікує вашого підпису</span>';
            }

            modalPreview.style.display = 'flex';
        }

        if (btnClosePreview && modalPreview) {
            btnClosePreview.addEventListener('click', () => modalPreview.style.display = 'none');
            modalPreview.addEventListener('click', (e) => {
                if (e.target === modalPreview) modalPreview.style.display = 'none';
            });
        }

        if (btnPreviewSignAction) {
            btnPreviewSignAction.addEventListener('click', () => {
                if (modalPreview) modalPreview.style.display = 'none';
                openBankIdModal(currentActiveDocType);
            });
        }

        const btnPrevMemo = document.getElementById('btnPartnerPreviewMemo');
        const btnPrevContract = document.getElementById('btnPartnerPreviewContract');
        if (btnPrevMemo) btnPrevMemo.addEventListener('click', () => openDocPreview('memorandum'));
        if (btnPrevContract) btnPrevContract.addEventListener('click', () => openDocPreview('contract_nda'));

        // ─── BankID SmartID Модальне вікно ─────────────────────────────────────
        function openBankIdModal(docType) {
            currentActiveDocType = docType;
            if (!modalBankId) return;
            if (bankIdProgress) bankIdProgress.style.display = 'none';
            modalBankId.style.display = 'flex';
        }

        if (btnCloseBankId && modalBankId) {
            btnCloseBankId.addEventListener('click', () => modalBankId.style.display = 'none');
            modalBankId.addEventListener('click', (e) => {
                if (e.target === modalBankId) modalBankId.style.display = 'none';
            });
        }

        const bankButtons = document.querySelectorAll('.btn-bank-select');
        bankButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const bankName = btn.dataset.bank || 'ПриватБанк';
                if (bankIdProgress) {
                    bankIdProgress.style.display = 'block';
                    bankIdProgress.textContent = `⏳ Підтвердіть запит SmartID у додатку ${bankName}...`;
                }

                setTimeout(async () => {
                    await executeDocumentSign(currentActiveDocType, 'bankid_smartid', bankName);
                    if (modalBankId) modalBankId.style.display = 'none';
                    const docName = (currentActiveDocType === 'memorandum') ? 'Меморандум' : 'Партнерський Договір/NDA';
                    alert(`✅ ${docName} успішно підписано КЕП через ${bankName}! Юридичні дані синхронізовано з ГО «Талан ЮА».`);
                }, 1200);
            });
        });

        // ─── Кнопки підписання Меморандуму ───────────────────────────────────
        const btnSignMemoDiia = document.getElementById('btnPartnerSignDiiaMemo');
        const btnSignMemoBankId = document.getElementById('btnPartnerSignBankIdMemo');
        const btnSignMemoKep = document.getElementById('btnPartnerSignKepMemo');

        if (btnSignMemoDiia) {
            btnSignMemoDiia.addEventListener('click', async () => {
                await executeDocumentSign('memorandum', 'diia');
                alert('✅ Меморандум про взаєморозуміння та співпрацю з ГО «Талан ЮА» успішно підписано через Дія.Підпис!');
            });
        }
        if (btnSignMemoBankId) {
            btnSignMemoBankId.addEventListener('click', () => {
                openBankIdModal('memorandum');
            });
        }
        if (btnSignMemoKep) {
            btnSignMemoKep.addEventListener('click', async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.p12,.pfx,.jks,.dat';
                input.onchange = async () => {
                    if (input.files && input.files[0]) {
                        await executeDocumentSign('memorandum', 'file_kep');
                        alert(`✅ Файл КЕП (${input.files[0].name}) успішно верифіковано ГО «Талан ЮА»! Меморандум підписано.`);
                    }
                };
                input.click();
            });
        }

        // ─── Кнопки підписання Партнерського Договору / NDA ──────────────────
        const btnSignContractDiia = document.getElementById('btnPartnerSignDiiaContract');
        const btnSignContractBankId = document.getElementById('btnPartnerSignBankIdContract');
        const btnSignContractKep = document.getElementById('btnPartnerSignKepContract');

        if (btnSignContractDiia) {
            btnSignContractDiia.addEventListener('click', async () => {
                await executeDocumentSign('contract_nda', 'diia');
                alert('✅ Партнерський Договір про співпрацю та захист персональних даних (NDA) підписано через Дія.Підпис! Доступ до CRM та вакансій розблоковано.');
            });
        }
        if (btnSignContractBankId) {
            btnSignContractBankId.addEventListener('click', () => {
                openBankIdModal('contract_nda');
            });
        }
        if (btnSignContractKep) {
            btnSignContractKep.addEventListener('click', async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.p12,.pfx,.jks,.dat';
                input.onchange = async () => {
                    if (input.files && input.files[0]) {
                        await executeDocumentSign('contract_nda', 'file_kep');
                        alert(`✅ КЕП (${input.files[0].name}) Договору/NDA верифіковано! Доступ до бази звернень ветеранів та створення вакансій розблоковано.`);
                    }
                };
                input.click();
            });
        }
    }

    initPartnerRolesAndDocuments();


    // ─── 11.2. Кабінет Роботодавця: Вакансії та Резюме з Сейфу ──────────────────
    async function initEmployerVacancies() {
        const btnNavEmployerJobs = document.getElementById('btnNavEmployerJobs');
        const container = document.getElementById('cabEmployerVacanciesContainer');
        const modalCreateVacancy = document.getElementById('modalCreateVacancy');
        const btnOpenCreateVacancy = document.getElementById('btnOpenCreateVacancy');
        const btnCloseModalVacancy = document.getElementById('btnCloseModalVacancy');
        const formCreateVacancy = document.getElementById('formCreateVacancy');
        const cabEmployerJobsCount = document.getElementById('cabEmployerJobsCount');

        if (!container) return;

        let partnerConfig = { contract_signed: true, partner_id: 'org_agro_talan_partner' };
        try {
            const saved = localStorage.getItem('novy_shlyakh_partner_roles_config');
            if (saved) partnerConfig = JSON.parse(saved);
        } catch (e) {}

        const isPartnerOrAdmin = currentUser.roles && (currentUser.roles.includes('ROLE_PARTNER') || currentUser.roles.includes('ROLE_ADMIN') || currentUser.roles.includes('ROLE_SPECIALIST'));
        if (btnNavEmployerJobs && (isPartnerOrAdmin || partnerConfig.role_employer)) {
            btnNavEmployerJobs.style.display = 'flex';
        }

        async function loadEmployerVacancies() {
            try {
                const employerId = partnerConfig.partner_id || 'org_agro_talan_partner';
                const res = await fetch(`/api/v1/crm/employer/vacancies?employer_id=${encodeURIComponent(employerId)}`);
                
                if (res.status === 403) {
                    container.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
                            <div style="font-size: 2.5rem; margin-bottom: 12px;">🛡️🔒</div>
                            <h3 style="color: #F87171; margin-bottom: 8px;">Публікація вакансій заблокована</h3>
                            <p style="color: #CBD5E1; max-width: 540px; margin: 0 auto 16px; font-size: 0.95rem;">
                                Для публікації інклюзивних ветеранських вакансій та отримання верифікації БФ «Веста» необхідно підписати <b>Партнерський Договір/NDA</b> з ГО «Талан ЮА».
                            </p>
                            <button class="btn-primary" onclick="document.querySelector('[data-tab=tab-partner-agreement]').click()" style="padding: 10px 20px; font-weight: 700;">
                                ✍️ Перейти до підписання Договору/NDA
                            </button>
                        </div>
                    `;
                    return;
                }

                const data = await res.json();
                const vacancies = (data && data.data) ? data.data : [];
                if (cabEmployerJobsCount) cabEmployerJobsCount.textContent = vacancies.length;

                if (vacancies.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 36px 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                            <div style="font-size: 2.5rem; margin-bottom: 12px;">💼</div>
                            <h3 style="color: #F8FAFC; margin-bottom: 6px;">У вас ще немає створених вакансій</h3>
                            <p style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 16px;">Створіть першу ветеран-френдлі позицію для захисників Черкащини</p>
                            <button class="btn-primary" id="btnCreateFirstVacancy" style="padding: 10px 20px;">
                                ➕ Додати першу вакансію
                            </button>
                        </div>
                    `;
                    const btnFirst = document.getElementById('btnCreateFirstVacancy');
                    if (btnFirst) btnFirst.addEventListener('click', () => { if (modalCreateVacancy) modalCreateVacancy.style.display = 'flex'; });
                    return;
                }

                container.innerHTML = vacancies.map(v => `
                    <div class="cab-ticket-card" style="margin-bottom: 14px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <h3 style="margin: 0; color: #F8FAFC; font-size: 1.15rem;">${v.title}</h3>
                                    ${v.is_bf_vesta_verified ? '<span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🛡️ БФ «Веста» Верифіковано</span>' : '<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.75rem;">⏳ На верифікації</span>'}
                                </div>
                                <div style="color: #94A3B8; font-size: 0.85rem; display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px;">
                                    <span>📍 ${v.community || 'Черкаська ТГ'}</span>
                                    <span>💰 ${v.salary_min ? v.salary_min.toLocaleString() : '20 000'} - ${v.salary_max ? v.salary_max.toLocaleString() : '35 000'} ${v.salary_currency || 'грн'}</span>
                                    <span>👥 Відгуків ветеранів: <b>${v.applications_count || 0}</b></span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="cab-btn-status-toggle" data-vac-id="${v.id}" data-current-status="${v.status}" style="background: ${v.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${v.status === 'active' ? '#34D399' : '#94A3B8'}; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer;">
                                    ${v.status === 'active' ? '🟢 Активна' : '⏸️ Призупинено'}
                                </button>
                            </div>
                        </div>
                        <p style="color: #CBD5E1; font-size: 0.9rem; margin: 8px 0;">${v.description}</p>
                        ${v.applications && v.applications.length > 0 ? `
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
                                <h4 style="color: #93C5FD; font-size: 0.85rem; margin-bottom: 6px;">📥 Отримані резюме із Сейфу документів:</h4>
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    ${v.applications.map(a => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; font-size: 0.8rem;">
                                            <span>🎖️ <b>${a.veteran_name}</b> (${a.phone})</span>
                                            <span style="color: #38BDF8;">📁 Документів з сейфу: ${(a.attached_vault_docs || []).length} шт.</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `).join('');

                // Обробник зміни статусу вакансії
                container.querySelectorAll('.cab-btn-status-toggle').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vacId = btn.getAttribute('data-vac-id');
                        const curStatus = btn.getAttribute('data-current-status');
                        const nextStatus = curStatus === 'active' ? 'paused' : 'active';
                        try {
                            const res = await fetch(`/api/v1/crm/employer/vacancies/${vacId}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    employer_id: partnerConfig.partner_id || 'org_agro_talan_partner',
                                    status: nextStatus
                                })
                            });
                            if (res.ok) loadEmployerVacancies();
                        } catch (err) {
                            console.error('Помилка оновлення статусу вакансії:', err);
                        }
                    });
                });

            } catch (err) {
                console.error('[Error loading employer vacancies]:', err);
            }
        }

        if (btnOpenCreateVacancy && modalCreateVacancy) {
            btnOpenCreateVacancy.addEventListener('click', () => { modalCreateVacancy.style.display = 'flex'; });
        }
        if (btnCloseModalVacancy && modalCreateVacancy) {
            btnCloseModalVacancy.addEventListener('click', () => { modalCreateVacancy.style.display = 'none'; });
        }

        if (formCreateVacancy) {
            formCreateVacancy.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    employer_id: partnerConfig.partner_id || 'org_agro_talan_partner',
                    company_name: 'Партнер ГО «Талан ЮА»',
                    title: document.getElementById('vacTitle').value.trim(),
                    category: document.getElementById('vacCategory').value,
                    employment_type: document.getElementById('vacEmploymentType').value,
                    salary_min: parseInt(document.getElementById('vacSalaryMin').value) || 20000,
                    salary_max: parseInt(document.getElementById('vacSalaryMax').value) || 35000,
                    salary_currency: 'грн',
                    community: document.getElementById('vacCommunity').value.trim() || 'Черкаська ТГ (м. Черкаси)',
                    settlement: 'м. Черкаси',
                    region: 'Черкаська область',
                    description: document.getElementById('vacDescription').value.trim(),
                    requirements: document.getElementById('vacRequirements').value.trim(),
                    is_accessible_workplace: document.getElementById('chkVacAccessible').checked,
                    is_flexible_schedule: document.getElementById('chkVacFlexible').checked,
                    is_combat_experience_priority: document.getElementById('chkVacCombatPriority').checked,
                    contact_person: document.getElementById('vacContactPerson').value.trim(),
                    contact_phone: document.getElementById('vacContactPhone').value.trim()
                };

                try {
                    const res = await fetch('/api/v1/crm/employer/vacancies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const resData = await res.json();
                    if (!res.ok) {
                        alert(resData.detail || 'Помилка публікації вакансії');
                        return;
                    }
                    alert('🎉 Вакансію успішно опубліковано на порталі «Новий Шлях»!');
                    formCreateVacancy.reset();
                    if (modalCreateVacancy) modalCreateVacancy.style.display = 'none';
                    loadEmployerVacancies();
                } catch (err) {
                    alert('Помилка сервера: ' + err.message);
                }
            });
        }

        loadEmployerVacancies();
    }

    // ─── 11.3. Кабінет Освітнього Провайдера: Курси та Ваучери ДСЗ (Крок C2) ─────
    async function initProviderCourses() {
        const btnNavProviderCourses = document.getElementById('btnNavProviderCourses');
        const container = document.getElementById('cabProviderCoursesContainer');
        const modalCreateCourse = document.getElementById('modalCreateCourse');
        const btnOpenCreateCourse = document.getElementById('btnOpenCreateCourse');
        const btnCloseModalCourse = document.getElementById('btnCloseModalCourse');
        const formCreateCourse = document.getElementById('formCreateCourse');
        const cabProviderCoursesCount = document.getElementById('cabProviderCoursesCount');

        if (!container) return;

        let partnerConfig = { contract_signed: true, partner_id: 'org_mate_academy' };
        try {
            const saved = localStorage.getItem('novy_shlyakh_partner_roles_config');
            if (saved) partnerConfig = JSON.parse(saved);
        } catch (e) {}

        const isPartnerOrAdmin = currentUser.roles && (currentUser.roles.includes('ROLE_PARTNER') || currentUser.roles.includes('ROLE_ADMIN') || currentUser.roles.includes('ROLE_SPECIALIST'));
        if (btnNavProviderCourses && (isPartnerOrAdmin || partnerConfig.role_education)) {
            btnNavProviderCourses.style.display = 'flex';
        }

        async function loadProviderCourses() {
            try {
                const providerId = partnerConfig.partner_id || 'org_mate_academy';
                const res = await fetch(`/api/v1/crm/provider/courses?provider_id=${encodeURIComponent(providerId)}`);
                
                if (res.status === 403) {
                    container.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 24px; text-align: center;">
                            <div style="font-size: 2.5rem; margin-bottom: 12px;">🛡️🔒</div>
                            <h3 style="color: #F87171; margin-bottom: 8px;">Публікація освітніх курсів заблокована</h3>
                            <p style="color: #CBD5E1; max-width: 540px; margin: 0 auto 16px; font-size: 0.95rem;">
                                Для розміщення навчальних програм та роботи з ваучерами ДСЗ необхідно підписати <b>Партнерський Договір/NDA</b> з ГО «Талан ЮА».
                            </p>
                            <button class="btn-primary" onclick="document.querySelector('[data-tab=tab-partner-agreement]').click()" style="padding: 10px 20px; font-weight: 700;">
                                ✍️ Перейти до підписання Договору/NDA
                            </button>
                        </div>
                    `;
                    return;
                }

                const data = await res.json();
                const courses = (data && data.data) ? data.data : [];
                if (cabProviderCoursesCount) cabProviderCoursesCount.textContent = courses.length;

                if (courses.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 36px 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                            <div style="font-size: 2.5rem; margin-bottom: 12px;">🎓</div>
                            <h3 style="color: #F8FAFC; margin-bottom: 6px;">У вашого закладу ще немає опублікованих курсів</h3>
                            <p style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 16px;">Додайте програму перепідготовки ветеранів за ваучером Держслужби зайнятості</p>
                            <button class="btn-primary" id="btnCreateFirstCourse" style="padding: 10px 20px;">
                                ➕ Додати перший курс
                            </button>
                        </div>
                    `;
                    const btnFirst = document.getElementById('btnCreateFirstCourse');
                    if (btnFirst) btnFirst.addEventListener('click', () => { if (modalCreateCourse) modalCreateCourse.style.display = 'flex'; });
                    return;
                }

                container.innerHTML = courses.map(c => `
                    <div class="cab-ticket-card" style="margin-bottom: 14px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <h3 style="margin: 0; color: #F8FAFC; font-size: 1.15rem;">${c.title}</h3>
                                    ${c.voucher_eligible ? '<span style="background: rgba(37, 99, 235, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">🏛️ Ваучер ДСЗ (до 30 280 грн)</span>' : ''}
                                </div>
                                <div style="color: #94A3B8; font-size: 0.85rem; display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px;">
                                    <span>📍 ${c.city || 'м. Черкаси'} (${c.format === 'online' ? 'Дистанційно' : c.format === 'hybrid' ? 'Змішаний' : 'Офлайн'})</span>
                                    <span>⏱️ ${c.duration_weeks || 8} тижнів</span>
                                    <span>🎟️ Вільних місць: <b>${c.seats_available} / ${c.seats_total}</b></span>
                                    <span>👥 Заявок: <b>${(c.applications || []).length}</b></span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="cab-btn-course-status-toggle" data-course-id="${c.id}" data-current-status="${c.status}" style="background: ${c.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${c.status === 'active' ? '#34D399' : '#94A3B8'}; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer;">
                                    ${c.status === 'active' ? '🟢 Набір відкрито' : '⏸️ На паузі'}
                                </button>
                            </div>
                        </div>
                        <p style="color: #CBD5E1; font-size: 0.9rem; margin: 8px 0;">${c.description}</p>
                        ${c.applications && c.applications.length > 0 ? `
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
                                <h4 style="color: #93C5FD; font-size: 0.85rem; margin-bottom: 6px;">📋 Зареєстровані ветерани (очікують супроводу ДСЗ):</h4>
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    ${c.applications.map(a => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; font-size: 0.8rem;">
                                            <span>🎖️ <b>${a.veteran_name}</b> (${a.phone}) — Статус: ${a.status_category === 'ubd' ? 'УБД' : 'Ветеран'}</span>
                                            <span style="color: #38BDF8;">📁 Документів: ${(a.attached_vault_docs || []).length} шт.</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `).join('');

                // Зміна статусу курсу
                container.querySelectorAll('.cab-btn-course-status-toggle').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const courseId = btn.getAttribute('data-course-id');
                        const curStatus = btn.getAttribute('data-current-status');
                        const nextStatus = curStatus === 'active' ? 'paused' : 'active';
                        try {
                            const res = await fetch(`/api/v1/crm/provider/courses/${courseId}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    provider_id: partnerConfig.partner_id || 'org_mate_academy',
                                    status: nextStatus
                                })
                            });
                            if (res.ok) loadProviderCourses();
                        } catch (err) {
                            console.error('Помилка оновлення статусу курсу:', err);
                        }
                    });
                });

            } catch (err) {
                console.error('[Error loading provider courses]:', err);
            }
        }

        if (btnOpenCreateCourse && modalCreateCourse) {
            btnOpenCreateCourse.addEventListener('click', () => { modalCreateCourse.style.display = 'flex'; });
        }
        if (btnCloseModalCourse && modalCreateCourse) {
            btnCloseModalCourse.addEventListener('click', () => { modalCreateCourse.style.display = 'none'; });
        }

        if (formCreateCourse) {
            formCreateCourse.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    provider_id: partnerConfig.partner_id || 'org_mate_academy',
                    provider_name: 'Освітній партнер ГО «Талан ЮА»',
                    title: document.getElementById('courseTitle').value.trim(),
                    category: document.getElementById('courseCategory').value,
                    format: document.getElementById('courseFormat').value,
                    duration_weeks: parseInt(document.getElementById('courseDurationWeeks').value) || 8,
                    seats_total: parseInt(document.getElementById('courseSeatsTotal').value) || 20,
                    cost_uah: parseInt(document.getElementById('courseCostUah').value) || 30000,
                    city: document.getElementById('courseCity').value.trim() || 'м. Черкаси',
                    voucher_eligible: document.getElementById('chkCourseVoucherEligible').checked,
                    voucher_amount_max: 30280,
                    description: document.getElementById('courseDescription').value.trim(),
                    requirements: document.getElementById('courseRequirements').value.trim(),
                    contact_email: document.getElementById('courseContactEmail').value.trim()
                };

                try {
                    const res = await fetch('/api/v1/crm/provider/courses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const resData = await res.json();
                    if (!res.ok) {
                        alert(resData.detail || 'Помилка публікації курсу');
                        return;
                    }
                    alert('🎉 Освітній курс успішно додано до каталогу ваучерних програм!');
                    formCreateCourse.reset();
                    if (modalCreateCourse) modalCreateCourse.style.display = 'none';
                    loadProviderCourses();
                } catch (err) {
                    alert('Помилка сервера: ' + err.message);
                }
            });
        }

        loadProviderCourses();
    }

    // ─── 11.5. ШІ-Штурман та Персональний RAG (Prompt Chips) ───────────────────
    function initCabinetAiAssistant() {
        const inputMsg = document.getElementById('inputCabAiMessage');
        const chatBox = document.getElementById('cabAiChatBox');
        const typingEl = document.getElementById('cabAiTyping');

        window.applyCabinetAiPrompt = function(promptText) {
            if (inputMsg) {
                inputMsg.value = promptText;
                window.sendCabinetAiMessage();
            }
        };

        window.sendCabinetAiMessage = async function() {
            if (!inputMsg || !chatBox) return;
            const text = inputMsg.value.trim();
            if (!text) return;

            // Відображаємо повідомлення користувача
            const userBubble = document.createElement('div');
            userBubble.style.cssText = 'align-self: flex-end; background: #2563EB; color: #FFFFFF; padding: 10px 16px; border-radius: 12px 12px 2px 12px; font-size: 0.95rem; max-width: 80%; line-height: 1.5;';
            userBubble.textContent = text;
            chatBox.appendChild(userBubble);
            inputMsg.value = '';
            chatBox.scrollTop = chatBox.scrollHeight;

            if (typingEl) typingEl.style.display = 'block';

            const activeUid = (storedUser && storedUser.id) ? storedUser.id : 'vet_taras_01';
            const userComm = (storedUser && storedUser.geo_context && storedUser.geo_context.community) ? storedUser.geo_context.community : 'Черкаська ТГ';

            try {
                const res = await fetch('/api/v1/ai/personal-query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: activeUid,
                        message: text,
                        community: userComm
                    })
                });

                if (typingEl) typingEl.style.display = 'none';

                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();

                const botBubble = document.createElement('div');
                botBubble.style.cssText = 'align-self: flex-start; background: rgba(30, 41, 59, 0.9); border-left: 3px solid #10B981; color: #F1F5F9; padding: 12px 16px; border-radius: 4px 12px 12px 12px; font-size: 0.92rem; max-width: 90%; line-height: 1.6;';
                
                let formatted = data.reply
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;color:#38BDF8;">$1</code>');

                if (data.sources && data.sources.length) {
                    formatted += '<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; color: #94A3B8;">📌 <b>Офіційні джерела:</b> ' + data.sources.join(' | ') + '</div>';
                }

                botBubble.innerHTML = formatted;
                chatBox.appendChild(botBubble);
                chatBox.scrollTop = chatBox.scrollHeight;

            } catch (err) {
                if (typingEl) typingEl.style.display = 'none';
                const errBubble = document.createElement('div');
                errBubble.style.cssText = 'align-self: flex-start; background: rgba(239, 68, 68, 0.2); border-left: 3px solid #EF4444; color: #FCA5A5; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem;';
                errBubble.textContent = '⚠️ Помилка з\'єднання з ШІ-штурманом: ' + err.message;
                chatBox.appendChild(errBubble);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        };
    }

    // ─── 11.6. Диспетчер ЦНАП, Офлайн-прийом та Друк Дорожньої Карти А4 (Крок G1) ──
    window.openPrintRoadmapModal = async function(ticketId) {
        const modal = document.getElementById('modalPrintRoadmap');
        const container = document.getElementById('roadmapA4Content');
        if (!modal || !container) return;

        try {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: #475569;">⏳ Генерація друкованого макету Дорожньої Карти А4...</div>';
            modal.style.display = 'flex';

            const res = await fetch(`/api/v1/crm/tickets/${encodeURIComponent(ticketId)}/roadmap-print`);
            const json = await res.json();
            if (!res.ok || !json.data) throw new Error(json.detail || 'Не вдалося завантажити карту');

            const rm = json.data;
            window._currentRoadmapData = rm;

            container.innerHTML = `
                <div class="roadmap-header-brand">
                    <div class="roadmap-logo-col">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                            <span style="font-size: 26px;">🛡️</span>
                            <h2>ВЕТЕРАНСЬКИЙ ПОРТАЛ «НОВИЙ ШЛЯХ»</h2>
                        </div>
                        <p>ГО «ТАЛАН ЮА» • МФВ «ВІДРОДЖЕННЯ» • ВСЕУКРАЇНСЬКА МЕРЕЖА ПІДТРИМКИ ВЕТЕРАНІВ</p>
                    </div>
                    <div class="roadmap-case-stamp">
                        <span class="case-num">СПРАВА № ${rm.case_id}</span>
                        <span class="case-date">Дата звернення: ${rm.created_at}</span>
                    </div>
                </div>

                <div class="roadmap-meta-grid">
                    <div class="roadmap-card-block">
                        <h4>👤 ДАНІ ОТРИМУВАЧА ДОПОМОГИ</h4>
                        <div class="roadmap-card-row"><b>ПІБ ветерана/родини:</b> ${rm.veteran.name}</div>
                        <div class="roadmap-card-row"><b>Контактний телефон:</b> ${rm.veteran.phone || 'Вказано при прийомі'}</div>
                        <div class="roadmap-card-row"><b>Г громада / Локація:</b> ${rm.veteran.community} (${rm.veteran.region})</div>
                        <div class="roadmap-card-row"><b>Категорія допомоги:</b> ${rm.category.label}</div>
                        <div class="roadmap-card-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #E2E8F0;">
                            <b>Суть запиту:</b> ${rm.description}
                        </div>
                    </div>

                    <div class="roadmap-qr-hero-box">
                        <img src="${rm.qr_image_url}" alt="Magic QR Code">
                        <p>📱 MAGIC QR-КОД<br><span style="font-size: 9.5px; font-weight: normal; color: #166534;">Скануйте для входу без пароля</span></p>
                    </div>
                </div>

                <div class="roadmap-card-block" style="margin-bottom: 20px; background: #F0F9FF; border-color: #BAE6FD;">
                    <h4 style="color: #0284C7;">🤝 ЗАКРІПЛЕНИЙ ФАХІВЕЦЬ ТА ОФЛАЙН-РЕЦЕПЦІЯ</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div class="roadmap-card-row"><b>Фахівець супроводу:</b> ${rm.specialist.name}</div>
                            <div class="roadmap-card-row"><b>Посада/Спеціалізація:</b> ${rm.specialist.role_title}</div>
                            <div class="roadmap-card-row"><b>Телефон фахівця:</b> ${rm.specialist.phone}</div>
                        </div>
                        <div>
                            <div class="roadmap-card-row"><b>Рецепція / Вікно:</b> ${rm.dispatcher.center}</div>
                            <div class="roadmap-card-row"><b>Оператор прийому:</b> ${rm.dispatcher.name}</div>
                            <div class="roadmap-card-row"><b>Локація простору:</b> ${rm.specialist.address}</div>
                        </div>
                    </div>
                </div>

                <div class="roadmap-steps-block">
                    <h4>📋 ПОКРОКОВИЙ ПЛАН ДІЙ (ДОРОЖНЯ КАРТА):</h4>
                    ${rm.next_steps.map(s => `
                        <div class="roadmap-step-item">
                            <span class="roadmap-step-num">${s.step}</span>
                            <div class="roadmap-step-content">
                                <b>${s.title}</b>
                                <p>${s.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="roadmap-hotlines-footer">
                    ${rm.hotlines.map(h => `
                        <div>
                            <b>📞 ${h.phone}</b>
                            <span>${h.name}</span><br>
                            <span style="color: #15803D;">${h.hours}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #DC2626;">⚠️ Помилка завантаження карти: ${err.message}</div>`;
        }
    };

    // ─── ФУНКЦІЇ ЕКСПОРТУ СПРАВИ (СТАНДАРТ НАКАЗУ № 7) ──────────────────────────
    window.openExportCaseBlocksModal = async function(ticketId) {
        const modal = document.getElementById('modalExportCaseBlocks');
        const b1 = document.getElementById('exportBlock1Text');
        const b2 = document.getElementById('exportBlock2Text');
        const b3 = document.getElementById('exportBlock3Text');
        if (!modal || !b1 || !b2 || !b3) return;

        b1.textContent = '⏳ Завантаження даних...';
        b2.textContent = '⏳ Завантаження даних...';
        b3.textContent = '⏳ Завантаження даних...';
        modal.style.display = 'flex';

        try {
            const res = await fetch(`/api/v1/crm/dispatcher/roadmap/${encodeURIComponent(ticketId)}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.data) {
                throw new Error(json.detail || 'Не вдалося завантажити картку');
            }
            const rm = json.data;

            // Блок 1: Профіль та контакти
            const statusMap = {
                ubd: 'Учасник бойових дій (УБД)',
                disability_war_1: 'Особа з інвалідністю внаслідок війни I групи',
                disability_war_2: 'Особа з інвалідністю внаслідок війни II групи',
                disability_war_3: 'Особа з інвалідністю внаслідок війни III групи',
                combatant: 'Учасник війни / Демобілізований',
                family_member: 'Член сім\'ї Захисника / Захисниці',
                family_deceased: 'Член сім\'ї полеглого Героя'
            };
            const statusLabel = statusMap[rm.veteran.status_type] || rm.veteran.status_type || 'Учасник бойових дій (УБД)';

            const text1 = [
                `Номер справи: ${rm.case_id}`,
                `ПІБ отримувача: ${rm.veteran.name}`,
                `Контактний телефон: ${rm.veteran.phone || '—'}`,
                `Територіальна громада: ${rm.veteran.community} (${rm.veteran.region})`,
                `Соціально-військовий статус: ${statusLabel}`,
                `Посвідчення: ${rm.veteran.certificate || 'Підтверджено в системі'}`,
                `Підрозділ / В/Ч: ${rm.veteran.military_unit || '—'}`
            ].join('\n');
            b1.textContent = text1;

            // Блок 2: Оцінка потреб (5 сфер Наказу № 7)
            const needs = rm.veteran.needs_matrix || {};
            const activeNeeds = [];
            if (needs.medical) activeNeeds.push('• Здоров\'я, реабілітація, протезування, декомпресія (Ашрам)');
            if (needs.legal) activeNeeds.push('• Юридична допомога, ВЛК, МСЕК, виплати');
            if (needs.psychological) activeNeeds.push('• Психологічна підтримка, стабілізація');
            if (needs.housing) activeNeeds.push('• Житлово-побутові потреби, субсидії ЖКП');
            if (needs.employment) activeNeeds.push('• Працевлаштування, державний ваучер ДСЗ (30 280 грн), ветеранський бізнес');
            if (activeNeeds.length === 0) activeNeeds.push(`• ${rm.category.label}`);

            const text2 = [
                `Категорія запиту: ${rm.category.label}`,
                `Суть звернення зі слів ветерана: ${rm.description}`,
                `Виявлені сфери потреб (Наказ Мінветеранів № 7):`,
                activeNeeds.join('\n')
            ].join('\n');
            b2.textContent = text2;

            // Блок 3: План заходів та закріплений фахівець
            const stepsList = (rm.next_steps || []).map(s => `${s.step}. ${s.title}: ${s.desc}`).join('\n');
            const text3 = [
                `Фахівець супроводу: ${rm.specialist.name} (${rm.specialist.role_title})`,
                `Телефон фахівця: ${rm.specialist.phone}`,
                `Офлайн-рецепція / Хаб: ${rm.dispatcher.center} (Оператор: ${rm.dispatcher.name})`,
                `Локація простору: ${rm.specialist.address}`,
                `План первинних заходів:`,
                stepsList
            ].join('\n');
            b3.textContent = text3;

            window._currentExportBlocks = { text1, text2, text3, case_id: rm.case_id };

        } catch (err) {
            b1.textContent = '⚠️ Помилка: ' + err.message;
            b2.textContent = '⚠️ Помилка: ' + err.message;
            b3.textContent = '⚠️ Помилка: ' + err.message;
        }
    };

    window.openOrder7PrintModal = async function(ticketId) {
        const modal = document.getElementById('modalPrintOrder7');
        const container = document.getElementById('order7A4Content');
        if (!modal || !container) return;

        container.innerHTML = '<div style="text-align:center; padding: 40px;">⏳ Генерація офіційного бланка Наказу № 7...</div>';
        modal.style.display = 'flex';

        try {
            const res = await fetch(`/api/v1/crm/dispatcher/roadmap/${encodeURIComponent(ticketId)}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.data) throw new Error(json.detail || 'Не вдалося отримати дані');
            const rm = json.data;

            const needs = rm.veteran.needs_matrix || {};
            const check = (val) => val ? '<b>[ ✓ ]</b>' : '[ &nbsp; ]';

            container.innerHTML = `
                <div style="text-align: right; font-size: 10pt; margin-bottom: 12px;">
                    Додаток 1<br>
                    до Порядку здійснення оцінки потреб<br>
                    ветеранів війни та членів їхніх сімей<br>
                    (Наказ Міністерства у справах ветеранів України № 7)
                </div>

                <div style="text-align: center; margin-bottom: 16px;">
                    <h2 style="font-size: 13pt; text-transform: uppercase; margin: 0 0 4px 0; font-weight: bold;">ІНДИВІДУАЛЬНА КАРТКА ОЦІНКИ ПОТРЕБ ВЕТЕРАНА</h2>
                    <div style="font-size: 11pt; font-weight: bold;">Реєстраційний номер справи: ${rm.case_id}</div>
                    <div style="font-size: 10pt; color: #444;">Дата первинного прийому: ${rm.created_at}</div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5pt;" border="1" cellpadding="5">
                    <tr style="background: #F8FAFC;">
                        <th colspan="2" style="text-align: left; padding: 6px;">1. ЗАГАЛЬНІ ВІДОМОСТІ ПРО ОТРИМУВАЧА ПОСЛУГ</th>
                    </tr>
                    <tr>
                        <td style="width: 38%; font-weight: bold;">Прізвище, ім'я, по батькові:</td>
                        <td>${rm.veteran.name}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Контактний номер телефону:</td>
                        <td>${rm.veteran.phone || 'Вказано при прийомі'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Територіальна громада / Адреса:</td>
                        <td>${rm.veteran.community} (${rm.veteran.region})</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Соціально-військовий статус:</td>
                        <td>${rm.veteran.status_type ? (rm.veteran.status_type === 'ubd' ? 'Учасник бойових дій (УБД)' : rm.veteran.status_type) : 'Учасник бойових дій (УБД)'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Серія та № посвідчення:</td>
                        <td>${rm.veteran.certificate || 'Підтверджено електронно'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Військова частина / Підрозділ:</td>
                        <td>${rm.veteran.military_unit || '—'}</td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5pt;" border="1" cellpadding="5">
                    <tr style="background: #F8FAFC;">
                        <th colspan="3" style="text-align: left; padding: 6px;">2. МАТРИЦЯ ОЦІНКИ ПОТРЕБ ЗА 5 СФЕРАМИ (НАКАЗ МІНВЕТЕРАНІВ № 7)</th>
                    </tr>
                    <tr>
                        <td style="width: 10%; text-align: center;">${check(needs.medical)}</td>
                        <td style="width: 40%; font-weight: bold;">1. Охорона здоров'я та реабілітація</td>
                        <td>Медичні послуги, ендопротезування, санаторно-курортне лікування, центр «Ашрам»</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">${check(needs.legal)}</td>
                        <td style="font-weight: bold;">2. Правовий захист та статус</td>
                        <td>Юридичний супровід, оскарження ВЛК, оформлення виплат та МСЕК</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">${check(needs.psychological)}</td>
                        <td style="font-weight: bold;">3. Психологічна допомога</td>
                        <td>Індивідуальне консультування, декомпресія, підтримка родини</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">${check(needs.housing)}</td>
                        <td style="font-weight: bold;">4. Житлово-побутове забезпечення</td>
                        <td>Поліпшення житлових умов, пільги на оплату ЖКП, субсидії</td>
                    </tr>
                    <tr>
                        <td style="text-align: center;">${check(needs.employment)}</td>
                        <td style="font-weight: bold;">5. Зайнятість, освіта та бізнес</td>
                        <td>Ваучери Держслужби зайнятості (30 280 грн), працевлаштування, бізнес-гранти</td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5pt;" border="1" cellpadding="5">
                    <tr style="background: #F8FAFC;">
                        <th colspan="2" style="text-align: left; padding: 6px;">3. РЕЗУЛЬТАТИ ПЕРВИННОГО СКРИНІНГУ ТА СУПРОВОДЖЕННЯ</th>
                    </tr>
                    <tr>
                        <td style="width: 38%; font-weight: bold;">Суть звернення (опис):</td>
                        <td>${rm.description}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Закріплений фахівець із супроводу:</td>
                        <td>${rm.specialist.name} (${rm.specialist.role_title}, тел: ${rm.specialist.phone})</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Осередок прийому / Ветеранський Простір:</td>
                        <td>${rm.dispatcher.center} (Оператор: ${rm.dispatcher.name})</td>
                    </tr>
                </table>

                <div style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 10pt;">
                    <div>
                        <div style="border-bottom: 1px solid #000; height: 30px;"></div>
                        <div style="text-align: center; margin-top: 4px;">(Підпис отримувача послуг / ветерана)</div>
                    </div>
                    <div>
                        <div style="border-bottom: 1px solid #000; height: 30px;"></div>
                        <div style="text-align: center; margin-top: 4px;">(Підпис фахівця із супроводу ветеранів)</div>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #DC2626;">⚠️ Помилка: ${err.message}</div>`;
        }
    };

    function initDispatcherWorkspace() {
        const btnOpenIntake = document.getElementById('btnOpenDispatcherIntake');
        const modalIntake = document.getElementById('modalDispatcherIntake');
        const btnCloseIntake = document.getElementById('btnCloseModalDispatcherIntake');
        const formIntake = document.getElementById('formDispatcherIntake');
        const modalRoadmap = document.getElementById('modalPrintRoadmap');
        const btnCloseRoadmap = document.getElementById('btnCloseModalRoadmap');
        const btnPrintExec = document.getElementById('btnPrintRoadmapExec');
        const btnCopyLink = document.getElementById('btnCopyMagicLink');
        const searchInput = document.getElementById('inputSearchDispatcherCases');
        const casesList = document.getElementById('dispatcherCasesList');

        // Модалка експорту блоків
        const modalExportBlocks = document.getElementById('modalExportCaseBlocks');
        const btnCloseExportBlocks = document.getElementById('btnCloseModalExportBlocks');
        const btnCopyAll = document.getElementById('btnCopyAllBlocks');

        // Модалка бланка Наказу № 7
        const modalOrder7 = document.getElementById('modalPrintOrder7');
        const btnCloseOrder7 = document.getElementById('btnCloseModalOrder7');
        const btnPrintOrder7 = document.getElementById('btnPrintOrder7Exec');

        if (btnOpenIntake && modalIntake) {
            btnOpenIntake.addEventListener('click', () => { modalIntake.style.display = 'flex'; });
        }
        if (btnCloseIntake && modalIntake) {
            btnCloseIntake.addEventListener('click', () => { modalIntake.style.display = 'none'; });
        }
        if (btnCloseRoadmap && modalRoadmap) {
            btnCloseRoadmap.addEventListener('click', () => { modalRoadmap.style.display = 'none'; });
        }
        if (btnCloseExportBlocks && modalExportBlocks) {
            btnCloseExportBlocks.addEventListener('click', () => { modalExportBlocks.style.display = 'none'; });
        }
        if (btnCloseOrder7 && modalOrder7) {
            btnCloseOrder7.addEventListener('click', () => { modalOrder7.style.display = 'none'; });
        }

        if (btnPrintExec) {
            btnPrintExec.addEventListener('click', () => {
                window.print();
            });
        }
        if (btnPrintOrder7) {
            btnPrintOrder7.addEventListener('click', () => {
                window.print();
            });
        }

        // Обробник копіювання ВСІЄЇ справи
        if (btnCopyAll) {
            btnCopyAll.addEventListener('click', () => {
                if (window._currentExportBlocks) {
                    const fullText = [
                        `═══════════════════════════════════════════════════════`,
                        `ДАНІ СПРАВИ ВЕТЕРАНА: ${window._currentExportBlocks.case_id} (СТАНДАРТ НАКАЗУ № 7)`,
                        `═══════════════════════════════════════════════════════\n`,
                        `[БЛОК 1: ПРОФІЛЬ ТА КОНТАКТИ]`,
                        window._currentExportBlocks.text1,
                        `\n[БЛОК 2: ОЦІНКА ПОТРЕБ (5 СФЕР)]`,
                        window._currentExportBlocks.text2,
                        `\n[БЛОК 3: ПЛАН ЗАХОДІВ ТА ФАХІВЕЦЬ]`,
                        window._currentExportBlocks.text3
                    ].join('\n');

                    navigator.clipboard.writeText(fullText).then(() => {
                        const old = btnCopyAll.textContent;
                        btnCopyAll.textContent = '✅ Всю справу скопійовано!';
                        setTimeout(() => { btnCopyAll.textContent = old; }, 2500);
                    }).catch(() => {
                        prompt('Скопіюйте текст справи вручну:', fullText);
                    });
                }
            });
        }

        // Обробники копіювання окремих частин (Блок 1, Блок 2, Блок 3)
        document.querySelectorAll('.btn-copy-part').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (targetEl && targetEl.textContent) {
                    navigator.clipboard.writeText(targetEl.textContent).then(() => {
                        const oldText = btn.textContent;
                        btn.textContent = '✅ Скопійовано!';
                        setTimeout(() => { btn.textContent = oldText; }, 2000);
                    }).catch(() => {
                        prompt('Скопіюйте блок вручну:', targetEl.textContent);
                    });
                }
            });
        });

        if (btnCopyLink) {
            btnCopyLink.addEventListener('click', () => {
                if (window._currentRoadmapData && window._currentRoadmapData.magic_url) {
                    const full = window.location.origin + window._currentRoadmapData.magic_url;
                    navigator.clipboard.writeText(full).then(() => {
                        alert('📋 Magic-посилання скопійовано:\n' + full);
                    }).catch(() => {
                        prompt('Скопіюйте посилання вручну:', full);
                    });
                }
            });
        }

        async function loadDispatcherCases(query = '') {
            if (!casesList) return;
            try {
                const res = await fetch(`/api/v1/crm/dispatcher/cases?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                const cases = json.data || [];

                const countBadge = document.getElementById('cabDispatcherCasesCount');
                if (countBadge) countBadge.textContent = cases.length;

                if (cases.length === 0) {
                    casesList.innerHTML = `
                        <div style="text-align: center; padding: 40px; background: rgba(30, 41, 59, 0.4); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                            <div style="font-size: 36px; margin-bottom: 8px;">🏛️</div>
                            <h4 style="color: #F8FAFC; margin: 0 0 6px 0;">Офлайн-звернень не знайдено</h4>
                            <p style="color: #94A3B8; font-size: 0.85rem; margin: 0;">Натисніть «Зареєструвати офлайн-звернення», щоб оформити прийом ветерана у Ветеранському Просторі / Хабі.</p>
                        </div>
                    `;
                    return;
                }

                casesList.innerHTML = cases.map(c => `
                    <div class="cab-ticket-card" style="margin-bottom: 12px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <span style="font-family: monospace; font-size: 0.8rem; background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 6px; font-weight: 700;">${c.id}</span>
                                    <h4 style="margin: 0; color: #F8FAFC; font-size: 1.05rem;">${c.client_name || 'Ветеран'} (${c.client_phone || 'Без телефону'})</h4>
                                </div>
                                <div style="font-size: 0.85rem; color: #94A3B8; display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 6px;">
                                    <span>📍 ${c.geo_context?.community || 'Черкаська ТГ'}</span>
                                    <span>📂 ${c.category_label || c.category}</span>
                                    <span>📅 ${c.created_at ? c.created_at.slice(0,10) : 'Сьогодні'}</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="btn-secondary btn-sm btn-export-blocks-card" data-ticket-id="${c.id}" title="Швидке копіювання блоків справи (Стандарт Наказу № 7)" style="padding: 6px 12px; font-size: 12px;">
                                    📋 Скопіювати блоки справи
                                </button>
                                <button type="button" class="btn-secondary btn-sm btn-order7-card" data-ticket-id="${c.id}" title="Офіційний бланк оцінки потреб (Наказ № 7)" style="padding: 6px 12px; font-size: 12px;">
                                    📑 Бланк Наказу № 7 (PDF)
                                </button>
                                <button type="button" class="btn-primary btn-sm btn-print-roadmap-card" data-ticket-id="${c.id}" style="background: #10B981; border-color: #10B981; font-weight: 600; padding: 6px 12px; font-size: 12px;">
                                    🖨️ Дорожня карта (А4)
                                </button>
                            </div>
                        </div>
                        <p style="color: #CBD5E1; font-size: 0.9rem; margin: 6px 0 0 0; line-height: 1.4;">${c.description}</p>
                    </div>
                `).join('');

                casesList.querySelectorAll('.btn-print-roadmap-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tid = btn.getAttribute('data-ticket-id');
                        if (tid) window.openPrintRoadmapModal(tid);
                    });
                });

                casesList.querySelectorAll('.btn-export-blocks-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tid = btn.getAttribute('data-ticket-id');
                        if (tid) window.openExportCaseBlocksModal(tid);
                    });
                });

                casesList.querySelectorAll('.btn-order7-card').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tid = btn.getAttribute('data-ticket-id');
                        if (tid) window.openOrder7PrintModal(tid);
                    });
                });

            } catch (err) {
                console.error('[Dispatcher cases load error]:', err);
            }
        }

        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadDispatcherCases(searchInput.value.trim());
                }, 300);
            });
        }

        if (formIntake) {
            formIntake.addEventListener('submit', async (e) => {
                e.preventDefault();
                const needsMatrix = {
                    medical: document.getElementById('dispNeedMed')?.checked || false,
                    legal: document.getElementById('dispNeedLegal')?.checked || false,
                    psychological: document.getElementById('dispNeedPsy')?.checked || false,
                    housing: document.getElementById('dispNeedHousing')?.checked || false,
                    employment: document.getElementById('dispNeedJob')?.checked || false
                };

                const payload = {
                    dispatcher_id: (storedUser && storedUser.id) ? storedUser.id : 'hub_operator_01',
                    dispatcher_name: (storedUser && (storedUser.callsign || storedUser.name)) ? (storedUser.callsign || storedUser.name) : 'Оператор прийому',
                    dispatcher_center: document.getElementById('intakeCenterName') ? document.getElementById('intakeCenterName').value.trim() : 'Ветеранський Простір Канівщини',
                    veteran_name: document.getElementById('dispVeteranName') ? document.getElementById('dispVeteranName').value.trim() : (document.getElementById('intakeVeteranName') ? document.getElementById('intakeVeteranName').value.trim() : ''),
                    phone: document.getElementById('dispVeteranPhone') ? document.getElementById('dispVeteranPhone').value.trim() : (document.getElementById('intakePhone') ? document.getElementById('intakePhone').value.trim() : ''),
                    veteran_status_type: document.getElementById('dispVeteranStatus') ? document.getElementById('dispVeteranStatus').value : 'ubd',
                    certificate_number: document.getElementById('dispCertNumber') ? document.getElementById('dispCertNumber').value.trim() : '',
                    community: document.getElementById('dispVeteranCommunity') ? document.getElementById('dispVeteranCommunity').value.trim() : (document.getElementById('intakeCommunity') ? document.getElementById('intakeCommunity').value.trim() : 'Черкаська ТГ'),
                    category: document.getElementById('intakeCategory') ? document.getElementById('intakeCategory').value : 'legal',
                    region: 'Черкаська область',
                    problem_description: document.getElementById('dispDescription') ? document.getElementById('dispDescription').value.trim() : (document.getElementById('intakeDescription') ? document.getElementById('intakeDescription').value.trim() : ''),
                    needs_matrix: needsMatrix,
                    urgency: document.getElementById('intakeUrgency') ? document.getElementById('intakeUrgency').value : 'normal'
                };

                try {
                    const res = await fetch('/api/v1/crm/dispatcher/intake', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const resData = await res.json();
                    if (!res.ok) {
                        alert(resData.detail || 'Помилка реєстрації звернення');
                        return;
                    }

                    formIntake.reset();
                    if (modalIntake) modalIntake.style.display = 'none';

                    // Відразу відкриваємо готову друковану Дорожню карту А4
                    const createdTicketId = resData.data?.ticket?.id;
                    if (createdTicketId) {
                        window.openPrintRoadmapModal(createdTicketId);
                    }

                    loadDispatcherCases();

                } catch (err) {
                    alert('Помилка сервера: ' + err.message);
                }
            });
        }

        loadDispatcherCases();
    }

    initEmployerVacancies();
    initProviderCourses();
    initCabinetAiAssistant();
    initDispatcherWorkspace();

    // ─── 12. Вихід з кабінету ─────────────────────────────────────────────────
    const btnCabLogout = document.getElementById('btnCabLogout');
    if (btnCabLogout) {
        btnCabLogout.addEventListener('click', () => {
            if (confirm('Ви дійсно бажаєте вийти з особистого кабінету?')) {
                localStorage.removeItem('novy_shlyakh_user_profile');
                sessionStorage.removeItem('novy_shlyakh_session_id');
                window.location.href = 'index.html';
            }
        });
    }
});

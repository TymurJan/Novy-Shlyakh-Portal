/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ВЕТЕРАНСЬКИЙ ПОРТАЛ «НОВИЙ ШЛЯХ» — КЛІЄНТСЬКА ІНФРАСТРУКТУРА СЕСІЙ ТА БЕЗПЕКИ
 * Модуль: auth_session.js (Кроки 1, 2, 3, 4: Повний Етап I "Вхід, Безпека та Місток")
 * Призначення:
 *  1. Управління анонімними жетонами Session_XYZ та ідентифікацією.
 *  2. Всеукраїнська гео-прив'язка за ієрархією КАТОТТГ (Село -> ТГ -> Район -> Область -> Онлайн/Світ).
 *  3. CSRF-захист та безпечна обгортка запитів authFetch().
 *  4. Управління станом ролей та динамічних масок доступу.
 *  5. Суцільна клікова телеметрія (Clickstream Engine) з пакетною відправкою (Batch Beacon).
 *  6. Механізм «Прихованого містка» (Session Merge Engine) — склеювання історії гостя з CRM.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function(window) {
    'use strict';

    const CONFIG = {
        SESSION_STORAGE_KEY: 'novy_shlyakh_session_id',
        CSRF_STORAGE_KEY: 'novy_shlyakh_csrf_token',
        USER_STORAGE_KEY: 'novy_shlyakh_user_profile',
        GEO_STORAGE_KEY: 'novy_shlyakh_geo_context',
        JOURNEY_STORAGE_KEY: 'novy_shlyakh_guest_journey',
        API_BASE: window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
            ? 'http://127.0.0.1:8000'
            : '',
        ENDPOINTS: {
            SESSION_INIT: '/api/v1/session/init',
            ANALYTICS_EVENTS: '/api/v1/analytics/events',
            SESSION_MERGE: '/api/v1/crm/session-merge',
            AUTH_ME: '/api/v1/auth/me',
            LOGOUT: '/api/v1/auth/logout',
            GEO_SEARCH: '/api/v1/geo/settlements'
        },
        BATCH_FLUSH_INTERVAL_MS: 20000,
        MAX_BATCH_SIZE: 25
    };

    // ─── 1. МЕНЕДЖЕР СЕСІЙ ТА ВСЕУКРАЇНСЬКОЇ ГЕО-ЛОКАЦІЇ (SessionManager) ────────
    const SessionManager = {
        sessionId: null,
        csrfToken: null,
        geoContext: {
            region: 'Черкаська область',
            district: null,
            community: 'Черкаська ТГ',
            settlement: 'Черкаси',
            katottg_code: null,
            is_online: true,
            lat: 49.4444,
            lng: 32.0597
        },
        isInitialized: false,

        generateAnonymousToken() {
            const timestamp = Date.now().toString(36);
            const randomBytes = new Uint8Array(8);
            if (window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(randomBytes);
            } else {
                for (let i = 0; i < 8; i++) randomBytes[i] = Math.floor(Math.random() * 256);
            }
            const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            return `sess_anon_${timestamp}_${randomHex}`;
        },

        getOrCreateSessionId() {
            let sid = sessionStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
            if (!sid) {
                sid = this.generateAnonymousToken();
                sessionStorage.setItem(CONFIG.SESSION_STORAGE_KEY, sid);
            }
            this.sessionId = sid;
            return sid;
        },

        loadStoredGeoContext() {
            try {
                const stored = localStorage.getItem(CONFIG.GEO_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.geoContext = { ...this.geoContext, ...parsed };
                }
            } catch (e) {
                const oldString = localStorage.getItem(CONFIG.GEO_STORAGE_KEY);
                if (oldString && typeof oldString === 'string') {
                    this.geoContext.community = oldString;
                    this.geoContext.settlement = oldString;
                }
            }
        },

        async init() {
            if (this.isInitialized) return;
            this.getOrCreateSessionId();
            this.loadStoredGeoContext();

            try {
                const response = await fetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SESSION_INIT}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': this.sessionId
                    },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        referrer: document.referrer || 'direct',
                        landing_page: window.location.pathname + window.location.search,
                        client_geo: this.geoContext
                    })
                });

                if (response.ok) {
                    const resData = await response.json();
                    if (resData.data) {
                        this.csrfToken = resData.data.csrf_token || null;
                        if (this.csrfToken) {
                            sessionStorage.setItem(CONFIG.CSRF_STORAGE_KEY, this.csrfToken);
                        }
                        if (resData.data.geo_detected && !localStorage.getItem(CONFIG.GEO_STORAGE_KEY)) {
                            this.setGeoContext(resData.data.geo_detected);
                        }
                    }
                }
            } catch (err) {
                console.info('[SessionManager] Backend offline, running in client standalone mode.');
                this.csrfToken = sessionStorage.getItem(CONFIG.CSRF_STORAGE_KEY) || 'fallback_csrf_' + Date.now();
            }

            this.isInitialized = true;
            window.dispatchEvent(new CustomEvent('novyshlyakh:session_ready', {
                detail: { sessionId: this.sessionId, geo: this.geoContext }
            }));
        },

        getCsrfToken() {
            return this.csrfToken || sessionStorage.getItem(CONFIG.CSRF_STORAGE_KEY) || '';
        },

        getGeoContext() {
            return this.geoContext;
        },

        getSelectedCommunity() {
            return this.geoContext.settlement || this.geoContext.community || 'Вся Україна';
        },

        setGeoContext(newGeo) {
            if (typeof newGeo === 'string') {
                this.geoContext.settlement = newGeo;
                this.geoContext.community = newGeo;
            } else if (typeof newGeo === 'object' && newGeo !== null) {
                this.geoContext = { ...this.geoContext, ...newGeo };
            }
            localStorage.setItem(CONFIG.GEO_STORAGE_KEY, JSON.stringify(this.geoContext));
            window.dispatchEvent(new CustomEvent('novyshlyakh:community_change', {
                detail: { geo: this.geoContext, label: this.getSelectedCommunity() }
            }));
        },

        setSelectedCommunity(name) {
            this.setGeoContext(name);
        }
    };

    // ─── 2. ЛОКАЛЬНИЙ ЖУРНАЛ ПОДОРОЖІ ГОСТЯ (JourneyTracker) ──────────────────────
    const JourneyTracker = {
        getJourney() {
            try {
                const stored = sessionStorage.getItem(CONFIG.JOURNEY_STORAGE_KEY);
                return stored ? JSON.parse(stored) : { categories: [], searches: [], last_page: window.location.pathname };
            } catch (e) {
                return { categories: [], searches: [], last_page: window.location.pathname };
            }
        },

        recordCategoryView(cat) {
            if (!cat) return;
            const j = this.getJourney();
            if (!j.categories.includes(cat)) {
                j.categories.push(cat);
                if (j.categories.length > 10) j.categories.shift();
            }
            j.last_page = window.location.pathname;
            sessionStorage.setItem(CONFIG.JOURNEY_STORAGE_KEY, JSON.stringify(j));
        },

        recordSearchQuery(q) {
            if (!q) return;
            const j = this.getJourney();
            j.searches.push({ q: q.substring(0, 50), t: Date.now() });
            if (j.searches.length > 5) j.searches.shift();
            sessionStorage.setItem(CONFIG.JOURNEY_STORAGE_KEY, JSON.stringify(j));
        },

        clearJourney() {
            sessionStorage.removeItem(CONFIG.JOURNEY_STORAGE_KEY);
        }
    };

    // ─── 3. МЕНЕДЖЕР АВТОРИЗАЦІЇ ТА МАСОК РОЛЕЙ (AuthManager) ───────────────────
    const AuthManager = {
        currentUser: null,

        init() {
            try {
                const stored = localStorage.getItem(CONFIG.USER_STORAGE_KEY);
                if (stored) {
                    this.currentUser = JSON.parse(stored);
                }
            } catch (e) {
                this.currentUser = null;
            }
        },

        isAuthenticated() {
            return !!(this.currentUser && this.currentUser.id);
        },

        getCurrentUser() {
            return this.currentUser;
        },

        getUserId() {
            return this.currentUser ? this.currentUser.id : 'anonymous';
        },

        getRoles() {
            if (!this.currentUser) return ['ROLE_GUEST'];
            return Array.isArray(this.currentUser.roles) && this.currentUser.roles.length > 0
                ? this.currentUser.roles
                : ['ROLE_VETERAN'];
        },

        hasRole(role) {
            return this.getRoles().includes(role);
        },

        isVeteran() {
            return this.currentUser ? !!this.currentUser.is_veteran : false;
        },

        isFamilyMember() {
            return this.currentUser ? !!this.currentUser.is_family_member : false;
        },

        /**
         * Вхід та автоматичний запуск «Прихованого містка» (Session Merge)
         */
        async setAuthenticatedUser(userData) {
            this.currentUser = {
                id: userData.id || userData.user_id,
                name: userData.name || userData.first_name || 'Користувач',
                username: userData.username || null,
                phone: userData.phone || null,
                roles: userData.roles || ['ROLE_VETERAN'],
                is_veteran: userData.is_veteran !== undefined ? userData.is_veteran : true,
                is_family_member: !!userData.is_family_member,
                geo_context: userData.geo_context || SessionManager.getGeoContext(),
                auth_provider: userData.auth_provider || 'telegram',
                diia_verified: !!userData.diia_verified,
                auth_date: Date.now()
            };

            localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(this.currentUser));
            
            // Запуск механізму склеювання сесій (Session Merge)
            this.triggerSessionMerge();

            window.dispatchEvent(new CustomEvent('novyshlyakh:auth_change', {
                detail: { isAuthenticated: true, user: this.currentUser }
            }));
        },

        /**
         * Механізм «Прихованого містка»: відправка анонімної історії у профіль CRM
         */
        async triggerSessionMerge() {
            const anonToken = SessionManager.sessionId || SessionManager.getOrCreateSessionId();
            const journey = JourneyTracker.getJourney();

            const mergePayload = {
                anonymous_token: anonToken,
                authenticated_user: this.currentUser,
                client_context: {
                    recent_categories: journey.categories,
                    recent_searches: journey.searches,
                    geo_community: SessionManager.getSelectedCommunity(),
                    geo_full: SessionManager.getGeoContext(),
                    landing_page: journey.last_page
                }
            };

            try {
                const res = await this.authFetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SESSION_MERGE}`, {
                    method: 'POST',
                    body: mergePayload
                });
                if (res.ok) {
                    const data = await res.json();
                    console.info('[Session Merge] Successfully merged guest history with CRM profile.');
                    JourneyTracker.clearJourney();
                    window.dispatchEvent(new CustomEvent('novyshlyakh:session_merged', { detail: data }));
                }
            } catch (err) {
                console.warn('[Session Merge] Offline / Deferred merge');
            }
        },

        async logout() {
            try {
                await this.authFetch(`${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LOGOUT}`, { method: 'POST' });
            } catch (e) {}

            this.currentUser = null;
            localStorage.removeItem(CONFIG.USER_STORAGE_KEY);
            sessionStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
            JourneyTracker.clearJourney();
            SessionManager.getOrCreateSessionId();

            window.dispatchEvent(new CustomEvent('novyshlyakh:auth_change', {
                detail: { isAuthenticated: false, user: null }
            }));
        },

        async authFetch(url, options = {}) {
            const finalOptions = { ...options };
            finalOptions.headers = {
                'X-Session-ID': SessionManager.sessionId || SessionManager.getOrCreateSessionId(),
                'X-CSRF-Token': SessionManager.getCsrfToken(),
                ...(finalOptions.headers || {})
            };

            if (finalOptions.body && typeof finalOptions.body === 'object' && !(finalOptions.body instanceof FormData)) {
                finalOptions.headers['Content-Type'] = 'application/json';
                finalOptions.body = JSON.stringify(finalOptions.body);
            }

            finalOptions.credentials = finalOptions.credentials || 'include';

            try {
                const response = await fetch(url, finalOptions);
                if (response.status === 401) {
                    if (this.isAuthenticated()) {
                        this.currentUser = null;
                        localStorage.removeItem(CONFIG.USER_STORAGE_KEY);
                        window.dispatchEvent(new CustomEvent('novyshlyakh:unauthorized'));
                    }
                }
                return response;
            } catch (err) {
                console.error('[AuthFetch Error]', err);
                throw err;
            }
        }
    };

    // ─── 4. СУЦІЛЬНА КЛІКОВА ТЕЛЕМЕТРІЯ (ClickstreamTracker) ──────────────────────
    const ClickstreamTracker = {
        eventBuffer: [],
        flushTimer: null,
        isTracking: false,

        init() {
            if (this.isTracking) return;
            this.isTracking = true;

            document.addEventListener('click', this.handleClick.bind(this), { capture: true, passive: true });
            document.addEventListener('change', this.handleChange.bind(this), { capture: true, passive: true });

            this.flushTimer = setInterval(() => {
                this.flush();
            }, CONFIG.BATCH_FLUSH_INTERVAL_MS);

            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flush(true);
                }
            });
            window.addEventListener('beforeunload', () => {
                this.flush(true);
            });
        },

        getSafeElementLabel(el) {
            if (!el) return '';
            if (el.tagName === 'INPUT' && (el.type === 'password' || el.type === 'tel' || el.type === 'email')) {
                return `[${el.type}_field]`;
            }
            const explicitTrack = el.getAttribute('data-track');
            if (explicitTrack) return explicitTrack;

            const text = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
            return text.substring(0, 40).replace(/\s+/g, ' ');
        },

        isInteractive(el) {
            if (!el || el === document.body || el === document.documentElement) return false;
            const tag = el.tagName.toLowerCase();
            return (
                tag === 'button' ||
                tag === 'a' ||
                tag === 'input' ||
                tag === 'select' ||
                tag === 'textarea' ||
                el.getAttribute('role') === 'button' ||
                el.classList.contains('btn') ||
                el.classList.contains('tab-btn') ||
                el.classList.contains('sw-opt-btn') ||
                el.hasAttribute('onclick') ||
                el.hasAttribute('data-track')
            );
        },

        handleClick(e) {
            try {
                let target = e.target;
                while (target && target !== document.body && !this.isInteractive(target)) {
                    target = target.parentElement;
                }

                if (!target || target === document.body) {
                    const section = e.target ? e.target.closest('[data-track-section]') : null;
                    if (!section) return;
                    target = section;
                }

                // Фіксуємо перегляд вкладки/категорії в журнал гостя
                const catTab = target.closest('.tab-btn[data-category]');
                if (catTab) {
                    JourneyTracker.recordCategoryView(catTab.getAttribute('data-category'));
                }

                const eventItem = {
                    t: Date.now(),
                    type: 'click',
                    tag: target.tagName.toLowerCase(),
                    id: target.id || null,
                    cls: target.className && typeof target.className === 'string' ? target.className.substring(0, 50) : null,
                    lbl: this.getSafeElementLabel(target),
                    url: window.location.pathname + window.location.search,
                    geo: SessionManager.getSelectedCommunity(),
                    geo_full: SessionManager.getGeoContext()
                };

                this.recordEvent(eventItem);
            } catch (err) {}
        },

        handleChange(e) {
            try {
                const target = e.target;
                if (!target) return;

                if (target.id === 'filterSpecialization' || target.name === 'q') {
                    JourneyTracker.recordSearchQuery(target.value);
                }

                const eventItem = {
                    t: Date.now(),
                    type: 'change',
                    tag: target.tagName.toLowerCase(),
                    id: target.id || null,
                    cls: target.className && typeof target.className === 'string' ? target.className.substring(0, 50) : null,
                    lbl: `val:${(target.value || '').substring(0, 30)}`,
                    url: window.location.pathname + window.location.search,
                    geo: SessionManager.getSelectedCommunity(),
                    geo_full: SessionManager.getGeoContext()
                };
                this.recordEvent(eventItem);
            } catch (err) {}
        },

        recordEvent(eventItem) {
            this.eventBuffer.push(eventItem);
            if (this.eventBuffer.length >= CONFIG.MAX_BATCH_SIZE) {
                this.flush();
            }
        },

        flush(isUrgent = false) {
            if (this.eventBuffer.length === 0) return;

            const payload = {
                session_id: SessionManager.sessionId || SessionManager.getOrCreateSessionId(),
                user_id: AuthManager.getUserId(),
                events_count: this.eventBuffer.length,
                events: [...this.eventBuffer],
                geo_context: SessionManager.getGeoContext(),
                sent_at: Date.now()
            };

            this.eventBuffer = [];
            const endpointUrl = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ANALYTICS_EVENTS}`;
            const jsonPayload = JSON.stringify(payload);

            if (isUrgent && navigator.sendBeacon) {
                const blob = new Blob([jsonPayload], { type: 'application/json' });
                navigator.sendBeacon(endpointUrl, blob);
            } else {
                fetch(endpointUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': payload.session_id,
                        'X-CSRF-Token': SessionManager.getCsrfToken()
                    },
                    body: jsonPayload,
                    keepalive: true
                }).catch(() => {});
            }
        }
    };

    // ─── АВТОМАТИЧНИЙ ЗАПУСК ─────────────────────────────────────────────────────
    AuthManager.init();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            SessionManager.init();
            ClickstreamTracker.init();
        });
    } else {
        SessionManager.init();
        ClickstreamTracker.init();
    }

    // Експорт у глобальний простір
    window.NovyShlyakh = window.NovyShlyakh || {};
    window.NovyShlyakh.Session = SessionManager;
    window.NovyShlyakh.Auth = AuthManager;
    window.NovyShlyakh.Tracker = ClickstreamTracker;
    window.NovyShlyakh.Journey = JourneyTracker;

    window.authFetch = AuthManager.authFetch.bind(AuthManager);
    window.isAuthenticated = AuthManager.isAuthenticated.bind(AuthManager);
    window.getCurrentUser = AuthManager.getCurrentUser.bind(AuthManager);
    window.getGeoContext = SessionManager.getGeoContext.bind(SessionManager);
    window.setGeoContext = SessionManager.setGeoContext.bind(SessionManager);

})(window);

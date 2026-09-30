/**
 * 🗺️ Вбудований Ветеранський Віджет «Новий Шлях» v2.0
 * Для розміщення на сайтах територіальних громад, ЦНАПів та ОВА Черкащини.
 * 
 * Використання:
 * <div id="novy-shlyakh-widget"></div>
 * <script src="https://novy-shlyakh.org/widget_veteran_map.js" data-container="novy-shlyakh-widget" data-community="Черкаська ТГ"></script>
 */
(function() {
    function initVeteranWidget() {
        var scriptTag = document.currentScript || (function() {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
        })();

        var containerId = scriptTag ? scriptTag.getAttribute('data-container') : 'novy-shlyakh-widget';
        var community = (scriptTag && scriptTag.getAttribute('data-community')) || 'Черкаська область';
        var targetEl = document.getElementById(containerId);

        if (!targetEl) {
            console.warn('[Novy Shlyakh Widget] Елемент контейнера #' + containerId + ' не знайдено на сторінці.');
            return;
        }

        var portalBaseUrl = 'https://novy-shlyakh.org';

        var widgetHtml = [
            '<div class="nsw-widget-card" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: linear-gradient(145deg, #0f172a, #1e293b); color: #f8fafc; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); max-width: 480px; box-sizing: border-box;">',
                '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">',
                    '<div style="display: flex; align-items: center; gap: 10px;">',
                        '<span style="font-size: 26px; line-height: 1;">🛡️</span>',
                        '<div>',
                            '<h4 style="margin: 0; font-size: 15px; font-weight: 700; color: #f8fafc; letter-spacing: 0.3px;">Ветеранський супровід</h4>',
                            '<span style="font-size: 12px; color: #94a3b8;">' + community + ' • ГО «Талан ЮА»</span>',
                        '</div>',
                    '</div>',
                    '<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.3);">Постанова №881</span>',
                '</div>',

                '<p style="margin: 0 0 14px 0; font-size: 13px; color: #cbd5e1; line-height: 1.45;">',
                    'Безкоштовний фаховий супровід ветеранів війни, військовослужбовців та їхніх родин: юридична допомога, ВЛК/МСЕК, державні виплати, психологічна підтримка та навчання.',
                '</p>',

                '<div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">',
                    '<div>',
                        '<div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Гаряча лінія психологічної підтримки</div>',
                        '<a href="tel:0800332029" style="font-size: 14px; font-weight: 700; color: #38bdf8; text-decoration: none;">📞 0 800 33 20 29</a>',
                    '</div>',
                    '<span style="font-size: 11px; color: #10b981; font-weight: 600;">24/7 Безкоштовно</span>',
                '</div>',

                '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">',
                    '<a href="' + portalBaseUrl + '/index.html#locations" target="_blank" style="text-align: center; background: rgba(255,255,255,0.08); color: #f8fafc; text-decoration: none; font-size: 12px; font-weight: 600; padding: 9px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); transition: all 0.2s;">',
                        '🗺️ Мапа послуг (139+)',
                    '</a>',
                    '<a href="' + portalBaseUrl + '/cabinet.html" target="_blank" style="text-align: center; background: #10b981; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 9px 10px; border-radius: 8px; border: 1px solid #10b981; transition: all 0.2s;">',
                        '📝 Договір на супровід',
                    '</a>',
                '</div>',

                '<div style="text-align: center; margin-top: 10px; font-size: 10.5px; color: #64748b;">',
                    'Офіційна платформа «Новий Шлях» спільно з МФВ «Відродження»',
                '</div>',
            '</div>'
        ].join('');

        targetEl.innerHTML = widgetHtml;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVeteranWidget);
    } else {
        initVeteranWidget();
    }
})();

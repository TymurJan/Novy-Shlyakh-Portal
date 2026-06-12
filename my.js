// my.js - Логіка Кабінету Ветерана

document.addEventListener('DOMContentLoaded', () => {

    // --- Перемикання табів ---
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const tabSpecialist = document.getElementById('tab-specialist');
    
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');
    const formSpecialist = document.getElementById('specialist-form');

    function resetTabs() {
        [tabLogin, tabRegister, tabSpecialist].forEach(t => t.classList.remove('active'));
        [formLogin, formRegister, formSpecialist].forEach(f => f.classList.remove('active'));
    }

    tabLogin.addEventListener('click', () => {
        resetTabs();
        tabLogin.classList.add('active');
        formLogin.classList.add('active');
    });

    tabRegister.addEventListener('click', () => {
        resetTabs();
        tabRegister.classList.add('active');
        formRegister.classList.add('active');
    });

    tabSpecialist.addEventListener('click', () => {
        resetTabs();
        tabSpecialist.classList.add('active');
        formSpecialist.classList.add('active');
    });

    // Перехід до Back-office спеціаліста
    document.getElementById('go-to-specialist').addEventListener('click', () => {
        window.location.href = 'cabinet.html';
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

    // --- Динамічна Анкетна Система (Фаза 2) ---
    const regRoleSelector = document.getElementById('reg-role-selector');
    const partnerTypeSelector = document.getElementById('partner-type-selector');
    const partnerTypeGroup = document.getElementById('partner-type-group');
    const privateRolesGroup = document.getElementById('private-roles-group');
    const orgRolesGroup = document.getElementById('org-roles-group');
    
    const regVeteranSection = document.getElementById('reg-veteran-section');
    const regPartnerGeneralSection = document.getElementById('reg-partner-general-section');
    const regPartnerServicesSection = document.getElementById('reg-partner-services-section');
    const partnerPrivateSpecFields = document.getElementById('partner-private-spec-fields');
    const partnerOrgProviderFields = document.getElementById('partner-org-provider-fields');
    const orgNgoExtraFields = document.getElementById('org-ngo-extra-fields');
    const orgCommercialExtraFields = document.getElementById('org-commercial-extra-fields');
    const regPartnerBenefactorSection = document.getElementById('reg-partner-benefactor-section');
    const regPartnerEmployerSection = document.getElementById('reg-partner-employer-section');
    const regStateSection = document.getElementById('reg-state-section');
    const regPartnerAgreementsSection = document.getElementById('reg-partner-agreements-section');
    
    // Checkboxes
    const rolePrivateSpecialist = document.getElementById('role-private-specialist');
    const rolePrivateBenefactor = document.getElementById('role-private-benefactor');
    const rolePrivateEmployer = document.getElementById('role-private-employer');
    
    const roleOrgProvider = document.getElementById('role-org-provider');
    const roleOrgBenefactor = document.getElementById('role-org-benefactor');
    const roleOrgEmployer = document.getElementById('role-org-employer');
    
    const orgLegalForm = document.getElementById('org-legal-form');
    const specField = document.getElementById('spec-field');
    
    // Zone views
    const specZone1Options = document.getElementById('spec-zone1-options');
    const specZone2Options = document.getElementById('spec-zone2-options');
    const specZoneTitle = document.getElementById('spec-zone-title');
    const specBarNumberGroup = document.getElementById('spec-bar-number-group');
    
    // Sign methods
    const partnerSignMethodRadios = document.getElementsByName('partner-sign-method');
    const partnerPanelFile = document.getElementById('partner-panel-file');
    const partnerPanelDiia = document.getElementById('partner-panel-diia');
    const partnerDiiaSignBtn = document.getElementById('partner-diia-sign-btn');
    const partnerDiiaEdrpou = document.getElementById('partner-diia-edrpou');
    const partnerDiiaSignStatus = document.getElementById('partner-diia-sign-status');
    const partnerDiiaSignToken = document.getElementById('partner-diia-sign-token');
    
    // Contact person group
    const partnerContactPersonGroup = document.getElementById('partner-contact-person-group');

    function toggleRegistration() {
        if (!regRoleSelector) return;
        const mainRole = regRoleSelector.value;

        if (mainRole === 'veteran') {
            // Show veteran, hide partner stuff
            if (regVeteranSection) regVeteranSection.style.display = 'block';
            if (partnerTypeGroup) partnerTypeGroup.style.display = 'none';
            if (privateRolesGroup) privateRolesGroup.style.display = 'none';
            if (orgRolesGroup) orgRolesGroup.style.display = 'none';
            if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'none';
            if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'none';
            if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'none';
            if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'none';
            if (regStateSection) regStateSection.style.display = 'none';
            if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'none';
            
            // Enable veteran inputs, disable partner inputs
            enableInputs(regVeteranSection, true);
            disablePartnerInputs();
        } else {
            // Partner flow
            if (regVeteranSection) regVeteranSection.style.display = 'none';
            enableInputs(regVeteranSection, false);
            
            if (partnerTypeGroup) partnerTypeGroup.style.display = 'block';
            
            const partnerType = partnerTypeSelector ? partnerTypeSelector.value : '';
            
            if (partnerType === 'state') {
                if (privateRolesGroup) privateRolesGroup.style.display = 'none';
                if (orgRolesGroup) orgRolesGroup.style.display = 'none';
                if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'none';
                if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'none';
                if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'none';
                if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'none';
                if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'none';
                
                if (regStateSection) regStateSection.style.display = 'block';
                
                enableInputs(regStateSection, true);
                disableInputs([privateRolesGroup, orgRolesGroup, regPartnerGeneralSection, regPartnerServicesSection, regPartnerBenefactorSection, regPartnerEmployerSection, regPartnerAgreementsSection], true);
            } else if (partnerType === 'private_person') {
                if (regStateSection) regStateSection.style.display = 'none';
                if (orgRolesGroup) orgRolesGroup.style.display = 'none';
                if (privateRolesGroup) privateRolesGroup.style.display = 'block';
                
                enableInputs(privateRolesGroup, true);
                enableInputs(orgRolesGroup, false);
                enableInputs(regStateSection, false);
                
                // Read roles
                const isSpec = rolePrivateSpecialist && rolePrivateSpecialist.checked;
                const isBenefactor = rolePrivateBenefactor && rolePrivateBenefactor.checked;
                const isEmployer = rolePrivateEmployer && rolePrivateEmployer.checked;
                
                const hasAnyRole = isSpec || isBenefactor || isEmployer;
                
                if (hasAnyRole) {
                    if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'block';
                    if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'block';
                    enableInputs(regPartnerGeneralSection, true);
                    enableInputs(regPartnerAgreementsSection, true);
                    
                    // Hide contact person since it's a private person
                    if (partnerContactPersonGroup) partnerContactPersonGroup.style.display = 'none';
                    const cpInput = document.getElementById('partner-contact-person');
                    if (cpInput) cpInput.disabled = true;
                } else {
                    if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'none';
                    if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'none';
                    enableInputs(regPartnerGeneralSection, false);
                    enableInputs(regPartnerAgreementsSection, false);
                }
                
                // Services
                if (isSpec) {
                    if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'block';
                    if (partnerPrivateSpecFields) partnerPrivateSpecFields.style.display = 'block';
                    if (partnerOrgProviderFields) partnerOrgProviderFields.style.display = 'none';
                    enableInputs(regPartnerServicesSection, true);
                    enableInputs(partnerPrivateSpecFields, true);
                    enableInputs(partnerOrgProviderFields, false);
                    toggleSpecialistZones();
                } else {
                    if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'none';
                    enableInputs(regPartnerServicesSection, false);
                }
                
                // Benefactor
                if (isBenefactor) {
                    if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'block';
                    enableInputs(regPartnerBenefactorSection, true);
                } else {
                    if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'none';
                    enableInputs(regPartnerBenefactorSection, false);
                }
                
                // Employer
                if (isEmployer) {
                    if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'block';
                    enableInputs(regPartnerEmployerSection, true);
                } else {
                    if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'none';
                    enableInputs(regPartnerEmployerSection, false);
                }
                
            } else if (partnerType === 'organization') {
                if (regStateSection) regStateSection.style.display = 'none';
                if (privateRolesGroup) privateRolesGroup.style.display = 'none';
                if (orgRolesGroup) orgRolesGroup.style.display = 'block';
                
                enableInputs(orgRolesGroup, true);
                enableInputs(privateRolesGroup, false);
                enableInputs(regStateSection, false);
                
                // Read roles
                const isProvider = roleOrgProvider && roleOrgProvider.checked;
                const isBenefactor = roleOrgBenefactor && roleOrgBenefactor.checked;
                const isEmployer = roleOrgEmployer && roleOrgEmployer.checked;
                
                const hasAnyRole = isProvider || isBenefactor || isEmployer;
                
                if (hasAnyRole) {
                    if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'block';
                    if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'block';
                    enableInputs(regPartnerGeneralSection, true);
                    enableInputs(regPartnerAgreementsSection, true);
                    
                    // Show contact person since it's an organization
                    if (partnerContactPersonGroup) partnerContactPersonGroup.style.display = 'block';
                    const cpInput = document.getElementById('partner-contact-person');
                    if (cpInput) cpInput.disabled = false;
                } else {
                    if (regPartnerGeneralSection) regPartnerGeneralSection.style.display = 'none';
                    if (regPartnerAgreementsSection) regPartnerAgreementsSection.style.display = 'none';
                    enableInputs(regPartnerGeneralSection, false);
                    enableInputs(regPartnerAgreementsSection, false);
                }
                
                // Services
                if (isProvider) {
                    if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'block';
                    if (partnerPrivateSpecFields) partnerPrivateSpecFields.style.display = 'none';
                    if (partnerOrgProviderFields) partnerOrgProviderFields.style.display = 'block';
                    enableInputs(regPartnerServicesSection, true);
                    enableInputs(partnerPrivateSpecFields, false);
                    enableInputs(partnerOrgProviderFields, true);
                    
                    // Check legal form
                    const lForm = orgLegalForm ? orgLegalForm.value : '';
                    const orgTypeSelect = document.getElementById('org-type');
                    const orgTypeGroup = orgTypeSelect ? orgTypeSelect.closest('.input-group') : null;
                    
                    if (lForm === 'Адвокатське бюро') {
                        if (orgTypeSelect) orgTypeSelect.value = 'Адвокатське бюро';
                        if (orgTypeGroup) orgTypeGroup.style.display = 'none';
                    } else {
                        if (orgTypeGroup) orgTypeGroup.style.display = 'block';
                    }
                    
                    const isNgo = (lForm === 'ГО' || lForm === 'БФ');
                    if (isNgo) {
                        if (orgNgoExtraFields) orgNgoExtraFields.style.display = 'block';
                        if (orgCommercialExtraFields) orgCommercialExtraFields.style.display = 'none';
                        enableInputs(orgNgoExtraFields, true);
                        enableInputs(orgCommercialExtraFields, false);
                    } else {
                        if (orgNgoExtraFields) orgNgoExtraFields.style.display = 'none';
                        if (orgCommercialExtraFields) orgCommercialExtraFields.style.display = 'block';
                        enableInputs(orgNgoExtraFields, false);
                        enableInputs(orgCommercialExtraFields, true);
                    }
                } else {
                    if (regPartnerServicesSection) regPartnerServicesSection.style.display = 'none';
                    enableInputs(regPartnerServicesSection, false);
                }
                
                // Benefactor
                if (isBenefactor) {
                    if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'block';
                    enableInputs(regPartnerBenefactorSection, true);
                } else {
                    if (regPartnerBenefactorSection) regPartnerBenefactorSection.style.display = 'none';
                    enableInputs(regPartnerBenefactorSection, false);
                }
                
                // Employer
                if (isEmployer) {
                    if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'block';
                    enableInputs(regPartnerEmployerSection, true);
                } else {
                    if (regPartnerEmployerSection) regPartnerEmployerSection.style.display = 'none';
                    enableInputs(regPartnerEmployerSection, false);
                }
            } else {
                // No partner type selected yet
                disablePartnerInputs();
            }
        }
    }

    function toggleSpecialistZones() {
        if (!specField) return;
        const val = specField.value;
        const isZone1 = ['psychologist', 'rehabilitation', 'narcologist', 'lawyer_consult'].includes(val);
        
        if (isZone1) {
            if (specZone1Options) specZone1Options.style.display = 'block';
            if (specZone2Options) specZone2Options.style.display = 'none';
            if (specZoneTitle) specZoneTitle.textContent = "Сесійна модель";
            enableInputs(specZone1Options, true);
            enableInputs(specZone2Options, false);
        } else {
            if (specZone1Options) specZone1Options.style.display = 'none';
            if (specZone2Options) specZone2Options.style.display = 'block';
            if (specZoneTitle) specZoneTitle.textContent = "Фіксована підписка";
            enableInputs(specZone1Options, false);
            enableInputs(specZone2Options, true);
            
            const isAdvocate = val === 'advocate';
            if (specBarNumberGroup) specBarNumberGroup.style.display = isAdvocate ? 'block' : 'none';
            const barInput = document.getElementById('spec-bar-number');
            if (barInput) barInput.disabled = !isAdvocate;
        }
    }

    function enableInputs(container, enable) {
        if (!container) return;
        const inputs = container.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            input.disabled = !enable;
            if (enable && input.hasAttribute('data-required')) {
                input.required = true;
            }
        });
    }

    function disablePartnerInputs() {
        disableInputs([
            privateRolesGroup, orgRolesGroup, regPartnerGeneralSection, 
            regPartnerServicesSection, regPartnerBenefactorSection, 
            regPartnerEmployerSection, regStateSection, regPartnerAgreementsSection
        ], true);
    }

    function disableInputs(containers, disable) {
        containers.forEach(container => {
            if (container) {
                container.style.display = 'none';
                const inputs = container.querySelectorAll('input, select, textarea, button');
                inputs.forEach(input => {
                    input.disabled = disable;
                });
            }
        });
    }

    // Set up event listeners
    if (regRoleSelector) {
        regRoleSelector.addEventListener('change', toggleRegistration);
    }
    if (partnerTypeSelector) {
        partnerTypeSelector.addEventListener('change', toggleRegistration);
    }
    if (orgLegalForm) {
        orgLegalForm.addEventListener('change', toggleRegistration);
    }
    if (specField) {
        specField.addEventListener('change', toggleSpecialistZones);
    }

    [rolePrivateSpecialist, rolePrivateBenefactor, rolePrivateEmployer, 
     roleOrgProvider, roleOrgBenefactor, roleOrgEmployer].forEach(cb => {
        if (cb) cb.addEventListener('change', toggleRegistration);
    });

    // Sign method toggle
    function switchPartnerSignMethod(method) {
        const isFile = method === 'file';
        if (partnerPanelFile) partnerPanelFile.style.display = isFile ? 'block' : 'none';
        if (partnerPanelDiia) partnerPanelDiia.style.display = isFile ? 'none' : 'block';
        
        const labelFile = document.getElementById('partner-kep-file-label');
        const labelDiia = document.getElementById('partner-kep-diia-label');
        
        if (labelFile) {
            labelFile.style.border = isFile ? '2px solid var(--primary-color)' : '2px solid var(--border-color)';
            labelFile.style.background = isFile ? 'rgba(46,139,87,0.06)' : 'transparent';
        }
        if (labelDiia) {
            labelDiia.style.border = isFile ? '2px solid var(--border-color)' : '2px solid #111';
            labelDiia.style.background = isFile ? 'transparent' : 'rgba(0,0,0,0.03)';
        }
    }

    partnerSignMethodRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchPartnerSignMethod(e.target.value);
        });
    });

    // Partner Diia Sign click mock
    if (partnerDiiaSignBtn) {
        partnerDiiaSignBtn.addEventListener('click', () => {
            const edrpou = partnerDiiaEdrpou ? partnerDiiaEdrpou.value.trim() : '';
            if (!/^\d{8,10}$/.test(edrpou)) {
                if (partnerDiiaEdrpou) {
                    partnerDiiaEdrpou.style.border = '2px solid var(--danger)';
                    partnerDiiaEdrpou.focus();
                }
                if (partnerDiiaSignStatus) {
                    partnerDiiaSignStatus.style.color = 'var(--danger)';
                    partnerDiiaSignStatus.textContent = '❌ Введіть коректний ЄДРПОУ / ІПН (8–10 цифр)';
                }
                return;
            }
            if (partnerDiiaEdrpou) partnerDiiaEdrpou.style.border = '';

            partnerDiiaSignBtn.disabled = true;
            partnerDiiaSignBtn.style.background = '#ffc107';
            partnerDiiaSignBtn.style.color = '#000';
            partnerDiiaSignBtn.innerHTML = '⏳ Підписання договору через Дія.Підпис...';

            setTimeout(() => {
                partnerDiiaSignToken.value = `DIIA_PARTNER_SIGN_MOCK_${edrpou}_${Date.now()}`;
                partnerDiiaSignBtn.style.background = '#28a745';
                partnerDiiaSignBtn.style.color = '#fff';
                partnerDiiaSignBtn.innerHTML = '✅ Договір підписано через Дія.Підпис';

                if (partnerDiiaSignStatus) {
                    partnerDiiaSignStatus.style.color = 'var(--success, #28a745)';
                    partnerDiiaSignStatus.textContent = `✅ Договір (ФОП/Організація ЄДРПОУ: ${edrpou}) підписано.`;
                }
            }, 3000);
        });
    }

    // Initialize registration views
    toggleRegistration();

    // Register Form Submit Listener
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const mainRole = regRoleSelector ? regRoleSelector.value : 'veteran';

        if (mainRole === 'veteran') {
            // Veteran registration
            const checkVerify = document.getElementById('reg-verify').checked;
            const checkNda = document.getElementById('reg-nda').checked;
            const diiaToken = diiaTokenInput.value;
            
            if (!diiaToken) {
                alert('Будь ласка, пройдіть верифікацію особи через Дію перед реєстрацією.');
                return;
            }
            
            if (!checkVerify || !checkNda) return;

            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const questionId = document.getElementById('reg-question').value;
            const answer = document.getElementById('reg-answer').value;

            const db = getDB();
            if (db[email]) {
                alert('Користувач з таким логіном вже існує!');
                return;
            }

            db[email] = { 
                name, 
                password, 
                questionId, 
                answer: answer.toLowerCase(),
                verified_by: 'DIIA_REGISTRY',
                token: diiaToken
            };
            saveDB(db);

            alert('✅ Профіль ветерана створено! Усі дані захищені та підтверджені. Тепер ви можете увійти.');
            tabLogin.click();
            formRegister.reset();
            
            // Reset Diia button
            diiaBtn.disabled = false;
            diiaBtn.style.background = '#111';
            diiaBtn.innerHTML = '<span style="font-weight: 900; font-family: Outfit; font-size: 18px; letter-spacing: 1px;">Дія.Підпис</span> Пройти верифікацію';
            diiaStatusText.textContent = '⚠️ Очікування верифікації...';
            diiaStatusText.style.color = 'var(--danger)';
            diiaTokenInput.value = '';
            toggleRegistration();
        } else {
            // Partner registration flow
            const partnerType = partnerTypeSelector ? partnerTypeSelector.value : '';
            
            if (!partnerType) {
                alert('Будь ласка, оберіть тип партнера.');
                return;
            }
            
            const formData = new FormData();
            
            if (partnerType === 'state') {
                // State structure
                formData.append('category', 'state');
                formData.append('name', document.getElementById('state-name').value);
                formData.append('address', document.getElementById('state-address').value);
                formData.append('contact_person', document.getElementById('state-contact').value);
                formData.append('phone', document.getElementById('state-phone').value);
                formData.append('bio', document.getElementById('state-services').value);
                formData.append('schedule', document.getElementById('state-schedule').value);
            } else {
                // Private Person or Organization
                const name = document.getElementById('partner-name').value;
                const phone = document.getElementById('partner-phone').value;
                const email = document.getElementById('partner-email').value;
                const address = document.getElementById('partner-address').value;
                const edrpou = document.getElementById('partner-edrpou').value;
                const website = document.getElementById('partner-website').value;
                const bio = document.getElementById('partner-bio').value;
                
                formData.append('name', name);
                formData.append('phone', phone);
                formData.append('email', email);
                formData.append('address', address);
                formData.append('edrpou', edrpou);
                formData.append('website', website);
                formData.append('bio', bio);
                
                const logoInput = document.getElementById('partner-logo');
                if (logoInput && logoInput.files.length > 0) {
                    formData.append('photo', logoInput.files[0]);
                }
                
                // Determine category & subroles
                let category = 'employer'; // default fallback
                const isPrivate = partnerType === 'private_person';
                
                if (isPrivate) {
                    const isSpec = rolePrivateSpecialist && rolePrivateSpecialist.checked;
                    const isBenefactor = rolePrivateBenefactor && rolePrivateBenefactor.checked;
                    const isEmployer = rolePrivateEmployer && rolePrivateEmployer.checked;
                    
                    if (isSpec) {
                        category = 'specialist';
                        
                        // specialist details
                        const sField = specField.value;
                        formData.append('services_list', sField);
                        
                        const isZone1 = ['psychologist', 'rehabilitation', 'narcologist', 'lawyer_consult'].includes(sField);
                        if (isZone1) {
                            formData.append('tariff_plan', document.getElementById('spec-choice-tariff').value === 'stable' ? 'grant_standard' : 'zone1_flexible');
                            formData.append('avg_service_price', document.getElementById('spec-price').value);
                        } else {
                            if (sField === 'lawyer_docs') {
                                formData.append('tariff_plan', 'zone2a_consultant');
                            } else if (sField === 'advocate') {
                                formData.append('tariff_plan', 'zone2b_practitioner');
                                formData.append('court_cases', document.getElementById('spec-bar-number').value); // NAAY number
                            } else {
                                formData.append('tariff_plan', 'zone2b_practitioner');
                            }
                            formData.append('avg_service_price', document.getElementById('spec-avg-price').value);
                            formData.append('discount_format', document.getElementById('spec-discount-format').value);
                        }
                        
                        formData.append('team_size', document.getElementById('spec-exp-years').value); // team_size repurposed as experience
                        formData.append('court_cases', document.getElementById('spec-vet-experience').checked ? 1 : 0); // court_cases repurposed as vet experience boolean
                    } else {
                        category = 'employer';
                    }
                    
                    if (isBenefactor) {
                        // benefactor detail
                        const subcategories = [];
                        if (document.getElementById('help-portal-finance').checked) subcategories.push('Фінансова підтримка');
                        if (document.getElementById('help-portal-promo').checked) subcategories.push('Популяризація');
                        if (document.getElementById('help-veteran-memo').checked) subcategories.push('Меморандум');
                        if (document.getElementById('help-ngo-statute').checked) subcategories.push('Статутна діяльність ГО');
                        formData.append('programs', subcategories.join(', '));
                        formData.append('financial_report_url', document.getElementById('benefactor-details').value);
                    }
                    
                    if (isEmployer) {
                        formData.append('discount_format', document.getElementById('employer-desc').value);
                        formData.append('schedule', document.getElementById('employer-conditions').value);
                    }
                } else {
                    // Organization
                    const isProvider = roleOrgProvider && roleOrgProvider.checked;
                    const isBenefactor = roleOrgBenefactor && roleOrgBenefactor.checked;
                    const isEmployer = roleOrgEmployer && roleOrgEmployer.checked;
                    
                    const lForm = orgLegalForm ? orgLegalForm.value : 'Інше';
                    formData.append('contact_person', document.getElementById('partner-contact-person').value);
                    
                    if (isProvider) {
                        const isNgo = (lForm === 'ГО' || lForm === 'БФ');
                        category = isNgo ? 'ngo' : 'partner';
                        
                        formData.append('services_list', document.getElementById('org-services-list').value);
                        formData.append('team_size', document.getElementById('org-team-size').value);
                        formData.append('schedule', document.getElementById('org-type').value); // org type
                        
                        if (isNgo) {
                            formData.append('tariff_plan', 'zone4_ngo');
                            formData.append('discount_format', document.getElementById('ngo-free-services').value); // free services
                            formData.append('programs', document.getElementById('ngo-programs').value);
                            formData.append('financial_report_url', document.getElementById('ngo-report').value);
                        } else {
                            formData.append('tariff_plan', 'zone3_bureau');
                            formData.append('discount_format', document.getElementById('org-discount').value);
                        }
                    } else {
                        category = 'employer';
                    }
                    
                    if (isBenefactor) {
                        const subcategories = [];
                        if (document.getElementById('help-portal-finance').checked) subcategories.push('Фінансова підтримка');
                        if (document.getElementById('help-portal-promo').checked) subcategories.push('Популяризація');
                        if (document.getElementById('help-veteran-memo').checked) subcategories.push('Меморандум');
                        if (document.getElementById('help-ngo-statute').checked) subcategories.push('Статутна діяльність ГО');
                        formData.append('programs', subcategories.join(', '));
                        formData.append('financial_report_url', document.getElementById('benefactor-details').value);
                    }
                    
                    if (isEmployer) {
                        formData.append('discount_format', document.getElementById('employer-desc').value);
                        formData.append('schedule', document.getElementById('employer-conditions').value);
                    }
                }
                
                formData.append('category', category);
                
                // Document upload (verification cert/statute)
                const docInput = document.getElementById('partner-doc');
                if (docInput && docInput.files.length > 0) {
                    formData.append('document', docInput.files[0]);
                }
            }
            
            // Agreements
            if (partnerType !== 'state') {
                if (!document.getElementById('partner-consent-privacy').checked ||
                    !document.getElementById('partner-consent-agreement').checked) {
                    alert('Будь ласка, погодьтеся з Політикою конфіденційності та Угодою про співпрацю.');
                    return;
                }
                // Signatures
                const chosenMethod = document.querySelector('input[name="partner-sign-method"]:checked')?.value || 'file';
                formData.append('sign_method', chosenMethod);
                
                if (chosenMethod === 'file') {
                    const kepInput = document.getElementById('partner-kep-file');
                    const kepPwd = document.getElementById('partner-kep-password');
                    if (!kepInput || kepInput.files.length === 0) {
                        alert('⚠️ Будь ласка, завантажте ваш файл КЕП (.p12/.pfx/.jks)');
                        return;
                    }
                    formData.append('kep_file', kepInput.files[0]);
                    formData.append('kep_password', kepPwd ? kepPwd.value : '');
                } else {
                    const signToken = partnerDiiaSignToken ? partnerDiiaSignToken.value : '';
                    if (!signToken) {
                        alert('⚠️ Будь ласка, підпишіть договір через Дія.Підпис');
                        return;
                    }
                    formData.append('diia_sign_token', signToken);
                }
            }
            
            const submitBtn = formRegister.querySelector('button[type="submit"]');
            const origBtnText = submitBtn ? submitBtn.textContent : '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Надсилаємо...'; }
            
            try {
                const response = await fetch('/api/register-specialist', { method: 'POST', body: formData });
                const result = await response.json();
                if (result.status === 'success') {
                    const kepMsg = result.kep_signed ? ' Угода підписана вашим КЕПом.' : '';
                    alert("Дякуємо! Заявку партнера надіслано на модерацію. Ми зв'яжемося через Telegram-бот." + kepMsg);
                    formRegister.reset();
                    
                    // Reset signature panel
                    switchPartnerSignMethod('file');
                    if (partnerDiiaSignStatus) {
                        partnerDiiaSignStatus.style.color = 'var(--danger)';
                        partnerDiiaSignStatus.textContent = '⚠️ Не підписано';
                    }
                    if (partnerDiiaSignToken) partnerDiiaSignToken.value = '';
                    if (partnerDiiaSignBtn) {
                        partnerDiiaSignBtn.disabled = false;
                        partnerDiiaSignBtn.style.background = '';
                        partnerDiiaSignBtn.style.color = '';
                        partnerDiiaSignBtn.innerHTML = 'Підписати через Дія.Підпис';
                    }
                    
                    window.location.href = 'index.html';
                } else {
                    alert('Помилка: ' + (result.detail || 'Невідома помилка'));
                }
            } catch (err) {
                console.error('Помилка відправки:', err);
                alert("Помилка з'єднання з сервером. Спробуйте пізніше.");
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
        const hash = window.location.hash;
        const search = window.location.search;
        
        let path = hash || '';
        let paramsStr = search || '';
        
        if (path.includes('?')) {
            const parts = path.split('?');
            path = parts[0];
            paramsStr = '?' + parts[1];
        }
        
        if (path === '#register') {
            resetTabs();
            tabRegister.classList.add('active');
            formRegister.classList.add('active');
        } else if (path === '#specialist') {
            resetTabs();
            tabSpecialist.classList.add('active');
            formSpecialist.classList.add('active');
        } else if (path === '#login') {
            resetTabs();
            tabLogin.classList.add('active');
            formLogin.classList.add('active');
        }
        
        const urlParams = new URLSearchParams(paramsStr);
        const role = urlParams.get('role');
        if (role) {
            const radio = Array.from(roleRadios).find(r => r.value === role);
            if (radio) {
                radio.checked = true;
                toggleRoleFields();
            }
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

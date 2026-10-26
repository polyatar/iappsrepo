const appList = document.getElementById('app-list');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search');

let apps = [];
let currentPage = 1;
let itemsPerPage = 20;
let displayMode = 'time';
let selectedCategory = '';
const maxVisiblePages = 5;

// переводы: словарь живёт в index.html (window.i18n); русский текст — запасной вариант
const T = (key, fallback) => {
    if (!window.i18n) return fallback;
    const value = window.i18n.t(key);
    return value === key ? fallback : value;
};
let loadFailed = false;

fetch('Repo.json')
    .then(response => response.json())
    .then(data => {
        apps = data;
        displayApps();
        updateStatsCounters(apps.length);
    })
    .catch(err => {
        console.error('Error loading apps:', err);
        loadFailed = true;
        renderLoadError();
        updateStatsCounters(150);
    });

function renderLoadError() {
    const isLocalFile = location.protocol === 'file:';
    appList.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
            <p style="font-size: 1.25rem; margin-bottom: 0.5rem;">${T('err.title', 'Не удалось загрузить приложения')}</p>
            <p style="font-size: 0.875rem;">${isLocalFile
                ? T('err.local', 'Откройте сайт через локальный сервер (например, <code>python3 -m http.server</code>) — браузер блокирует fetch для file://')
                : T('err.net', 'Проверьте подключение к интернету')}</p>
        </div>
    `;
}

function animateCounter(element, target, duration = 2000, suffix = '') {
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * easeOut);
        element.textContent = formatNumber(current) + suffix;
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return num.toString();
}

function updateStatsCounters(appsCount) {
    const badgeCount = document.getElementById('badgeCount');
    if (badgeCount) {
        animateCounter(badgeCount, appsCount, 1500);
    }
    
    const statApps = document.getElementById('statApps');
    if (statApps) {
        statApps.dataset.target = appsCount;
        animateCounter(statApps, appsCount, 2000, '+');
    }
    
    const statUsers = document.getElementById('statUsers');
    if (statUsers) {
        const usersTarget = parseInt(statUsers.dataset.target) || 5000;
        animateCounter(statUsers, usersTarget, 2500, '+');
    }
}

document.querySelectorAll('input[name="sortMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        displayMode = this.value;
        currentPage = 1;
        displayApps();
    });
});

document.querySelectorAll('input[name="itemsPerPage"]').forEach(radio => {
    radio.addEventListener('change', function() {
        itemsPerPage = parseInt(this.value, 10);
        currentPage = 1;
        displayApps();
    });
});

document.querySelectorAll('input[name="categoryApps"]').forEach(radio => {
    radio.addEventListener('change', function() {
        selectedCategory = this.value;
        currentPage = 1;
        displayApps();
    });
});

const resetFiltersBtn = document.getElementById('resetFilters');
if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
        selectedCategory = '';
        const allCategoryRadio = document.querySelector('input[name="categoryApps"][value=""]');
        if (allCategoryRadio) allCategoryRadio.checked = true;
        
        itemsPerPage = 20;
        const defaultItemsRadio = document.querySelector('input[name="itemsPerPage"][value="20"]');
        if (defaultItemsRadio) defaultItemsRadio.checked = true;
        
        displayMode = 'time';
        const defaultSortRadio = document.querySelector('input[name="sortMode"][value="time"]');
        if (defaultSortRadio) defaultSortRadio.checked = true;
        
        if (searchInput) searchInput.value = '';
        
        currentPage = 1;
        displayApps();
        
        document.getElementById('settingsModal').classList.remove('active');
        document.body.style.overflow = '';
    });
}

let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        displayApps();
    }, 300);
});

function displayApps() {
    appList.innerHTML = '';
    
    let filteredApps = apps.filter(app => 
        app.appName.toLowerCase().includes(searchInput.value.toLowerCase())
    );

    if (selectedCategory) {
        filteredApps = filteredApps.filter(app => 
            app.appName.toLowerCase().includes(`#${selectedCategory.toLowerCase()}`)
        );
    }

    if (displayMode === 'time') {
        filteredApps.sort((a, b) => new Date(b.appUpdateTime) - new Date(a.appUpdateTime));
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedApps = filteredApps.slice(start, end);

    if (paginatedApps.length === 0) {
        appList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <p style="font-size: 3rem; margin-bottom: 1rem;">🔍</p>
                <p style="font-size: 1.25rem; margin-bottom: 0.5rem;">${T('empty.title', 'Ничего не найдено')}</p>
                <p style="font-size: 0.875rem;">${T('empty.sub', 'Попробуйте изменить параметры поиска')}</p>
            </div>
        `;
        pagination.innerHTML = '';
        return;
    }

    paginatedApps.forEach((app, index) => {
        const cleanedAppName = app.appName.split('\n')[0];
        const formattedDescription = app.appDescription.replace(/\n/g, '<br>');
        const delay = index * 0.05;
        // версия и размер — плашками, как на постерах (значения, которые не удалось разобрать, не показываем)
        const vi = parseAppVersion(app.appVersion);
        const pills = [[META_ICONS.version, vi.version], [META_ICONS.size, vi.size]]
            .filter(p => p[1] && p[1] !== 'N/A')
            .map(p => `<span class="app-pill">${p[0]}<span>${p[1]}</span></span>`).join('');

        const appItem = document.createElement('div');
        appItem.className = 'app-item';
        appItem.style.animationDelay = `${delay}s`;
        appItem.style.cursor = 'pointer';
        appItem.innerHTML = `
            <div class="app-header">
                <img src="${app.appImage}" alt="${cleanedAppName}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%236366f1%22 width=%22100%22 height=%22100%22 rx=%2220%22/><text x=%2250%22 y=%2255%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22white%22>📱</text></svg>'">
                <div class="app-header__info">
                    <h3>${cleanedAppName}</h3>
                    <div class="app-pills">${pills}</div>
                </div>
                <span class="app-item__go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"/></svg></span>
            </div>
            <hr>
            <p class="app-description">${formattedDescription}</p>
        `;
        appItem.addEventListener('click', () => openAppModal(app));
        appList.appendChild(appItem);
    });

    setupPagination(filteredApps);
}

function setupPagination(filteredApps) {
    pagination.innerHTML = '';
    const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
    
    if (totalPages <= 1) return;

    const scrollToApps = () => {
        document.getElementById('apps').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (currentPage > 2) {
        createPaginationBtn('«', () => { currentPage = 1; displayApps(); scrollToApps(); });
    }

    if (currentPage > 1) {
        createPaginationBtn('‹', () => { currentPage--; displayApps(); scrollToApps(); });
    }

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = createPaginationBtn(i, () => {
            currentPage = i;
            displayApps();
            scrollToApps();
        });
        if (currentPage === i) btn.disabled = true;
    }

    if (currentPage < totalPages) {
        createPaginationBtn('›', () => { currentPage++; displayApps(); scrollToApps(); });
    }

    if (currentPage < totalPages - 1) {
        createPaginationBtn('»', () => { currentPage = totalPages; displayApps(); scrollToApps(); });
    }
}

function createPaginationBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.addEventListener('click', onClick);
    pagination.appendChild(btn);
    return btn;
}


const appModal = document.getElementById('appModal');
const appModalBackdrop = document.getElementById('appModalBackdrop');
const closeAppModalBtn = document.getElementById('closeAppModal');
const appModalBody = document.getElementById('appModalBody');
const appModalTitle = document.getElementById('appModalTitle');

function parseAppVersion(versionStr) {
    const parts = versionStr.split('|').map(p => p.trim());
    let version = 'N/A';
    let size = 'N/A';
    let ios = 'N/A';
    
    for (const part of parts) {
        if (/\d\s*(kb|mb|gb|tb)\b/i.test(part)) {
            size = part;
        } else if (/ios/i.test(part)) {
            ios = part.replace(/ios\s*/i, '').trim();
        } else if (part && version === 'N/A') {
            version = part;
        }
    }
    
    return { version, size, ios };
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(T('date.locale', 'ru-RU'), { day: 'numeric', month: 'long', year: 'numeric' });
}

// все теги вида #Games #Social в названии приложения (у приложения может быть несколько категорий)
const CATEGORY_EMOJI = {
    Russia: '🇷🇺', Social: '💬', Music: '🎵', Video: '🎬', Design: '🎨', Network: '🌍', Study: '📚',
    Office: '📋', Games: '🎮', Kids: '👶', Life: '💪', Money: '💰', Travel: '✈️', Themes: '🖼️', Other: '📦'
};
const CATEGORY_ALIASES = { networke: 'Network' };

function getAppCategories(appName) {
    const found = [];
    const seen = new Set();
    const re = /#([A-Za-z0-9_]+)/g;
    let match;
    while ((match = re.exec(appName)) !== null) {
        const raw = match[1];
        const known = CATEGORY_ALIASES[raw.toLowerCase()]
            || Object.keys(CATEGORY_EMOJI).find(k => k.toLowerCase() === raw.toLowerCase());
        const key = known || raw;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ key, name: T('cat.' + key, key), emoji: CATEGORY_EMOJI[key] || '🏷️' });
    }
    if (!found.length) found.push({ key: 'Other', name: T('cat.Other', 'Other'), emoji: '📦' });
    return found;
}

// иконки для плиток «iOS / Размер / Версия»: тонкая линия, небесно-голубой цвет
const META_ICONS = {
    ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.2 5.7h3.6"/><path d="M10.5 18.3h3"/></svg>',
    size: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.2 5.1 4.6A1.5 1.5 0 0 1 6.5 3.7h11a1.5 1.5 0 0 1 1.4.9l1.6 3.6"/><rect x="3.5" y="8.2" width="17" height="12.3" rx="2"/><path d="M9.8 12.6h4.4"/></svg>',
    version: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.1V5A1.5 1.5 0 0 1 5 3.5h7.1a1.5 1.5 0 0 1 1.06.44l7.4 7.4a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.4-7.4A1.5 1.5 0 0 1 3.5 12.1z"/><circle cx="8" cy="8" r="1.3"/></svg>'
};

// ---- цвет окна приложения: берём из иконки; если браузер не даёт прочитать картинку, цвет получается из названия ----
const appColorCache = new Map();
const mixRgb = (a, b, k) => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];

function hashColor(name) {
    let hsh = 0;
    for (let i = 0; i < name.length; i += 1) hsh = (hsh * 31 + name.charCodeAt(i)) >>> 0;
    const h = (hsh % 360) / 360, s = 0.62, l = 0.5;
    const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function extractIconColor(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(null); return; }
        const img = new Image();
        const timer = setTimeout(() => resolve(null), 4000);
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            clearTimeout(timer);
            try {
                const S = 40, c = document.createElement('canvas');
                c.width = c.height = S;
                const g = c.getContext('2d', { willReadFrequently: true });
                g.drawImage(img, 0, 0, S, S);
                const d = g.getImageData(0, 0, S, S).data;
                let r = 0, gr = 0, b = 0, wsum = 0;
                for (let i = 0; i < d.length; i += 4) {
                    if (d[i + 3] < 128) continue;
                    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
                    const lum = (mx + mn) / 510, sat = mx ? (mx - mn) / mx : 0;
                    if (lum > 0.93 || lum < 0.06) continue;             // белый и чёрный фон иконки не считаем
                    const w = 0.15 + sat * sat * 2;
                    r += d[i] * w; gr += d[i + 1] * w; b += d[i + 2] * w; wsum += w;
                }
                if (wsum < 1) { resolve(null); return; }
                let col = [Math.round(r / wsum), Math.round(gr / wsum), Math.round(b / wsum)];
                const mx = Math.max(...col), mn = Math.min(...col);
                if (mx && (mx - mn) / mx < 0.18) col = mixRgb(col, [99, 102, 241], 0.5);   // серые иконки чуть подкрашиваем цветом сайта
                resolve(col);
            } catch (e) { resolve(null); }                              // браузер запретил чтение картинки (CORS)
        };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = url;
    });
}

function applyAppColor(rgb) {
    const box = appModal.querySelector('.modal__content--app');
    if (!box) return;
    const m = (k) => mixRgb(rgb, [0, 0, 0], k).join(',');
    box.style.setProperty('--app-rgb', rgb.join(','));
    box.style.setProperty('--app-top', 'rgb(' + m(0.28) + ')');
    box.style.setProperty('--app-bot', 'rgb(' + m(0.72) + ')');
    box.style.setProperty('--app-dark', 'rgb(' + m(0.55) + ')');
}

function renderAppModal(app) {
    const cleanedAppName = app.appName.split('\n')[0];
    const versionInfo = parseAppVersion(app.appVersion);
    const categories = getAppCategories(app.appName);
    
    const initial = hashColor(cleanedAppName);

    appModalTitle.textContent = cleanedAppName;
    appModalBody.innerHTML = `
        <div class="app-detail">
            <div class="app-detail__header">
                <img class="app-detail__icon" src="${app.appImage}" alt="${cleanedAppName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%236366f1%22 width=%22100%22 height=%22100%22 rx=%2220%22/><text x=%2250%22 y=%2255%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22white%22>📱</text></svg>'">
                <div class="app-detail__info">
                    <h2 class="app-detail__name">${cleanedAppName}</h2>
                    <div class="app-detail__categories">${categories.map(c => `<span class="app-detail__category">${c.emoji} ${c.name}</span>`).join('')}</div>
                </div>
            </div>
            <div class="app-detail__meta">
                <div class="app-detail__meta-item">
                    <span class="app-detail__meta-icon">${META_ICONS.ios}</span>
                    <span class="app-detail__meta-text"><span class="app-detail__meta-value">${versionInfo.ios}</span><span class="app-detail__meta-label">iOS</span></span>
                </div>
                <div class="app-detail__meta-item">
                    <span class="app-detail__meta-icon">${META_ICONS.size}</span>
                    <span class="app-detail__meta-text"><span class="app-detail__meta-value">${versionInfo.size}</span><span class="app-detail__meta-label">${T('app.size', 'Размер')}</span></span>
                </div>
                <div class="app-detail__meta-item">
                    <span class="app-detail__meta-icon">${META_ICONS.version}</span>
                    <span class="app-detail__meta-text"><span class="app-detail__meta-value">${versionInfo.version}</span><span class="app-detail__meta-label">${T('app.version', 'Версия')}</span></span>
                </div>
            </div>
            <button type="button" class="btn btn--primary btn--full app-detail__access" id="appGetAccess">
                <span>${T('app.access', 'Получить доступ')}</span>
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"/></svg>
            </button>
            <div class="app-detail__section">
                <h3 class="app-detail__section-title">${T('app.desc', 'Описание')}</h3>
                <p class="app-detail__description">${app.appDescription}</p>
            </div>
            <div class="app-detail__updated">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-8h4v2h-6V7h2v5z"/></svg>
                <span>${T('app.updated', 'Обновлено:')} ${formatDate(app.appUpdateTime)}</span>
            </div>
        </div>
    `;

    // цвет окна: сразу из кэша (или по названию), затем уточняем по иконке
    const cacheKey = app.appImage || cleanedAppName;
    const cached = appColorCache.get(cacheKey);
    applyAppColor(cached || initial);
    if (!cached) {
        extractIconColor(app.appImage).then((col) => {
            const color = col || initial;
            appColorCache.set(cacheKey, color);
            if (currentApp === app && appModal.classList.contains('active')) applyAppColor(color);
        });
    }

    const accessBtn = document.getElementById('appGetAccess');
    if (accessBtn) {
        accessBtn.addEventListener('click', () => {
            closeAppModal();
            const target = document.getElementById('pricing');
            if (target) {
                // даём странице вернуться на место после закрытия окна, затем плавно едем к тарифам
                requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }
        });
    }

}

let currentApp = null;

function openAppModal(app) {
    currentApp = app;
    renderAppModal(app);
    if (!document.body.classList.contains('modal-open')) {
        appModalScrollPosition = window.pageYOffset;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${appModalScrollPosition}px`;
    }
    appModal.classList.add('active');
}

let appModalScrollPosition = 0;

function closeAppModal() {
    appModal.classList.remove('active');
    if (!document.querySelector('.modal.active')) {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo({ top: appModalScrollPosition, left: 0, behavior: 'instant' });
    }
}

closeAppModalBtn.addEventListener('click', closeAppModal);
appModalBackdrop.addEventListener('click', closeAppModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && appModal.classList.contains('active')) {
        closeAppModal();
    }
});

// смена языка: перерисовываем список и открытое окно приложения
document.addEventListener('iapps:lang', () => {
    if (loadFailed) renderLoadError(); else displayApps();
    if (currentApp && appModal.classList.contains('active')) renderAppModal(currentApp);
});

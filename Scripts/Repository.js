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

// Repo.json грузим «свежим»: адрес меняется раз в минуту, а браузер перед использованием копии всегда проверяет её на сервере.
// Так новый файл появляется после одного обновления страницы, а не после нескольких (раньше мешали кэш браузера и CDN).
fetch('Repo.json?v=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' })
    .then(response => response.json())
    .then(data => {
        apps = data;
    prepApps();
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

// названия в нижнем регистре и время обновления считаются один раз при загрузке, а не при каждом поиске и сортировке
function prepApps() {
    for (const a of apps) { a._ln = String(a.appName || '').toLowerCase(); a._ts = Date.parse(a.appUpdateTime) || 0; }
}

function displayApps() {
    appList.innerHTML = '';
    
    const q = searchInput.value.toLowerCase();
    let filteredApps = q ? apps.filter(app => app._ln.includes(q)) : apps.slice();

    if (selectedCategory) {
        const tag = `#${selectedCategory.toLowerCase()}`;
        filteredApps = filteredApps.filter(app => app._ln.includes(tag));
    }

    if (displayMode === 'time') {
        filteredApps.sort((a, b) => b._ts - a._ts);
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedApps = filteredApps.slice(start, end);

    if (paginatedApps.length === 0) {
        appList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <div class="empty-ico">${SEARCH_ICON}</div>
                <p style="font-size: 1.25rem; margin-bottom: 0.5rem;">${T('empty.title', 'Ничего не найдено')}</p>
                <p style="font-size: 0.875rem;">${T('empty.sub', 'Попробуйте изменить параметры поиска')}</p>
                <button type="button" class="suggest-btn" id="suggestOpen">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                    <span>${T('suggest.btn', 'Предложить приложение')}</span>
                </button>
            </div>
        `;
        const suggestBtn = document.getElementById('suggestOpen');
        if (suggestBtn) suggestBtn.addEventListener('click', () => { if (window.openSuggest) window.openSuggest(searchInput.value.trim()); });
        pagination.innerHTML = '';
        return;
    }

    paginatedApps.forEach((app, index) => {
        const cleanedAppName = app.appName.split('\n')[0];
        const formattedDescription = app.appDescription.replace(/\n/g, '<br>');
        const delay = Math.min(index * 0.04, 0.32);   // раньше на 100 карточках последняя появлялась только через 5 секунд
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
                <img src="${app.appImage}" data-orig="${app.appImage}" alt="${cleanedAppName}" loading="lazy" decoding="async" onerror="iconFallback(this)">
                <div class="app-header__info">
                    <h3>${cleanedAppName}</h3>
                    <div class="app-pills">${pills}</div>
                </div>
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
const ICO = (inner) => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + '</svg>';
const CATEGORY_ICON = {
    Russia: ICO("<path d='M4 6.5h16v3H4z'/><path d='M5.5 9.5V17a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9.5'/><path d='M10 13h4'/>"),
    Social: ICO("<path d='M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H13l-4.5 3.5V17H5.5A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z'/>"),
    Music: ICO("<path d='M9 17.5V6l10-2v11.5'/><circle cx='6.5' cy='17.5' r='2.5'/><circle cx='16.5' cy='15.5' r='2.5'/>"),
    Video: ICO("<rect x='3.5' y='5' width='17' height='14' rx='3'/><path d='m10.3 9.4 4.4 2.6-4.4 2.6V9.4z'/>"),
    Design: ICO("<path d='M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.9-1.8 0-1.5-1.3-1.7-1.3-2.9 0-.9.7-1.5 1.6-1.5H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.8 16.8 3.5 12 3.5z'/><path d='M7.8 11h.01M11 7.6h.01M15.4 8.6h.01' stroke-width='2.2'/>"),
    Network: ICO("<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9S14.6 18.3 12 21c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z'/>"),
    Study: ICO("<path d='M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15z'/><path d='M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15z'/>"),
    Office: ICO("<rect x='4' y='7.5' width='16' height='12' rx='2.2'/><path d='M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M4 12.5h16'/>"),
    Games: ICO("<path d='M7.5 8h9A4.5 4.5 0 0 1 21 12.5l-.6 3.4a2.2 2.2 0 0 1-3.8 1.1L15 15H9l-1.6 2a2.2 2.2 0 0 1-3.8-1.1L3 12.5A4.5 4.5 0 0 1 7.5 8z'/><path d='M8 10.5v3M6.5 12h3'/><path d='M15.4 11.6h.01M17.6 13.2h.01' stroke-width='2.2'/>"),
    Kids: ICO("<circle cx='12' cy='12' r='8.5'/><path d='M8.6 14a4.2 4.2 0 0 0 6.8 0'/><path d='M9.2 9.8h.01M14.8 9.8h.01' stroke-width='2.2'/>"),
    Life: ICO("<path d='M12 20s-7.2-4.5-7.2-10A4.1 4.1 0 0 1 12 7.6 4.1 4.1 0 0 1 19.2 10C19.2 15.5 12 20 12 20z'/><path d='M8.4 12.2h2l1.1-2.2 1.8 3.8 1-1.6h1.3'/>"),
    Money: ICO("<path d='M4 8a2 2 0 0 1 2-2h11a1.5 1.5 0 0 1 1.5 1.5V9'/><path d='M4 8v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6.5a1.5 1.5 0 0 0-1.5-1.5H6A2 2 0 0 1 4 8z'/><path d='M16.2 14h.01' stroke-width='2.2'/>"),
    Travel: ICO("<path d='M3.2 10.8 20.8 3.5l-7 17.3-2.7-7.2-7.9-2.8z'/><path d='m11.1 13.6 9.7-10.1'/>"),
    Themes: ICO("<rect x='4' y='4.5' width='16' height='15' rx='2.5'/><path d='m4 15.5 4.2-4.2a1.5 1.5 0 0 1 2.1 0l5.2 5.2M13.6 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15.5'/><path d='M9 8.8h.01' stroke-width='2.2'/>"),
    Other: ICO("<circle cx='12' cy='12' r='9'/><path d='M8.2 12h.01M12 12h.01M15.8 12h.01' stroke-width='2.4'/>")
};
const TAG_ICON = ICO("<path d='M3.5 12.1V5.5a2 2 0 0 1 2-2h6.6a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0L4.1 13.5a2 2 0 0 1-.6-1.4z'/><path d='M8 8h.01' stroke-width='2.2'/>");
const SEARCH_ICON = ICO("<circle cx='10.5' cy='10.5' r='6.5'/><path d='m15.5 15.5 5 5'/>");
const CATEGORY_ALIASES = { networke: 'Network' };

function getAppCategories(appName) {
    const found = [];
    const seen = new Set();
    const re = /#([A-Za-z0-9_]+)/g;
    let match;
    while ((match = re.exec(appName)) !== null) {
        const raw = match[1];
        const known = CATEGORY_ALIASES[raw.toLowerCase()]
            || Object.keys(CATEGORY_ICON).find(k => k.toLowerCase() === raw.toLowerCase());
        const key = known || raw;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ key, name: T('cat.' + key, key), icon: CATEGORY_ICON[key] || TAG_ICON });
    }
    if (!found.length) found.push({ key: 'Other', name: T('cat.Other', 'Other'), icon: CATEGORY_ICON.Other });
    return found;
}

// иконки для плиток «iOS / Размер / Версия»: тонкая линия, небесно-голубой цвет
const META_ICONS = {
    ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.2 5.7h3.6"/><path d="M10.5 18.3h3"/></svg>',
    size: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.2 5.1 4.6A1.5 1.5 0 0 1 6.5 3.7h11a1.5 1.5 0 0 1 1.4.9l1.6 3.6"/><rect x="3.5" y="8.2" width="17" height="12.3" rx="2"/><path d="M9.8 12.6h4.4"/></svg>',
    version: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.1V5A1.5 1.5 0 0 1 5 3.5h7.1a1.5 1.5 0 0 1 1.06.44l7.4 7.4a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.4-7.4A1.5 1.5 0 0 1 3.5 12.1z"/><circle cx="8" cy="8" r="1.3"/></svg>'
};

// ---- иконки на GitHub: файлы из релизов отдаются как application/octet-stream, и браузер часто не показывает их как картинки.
// Если иконка не загрузилась, пробуем тот же адрес через прокси-сервис изображений, и только потом ставим заглушку.
const ICON_PLACEHOLDER = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%232a7cf5' width='100' height='100' rx='20'/><rect x='33' y='22' width='34' height='56' rx='9' fill='none' stroke='white' stroke-width='4.5'/><path d='M44 32h12M45 68h10' stroke='white' stroke-width='4.5' stroke-linecap='round'/></svg>";
function iconProxies(url) {
    const enc = encodeURIComponent(url);
    return ['https://wsrv.nl/?url=' + enc + '&w=256&h=256&fit=cover&output=png', 'https://images.weserv.nl/?url=' + enc + '&w=256&h=256&fit=cover&output=png'];
}
function iconFallback(img) {
    const orig = img.dataset.orig || '';
    const stage = Number(img.dataset.stage || 0);
    const list = /^https?:/i.test(orig) ? iconProxies(orig) : [];
    if (stage < list.length) { img.dataset.stage = String(stage + 1); img.src = list[stage]; return; }
    img.onerror = null;
    img.src = ICON_PLACEHOLDER;
}
window.iconFallback = iconFallback;

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
                if (mx && (mx - mn) / mx < 0.18) col = mixRgb(col, [42, 124, 245], 0.5);   // серые иконки чуть подкрашиваем цветом сайта
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

// карточку приложения нельзя «оттянуть» за верхний и нижний край (иначе открывается пустота): остаётся только прокрутка описания
(function lockModalOverscroll() {
    const box = appModal.querySelector('.modal__content--app');
    if (!box) return;
    let lastY = 0;
    box.addEventListener('touchstart', (e) => { lastY = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchmove', (e) => {
        const y = e.touches[0].clientY, step = y - lastY;
        lastY = y;
        const atTop = box.scrollTop <= 0, atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
        const noScroll = box.scrollHeight <= box.clientHeight + 1;
        if ((noScroll || (atTop && step > 0) || (atBottom && step < 0)) && e.cancelable) e.preventDefault();
    }, { passive: false });
})();

// значения в плашках iOS / размер / версия не должны обрезаться: если не помещаются, включаем более плотные ступени
function fitMetaPills() {
    const meta = appModalBody.querySelector('.app-detail__meta');
    if (!meta) return;
    meta.classList.remove('is-tight', 'is-tighter');
    const cut = () => [...meta.querySelectorAll('.app-detail__meta-value')].some(v => v.scrollWidth > v.clientWidth + 0.5);
    if (cut()) { meta.classList.add('is-tight'); if (cut()) meta.classList.add('is-tighter'); }
}
window.addEventListener('resize', fitMetaPills);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMetaPills);

function renderAppModal(app) {
    const cleanedAppName = app.appName.split('\n')[0];
    const versionInfo = parseAppVersion(app.appVersion);
    const categories = getAppCategories(app.appName);
    
    const initial = hashColor(cleanedAppName);

    appModalTitle.textContent = cleanedAppName;
    appModalBody.innerHTML = `
        <div class="app-detail">
            <div class="app-detail__header">
                <img class="app-detail__icon" src="${app.appImage}" data-orig="${app.appImage}" alt="${cleanedAppName}" onerror="iconFallback(this)">
                <div class="app-detail__info">
                    <h2 class="app-detail__name">${cleanedAppName}</h2>
                    <div class="app-detail__categories">${categories.map(c => `<span class="app-detail__category">${c.icon}<span>${c.name}</span></span>`).join('')}</div>
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

    fitMetaPills();

    // цвет окна: сразу из кэша (или по названию), затем уточняем по иконке
    const cacheKey = app.appImage || cleanedAppName;
    const cached = appColorCache.get(cacheKey);
    applyAppColor(cached || initial);
    if (!cached) {
        extractIconColor(app.appImage).then((col) => col || (/^https?:/i.test(app.appImage || '') ? extractIconColor(iconProxies(app.appImage)[0]) : null)).then((col) => {
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

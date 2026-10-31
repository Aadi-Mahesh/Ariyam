/* Ariyam map. ES module; Leaflet (L) and markercluster load as classic scripts first. */

const CONFIG = {
    dataUrl: 'map_locs.json',
    /* local copy first (npm install), then CDN; plain search if both fail */
    fuseSources: [
        './vendor/fuse.min.mjs',
        'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs'
    ],
    initialView: { center: [10.8505, 76.2711], zoom: 7 },
    southIndia: { minLat: 7.5, maxLat: 14.5, minLng: 74, maxLng: 81 },
    theme: {
        key: 'arivu-theme',            /* shared with Arivu */
        legacyKey: 'darkMode',
        light: '#f5ecd6',              /* --paper */
        dark: '#18160f'                /* --paper (dark) */
    },
    phoneQuery: '(max-width: 640px)'
};

const TYPE_PIN = {
    'Robotics': 'pin-robotics',
    'Space': 'pin-space',
    'Science Centre': 'pin-sciencec',
    'Deep Tech': 'pin-dtech',
    'Biotech': 'pin-biotech',
    'Marine Science': 'pin-marine'
};
/* Arivu has four badge colours for six categories, so some share one */
const ACCESS = {
    open: 'Open to visitors',
    events: 'Open days only',
    appointment: 'Call ahead',
    register: 'Register first'
};
const TYPE_BADGE = {
    'Robotics': 'pc-badge-diff-advanced',
    'Space': 'pc-badge-exam',
    'Science Centre': 'pc-badge-diff-beginner',
    'Deep Tech': 'pc-badge-diff-intermediate',
    'Biotech': 'pc-badge-diff-beginner',
    'Marine Science': 'pc-badge-exam'
};

const $ = (id) => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => window.matchMedia(CONFIG.phoneQuery).matches;
const hasFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode, storage full */ } }
};

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}
function badgeHtml(type) {
    return '<span class="pc-badge ' + (TYPE_BADGE[type] || 'pc-badge-exam') + '">' + esc(type || 'Location') + '</span>';
}
function debounce(fn, wait = 180) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}
function distanceKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
/* only http(s) goes into an href */
function safeUrl(u) {
    try { const x = new URL(u, window.location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; }
    catch (e) { return ''; }
}

let toastContainer = null;
window.arivuToast = function (msg, type, duration) {
    type = type || 'info';
    duration = duration || 2800;
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.id = 'toast-container';
        toastContainer.setAttribute('role', 'status');
        toastContainer.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastContainer);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    toastContainer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, duration);
};
const toast = window.arivuToast;

let Fuse = null;
for (const src of CONFIG.fuseSources) {
    try { Fuse = (await import(src)).default; break; }
    catch (e) { /* try the next source */ }
}
if (!Fuse) console.warn('Fuse.js could not be loaded; using plain substring search.');

if (typeof L === 'undefined') {
    $('map').innerHTML = '<p style="padding:2rem;font-family:var(--sans);color:var(--ink)"><strong>The map library (Leaflet) could not load.</strong><br>Check your internet connection, then reload.</p>';
    console.error('Leaflet (L) is undefined: leaflet.js did not load.');
    throw new Error('Leaflet not loaded');
}

/* markercluster throws without a map-level maxZoom */
const map = L.map('map', { zoomControl: false, maxZoom: 19, minZoom: 5 })
    .setView(CONFIG.initialView.center, CONFIG.initialView.zoom);
L.control.zoom({ position: 'bottomright' }).addTo(map); /* top-left sits under the sidebar */

const hasCluster = typeof L.markerClusterGroup === 'function';
if (!hasCluster) console.warn('leaflet.markercluster did not load: showing plain pins');
const cluster = hasCluster
    ? L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        iconCreateFunction(c) {
            const n = c.getChildCount();
            const size = n < 10 ? 'sm' : (n < 100 ? 'md' : 'lg');
            const px = { sm: 38, md: 44, lg: 52 }[size];
            return L.divIcon({
                html: '<span>' + n + '</span><span class="sr-only"> places</span>',
                className: 'ariyam-cluster ariyam-cluster--' + size,
                iconSize: [px, px]
            });
        }
    })
    : Object.assign(L.layerGroup(), {
        addLayers(a) { a.forEach((m) => this.addLayer(m)); },
        removeLayers(a) { a.forEach((m) => this.removeLayer(m)); }
    });
map.addLayer(cluster);

const lightLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
});
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
});

const themeToggle = $('theme-toggle');
const themeLabel = $('theme-label');
const metaThemeColor = $('meta-theme-color');
const rootEl = document.documentElement;

function syncTiles(dark) {
    const on = dark ? darkLayer : lightLayer, off = dark ? lightLayer : darkLayer;
    if (map.hasLayer(off)) map.removeLayer(off);
    if (!map.hasLayer(on)) on.addTo(map);
}
function syncThemeChrome(dark) {
    themeLabel.textContent = dark ? 'Light mode' : 'Dark mode';
    themeToggle.setAttribute('aria-label', themeLabel.textContent);
    metaThemeColor.setAttribute('content', dark ? CONFIG.theme.dark : CONFIG.theme.light);
}
function applyTheme(dark, { save = true, transition = true } = {}) {
    if (transition && !reducedMotion()) rootEl.classList.add('theme-transitioning');
    rootEl.classList.toggle('dark', dark);
    syncThemeChrome(dark);
    syncTiles(dark);
    if (save) store.set(CONFIG.theme.key, dark ? 'dark' : 'light');
    if (transition) setTimeout(() => rootEl.classList.remove('theme-transitioning'), 420);
}
themeToggle.addEventListener('click', () => {
    const nowDark = !rootEl.classList.contains('dark');
    applyTheme(nowDark);
    toast(nowDark ? 'Dark mode on' : 'Light mode on', 'info', 1500);
});
/* the <head> script already set html.dark; sync label, meta colour and tiles */
applyTheme(rootEl.classList.contains('dark'), { save: false, transition: false });
/* follow the OS setting until the visitor picks one */
const osDark = window.matchMedia('(prefers-color-scheme: dark)');
const onOsChange = (e) => { if (!store.get(CONFIG.theme.key)) applyTheme(e.matches, { save: false }); };
if (osDark.addEventListener) osDark.addEventListener('change', onOsChange); else if (osDark.addListener) osDark.addListener(onOsChange);

let locations = [];          /* [{ ...data, marker, shown }] */
let fuseSearch = null;
let currentLoc = null;
let userPos = null;
let userMarker = null;
let returnFocusTo = null;

const welcome = $('welcome-screen-modal');
const locBackdrop = $('loc-modal-backdrop');
const locImg = $('loc-modal-img');
const locName = $('loc-modal-name');
const locInst = $('loc-modal-inst');
const locBadges = $('loc-modal-badges');
const locDesc = $('loc-modal-desc');
const locMeta = $('loc-modal-meta');
const locDirections = $('loc-modal-directions');
const locWebsite = $('loc-modal-website');
const locCredit = $('loc-modal-credit');
const locClose = $('loc-modal-close');
const baseTitle = document.title;

const findLoc = (id) => locations.find((x) => x.id === id);
const isOpen = (el) => el.classList.contains('show');

/* everything behind an open dialog is inert */
const backgroundEls = ['dock', 'dock-tab', 'map'].map($).concat(document.querySelector('.map-top-right'));
function syncInert() {
    const modalOpen = isOpen(welcome) || isOpen(locBackdrop);
    backgroundEls.forEach((el) => { if (el) el.inert = modalOpen; });
}

function closeWelcome() {
    const wasOpen = isOpen(welcome);
    welcome.classList.remove('show');
    syncInert();
    store.set('ariyam-seen', '1');
    if (wasOpen) locateUser();
}
$('welcome-start').addEventListener('click', closeWelcome);
setTimeout(() => { if (isOpen(welcome)) $('welcome-start').focus(); }, 100);
if (rootEl.classList.contains('seen')) welcome.classList.remove('show');
syncInert();

function clearHash() {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
}

function openLocsModal(id, trigger) {
    const loc = findLoc(id);
    if (!loc) return;
    currentLoc = loc;
    returnFocusTo = trigger || document.activeElement;
    const hasLong = !!loc.longDesc;

    if (loc.img) {
        locImg.src = loc.img;
        locImg.alt = loc.name || '';
        locImg.style.display = 'block';
        locImg.onerror = () => { locImg.style.display = 'none'; locCredit.hidden = true; };
    } else {
        locImg.removeAttribute('src');
        locImg.style.display = 'none';
    }
    const credit = safeUrl(loc.imgSource);
    locCredit.hidden = !(loc.img && credit);
    if (credit) locCredit.href = credit;
    locName.textContent = loc.name || '';
    locInst.textContent = hasLong ? (loc.shortDesc || '') : '';
    locInst.hidden = !locInst.textContent;
    locDesc.textContent = hasLong ? loc.longDesc : (loc.shortDesc || '');
    locDesc.hidden = !locDesc.textContent;
    locBadges.innerHTML = badgeHtml(loc.type);

    let meta = '';
    if (ACCESS[loc.access]) {
        meta += '<div class="modal-meta-item"><span class="label-sm">Visiting</span><span class="value-sm">' + ACCESS[loc.access] + '</span></div>';
    }
    if (loc.place) {
        meta += '<div class="modal-meta-item"><span class="label-sm">Where</span><span class="value-sm">' + esc(loc.place) + '</span></div>';
    }
    if (userPos) {
        meta += '<div class="modal-meta-item"><span class="label-sm">From you</span><span class="value-sm">~' +
            Math.round(distanceKm(userPos, loc.coords)).toLocaleString() + ' km</span></div>';
    }
    meta += '<div class="modal-meta-item"><span class="label-sm">Coordinates</span><span class="value-sm mono">' +
        loc.coords[0].toFixed(4) + ', ' + loc.coords[1].toFixed(4) + '</span></div>';
    locMeta.innerHTML = meta;

    locDirections.href = 'https://www.google.com/maps/dir/?api=1&destination=' + loc.coords[0] + ',' + loc.coords[1];
    const site = safeUrl(loc.website);
    locWebsite.hidden = !site;
    if (site) locWebsite.href = site;

    document.title = (loc.name || 'Location') + ' - Ariyam';
    history.replaceState(null, '', '#' + encodeURIComponent(loc.id));

    locBackdrop.classList.add('show');
    syncInert();
    setTimeout(() => locClose.focus(), 100);
}

function closeLocsModal() {
    if (!isOpen(locBackdrop)) return;
    locBackdrop.classList.remove('show');
    syncInert();
    document.title = baseTitle;
    clearHash();
    /* the popup button is gone, so fall back to the pin */
    const target = (returnFocusTo && returnFocusTo.isConnected && returnFocusTo.focus)
        ? returnFocusTo
        : (currentLoc && currentLoc.marker && currentLoc.marker.getElement && currentLoc.marker.getElement());
    if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}

function showDetails(id, trigger) {
    map.closePopup();
    openLocsModal(id, trigger);
}

locClose.addEventListener('click', closeLocsModal);
$('loc-modal-close2').addEventListener('click', closeLocsModal);
locBackdrop.addEventListener('click', (e) => { if (e.target === locBackdrop) closeLocsModal(); });

/* native share sheet, else copy the link */
function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
        ta.remove();
        ok ? resolve() : reject(new Error('copy failed'));
    });
}
$('loc-modal-share').addEventListener('click', async () => {
    if (!currentLoc) return;
    const name = currentLoc.name || 'Ariyam location';
    const url = window.location.href.split('#')[0] + '#' + encodeURIComponent(currentLoc.id);
    const text = name + ' on Ariyam';
    if (navigator.share) {
        try { await navigator.share({ title: name, text, url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; /* otherwise fall through to copying */ }
    }
    try {
        await copyText(text + ' ' + url);
        toast('Link copied', 'success', 1800);
    } catch (e) {
        toast('Could not copy. Use the address bar link instead.', 'warn', 2800);
    }
});

/* Esc closes the dialog or phone drawer; Tab stays inside a dialog */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isOpen(locBackdrop)) { e.preventDefault(); closeLocsModal(); }
        else if (isOpen(welcome)) { e.preventDefault(); closeWelcome(); }
        else if (isPhone() && !rootEl.classList.contains('dock-closed')) { setDock(false); }
        return;
    }
    if (e.key !== 'Tab') return;
    const backdrop = isOpen(locBackdrop) ? locBackdrop : (isOpen(welcome) ? welcome : null);
    if (!backdrop) return;
    const focusable = Array.from(backdrop.querySelectorAll('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hidden && el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!backdrop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

function popupHtml(loc) {
    return '<div class="paper-card">' +
        (loc.img ? '<img class="modal-img" src="' + esc(loc.img) + '" alt="" loading="lazy" decoding="async">' : '') +
        '<div class="pc-badges">' + badgeHtml(loc.type) + '</div>' +
        '<div class="ty-title">' + esc(loc.name) + '</div>' +
        (loc.place ? '<div class="ty-meta">' + esc(loc.place) + (ACCESS[loc.access] ? ' · ' + ACCESS[loc.access] : '') + '</div>' : '') +
        (loc.shortDesc ? '<div class="ty-desc">' + esc(loc.shortDesc) + '</div>' : '') +
        '<button type="button" class="modal-btn primary" data-open="' + esc(loc.id) + '">Details</button>' +
        '</div>';
}
const mapEl = map.getContainer();
/* delegated: Leaflet rebuilds popup DOM on every open */
mapEl.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-open]');
    if (btn) showDetails(btn.dataset.open, btn);
    else if (isPhone() && !rootEl.classList.contains('dock-closed')) setDock(false); /* tap the map to dismiss the drawer */
});
/* 'error' doesn't bubble, so capture it to hide broken popup images */
mapEl.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG' && e.target.closest('.paper-popup')) e.target.style.display = 'none';
}, true);

const searchBox = $('search-box');
const searchClear = $('search-clear');
const filterOptions = $('filter-options');
const filterReset = $('filter-reset');

const SEARCH_KEYS = [
    { name: 'name', weight: 3 },
    { name: 'type', weight: 2 },
    { name: 'place', weight: 1.5 },
    { name: 'shortDesc', weight: 1 },
    { name: 'longDesc', weight: 0.5 }
];
function buildSearch() {
    if (Fuse) {
        const fuse = new Fuse(locations, { keys: SEARCH_KEYS, threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 });
        return (q) => fuse.search(q).map((r) => r.item);
    }
    return (q) => {
        q = q.toLowerCase();
        return locations.filter((l) => SEARCH_KEYS.some((k) => String(l[k.name] || '').toLowerCase().includes(q)));
    };
}

function selectedTypes() {
    return Array.from(filterOptions.querySelectorAll('.f-btn[aria-pressed="true"]')).map((b) => b.dataset.type);
}

/* show only matching pins; optionally zoom to them */
function filterLocations({ fit = true } = {}) {
    if (!fuseSearch) return;
    const q = searchBox.value.trim();
    const types = selectedTypes();
    const matching = q ? new Set(fuseSearch(q).map((l) => l.id)) : null;

    const toAdd = [], toRemove = [], visibleLocs = [];
    for (const loc of locations) {
        const ok = (!matching || matching.has(loc.id)) && (!types.length || types.includes(loc.type));
        if (ok) {
            visibleLocs.push(loc);
            if (!loc.shown) { loc.shown = true; toAdd.push(loc.marker); }
        } else if (loc.shown) {
            loc.shown = false;
            toRemove.push(loc.marker);
        }
    }
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);

    $('visible-count').textContent = visibleLocs.length;
    $('total-count').textContent = locations.length;
    filterReset.classList.toggle('show', !!(q || types.length));
    $('no-results').hidden = !(locations.length > 0 && visibleLocs.length === 0);
    searchClear.classList.toggle('show', searchBox.value.length > 0);

    if (fit && visibleLocs.length) fitTo(visibleLocs);
}

/* otherwise filtering to "Space" while zoomed into Kochi leaves a blank map */
function fitTo(locs, animate = !reducedMotion()) {
    const bounds = L.latLngBounds(locs.map((l) => l.coords));
    map.fitBounds(bounds, { paddingTopLeft: [48, 64], paddingBottomRight: [48, isPhone() ? 150 : 48], maxZoom: locs.length === 1 ? 12 : 10, animate });
}

const runSearch = debounce(() => filterLocations(), 180);
searchBox.addEventListener('input', () => {
    searchClear.classList.toggle('show', searchBox.value.length > 0);
    runSearch();
});
searchClear.addEventListener('click', () => {
    searchBox.value = '';
    searchBox.focus();
    filterLocations();
});

function chipBurst(chip) {
    if (reducedMotion()) return;
    const r = chip.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = ['var(--accent)', 'var(--gold)', 'var(--sage)'];
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('span');
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 30;
        p.className = 'chip-particle';
        p.style.position = 'fixed';
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.background = colors[i % colors.length];
        p.style.setProperty('--dx', Math.cos(a) * d + 'px');
        p.style.setProperty('--dy', Math.sin(a) * d + 'px');
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }
}
filterOptions.addEventListener('click', (e) => {
    const button = e.target.closest('.f-btn[data-type]');
    if (!button) return;
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
    button.classList.toggle('active', !pressed);
    if (!pressed) chipBurst(button);
    filterLocations();
});
filterReset.addEventListener('click', () => {
    searchBox.value = '';
    filterOptions.querySelectorAll('.f-btn').forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.classList.remove('active'); });
    filterLocations();
    /* reset hides itself; move focus unless that would pop up a touch keyboard */
    if (hasFinePointer()) searchBox.focus({ preventScroll: true });
});

const panelCollapse = $('panel-collapse');
const dockTab = $('dock-tab');
function setDock(open) {
    rootEl.classList.toggle('dock-closed', !open);
    panelCollapse.setAttribute('aria-expanded', String(open));
    panelCollapse.setAttribute('aria-label', open ? 'Hide filters' : 'Show filters');
    dockTab.setAttribute('aria-expanded', String(open));
    syncDockInert();
    map.invalidateSize({ pan: false });
    setTimeout(() => map.invalidateSize({ pan: false }), 300);
    /* not focusable until painted */
    if (open && !isPhone()) setTimeout(() => panelCollapse.focus({ preventScroll: true }), 60);
    else if (!open && !isPhone()) dockTab.focus({ preventScroll: true });
}
/* on phones the closed sheet keeps its search bar peeking, so only that stays reachable */
function syncDockInert() {
    const hide = isPhone() && rootEl.classList.contains('dock-closed');
    Array.from(document.querySelector('.panel-body').children).forEach((el, i) => { if (i > 0) el.inert = hide; });
}
panelCollapse.addEventListener('click', () => setDock(rootEl.classList.contains('dock-closed')));
searchBox.addEventListener('focus', () => { if (isPhone() && rootEl.classList.contains('dock-closed')) setDock(true); });
$('dock').addEventListener('click', (e) => { if (isPhone() && rootEl.classList.contains('dock-closed') && !e.target.closest('input, button')) setDock(true); });
dockTab.addEventListener('click', () => setDock(true));
dockTab.setAttribute('aria-expanded', String(!rootEl.classList.contains('dock-closed')));
panelCollapse.setAttribute('aria-expanded', String(!rootEl.classList.contains('dock-closed')));
syncDockInert();
map.invalidateSize({ pan: false });
window.addEventListener('resize', debounce(() => { map.invalidateSize({ pan: false }); syncDockInert(); }, 150));

document.querySelector('.faq-list').addEventListener('click', (e) => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    const open = q.closest('.faq-item').classList.toggle('open');
    q.setAttribute('aria-expanded', String(open));
});

/* Asked after the welcome dialog or from the Near me button, never on page load */
let located = false;
function locateUser(manual) {
    if (located && !manual) return;
    located = true;
    if (!navigator.geolocation) { if (manual) toast('This browser cannot share your location.', 'warn', 2800); return; }
    if (manual) toast('Finding you...', 'info', 1500);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude, lng = position.coords.longitude;
            userPos = [lat, lng];
            const s = CONFIG.southIndia;
            const inSouthIndia = lat >= s.minLat && lat <= s.maxLat && lng >= s.minLng && lng <= s.maxLng;

            if (userMarker) userMarker.remove();
            userMarker = L.marker([lat, lng], {
                icon: L.divIcon({ html: '<span class="you-dot"></span>', className: '', iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] }),
                title: 'You are here',
                alt: 'Your location',
                zIndexOffset: 1000
            }).addTo(map);
            userMarker.bindPopup('<div class="paper-card"><div class="ty-title">You are here</div></div>', { className: 'paper-popup', minWidth: 140 });

            if (!inSouthIndia) {
                if (manual) toast('You are outside South India, so the map stays where it is.', 'info', 3200);
                return;
            }
            /* frame you and the nearest pin; centring on you alone often lands on empty map */
            if (locations.length && !isOpen(locBackdrop)) {
                const nearest = locations.reduce((best, l) => (distanceKm(userPos, l.coords) < distanceKm(userPos, best.coords) ? l : best));
                map.fitBounds(L.latLngBounds([userPos, nearest.coords]), { padding: [80, 80], maxZoom: 11, animate: !reducedMotion() });
                userMarker.openPopup();
            }
        },
        (err) => {
            console.warn('Geolocation error (' + err.code + '): ' + err.message);
            if (err.code === 1) { if (manual) toast('Location is blocked for this site. Allow it in your browser settings.', 'warn', 3600); }
            else toast('Could not get your location.', 'info', 2600);
        },
        { timeout: 20000, maximumAge: 300000 }
    );
}
$('locate-me').addEventListener('click', () => locateUser(true));

function validCoords(c) {
    return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
        Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180;
}

async function loadLocs() {
    try {
        const resp = await fetch(CONFIG.dataUrl);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const raw = await resp.json();
        if (!Array.isArray(raw)) throw new Error('map_locs.json must be an array');

        const seen = new Set();
        raw.forEach((item, idx) => {
            const loc = Object.assign({}, item);
            loc.id = String(loc.id || 'loc-' + idx);
            if (seen.has(loc.id)) { console.warn('Skipping duplicate id:', loc.id); return; }
            if (!validCoords(loc.coords)) { console.warn('Skipping location without valid coords:', loc.id); return; }
            seen.add(loc.id);

            const icon = L.divIcon({
                html: '<span class="pin ' + (TYPE_PIN[loc.type] || 'pin-other') + '"></span>',
                className: 'pin-wrap',
                iconSize: [28, 36],
                iconAnchor: [14, 34],
                popupAnchor: [0, -32]
            });
            /* filterLocations() adds pins to the cluster group */
            loc.marker = L.marker(loc.coords, { icon, title: loc.name, alt: loc.name, riseOnHover: true });
            loc.marker.bindPopup(popupHtml(loc), { className: 'paper-popup', maxWidth: 270, minWidth: 230, autoPanPaddingTopLeft: [24, 70], autoPanPaddingBottomRight: [24, isPhone() ? 150 : 24] });
            loc.shown = false;
            locations.push(loc);
        });

        fuseSearch = buildSearch();
        filterLocations({ fit: false });
        if (locations.length) fitTo(locations, false);
        openFromHash();
    } catch (err) {
        console.error('Failed to load locations:', err);
        toast('Could not load the map data. Try refreshing.', 'error', 4000);
    }
}

/* index.html#pin-id opens that place; also follows back/forward */
function openFromHash() {
    const hash = decodeURIComponent((window.location.hash || '').slice(1));
    const linked = hash && findLoc(hash);
    if (linked) {
        if (isOpen(welcome)) { welcome.classList.remove('show'); syncInert(); }
        if (!isOpen(locBackdrop)) map.setView(linked.coords, 11, { animate: false });
        openLocsModal(linked.id);
    } else if (!hash && isOpen(locBackdrop)) {
        closeLocsModal();
    }
}
window.addEventListener('hashchange', openFromHash);

/* custom cursor: mouse only, off for reduced motion */
function initCursor() {
    if (!hasFinePointer() || reducedMotion()) return;
    const ring = $('cursor-ring'), dot = $('cursor-dot');
    let mx = 0, my = 0, rx = 0, ry = 0, raf = 0, started = false;
    const interactive = 'a, button, input, select, textarea, summary, label, [role="button"], .f-btn, .faq-q, .modal-btn, .icon-btn, .filter-reset, .leaflet-marker-icon';

    function frame() {
        rx += (mx - rx) * 0.16;
        ry += (my - ry) * 0.16;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) raf = requestAnimationFrame(frame);
        else raf = 0;
    }
    document.addEventListener('mousemove', (e) => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        if (!started) {
            started = true;
            rx = mx; ry = my;
            rootEl.classList.add('has-custom-cursor');
        }
        rootEl.classList.add('cursor-visible');
        if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    rootEl.addEventListener('mouseleave', () => rootEl.classList.remove('cursor-visible'));
    rootEl.addEventListener('mouseenter', () => { if (started) rootEl.classList.add('cursor-visible'); });
    document.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest(interactive)) document.body.classList.add('cursor-hover'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest(interactive)) document.body.classList.remove('cursor-hover'); });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-click'));
}
initCursor();

loadLocs();

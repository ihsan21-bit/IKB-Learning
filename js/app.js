/* global SUPABASE_CONFIG, DEFAULT_DATA */
// ============================================================
// ikb learning - Aplikasi utama
// Mode Supabase : data tersimpan online, admin login lewat Supabase Auth
// Mode Demo     : (config belum diisi) data tersimpan di browser saja
// ============================================================

const BUCKET = 'dokumen';
const LOCAL_KEY = 'ikb_learning_demo_state_v1';
const MAX_PDF_MB = 10;
const MAX_LOGO_MB = 2;
const DEMO_ADMIN = { username: 'admin', passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' }; // admin / admin123 (hanya mode demo)

const DEFAULT_LOGO_SVG = `
    <svg class="w-6 h-6 text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
    </svg>`;

// ---------- Supabase client ----------
function isSupabaseConfigured() {
    const c = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG : {};
    return !!(c.url && c.anonKey && /^https:\/\//.test(c.url) && !/GANTI/i.test(c.url) && !/GANTI/i.test(c.anonKey));
}
const sb = (window.supabase && isSupabaseConfigured())
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;

// ---------- State ----------
let appState = structuredClone(DEFAULT_DATA);
let isAdminLoggedIn = false;
let pendingLogoValue = '';      // URL / data-URL logo yang akan disimpan
let pendingLogoFile = null;     // File logo baru (jika dipilih)
let pendingMateriPdf = null;    // { file, fileName }
let pendingKuisPdf = null;      // { file, fileName }
let dataLoadedOnline = false;

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    setupLoginHint();
    await loadState();
    if (sb) {
        try {
            const { data } = await sb.auth.getSession();
            if (data && data.session) isAdminLoggedIn = true;
        } catch (e) { console.warn(e); }
    }
    renderAll();
    updateStorageBadge();
    updateAdminButton();
    toggleSourceInputs('materi');
    toggleSourceInputs('kuis');
});

// ---------- Data mapping (DB <-> UI) ----------
const rowToSettings = r => ({
    siteName: r.site_name, tagline: r.tagline, registrationTitle: r.registration_title,
    registrationBtnLabel: r.registration_btn_label, registrationUrl: r.registration_url,
    registrationDesc: r.registration_desc, heroDesc: r.hero_desc, profileDesc: r.profile_desc,
    email: r.email, phone: r.phone, address: r.address, logoBase64: r.logo_base64 || ''
});
const settingsToRow = s => ({
    id: 1, site_name: s.siteName, tagline: s.tagline, registration_title: s.registrationTitle,
    registration_btn_label: s.registrationBtnLabel, registration_url: s.registrationUrl,
    registration_desc: s.registrationDesc, hero_desc: s.heroDesc, profile_desc: s.profileDesc,
    email: s.email, phone: s.phone, address: s.address, logo_base64: s.logoBase64 || '',
    updated_at: new Date().toISOString()
});
const rowToMateri = r => ({
    id: r.id, title: r.title, category: r.category, desc: r.description || '',
    checklist: Array.isArray(r.checklist) ? r.checklist : [], type: r.source_type || 'link',
    url: r.url, fileName: r.file_name || ''
});
const materiToRow = m => ({
    id: m.id, title: m.title, category: m.category, description: m.desc, checklist: m.checklist,
    source_type: m.type, url: m.url, file_name: m.fileName || ''
});
const rowToKuis = r => ({
    id: r.id, title: r.title, category: r.category, desc: r.description || '',
    duration: r.duration || '', type: r.source_type || 'link', url: r.url, fileName: r.file_name || ''
});
const kuisToRow = k => ({
    id: k.id, title: k.title, category: k.category, description: k.desc, duration: k.duration,
    source_type: k.type, url: k.url, file_name: k.fileName || ''
});

// ---------- Load / persist ----------
async function loadState() {
    if (!sb) {
        try {
            const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
            if (saved && saved.settings) appState = saved;
        } catch (e) { /* abaikan */ }
        return;
    }
    try {
        const [s, m, k] = await Promise.all([
            sb.from('site_settings').select('*').eq('id', 1).maybeSingle(),
            sb.from('materi').select('*').order('created_at', { ascending: true }),
            sb.from('kuis').select('*').order('created_at', { ascending: true })
        ]);
        const err = s.error || m.error || k.error;
        if (err) throw err;
        if (s.data) appState.settings = rowToSettings(s.data);
        appState.materi = (m.data || []).map(rowToMateri);
        appState.kuis = (k.data || []).map(rowToKuis);
        dataLoadedOnline = true;
    } catch (e) {
        console.error('Gagal memuat Supabase:', e);
        dataLoadedOnline = false;
        showToast('Gagal memuat data dari Supabase. Menampilkan data bawaan.', 'error');
    }
}

function persistLocal() {
    if (sb) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(appState)); }
    catch (e) { showToast('Penyimpanan lokal penuh (file PDF terlalu besar untuk mode demo).', 'error'); }
}

async function dbRun(query) {
    const { error } = await query;
    if (error) throw error;
}

function handleError(err, action) {
    console.error(err);
    let msg = (err && err.message) ? err.message : String(err);
    if (/row-level security|permission denied|not authorized/i.test(msg)) {
        msg = 'Akun ini tidak punya izin admin. Pastikan email admin sudah diatur di supabase/schema.sql.';
    }
    showToast(`Gagal ${action}: ${msg}`, 'error');
}

// ---------- File upload (Supabase Storage / data-URL di mode demo) ----------
function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}

async function uploadFile(file, folder) {
    if (!sb) return readAsDataURL(file);
    const ext = ((file.name.split('.').pop() || 'bin').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined, cacheControl: '3600', upsert: false
    });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function removeStoredFile(url) {
    if (!sb || !url) return;
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return;
    try { await sb.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]); }
    catch (e) { console.warn('Gagal menghapus file lama:', e); }
}

// ---------- Utilities ----------
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function safeUrl(u) {
    const s = String(u || '').trim();
    return (/^https?:\/\//i.test(s) || /^data:application\/pdf/i.test(s)) ? s : '#';
}
function safeImg(u) {
    const s = String(u || '').trim();
    return (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) ? s : '';
}
function isHttpUrl(u) { return /^https?:\/\/\S+$/i.test(String(u || '').trim()); }

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const styles = {
        success: 'bg-emerald-600 text-white border-emerald-500',
        error: 'bg-rose-600 text-white border-rose-500',
        info: 'bg-indigo-900 text-white border-indigo-700'
    };
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    toast.className = `toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold max-w-sm ${styles[type] || styles.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-base shrink-0"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function toggleMobileMenu() { document.getElementById('mobile-menu').classList.toggle('hidden'); }

function updateStorageBadge() {
    const el = document.getElementById('admin-storage-status');
    if (!el) return;
    if (sb && dataLoadedOnline) { el.textContent = 'Terhubung ke Supabase'; el.className = 'block text-sm font-bold text-emerald-700 mt-1'; }
    else if (sb) { el.textContent = 'Supabase gagal dimuat'; el.className = 'block text-sm font-bold text-rose-600 mt-1'; }
    else { el.textContent = 'Mode Demo (data hanya di browser ini)'; el.className = 'block text-sm font-bold text-amber-700 mt-1'; }
}

function updateAdminButton() {
    const btn = document.getElementById('btn-open-admin');
    if (!btn) return;
    btn.innerHTML = isAdminLoggedIn
        ? '<i class="fa-solid fa-gauge-high text-yellow-300"></i><span>Dashboard Admin</span>'
        : '<i class="fa-solid fa-user-shield text-yellow-300"></i><span>Admin</span>';
}

// ---------- Render publik ----------
function renderAll() {
    renderBrandingAndProfile();
    renderPublicMateri();
    renderPublicKuis();
    updateStats();
    if (isAdminLoggedIn) { populateSettingsForm(); renderAdminMateriList(); renderAdminKuisList(); }
}

function renderBrandingAndProfile() {
    const s = appState.settings || {};
    const name = s.siteName || 'ikb learning';
    const regUrl = safeUrl(s.registrationUrl) !== '#' ? s.registrationUrl : 'https://docs.google.com/forms';
    const regBtnLabel = s.registrationBtnLabel || 'Buka Form Pendaftaran Peserta';
    document.title = `${name} - ${s.tagline || 'Pusat Pembelajaran Optimalisasi Pemasaran & Kompetensi'}`;
    document.getElementById('header-site-name').textContent = name;
    document.getElementById('header-site-tagline').textContent = s.tagline || '';
    document.getElementById('hero-site-name').textContent = name;
    document.getElementById('hero-description').textContent = s.heroDesc || '';
    document.getElementById('hero-register-btn').href = regUrl;
    document.getElementById('hero-register-label').textContent = regBtnLabel;
    document.getElementById('reg-section-title').innerHTML =
        `${escapeHtml(s.registrationTitle || 'Pendaftaran Kelas')} — <span id="reg-site-name" class="text-blue-600">${escapeHtml(name)}</span>`;
    document.getElementById('reg-description').textContent = s.registrationDesc || '';
    document.getElementById('registration-form-link').href = regUrl;
    document.getElementById('registration-btn-text').textContent = regBtnLabel;
    document.getElementById('profile-title').textContent = `Profil ${name}`;
    document.getElementById('profile-description').textContent = s.profileDesc || '';
    document.getElementById('contact-address').textContent = s.address || '';
    document.getElementById('contact-phone').textContent = s.phone || '';
    document.getElementById('contact-email').textContent = s.email || '';
    document.getElementById('footer-site-name').textContent = name;
    document.getElementById('contact-wa-btn').href = `https://wa.me/${(s.phone || '').replace(/[^0-9]/g, '')}`;

    const img = safeImg(s.logoBase64);
    const logoHtml = img
        ? `<img src="${escapeHtml(img)}" alt="Logo ${escapeHtml(name)}" class="w-full h-full object-cover">`
        : DEFAULT_LOGO_SVG;
    document.getElementById('header-logo-container').innerHTML = logoHtml;
    document.getElementById('footer-logo-container').innerHTML = logoHtml;
}

function selectTopicPill(topic) {
    document.getElementById('filter-kategori-materi').value = topic;
    renderPublicMateri();
}

function syncTopicPills(selectedCat) {
    document.querySelectorAll('.topic-pill-btn').forEach(btn => {
        btn.className = btn.dataset.topic === selectedCat
            ? 'topic-pill-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-teal-600 text-white shadow-sm transition-all'
            : 'topic-pill-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-700 hover:bg-teal-50 border border-slate-200 transition-all';
    });
}

function renderPublicMateri() {
    const grid = document.getElementById('public-materi-grid');
    const searchQuery = document.getElementById('search-materi').value.toLowerCase();
    const catSelect = document.getElementById('filter-kategori-materi');
    const prev = catSelect.value || 'ALL';
    const defaultTopics = ['Optimasi Profil', 'Mengelola Konten', 'Copywriting'];
    const categories = ['ALL', ...new Set([...defaultTopics, ...appState.materi.map(m => m.category)])];
    catSelect.innerHTML = categories.map(cat =>
        `<option value="${escapeHtml(cat)}">${cat === 'ALL' ? 'Semua Modul (3 Topik)' : escapeHtml(cat)}</option>`).join('');
    catSelect.value = categories.includes(prev) ? prev : 'ALL';
    const selectedCat = catSelect.value;
    syncTopicPills(selectedCat);

    const filtered = appState.materi.filter(item => {
        const checklistText = (item.checklist || []).join(' ').toLowerCase();
        const matchSearch = item.title.toLowerCase().includes(searchQuery)
            || (item.desc || '').toLowerCase().includes(searchQuery)
            || item.category.toLowerCase().includes(searchQuery)
            || checklistText.includes(searchQuery);
        return matchSearch && (selectedCat === 'ALL' || item.category === selectedCat);
    });

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200/80">
                <i class="fa-solid fa-folder-open text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium">Tidak ada modul pelatihan yang sesuai dengan pencarian atau filter Anda.</p>
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        const isPdf = item.type === 'pdf';
        const badgeClass = isPdf ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200';
        const checklistHtml = (item.checklist && item.checklist.length)
            ? `<ul class="space-y-1.5 mb-6 bg-teal-50/60 border border-teal-100 rounded-xl p-3.5">
                ${item.checklist.map(p => `
                    <li class="flex items-start gap-2 text-xs text-slate-700 leading-snug">
                        <i class="fa-solid fa-circle-check text-teal-600 mt-0.5 shrink-0"></i><span>${escapeHtml(p)}</span>
                    </li>`).join('')}
               </ul>` : '';
        const actionBtn = isPdf
            ? `<button onclick="openPdfModal('${escapeHtml(item.id)}', 'materi')" class="w-full py-2.5 px-4 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                    <i class="fa-solid fa-eye text-amber-400"></i><span>Preview & Unduh PDF</span></button>`
            : `<a href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                    <span>Buka Modul</span><i class="fa-solid fa-arrow-up-right-from-square text-xs"></i></a>`;
        return `
            <article class="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between group">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-4">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/70">${escapeHtml(item.category)}</span>
                        <span class="px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeClass} flex items-center gap-1.5">
                            <i class="fa-solid ${isPdf ? 'fa-file-pdf' : 'fa-link'}"></i> ${isPdf ? 'Dokumen PDF' : 'Tautan Materi'}
                        </span>
                    </div>
                    <h3 class="text-lg font-bold text-teal-950 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">${escapeHtml(item.title)}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">${escapeHtml(item.desc)}</p>
                    ${checklistHtml}
                </div>
                <div class="pt-4 border-t border-slate-100">${actionBtn}</div>
            </article>`;
    }).join('');
}

function renderPublicKuis() {
    const grid = document.getElementById('public-kuis-grid');
    if (!appState.kuis.length) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200/80">
                <p class="text-slate-500 font-medium">Belum ada kuis atau assessment yang dipublikasikan.</p>
            </div>`;
        return;
    }
    grid.innerHTML = appState.kuis.map(item => {
        const isPdf = item.type === 'pdf';
        const actionBtn = isPdf
            ? `<button onclick="openPdfModal('${escapeHtml(item.id)}', 'kuis')" class="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-sm font-bold flex items-center gap-2 transition-all shrink-0">
                    <i class="fa-solid fa-file-pdf"></i><span>Lihat Soal PDF</span></button>`
            : `<a href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white text-sm font-bold flex items-center gap-2 transition-all shrink-0">
                    <span>Mulai Kuis</span><i class="fa-solid fa-play text-xs text-yellow-300"></i></a>`;
        return `
            <div class="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-300/70">${escapeHtml(item.category)}</span>
                        <span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <i class="fa-regular fa-clock"></i> ${escapeHtml(item.duration)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-teal-950">${escapeHtml(item.title)}</h3>
                    <p class="text-sm text-slate-600">${escapeHtml(item.desc)}</p>
                </div>
                <div>${actionBtn}</div>
            </div>`;
    }).join('');
}

function updateStats() {
    const tm = appState.materi.length, tk = appState.kuis.length;
    [['stat-total-materi', tm], ['stat-total-kuis', tk], ['admin-stat-materi', tm], ['admin-stat-kuis', tk]].forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
    });
}

// ---------- Login admin ----------
function setupLoginHint() {
    const label = document.getElementById('admin-username-label');
    const input = document.getElementById('admin-username');
    const hint = document.getElementById('admin-login-hint');
    if (sb) {
        label.textContent = 'Email Admin';
        input.type = 'email';
        input.placeholder = 'email@anda.com';
        hint.innerHTML = 'Masuk dengan akun admin yang dibuat di <strong>Supabase &gt; Authentication &gt; Users</strong>.';
    } else {
        label.textContent = 'Username Admin';
        input.type = 'text';
        input.placeholder = 'admin';
        hint.innerHTML = '<strong>Mode Demo</strong> (Supabase belum dikonfigurasi). Kredensial: <strong>admin</strong> / <strong>admin123</strong>. Data hanya tersimpan di browser ini.';
    }
}

function openAdminModal() {
    if (isAdminLoggedIn) { showAdminDashboard(); return; }
    document.getElementById('admin-login-error').classList.add('hidden');
    document.getElementById('admin-login-form').reset();
    const modal = document.getElementById('modal-admin-login');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeAdminLoginModal() {
    const modal = document.getElementById('modal-admin-login');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleAdminLogin(event) {
    event.preventDefault();
    const user = document.getElementById('admin-username').value.trim();
    const pass = document.getElementById('admin-password').value;
    const errEl = document.getElementById('admin-login-error');
    const submitBtn = event.submitter;
    let ok = false;

    if (submitBtn) submitBtn.disabled = true;
    try {
        if (sb) {
            const { error } = await sb.auth.signInWithPassword({ email: user, password: pass });
            ok = !error;
            if (error) errEl.textContent = 'Email atau password salah.';
        } else {
            ok = user === DEMO_ADMIN.username && (await sha256Hex(pass)) === DEMO_ADMIN.passwordHash;
            if (!ok) errEl.textContent = 'Username atau password salah (demo: admin / admin123).';
        }
    } catch (e) {
        console.error(e);
        errEl.textContent = 'Terjadi kesalahan saat login. Coba lagi.';
    }
    if (submitBtn) submitBtn.disabled = false;

    if (ok) {
        isAdminLoggedIn = true;
        closeAdminLoginModal();
        showAdminDashboard();
        showToast('Berhasil masuk ke Panel Admin', 'success');
    } else {
        errEl.classList.remove('hidden');
    }
}

function showAdminDashboard() {
    document.getElementById('public-portal-view').classList.add('hidden');
    document.getElementById('admin-dashboard-view').classList.remove('hidden');
    updateAdminButton();
    updateStorageBadge();
    populateSettingsForm();
    renderAdminMateriList();
    renderAdminKuisList();
    updateStats();
    switchAdminTab('identitas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToPublicPortal() {
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('public-portal-view').classList.remove('hidden');
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function logoutAdmin() {
    if (sb) { try { await sb.auth.signOut(); } catch (e) { console.warn(e); } }
    isAdminLoggedIn = false;
    pendingLogoFile = null; pendingMateriPdf = null; pendingKuisPdf = null;
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('public-portal-view').classList.remove('hidden');
    updateAdminButton();
    showToast('Anda telah keluar dari mode Admin', 'info');
}

function switchAdminTab(tabName) {
    ['identitas', 'materi', 'kuis'].forEach(t => {
        const panel = document.getElementById(`admin-panel-${t}`);
        const btn = document.getElementById(`admin-tab-${t}`);
        const active = t === tabName;
        panel.classList.toggle('hidden', !active);
        btn.className = active
            ? 'admin-tab-btn px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-700 text-white shadow-sm transition-all flex items-center gap-2'
            : 'admin-tab-btn px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-700 hover:bg-teal-50 border border-slate-200 transition-all flex items-center gap-2';
    });
}

// ---------- Admin: identitas & logo ----------
function populateSettingsForm() {
    const s = appState.settings || {};
    pendingLogoValue = s.logoBase64 || '';
    pendingLogoFile = null;
    const set = (id, v) => { document.getElementById(id).value = v || ''; };
    set('set-site-name', s.siteName); set('set-tagline', s.tagline); set('set-email', s.email);
    set('set-phone', s.phone); set('set-address', s.address); set('set-reg-title', s.registrationTitle);
    set('set-reg-btn-label', s.registrationBtnLabel); set('set-reg-url', s.registrationUrl);
    set('set-reg-desc', s.registrationDesc); set('set-hero-desc', s.heroDesc); set('set-profile-desc', s.profileDesc);
    renderAdminLogoPreview(pendingLogoValue);
}

function renderAdminLogoPreview(src) {
    const box = document.getElementById('admin-logo-preview');
    if (!box) return;
    const img = safeImg(src);
    box.innerHTML = img
        ? `<img src="${escapeHtml(img)}" alt="Preview Logo" class="w-full h-full object-cover">`
        : '<i class="fa-solid fa-image text-2xl text-yellow-200"></i>';
}

async function handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('File logo harus berupa gambar', 'error'); event.target.value = ''; return; }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) { showToast(`Ukuran logo maksimal ${MAX_LOGO_MB} MB`, 'error'); event.target.value = ''; return; }
    pendingLogoFile = file;
    renderAdminLogoPreview(await readAsDataURL(file));
    showToast('Logo siap disimpan. Klik "Simpan Pengaturan" untuk menerapkan.', 'info');
}

function resetLogoToDefault() {
    pendingLogoValue = '';
    pendingLogoFile = null;
    const input = document.getElementById('admin-logo-input');
    if (input) input.value = '';
    renderAdminLogoPreview('');
    showToast('Logo direset ke bawaan. Klik "Simpan Pengaturan" untuk menerapkan.', 'info');
}

async function saveAdminSettings(event) {
    event.preventDefault();
    const btn = event.submitter;
    if (btn) btn.disabled = true;
    try {
        const oldLogo = appState.settings.logoBase64 || '';
        let logo = pendingLogoValue;
        if (pendingLogoFile) logo = await uploadFile(pendingLogoFile, 'logo');
        const g = id => document.getElementById(id).value.trim();
        const next = {
            ...appState.settings,
            siteName: g('set-site-name'), tagline: g('set-tagline'), email: g('set-email'),
            phone: g('set-phone'), address: g('set-address'), registrationTitle: g('set-reg-title'),
            registrationBtnLabel: g('set-reg-btn-label'), registrationUrl: g('set-reg-url'),
            registrationDesc: g('set-reg-desc'), heroDesc: g('set-hero-desc'),
            profileDesc: g('set-profile-desc'), logoBase64: logo || ''
        };
        if (sb) await dbRun(sb.from('site_settings').upsert(settingsToRow(next)));
        appState.settings = next;
        if (oldLogo && oldLogo !== next.logoBase64) await removeStoredFile(oldLogo);
        pendingLogoValue = next.logoBase64; pendingLogoFile = null;
        persistLocal();
        renderAll();
        showToast('Pengaturan situs berhasil disimpan', 'success');
    } catch (e) { handleError(e, 'menyimpan pengaturan'); }
    if (btn) btn.disabled = false;
}

// ---------- Admin: umum ----------
function toggleSourceInputs(prefix) {
    const type = document.getElementById(`${prefix}-type`).value;
    document.getElementById(`${prefix}-source-link-group`).classList.toggle('hidden', type === 'pdf');
    document.getElementById(`${prefix}-source-pdf-group`).classList.toggle('hidden', type !== 'pdf');
}

document.addEventListener('change', e => {
    const id = e.target && e.target.id;
    if (id !== 'materi-pdf-file' && id !== 'kuis-pdf-file') return;
    const file = e.target.files && e.target.files[0];
    const prefix = id === 'materi-pdf-file' ? 'materi' : 'kuis';
    if (!file) return;
    if (file.type !== 'application/pdf') { showToast('File harus berformat PDF', 'error'); e.target.value = ''; return; }
    if (file.size > MAX_PDF_MB * 1024 * 1024) { showToast(`Ukuran PDF maksimal ${MAX_PDF_MB} MB`, 'error'); e.target.value = ''; return; }
    const data = { file, fileName: file.name };
    if (prefix === 'materi') pendingMateriPdf = data; else pendingKuisPdf = data;
    document.getElementById(`${prefix}-current-pdf-label`).textContent = `File terpilih: ${file.name}`;
});

function adminRowHtml(item, kind, extraBadge) {
    const isMateri = kind === 'materi';
    return `
        <div class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <div class="flex flex-wrap items-center gap-2 mb-1">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isMateri ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-yellow-100 text-yellow-900 border border-yellow-300'}">${escapeHtml(item.category)}</span>
                    ${extraBadge}
                </div>
                <h4 class="font-bold text-slate-900 text-base">${escapeHtml(item.title)}</h4>
                <p class="text-xs text-slate-600 mt-0.5">${escapeHtml(item.desc)}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button type="button" onclick="${isMateri ? 'editMateriItem' : 'editKuisItem'}('${escapeHtml(item.id)}')" class="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-all"><i class="fa-solid fa-pen mr-1"></i>Edit</button>
                <button type="button" onclick="${isMateri ? 'deleteMateriItem' : 'deleteKuisItem'}('${escapeHtml(item.id)}')" class="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-all"><i class="fa-solid fa-trash mr-1"></i>Hapus</button>
            </div>
        </div>`;
}

// ---------- Admin: modul ----------
async function saveMateriItem(event) {
    event.preventDefault();
    const btn = event.submitter;
    const editId = document.getElementById('materi-edit-id').value.trim();
    const type = document.getElementById('materi-type').value;
    const existing = editId ? appState.materi.find(m => m.id === editId) : null;
    let url = document.getElementById('materi-url').value.trim();
    let fileName = '';

    if (btn) btn.disabled = true;
    try {
        if (type === 'pdf') {
            if (pendingMateriPdf) { url = await uploadFile(pendingMateriPdf.file, 'materi'); fileName = pendingMateriPdf.fileName; }
            else if (existing && existing.type === 'pdf') { url = existing.url; fileName = existing.fileName; }
            else { showToast('Silakan pilih file PDF terlebih dahulu', 'error'); return; }
        } else if (!isHttpUrl(url)) {
            showToast('Masukkan URL tautan yang valid (diawali http:// atau https://)', 'error'); return;
        }
        const item = {
            id: editId || `mat-${Date.now()}`,
            title: document.getElementById('materi-title').value.trim(),
            category: document.getElementById('materi-category').value,
            desc: document.getElementById('materi-desc').value.trim(),
            checklist: document.getElementById('materi-checklist').value.split('\n').map(l => l.trim()).filter(Boolean),
            type, url, fileName
        };
        if (sb) await dbRun(sb.from('materi').upsert(materiToRow(item)));
        if (existing && existing.type === 'pdf' && existing.url !== item.url) await removeStoredFile(existing.url);
        appState.materi = existing ? appState.materi.map(m => m.id === editId ? item : m) : [...appState.materi, item];
        persistLocal();
        resetMateriForm();
        renderAll();
        showToast(existing ? 'Modul berhasil diperbarui' : 'Modul baru berhasil ditambahkan', 'success');
    } catch (e) { handleError(e, 'menyimpan modul'); }
    finally { if (btn) btn.disabled = false; }
}

function editMateriItem(id) {
    const item = appState.materi.find(m => m.id === id);
    if (!item) return;
    pendingMateriPdf = null;
    document.getElementById('materi-edit-id').value = item.id;
    document.getElementById('materi-title').value = item.title;
    document.getElementById('materi-category').value = item.category;
    document.getElementById('materi-desc').value = item.desc;
    document.getElementById('materi-checklist').value = (item.checklist || []).join('\n');
    document.getElementById('materi-type').value = item.type || 'link';
    document.getElementById('materi-url').value = item.type === 'link' ? item.url : '';
    document.getElementById('materi-current-pdf-label').textContent = item.type === 'pdf' ? `PDF aktif: ${item.fileName || 'dokumen.pdf'}` : '';
    document.getElementById('materi-form-heading').textContent = 'Edit Modul Pelatihan';
    document.getElementById('btn-cancel-edit-materi').classList.remove('hidden');
    toggleSourceInputs('materi');
    switchAdminTab('materi');
    document.getElementById('admin-materi-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteMateriItem(id) {
    const item = appState.materi.find(m => m.id === id);
    if (!item || !confirm(`Hapus modul "${item.title}"?`)) return;
    try {
        if (sb) await dbRun(sb.from('materi').delete().eq('id', id));
        if (item.type === 'pdf') await removeStoredFile(item.url);
        appState.materi = appState.materi.filter(m => m.id !== id);
        persistLocal();
        renderAll();
        showToast('Modul dihapus', 'info');
    } catch (e) { handleError(e, 'menghapus modul'); }
}

function resetMateriForm() {
    pendingMateriPdf = null;
    document.getElementById('admin-materi-form').reset();
    document.getElementById('materi-edit-id').value = '';
    document.getElementById('materi-current-pdf-label').textContent = '';
    document.getElementById('materi-form-heading').textContent = 'Tambah Modul Pelatihan';
    document.getElementById('btn-cancel-edit-materi').classList.add('hidden');
    toggleSourceInputs('materi');
}

function renderAdminMateriList() {
    const c = document.getElementById('admin-materi-list');
    if (!c) return;
    if (!appState.materi.length) {
        c.innerHTML = '<div class="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">Belum ada modul pelatihan.</div>';
        return;
    }
    c.innerHTML = appState.materi.map(i =>
        adminRowHtml(i, 'materi', `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">${i.type === 'pdf' ? 'PDF' : 'Link'}</span>`)).join('');
}

// ---------- Admin: kuis ----------
async function saveKuisItem(event) {
    event.preventDefault();
    const btn = event.submitter;
    const editId = document.getElementById('kuis-edit-id').value.trim();
    const type = document.getElementById('kuis-type').value;
    const existing = editId ? appState.kuis.find(q => q.id === editId) : null;
    let url = document.getElementById('kuis-url').value.trim();
    let fileName = '';

    if (btn) btn.disabled = true;
    try {
        if (type === 'pdf') {
            if (pendingKuisPdf) { url = await uploadFile(pendingKuisPdf.file, 'kuis'); fileName = pendingKuisPdf.fileName; }
            else if (existing && existing.type === 'pdf') { url = existing.url; fileName = existing.fileName; }
            else { showToast('Silakan pilih file PDF soal terlebih dahulu', 'error'); return; }
        } else if (!isHttpUrl(url)) {
            showToast('Masukkan URL kuis yang valid (diawali http:// atau https://)', 'error'); return;
        }
        const item = {
            id: editId || `quiz-${Date.now()}`,
            title: document.getElementById('kuis-title').value.trim(),
            category: document.getElementById('kuis-category').value,
            desc: document.getElementById('kuis-desc').value.trim(),
            duration: document.getElementById('kuis-duration').value.trim(),
            type, url, fileName
        };
        if (sb) await dbRun(sb.from('kuis').upsert(kuisToRow(item)));
        if (existing && existing.type === 'pdf' && existing.url !== item.url) await removeStoredFile(existing.url);
        appState.kuis = existing ? appState.kuis.map(q => q.id === editId ? item : q) : [...appState.kuis, item];
        persistLocal();
        resetKuisForm();
        renderAll();
        showToast(existing ? 'Kuis berhasil diperbarui' : 'Kuis baru ditambahkan', 'success');
    } catch (e) { handleError(e, 'menyimpan kuis'); }
    finally { if (btn) btn.disabled = false; }
}

function editKuisItem(id) {
    const item = appState.kuis.find(q => q.id === id);
    if (!item) return;
    pendingKuisPdf = null;
    document.getElementById('kuis-edit-id').value = item.id;
    document.getElementById('kuis-title').value = item.title;
    document.getElementById('kuis-category').value = item.category;
    document.getElementById('kuis-desc').value = item.desc;
    document.getElementById('kuis-duration').value = item.duration;
    document.getElementById('kuis-type').value = item.type || 'link';
    document.getElementById('kuis-url').value = item.type === 'link' ? item.url : '';
    document.getElementById('kuis-current-pdf-label').textContent = item.type === 'pdf' ? `PDF aktif: ${item.fileName || 'soal.pdf'}` : '';
    document.getElementById('kuis-form-heading').textContent = 'Edit Kuis / Assessment';
    document.getElementById('btn-cancel-edit-kuis').classList.remove('hidden');
    toggleSourceInputs('kuis');
    switchAdminTab('kuis');
    document.getElementById('admin-kuis-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteKuisItem(id) {
    const item = appState.kuis.find(q => q.id === id);
    if (!item || !confirm(`Hapus kuis "${item.title}"?`)) return;
    try {
        if (sb) await dbRun(sb.from('kuis').delete().eq('id', id));
        if (item.type === 'pdf') await removeStoredFile(item.url);
        appState.kuis = appState.kuis.filter(q => q.id !== id);
        persistLocal();
        renderAll();
        showToast('Kuis dihapus', 'info');
    } catch (e) { handleError(e, 'menghapus kuis'); }
}

function resetKuisForm() {
    pendingKuisPdf = null;
    document.getElementById('admin-kuis-form').reset();
    document.getElementById('kuis-edit-id').value = '';
    document.getElementById('kuis-current-pdf-label').textContent = '';
    document.getElementById('kuis-form-heading').textContent = 'Tambah Kuis / Assessment';
    document.getElementById('btn-cancel-edit-kuis').classList.add('hidden');
    toggleSourceInputs('kuis');
}

function renderAdminKuisList() {
    const c = document.getElementById('admin-kuis-list');
    if (!c) return;
    if (!appState.kuis.length) {
        c.innerHTML = '<div class="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">Belum ada kuis atau assessment.</div>';
        return;
    }
    c.innerHTML = appState.kuis.map(i =>
        adminRowHtml(i, 'kuis', `<span class="text-xs font-semibold text-blue-700">${escapeHtml(i.duration)}</span>`)).join('');
}

// ---------- Modal PDF ----------
function openPdfModal(id, sourceType) {
    const list = sourceType === 'materi' ? appState.materi : appState.kuis;
    const item = list.find(x => x.id === id);
    if (!item || safeUrl(item.url) === '#') return;
    document.getElementById('pdf-modal-title').textContent = item.title;
    document.getElementById('pdf-modal-iframe').src = item.url;
    const dl = document.getElementById('pdf-modal-download');
    dl.href = item.url;
    dl.target = '_blank';
    dl.rel = 'noopener noreferrer';
    dl.download = item.fileName || `${item.title.replace(/\s+/g, '_')}.pdf`;
    const m = document.getElementById('modal-pdf-preview');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closePdfModal() {
    const m = document.getElementById('modal-pdf-preview');
    m.classList.add('hidden');
    m.classList.remove('flex');
    document.getElementById('pdf-modal-iframe').src = '';
}

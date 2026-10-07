/* Roc B 喵喵著數 — 「🆕️ 本月新優惠」banner + panel and 「⚠️ 條款有變」alerts.
   Data rules (all from data/offers.json):
   - New this month = offer_type 限時推廣, added_date in the current calendar month (HK time), not expired.
   - T&C changes   = offers[].changes[] entries dated in the current month or the last 30 days (official term changes only).
   - Remember-seen = localStorage; once everything is seen the banner collapses to a small badge,
     and lights up again when new promos / changes appear. */
(function () {
  'use strict';
  var KEY = 'rocb-monthly-seen-v1';
  var CHANGE_DAYS = 30; // T&C changes stay listed for the current month or 30 days, whichever is longer
  var FIELD_ZH = { welcome: '迎新', validity: '有效期', rebate_pct: '回贈率', cap: '上限', min_spend: '簽賬要求', registration: '登記', other: '其他條款' };
  var DATA = null, lastFocus = null, mem = null;

  function hkToday() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function today() { return (window.RocBApp && window.RocBApp.today) || hkToday(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function fmtDate(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function fmtDM(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function monthEnd(ym) { var p = ym.split('-'), d = new Date(Date.UTC(+p[0], +p[1], 0)); return d.toISOString().slice(0, 10); }

  // ---------- data ----------
  function compute(data, asOf) {
    data = data || DATA || [];
    var t = asOf || today(), ym = t.slice(0, 7), end = monthEnd(ym);
    var live = function (o) { return !o.expiry_date || o.expiry_date >= t; };
    var promos = data.filter(function (o) {
      return o.offer_type === '限時推廣' && o.added_date && o.added_date.slice(0, 7) === ym && live(o);
    }).map(function (o) {
      var days = o.expiry_date ? diffDays(t, o.expiry_date) : null;
      var byMonthEnd = !!(o.expiry_date && o.expiry_date <= end);
      return { o: o, key: 'p:' + o.id, days: days, byMonthEnd: byMonthEnd, urgent: byMonthEnd || (days != null && days <= 7) };
    });
    promos.sort(function (a, b) {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (a.urgent) return a.days - b.days;
      return String(b.o.added_date).localeCompare(String(a.o.added_date)) || String(a.o.expiry_date || '9999').localeCompare(String(b.o.expiry_date || '9999'));
    });
    var changes = [];
    data.forEach(function (o) {
      if (!live(o)) return;
      (o.changes || []).forEach(function (c, i) {
        if (c.date && c.date <= t && (c.date.slice(0, 7) === ym || diffDays(c.date, t) < CHANGE_DAYS)) changes.push({ o: o, c: c, key: 'c:' + o.id + '|' + c.date + '|' + c.field + '|' + i });
      });
    });
    changes.sort(function (a, b) { return b.c.date.localeCompare(a.c.date) || a.o.id.localeCompare(b.o.id); });
    return {
      today: t, ym: ym, month: +ym.slice(5, 7), monthEnd: end,
      promos: promos, soon: promos.filter(function (p) { return p.byMonthEnd; }).length,
      changes: changes, changedOffers: uniq(changes.map(function (x) { return x.o.id; })).length,
      fieldZh: FIELD_ZH
    };
  }
  function uniq(a) { var s = {}, out = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; out.push(x); } }); return out; }

  // ---------- remember-seen ----------
  function loadSeen() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.keys) return v; } catch (e) { /* private mode */ }
    return mem || { keys: [] };
  }
  function saveSeen(keys) {
    var v = { keys: keys.slice(-500), at: new Date().toISOString() };
    mem = v;
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
  function unseenKeys(m) {
    var seen = {}; loadSeen().keys.forEach(function (k) { seen[k] = 1; });
    return m.promos.map(function (p) { return p.key; }).concat(m.changes.map(function (c) { return c.key; })).filter(function (k) { return !seen[k]; });
  }
  function everSeen() { return loadSeen().keys.length > 0; }

  // ---------- banner ----------
  function renderBanner() {
    var el = document.getElementById('monthlyBanner');
    if (!el || !DATA) return;
    var m = compute(), unseen = unseenKeys(m), nNew = unseen.length;
    var collapsed = nNew === 0;
    var txt = '🆕️ ' + m.month + ' 月新優惠：';
    txt += m.promos.length ? m.promos.length + ' 個限時推廣' : '暫時未有新限時推廣';
    if (m.soon) txt += ' · <b class="mb-soon">' + m.soon + ' 個月底前完</b>';
    if (m.changes.length) txt += ' · <b class="mb-chg">⚠️ ' + m.changedOffers + ' 個優惠條款有變</b>';
    var h;
    if (collapsed) {
      h = '<button type="button" class="mb-badge" id="mbOpen" aria-haspopup="dialog" aria-controls="mbSheet">🆕️ ' + m.month + ' 月新優惠 <span class="mb-n">' + m.promos.length + '</span>' +
        (m.changes.length ? ' <span class="mb-n warn">⚠️ ' + m.changedOffers + '</span>' : '') + ' <span class="mb-go">›</span></button>';
    } else {
      h = '<button type="button" class="mb-banner" id="mbOpen" aria-haspopup="dialog" aria-controls="mbSheet">' +
        '<span class="mb-txt">' + txt + '</span>' +
        (everSeen() ? '<span class="mb-new">' + nNew + ' 個新</span>' : '') +
        '<span class="mb-go">睇晒 ›</span></button>';
    }
    el.innerHTML = h;
    el.className = 'mb-wrap' + (collapsed ? ' collapsed' : '');
    el.hidden = false;
    document.getElementById('mbOpen').addEventListener('click', function () { open(); });
  }

  // ---------- panel ----------
  function promoKey(o) {
    var h = [];
    if (o.rebate_pct != null) h.push('<span class="k big sm">最高 ' + o.rebate_pct + '%</span>');
    if (o.welcome_value_hkd) h.push('<span class="k wel sm">HK$' + num(o.welcome_value_hkd) + '</span>');
    if (o.welcome_miles) h.push('<span class="k mile sm">' + num(o.welcome_miles) + ' 里</span>');
    if (o.hkd_per_mile != null) h.push('<span class="k mile sm">HK$' + o.hkd_per_mile + '/里</span>');
    if (o.min_spend_hkd) h.push('<span class="k sm">簽 HK$' + num(o.min_spend_hkd) + '</span>');
    if (o.rebate_cap_hkd != null) h.push('<span class="k sm">上限 HK$' + num(o.rebate_cap_hkd) + (o.cap_period ? '／' + esc(o.cap_period) : '') + '</span>');
    return h.join('');
  }
  function expLine(p) {
    var o = p.o;
    if (!o.expiry_date) return '<span class="muted">' + esc(o.validity_text && o.validity_text !== '未有列明' ? o.validity_text : '到期日未有列明') + '</span>';
    var d = p.days, t = d === 0 ? '今日最後一日' : '仲有 ' + d + ' 日';
    return '至 ' + fmtDate(o.expiry_date) + ' <span class="days' + (p.urgent ? ' soon' : '') + '">' + t + '</span>';
  }
  function promoHtml(p, isNew) {
    var o = p.o, h = '<li class="mp-item' + (p.urgent ? ' urgent' : '') + '" data-key="' + esc(p.key) + '">';
    h += '<div class="mp-top">' + (p.urgent ? '<span class="mp-flag">⏰ ' + (p.byMonthEnd ? '月底前完' : '快完') + '</span>' : '') +
      (isNew ? '<span class="mp-dot">NEW</span>' : '') +
      '<span class="mp-bank">' + esc(o.bank) + '</span><span class="mp-card">' + esc(o.card) + '</span></div>';
    h += '<div class="mp-title">' + esc(o.title) + '</div>';
    var k = promoKey(o); if (k) h += '<div class="keys">' + k + '</div>';
    h += '<div class="mp-meta">⏰ ' + expLine(p) + ' <span class="mp-added">🆕️ ' + fmtDM(o.added_date) + ' 加入</span></div>';
    if (o.requires_registration && o.registration_note_zh) {
      var dl = o.registration_deadline && o.registration_note_zh.indexOf(fmtDate(o.registration_deadline)) < 0 ? '（登記限期 ' + fmtDate(o.registration_deadline) + '）' : '';
      h += '<div class="regnote ' + esc(o.registration_method || 'other') + (o.registration_confirmed ? '' : ' unconfirmed') + '">' +
        (o.registration_method === 'app' && o.registration_note_zh.indexOf('📱') < 0 ? '📱 ' : '') + esc(o.registration_note_zh) + dl + '</div>';
    } else if (!o.requires_registration) {
      h += '<div class="mp-noreg">✅ 唔使登記</div>';
    }
    h += '<div class="acts">';
    if (o.registration_url) h += '<a class="btn btn-reg" href="' + esc(o.registration_url) + '" target="_blank" rel="noopener">去登記 ↗</a>';
    if (o.promo_url) h += '<a class="btn btn-promo" href="' + esc(o.promo_url) + '" target="_blank" rel="noopener">官方推廣頁 ↗</a>';
    else h += '<a class="btn btn-src" href="' + esc(o.source_url) + '" target="_blank" rel="noopener">官方來源 ↗</a>';
    h += '</div></li>';
    return h;
  }
  function changeHtml(list, unseen, focusId) {
    var o = list[0].o, isNew = list.some(function (x) { return unseen[x.key]; });
    var fields = uniq(list.map(function (x) { return FIELD_ZH[x.c.field] || '條款'; }));
    var h = '<li class="mc-item' + (focusId === o.id ? ' focus' : '') + '" data-oid="' + esc(o.id) + '">';
    h += '<div class="mp-top">' + (isNew ? '<span class="mp-dot">NEW</span>' : '') + '<span class="mc-field">⚠️ ' + esc(fields.join('、')) + '有變</span>' +
      '<span class="mp-bank">' + esc(o.bank) + '</span><span class="mp-card">' + esc(o.card) + '（' + esc(o.offer_type) + '）</span></div>';
    var srcs = [], olds = [];
    list.forEach(function (x) {
      var c = x.c;
      if (list.length > 1) h += '<div class="mc-label">' + esc(FIELD_ZH[c.field] || '條款') + '</div>';
      h += '<div class="mc-diff"><div class="mc-old"><span>之前</span>' + esc(c.old_zh) + '</div><div class="mc-new"><span>而家</span>' + esc(c.new_zh) + '</div></div>';
      if (c.note_zh) h += '<div class="mc-note">💡 ' + esc(c.note_zh) + '</div>';
      if (srcs.indexOf(c.source_url) < 0) srcs.push(c.source_url);
      if (c.old_source_url && olds.indexOf(c.old_source_url) < 0) olds.push(c.old_source_url);
    });
    var dates = uniq(list.map(function (x) { return fmtDate(x.c.date); }));
    h += '<div class="mp-meta">📅 ' + dates.join('、') + ' 記錄（香港時間）</div><div class="acts">';
    srcs.forEach(function (u, i) { h += '<a class="btn btn-promo" href="' + esc(u) + '" target="_blank" rel="noopener">官方新條款' + (srcs.length > 1 ? ' ' + (i + 1) : '') + ' ↗</a>'; });
    olds.forEach(function (u, i) { h += '<a class="btn btn-src" href="' + esc(u) + '" target="_blank" rel="noopener">舊條款' + (olds.length > 1 ? ' ' + (i + 1) : '') + ' ↗</a>'; });
    if (o.card_id && window.RocBApp) h += '<button type="button" class="btn btn-src mc-show" data-card="' + esc(o.card) + '">喺列表睇呢張卡 ›</button>';
    h += '</div></li>';
    return h;
  }
  function byOffer(changes) {
    var map = {}, out = [];
    changes.forEach(function (x) { if (!map[x.o.id]) { map[x.o.id] = []; out.push(map[x.o.id]); } map[x.o.id].push(x); });
    return out;
  }
  function buildSheet() {
    if (document.getElementById('mbSheet')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="mb-overlay" id="mbOverlay" hidden></div>' +
      '<section class="mb-sheet" id="mbSheet" role="dialog" aria-modal="true" aria-labelledby="mbTitle" hidden tabindex="-1">' +
      '<header class="mb-head"><span class="mb-grab" aria-hidden="true"></span><div><h2 id="mbTitle"></h2><small id="mbSub"></small></div>' +
      '<button type="button" class="qa-close" id="mbClose" aria-label="關閉">✕</button></header>' +
      '<div class="mb-body" id="mbBody"></div></section>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    document.getElementById('mbClose').addEventListener('click', close);
    document.getElementById('mbOverlay').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('mbSheet').hidden) close(); });
    document.getElementById('mbBody').addEventListener('click', function (e) {
      var j = e.target.closest('[data-jump]');
      if (j) { var t = document.getElementById(j.dataset.jump); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var s = e.target.closest('.mc-show');
      if (s && window.RocBApp) { close(); window.RocBApp.applyFilter({ q: s.dataset.card }); }
    });
  }
  function open(section, focusId) {
    if (!DATA) return;
    buildSheet();
    var m = compute(), unseen = {}, anySeen = everSeen();
    unseenKeys(m).forEach(function (k) { unseen[k] = 1; });
    document.getElementById('mbTitle').textContent = '🆕️ ' + m.month + ' 月新優惠';
    document.getElementById('mbSub').textContent = fmtDate(m.ym + '-01') + ' 至 ' + fmtDate(m.monthEnd) + ' 新加入、仲未完嘅限時推廣（香港時間）· 全部連銀行官網';
    var h = '<nav class="mb-jump">' +
      '<button type="button" class="chip" data-jump="mbPromos">🔥 新限時推廣 <b>' + m.promos.length + '</b></button>' +
      (m.soon ? '<button type="button" class="chip soon" data-jump="mbPromos">⏰ 月底前完 <b>' + m.soon + '</b></button>' : '') +
      '<button type="button" class="chip warn" data-jump="mbChanges">⚠️ 條款有變 <b>' + m.changedOffers + '</b></button></nav>';
    h += '<h3 class="mb-sec" id="mbPromos">🔥 本月新增限時推廣（' + m.promos.length + '）</h3>';
    if (m.promos.length) h += '<p class="mb-hint">⏰ 月底前或 7 日內完嘅排最頂；📱 要用 App 登記；「去登記」同「官方推廣頁」都係銀行官網。</p><ul class="mp-list">' +
      m.promos.map(function (p) { return promoHtml(p, anySeen && unseen[p.key]); }).join('') + '</ul>';
    else h += '<p class="mb-empty">😺 ' + m.month + ' 月暫時未有新加入嘅限時推廣，每朝更新後會自動顯示。</p>';
    h += '<h3 class="mb-sec warn" id="mbChanges">⚠️ 最近條款有變（' + m.changedOffers + ' 個優惠）</h3>';
    if (m.changes.length) h += '<p class="mb-hint">銀行最近（本月或 30 日內）改咗嘅重要條款（例如回贈率、上限、簽賬要求、有效期、迎新金額）。已申請或者打算申請嘅，記得睇返官方新條款。</p><ul class="mc-list">' +
      byOffer(m.changes).map(function (list) { return changeHtml(list, anySeen ? unseen : {}, focusId); }).join('') + '</ul>';
    else h += '<p class="mb-empty">最近暫時未有記錄到重大條款改動。</p>';
    h += '<p class="mb-disc">資料只供參考，以銀行官方條款為準。</p>';
    document.getElementById('mbBody').innerHTML = h;
    lastFocus = document.activeElement;
    document.getElementById('mbOverlay').hidden = false;
    var sheet = document.getElementById('mbSheet');
    sheet.hidden = false;
    document.body.classList.add('mb-lock');
    var body = document.getElementById('mbBody');
    body.scrollTop = 0;
    var target = focusId ? body.querySelector('.mc-item.focus') : section === 'changes' ? document.getElementById('mbChanges') : null;
    if (target) setTimeout(function () { body.scrollTop = target.offsetTop - body.offsetTop - 8; }, 0);
    setTimeout(function () { sheet.focus({ preventScroll: true }); }, 0);
    // mark everything currently listed as seen
    var keys = loadSeen().keys.slice();
    m.promos.forEach(function (p) { if (keys.indexOf(p.key) < 0) keys.push(p.key); });
    m.changes.forEach(function (x) { if (keys.indexOf(x.key) < 0) keys.push(x.key); });
    saveSeen(keys);
  }
  function close() {
    var sheet = document.getElementById('mbSheet'); if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.getElementById('mbOverlay').hidden = true;
    document.body.classList.remove('mb-lock');
    renderBanner();
    var f = document.getElementById('mbOpen') || lastFocus;
    if (f && f.focus) f.focus({ preventScroll: true });
  }

  window.RocBMonthly = {
    compute: function (asOf) { return compute(DATA, asOf); },
    open: open, close: close,
    fieldZh: FIELD_ZH,
    resetSeen: function () { mem = null; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } renderBanner(); }
  };
  document.addEventListener('rocb:data', function (e) { DATA = e.detail; renderBanner(); });
  if (window.RocBApp) { DATA = window.RocBApp.getData(); renderBanner(); }
})();

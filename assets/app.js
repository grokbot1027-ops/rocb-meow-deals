/* Roc B 喵喵著數 — renders data/offers.json (single source of truth). No build step. */
(function () {
  'use strict';
  var CAT_ORDER = ['迎新', '現金回贈', '里數', '餐飲', '網購', '海外', '超市', '交通', '內地／澳門', '日本', '電子產品', '電子錢包', '購物', '繳費／保險', '分期', '生活'];
  var TYPE_ORDER = ['迎新', '簽賬回贈', '限時推廣'];
  var CARDTYPE_ORDER = ['現金回贈卡', '里數卡', '積分卡', '不限／多款'];
  // default display order of issuers (major banks first)
  var BANK_ORDER = ['hsbc', 'hangseng', 'boc', 'sc', 'citi', 'dbs', 'bea', 'amex', 'aeon', 'dahsing', 'icbc', 'cncbi', 'ccba', 'fubon', 'mox', 'primecredit', 'samsung'];
  function bankRank(o) { var i = BANK_ORDER.indexOf(o.bank_key); return i < 0 ? 99 : i; }

  var state = { q: '', sort: 'default', cat: [], type: [], cardtype: [], bank: [], hideExpired: true, onlyNoReg: false };
  var data = [], open = {};
  var $ = function (id) { return document.getElementById(id); };

  // today's date in Hong Kong (YYYY-MM-DD)
  function hkToday() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  var TODAY = hkToday();
  function daysLeft(iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(TODAY + 'T00:00:00Z')) / 86400000); }
  function fmtDate(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return Number(n).toLocaleString('en-US'); }
  function isExpired(o) { return o.expiry_date && daysLeft(o.expiry_date) < 0; }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  function haystack(o) {
    return norm([o.bank, o.card, o.title, o.summary_zh, (o.categories || []).join(' '), (o.key_terms || []).join(' '), o.caps, o.offer_type, o.card_type, o.issuer_type, o.validity_text].join(' '));
  }

  // ---------- URL hash state ----------
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (kv) {
      var p = kv.split('='), k = p[0], v = decodeURIComponent(p[1] || '');
      if (['cat', 'type', 'cardtype', 'bank'].indexOf(k) >= 0) state[k] = v ? v.split(',') : [];
      else if (k === 'q' || k === 'sort') state[k] = v;
      else if (['hideExpired', 'onlyNoReg'].indexOf(k) >= 0) state[k] = v === '1';
    });
  }
  function writeHash() {
    var parts = [];
    ['cat', 'type', 'cardtype', 'bank'].forEach(function (k) { if (state[k].length) parts.push(k + '=' + encodeURIComponent(state[k].join(','))); });
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.sort !== 'default') parts.push('sort=' + state.sort);
    if (!state.hideExpired) parts.push('hideExpired=0');
    if (state.onlyNoReg) parts.push('onlyNoReg=1');
    var h = parts.join('&');
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  // ---------- filters ----------
  function matches(o, skip) {
    if (state.hideExpired && isExpired(o)) return false;
    if (state.onlyNoReg && o.requires_registration) return false;
    if (skip !== 'cat' && state.cat.length && !state.cat.every(function (c) { return o.categories.indexOf(c) >= 0; })) return false;
    if (skip !== 'type' && state.type.length && state.type.indexOf(o.offer_type) < 0) return false;
    if (skip !== 'cardtype' && state.cardtype.length && state.cardtype.indexOf(o.card_type) < 0) return false;
    if (skip !== 'bank' && state.bank.length && state.bank.indexOf(o.bank) < 0) return false;
    if (state.q) {
      var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean), hs = o._hs;
      for (var i = 0; i < terms.length; i++) if (hs.indexOf(norm(terms[i])) < 0) return false;
    }
    return true;
  }

  function buildChips(elId, key, values, getter) {
    var el = $(elId);
    el.innerHTML = '';
    values.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.v = v;
      b.setAttribute('aria-pressed', state[key].indexOf(v) >= 0 ? 'true' : 'false');
      b.innerHTML = esc(v) + '<span class="n"></span>';
      b.addEventListener('click', function () {
        var i = state[key].indexOf(v);
        if (i >= 0) state[key].splice(i, 1); else state[key].push(v);
        update();
      });
      el.appendChild(b);
    });
    el._getter = getter; el._key = key;
  }

  function refreshChipCounts() {
    [['f-cat', 'cat', function (o, v) { return o.categories.indexOf(v) >= 0; }],
     ['f-type', 'type', function (o, v) { return o.offer_type === v; }],
     ['f-cardtype', 'cardtype', function (o, v) { return o.card_type === v; }],
     ['f-bank', 'bank', function (o, v) { return o.bank === v; }]].forEach(function (cfg) {
      var el = $(cfg[0]), key = cfg[1], test = cfg[2];
      var pool = data.filter(function (o) { return matches(o, key === 'cat' ? null : key); });
      Array.prototype.forEach.call(el.children, function (b) {
        var v = b.dataset.v;
        var n = pool.filter(function (o) { return test(o, v); }).length;
        b.querySelector('.n').textContent = n;
        b.setAttribute('aria-pressed', state[key].indexOf(v) >= 0 ? 'true' : 'false');
      });
    });
    $('bankSel').textContent = state.bank.length ? '已揀 ' + state.bank.length + ' 間' : '全部';
  }

  // ---------- sorting ----------
  function welcomeScore(o) { return (o.welcome_value_hkd || 0) + (o.welcome_miles ? o.welcome_miles * 0.1 : 0); }
  function sorter(mode) {
    var nullLast = function (a, b, f, dir) {
      var x = f(a), y = f(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return dir * (x - y);
    };
    var byBank = function (a, b) { return (bankRank(a) - bankRank(b)) || a.bank.localeCompare(b.bank, 'zh-Hant') || a.card.localeCompare(b.card, 'zh-Hant') || (TYPE_ORDER.indexOf(a.offer_type) - TYPE_ORDER.indexOf(b.offer_type)); };
    return {
      'default': function (a, b) { return (bankRank(a) - bankRank(b)) || a.card.localeCompare(b.card, 'zh-Hant') || (TYPE_ORDER.indexOf(a.offer_type) - TYPE_ORDER.indexOf(b.offer_type)); },
      rebate: function (a, b) { return nullLast(a, b, function (o) { return o.rebate_pct; }, -1) || byBank(a, b); },
      mile: function (a, b) { return nullLast(a, b, function (o) { return o.hkd_per_mile; }, 1) || byBank(a, b); },
      welcome: function (a, b) { return nullLast(a, b, function (o) { var s = welcomeScore(o); return s ? s : null; }, -1) || byBank(a, b); },
      expiry: function (a, b) { return nullLast(a, b, function (o) { return o.expiry_date ? Date.parse(o.expiry_date) : null; }, 1) || byBank(a, b); },
      bank: byBank
    }[mode] || byBank;
  }

  // ---------- rendering ----------
  function keyNumbers(o) {
    var h = [];
    if (o.rebate_pct != null) h.push('<span class="k big" title="最高回贈率">' + o.rebate_pct + '%</span>');
    if (o.hkd_per_mile != null) h.push('<span class="k mile" title="每里成本">HK$' + o.hkd_per_mile + '/里</span>');
    if (o.welcome_value_hkd && o.welcome_miles && o.card_type === '里數卡') h.push('<span class="k wel" title="迎新（以里數計）">🎁 ' + num(o.welcome_miles) + ' 里</span>');
    else {
      if (o.welcome_value_hkd) h.push('<span class="k wel" title="迎新價值">🎁 $' + num(o.welcome_value_hkd) + '</span>');
      if (o.welcome_miles) h.push('<span class="k wel" title="迎新里數">🎁 ' + num(o.welcome_miles) + ' 里</span>');
    }
    if (o.min_spend_hkd) h.push('<span class="k" title="簽賬要求">簽 $' + num(o.min_spend_hkd) + '</span>');
    if (o.caps) h.push('<span class="k cap" title="上限／條件">上限：' + esc(o.caps) + '</span>');
    return h.join('') || '<span class="muted">—</span>';
  }

  function expiryCell(o) {
    if (!o.expiry_date) return '<span class="exp muted">未有列明</span>';
    var d = daysLeft(o.expiry_date), cls = d <= 14 ? 'days soon' : 'days';
    var t = d < 0 ? '已過期' : d === 0 ? '今日最後一日' : '仲有 ' + d + ' 日';
    return '<span class="exp">' + fmtDate(o.expiry_date) + '</span><span class="' + cls + '">' + t + '</span>';
  }

  // registration remark — always visible (not hidden behind 詳情)
  function regNote(o) {
    if (!o.requires_registration || !o.registration_note_zh) return '';
    var cls = 'regnote ' + (o.registration_method || 'other') + (o.registration_confirmed ? '' : ' unconfirmed');
    var h = '<div class="' + cls + '"><span class="regtxt">' + esc(o.registration_note_zh) + '</span>';
    if (o.registration_deadline && o.registration_note_zh.indexOf(fmtDate(o.registration_deadline)) < 0) h += ' <span class="regdl">（登記限期 ' + fmtDate(o.registration_deadline) + '）</span>';
    if (o.registration_url) h += ' <a class="btn btn-reg" href="' + esc(o.registration_url) + '" target="_blank" rel="noopener">去登記 ↗</a>';
    return h + '</div>';
  }
  // official link buttons
  function linkBtns(o) {
    var h = '';
    if (o.promo_url) h += '<a class="btn btn-promo" href="' + esc(o.promo_url) + '" target="_blank" rel="noopener">官方推廣頁 ↗</a>';
    if (!o.promo_url || o.promo_url !== o.source_url) h += '<a class="btn btn-src" href="' + esc(o.source_url) + '" target="_blank" rel="noopener">' + (o.promo_url ? '官方條款／來源 ↗' : '官方來源 ↗') + '</a>';
    return '<div class="links">' + h + '</div>';
  }

  function srcLinks(list) {
    return (list || []).map(function (s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>'; }).join('');
  }

  function detailHtml(o) {
    var h = '<div class="detail" role="region" aria-label="詳情">';
    h += '<h4>優惠內容</h4><p>' + esc(o.summary_zh) + '</p>';
    if (o.caps) h += '<h4>上限／條件</h4><p>' + esc(o.caps) + '</p>';
    if (o.key_terms && o.key_terms.length) h += '<h4>重要條款</h4><ul>' + o.key_terms.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    h += '<h4>有效期</h4><p>' + esc(o.validity_text || '未有列明') + '</p>';
    var meta = [];
    if (o.annual_fee_hkd != null) meta.push('年費：HK$' + num(o.annual_fee_hkd) + (o.annual_fee_note ? '（' + esc(o.annual_fee_note) + '）' : ''));
    else if (o.annual_fee_note) meta.push('年費：' + esc(o.annual_fee_note));
    if (o.fx_fee_pct != null) meta.push('外幣手續費：' + o.fx_fee_pct + '%');
    if (meta.length) h += '<h4>卡資料</h4><p>' + meta.join(' · ') + '</p>';
    if (o.requires_registration && o.registration_app) h += '<h4>登記方法</h4><p>' + esc(o.registration_note_zh) + (o.registration_app ? '（App：' + esc(o.registration_app) + '）' : '') + '</p>';
    h += '<h4>官方資料來源</h4><ul class="src"><li><a href="' + esc(o.source_url) + '" target="_blank" rel="noopener">' + esc(o.source_label || '官方網頁') + '</a></li>' + srcLinks(o.extra_sources) + '</ul>';
    h += '<p class="muted">最後檢查：' + fmtDate(o.last_checked) + '（香港時間）</p></div>';
    return h;
  }

  function rowHtml(o) {
    var isOpen = !!open[o.id];
    var h = '<div class="row offer' + (isExpired(o) ? ' expired' : '') + '" role="row" tabindex="0" aria-expanded="' + isOpen + '" data-id="' + esc(o.id) + '">';
    h += '<div class="c-bank" role="cell"><span class="bank-name">' + esc(o.bank) + '</span><span class="issuer">' + esc(o.issuer_type) + '</span></div>';
    h += '<div class="c-card" role="cell"><div class="card-name">' + esc(o.card) + '</div>';
    h += '<div class="title"><span class="otype t-' + esc(o.offer_type) + '">' + esc(o.offer_type) + '</span>' + (o.offer_type === '限時推廣' ? esc(o.title) : '') + '</div>';
    h += '<div class="tags">' + o.categories.map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + '</div>' + regNote(o) + '</div>';
    h += '<div class="c-key" role="cell"><div class="keys">' + keyNumbers(o) + '</div></div>';
    h += '<div class="c-exp" role="cell">' + expiryCell(o) + '</div>';
    h += '<div class="c-ver" role="cell">' + linkBtns(o) + '<div class="chev">' + (isOpen ? '收起 ▴' : '詳情 ▾') + '</div></div>';
    if (isOpen) h += detailHtml(o);
    h += '</div>';
    return h;
  }

  function render() {
    var list = data.filter(function (o) { return matches(o); }).sort(sorter(state.sort));
    $('rows').innerHTML = list.map(rowHtml).join('');
    $('shown').textContent = list.length;
    $('empty').hidden = list.length > 0;
  }

  function update() {
    writeHash();
    refreshChipCounts();
    render();
  }

  function syncInputs() {
    $('q').value = state.q; $('sort').value = state.sort;
    $('hideExpired').checked = state.hideExpired; $('onlyNoReg').checked = state.onlyNoReg;
  }

  function init(json) {
    data = json.map(function (o) { o.categories = o.categories || []; o._hs = haystack(o); return o; });
    var last = data.reduce(function (m, o) { return o.last_checked > m ? o.last_checked : m; }, '');
    $('lastUpdated').textContent = fmtDate(last);
    $('totalCount').textContent = data.length;
    var present = function (field, order) {
      var set = {};
      data.forEach(function (o) { [].concat(o[field]).forEach(function (v) { if (v) set[v] = 1; }); });
      var vals = Object.keys(set);
      return order ? order.filter(function (v) { return set[v]; }).concat(vals.filter(function (v) { return order.indexOf(v) < 0; })) : vals.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
    };
    readHash();
    buildChips('f-cat', 'cat', present('categories', CAT_ORDER));
    buildChips('f-type', 'type', present('offer_type', TYPE_ORDER));
    buildChips('f-cardtype', 'cardtype', present('card_type', CARDTYPE_ORDER));
    var banks = present('bank');
    // order banks by number of offers (most first)
    var cnt = {}; data.forEach(function (o) { cnt[o.bank] = (cnt[o.bank] || 0) + 1; });
    banks.sort(function (a, b) { return cnt[b] - cnt[a] || a.localeCompare(b, 'zh-Hant'); });
    buildChips('f-bank', 'bank', banks);
    if (state.bank.length) $('bankDetails').open = true;
    syncInputs();

    var t;
    $('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { state.q = e.target.value.trim(); update(); }, 120); });
    $('sort').addEventListener('change', function (e) { state.sort = e.target.value; update(); });
    ['hideExpired', 'onlyNoReg'].forEach(function (k) { $(k).addEventListener('change', function (e) { state[k] = e.target.checked; update(); }); });
    $('reset').addEventListener('click', function () {
      state = { q: '', sort: 'default', cat: [], type: [], cardtype: [], bank: [], hideExpired: true, onlyNoReg: false };
      syncInputs(); update();
    });
    document.querySelectorAll('.row.head button[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () { state.sort = b.dataset.sort; $('sort').value = state.sort; update(); });
    });
    var toggle = function (row) { var id = row.dataset.id; open[id] = !open[id]; render(); };
    $('rows').addEventListener('click', function (e) {
      if (e.target.closest('a') || e.target.closest('.detail')) return;
      var row = e.target.closest('.offer'); if (row) toggle(row);
    });
    $('rows').addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('offer')) { e.preventDefault(); toggle(e.target); }
    });
    update();
    // public API for the Q&A assistant (assets/assistant.js)
    window.RocBApp = {
      today: TODAY,
      getData: function () { return data; },
      applyFilter: function (patch) {
        state = { q: '', sort: 'default', cat: [], type: [], cardtype: [], bank: [], hideExpired: true, onlyNoReg: false };
        Object.keys(patch || {}).forEach(function (k) { state[k] = patch[k]; });
        syncInputs(); update();
        var el = document.getElementById('list'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    document.dispatchEvent(new CustomEvent('rocb:data', { detail: data }));
  }

  fetch('data/offers.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function (err) {
      $('rows').innerHTML = '<p class="empty">😿 載入優惠資料失敗（' + esc(err.message) + '），請稍後再試。</p>';
    });
})();

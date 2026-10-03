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

  // ---------- grouping: one row per card (offers grouped by card_id) ----------
  var groups = [];
  function buildGroups() {
    var map = {}, out = [];
    data.forEach(function (o) {
      var key = o.card_id ? 'c:' + o.card_id : 'p:' + o.id;
      var g = map[key];
      if (!g) {
        g = map[key] = { id: key, kind: o.card_id ? 'card' : 'promo', offers: [], bank: o.bank, bank_key: o.bank_key, issuer_type: o.issuer_type, card: o.card, card_type: o.card_type };
        out.push(g);
      }
      g.offers.push(o);
      if (o.offer_type !== '限時推廣') g.card = o.card; // prefer the card name used by welcome / rewards records
    });
    out.forEach(function (g) {
      g.offers.sort(function (a, b) { return TYPE_ORDER.indexOf(a.offer_type) - TYPE_ORDER.indexOf(b.offer_type) || String(a.expiry_date || '9').localeCompare(String(b.expiry_date || '9')); });
      var feeSrc = g.offers.filter(function (o) { return o.offer_type === '簽賬回贈' && (o.annual_fee_hkd != null || o.annual_fee_note); })[0] ||
                   g.offers.filter(function (o) { return o.offer_type !== '限時推廣' && (o.annual_fee_hkd != null || o.annual_fee_note); })[0];
      g.fee = feeSrc ? { hkd: feeSrc.annual_fee_hkd, note: feeSrc.annual_fee_note } : null;
    });
    return out;
  }

  // ---------- filters ----------
  // per-offer filters (an offer hidden by these is not shown inside its card)
  function offerVisible(o) {
    if (state.hideExpired && isExpired(o)) return false;
    if (state.onlyNoReg && o.requires_registration) return false;
    return true;
  }
  function visibleOffers(g) { return g.offers.filter(offerVisible); }
  function union(list, f) { var set = {}; list.forEach(function (o) { [].concat(o[f]).forEach(function (v) { if (v) set[v] = 1; }); }); return set; }
  // card-level match: a card matches when its (visible) offers together satisfy every filter
  function groupMatches(g, skip) {
    var vis = visibleOffers(g);
    if (!vis.length) return false;
    if (skip !== 'cat' && state.cat.length) { var cats = union(vis, 'categories'); if (!state.cat.every(function (c) { return cats[c]; })) return false; }
    if (skip !== 'type' && state.type.length && !vis.some(function (o) { return state.type.indexOf(o.offer_type) >= 0; })) return false;
    if (skip !== 'cardtype' && state.cardtype.length && state.cardtype.indexOf(g.card_type) < 0) return false;
    if (skip !== 'bank' && state.bank.length && state.bank.indexOf(g.bank) < 0) return false;
    if (state.q) {
      var hs = vis.map(function (o) { return o._hs; }).join('|');
      var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (hs.indexOf(norm(terms[i])) < 0) return false;
    }
    return true;
  }

  function buildChips(elId, key, values) {
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
  }

  // chip counts = number of cards (plus multi-card promos) that would match
  function refreshChipCounts() {
    [['f-cat', 'cat', function (g, v) { return union(visibleOffers(g), 'categories')[v]; }],
     ['f-type', 'type', function (g, v) { return visibleOffers(g).some(function (o) { return o.offer_type === v; }); }],
     ['f-cardtype', 'cardtype', function (g, v) { return g.card_type === v; }],
     ['f-bank', 'bank', function (g, v) { return g.bank === v; }]].forEach(function (cfg) {
      var el = $(cfg[0]), key = cfg[1], test = cfg[2];
      var pool = groups.filter(function (g) { return groupMatches(g, key === 'cat' ? null : key); });
      Array.prototype.forEach.call(el.children, function (b) {
        var v = b.dataset.v;
        b.querySelector('.n').textContent = pool.filter(function (g) { return test(g, v); }).length;
        b.setAttribute('aria-pressed', state[key].indexOf(v) >= 0 ? 'true' : 'false');
      });
    });
    $('bankSel').textContent = state.bank.length ? '已揀 ' + state.bank.length + ' 間' : '全部';
  }

  // ---------- sorting (card level: best relevant value of the card) ----------
  var SPEND_CATS = CAT_ORDER.filter(function (c) { return ['迎新', '現金回贈', '里數'].indexOf(c) < 0; });
  function welcomeScore(o) { return (o.welcome_value_hkd || 0) + (o.welcome_miles ? o.welcome_miles * 0.1 : 0); }
  function relevantOffers(g) {
    var vis = visibleOffers(g);
    if (state.type.length) { var t = vis.filter(function (o) { return state.type.indexOf(o.offer_type) >= 0; }); if (t.length) return t; }
    return vis;
  }
  function best(list, f, dir) { var b = null; list.forEach(function (o) { var v = f(o); if (v != null && (b == null || dir * (v - b) > 0)) b = v; }); return b; }
  function rateOf(o) {
    var cats = state.cat.filter(function (c) { return SPEND_CATS.indexOf(c) >= 0; });
    if (!cats.length) return o.rebate_pct;
    return best(cats, function (c) {
      if (o.cat_rates && o.cat_rates[c] != null) return o.cat_rates[c];
      return o.categories.indexOf(c) >= 0 ? o.rebate_pct : null;
    }, 1);
  }
  var METRIC = {
    rebate: [function (g) { return best(relevantOffers(g), rateOf, 1); }, -1],
    mile: [function (g) { return best(relevantOffers(g), function (o) { return o.hkd_per_mile; }, -1); }, 1],
    welcome: [function (g) { var v = best(relevantOffers(g), function (o) { var s = welcomeScore(o); return s || null; }, 1); return v; }, -1],
    expiry: [function (g) { return best(relevantOffers(g), function (o) { return o.expiry_date && daysLeft(o.expiry_date) >= 0 ? Date.parse(o.expiry_date) : null; }, -1); }, 1]
  };
  function sorter(mode) {
    var byBank = function (a, b) { return (bankRank(a) - bankRank(b)) || a.bank.localeCompare(b.bank, 'zh-Hant') || a.card.localeCompare(b.card, 'zh-Hant'); };
    var m = METRIC[mode];
    if (!m) return byBank;
    return function (a, b) {
      var x = m[0](a), y = m[0](b);
      if (x == null && y == null) return byBank(a, b); if (x == null) return 1; if (y == null) return -1;
      return (m[1] * (x - y)) || byBank(a, b);
    };
  }

  // ---------- rendering ----------
  function expiryText(o, prefix) {
    if (!o.expiry_date) return '<span class="exp muted">' + esc(o.validity_text && o.validity_text !== '未有列明' ? o.validity_text : '到期日未有列明') + '</span>';
    var d = daysLeft(o.expiry_date), cls = d <= 14 ? 'days soon' : 'days';
    var t = d < 0 ? '已過期' : d === 0 ? '今日最後一日' : '仲有 ' + d + ' 日';
    return '<span class="exp">' + (prefix || '') + fmtDate(o.expiry_date) + '</span> <span class="' + cls + '">' + t + '</span>';
  }

  // registration remark — always visible, next to the block it belongs to
  function regNote(o) {
    if (!o.requires_registration || !o.registration_note_zh) return '';
    var cls = 'regnote ' + (o.registration_method || 'other') + (o.registration_confirmed ? '' : ' unconfirmed');
    var h = '<div class="' + cls + '"><span class="regtxt">' + esc(o.registration_note_zh) + '</span>';
    if (o.registration_deadline && o.registration_note_zh.indexOf(fmtDate(o.registration_deadline)) < 0) h += ' <span class="regdl">（登記限期 ' + fmtDate(o.registration_deadline) + '）</span>';
    if (o.registration_url) h += ' <a class="btn btn-reg" href="' + esc(o.registration_url) + '" target="_blank" rel="noopener">去登記 ↗</a>';
    return h + '</div>';
  }
  function linkBtns(o) {
    var h = '';
    if (o.promo_url) h += '<a class="btn btn-promo" href="' + esc(o.promo_url) + '" target="_blank" rel="noopener">官方推廣頁 ↗</a>';
    if (!o.promo_url || o.promo_url !== o.source_url) h += '<a class="btn btn-src" href="' + esc(o.source_url) + '" target="_blank" rel="noopener">' + (o.promo_url ? '官方條款／來源 ↗' : '官方來源 ↗') + '</a>';
    return h;
  }
  function moreBtn(o) { return '<button type="button" class="more" data-oid="' + esc(o.id) + '" aria-expanded="' + !!open[o.id] + '">' + (open[o.id] ? '收起 ▴' : '詳情 ▾') + '</button>'; }
  function srcLinks(list) {
    return (list || []).map(function (s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>'; }).join('');
  }
  function detailHtml(o) {
    if (!open[o.id]) return '';
    var h = '<div class="detail" role="region" aria-label="詳情">';
    h += '<h4>優惠內容</h4><p>' + esc(o.summary_zh) + '</p>';
    if (o.caps) h += '<h4>上限／條件</h4><p>' + esc(o.caps) + '</p>';
    if (o.key_terms && o.key_terms.length) h += '<h4>重要條款</h4><ul>' + o.key_terms.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    h += '<h4>有效期</h4><p>' + esc(o.validity_text || '未有列明') + '</p>';
    if (o.fx_fee_pct != null) h += '<h4>外幣手續費</h4><p>' + o.fx_fee_pct + '%</p>';
    h += '<h4>官方資料來源</h4><ul class="src"><li><a href="' + esc(o.source_url) + '" target="_blank" rel="noopener">' + esc(o.source_label || '官方網頁') + '</a></li>' + srcLinks(o.extra_sources) + '</ul>';
    h += '<p class="muted">最後檢查：' + fmtDate(o.last_checked) + '（香港時間）</p></div>';
    return h;
  }
  // spending window quoted from the official summary, e.g. 「發卡後 60 日內」「首 2 個月」
  var WIN_RE = /(?:發卡後首?|批卡後首?|首)\s*\d+\s*(?:日|天|個月)內?|\d+\s*(?:日|天|個月)內/g;
  function spendWindow(o) {
    var seg = String(o.summary_zh || '').split('→')[0], m;
    WIN_RE.lastIndex = 0;
    while ((m = WIN_RE.exec(seg))) {
      var prev = seg.charAt(m.index - 1);
      if (prev !== '–' && prev !== '-' && prev !== ',' && !/\d/.test(prev)) return m[0].replace(/\s+/g, ' ').trim();
    }
    return '';
  }
  function giftChips(o) {
    var h = [];
    if (o.welcome_value_hkd && o.welcome_miles && o.card_type === '里數卡') h.push('<span class="k wel">🎁 ' + num(o.welcome_miles) + ' 里</span>');
    else {
      if (o.welcome_value_hkd) h.push('<span class="k wel">🎁 $' + num(o.welcome_value_hkd) + '</span>');
      if (o.welcome_miles) h.push('<span class="k wel">🎁 ' + num(o.welcome_miles) + ' 里</span>');
    }
    if (o.min_spend_hkd) { var w = spendWindow(o); h.push('<span class="k">' + (w ? esc(w) + '簽' : '簽') + ' $' + num(o.min_spend_hkd) + '</span>'); }
    return h.join('');
  }
  function welcomeItem(o) {
    var h = '<div class="item' + (isExpired(o) ? ' expired' : '') + '">';
    var g = giftChips(o);
    h += '<div class="keys">' + (g || '<span class="muted small">' + esc(o.title) + '</span>') + '</div>';
    h += '<div class="meta">⏰ ' + expiryText(o, '申請／推廣至 ') + '</div>';
    h += regNote(o);
    h += '<div class="acts">' + linkBtns(o) + moreBtn(o) + '</div>' + detailHtml(o) + '</div>';
    return h;
  }
  function rewardItem(o) {
    var h = '<div class="item' + (isExpired(o) ? ' expired' : '') + '"><div class="keys">';
    if (o.rebate_pct != null) h += '<span class="k big" title="最高回贈率">最高 ' + o.rebate_pct + '%</span>';
    if (o.hkd_per_mile != null) h += '<span class="k mile" title="每里成本">HK$' + o.hkd_per_mile + '/里</span>';
    var cr = o.cat_rates ? Object.keys(o.cat_rates).sort(function (a, b) { return o.cat_rates[b] - o.cat_rates[a]; }) : [];
    cr.forEach(function (c) { h += '<span class="k cr">' + esc(c) + ' ' + o.cat_rates[c] + '%</span>'; });
    if (o.rebate_pct == null && o.hkd_per_mile == null && !cr.length) h += '<span class="muted small">' + esc(o.title) + '</span>';
    h += '</div>';
    if (o.caps) h += '<div class="cap">上限／條件：' + esc(o.caps) + '</div>';
    if (o.expiry_date) h += '<div class="meta">⏰ ' + expiryText(o, '回贈計劃至 ') + '</div>';
    h += regNote(o);
    h += '<div class="acts">' + linkBtns(o) + moreBtn(o) + '</div>' + detailHtml(o) + '</div>';
    return h;
  }
  function feeLine(g) {
    if (!g.fee) return '';
    var hk = g.fee.hkd != null ? 'HK$' + num(g.fee.hkd) : '', note = g.fee.note || '';
    var t = note ? (hk && note.indexOf(num(g.fee.hkd)) < 0 ? hk + ' · ' + note : note) : hk;
    return '<div class="fee">💰 年費：' + esc(t) + '</div>';
  }
  function promoKey(o) {
    if (o.rebate_pct != null) return '<span class="k big sm">' + o.rebate_pct + '%</span>';
    if (o.welcome_value_hkd) return '<span class="k wel sm">$' + num(o.welcome_value_hkd) + '</span>';
    if (o.hkd_per_mile != null) return '<span class="k mile sm">HK$' + o.hkd_per_mile + '/里</span>';
    return '';
  }
  function promoItem(o, showCard) {
    var h = '<div class="pitem' + (isExpired(o) ? ' expired' : '') + '">';
    h += '<div class="pline"><span class="ptitle">' + esc(o.title) + '</span> ' + promoKey(o) + ' <span class="pexp">⏰ ' + expiryText(o, '至 ') + '</span></div>';
    if (showCard) h += '<div class="small muted">適用：' + esc(o.card) + '</div>';
    h += regNote(o);
    h += '<div class="acts">' + linkBtns(o) + moreBtn(o) + '</div>' + detailHtml(o) + '</div>';
    return h;
  }

  function cardRow(g) {
    var vis = visibleOffers(g);
    var wel = vis.filter(function (o) { return o.offer_type === '迎新'; });
    var rew = vis.filter(function (o) { return o.offer_type === '簽賬回贈'; });
    var pro = vis.filter(function (o) { return o.offer_type === '限時推廣'; });
    var cats = union(vis, 'categories');
    var tags = CAT_ORDER.filter(function (c) { return cats[c]; });
    var h = '<article class="row cardrow" role="row" data-gid="' + esc(g.id) + '">';
    h += '<div class="c-card" role="cell"><div class="card-name">' + esc(g.card) + '</div>';
    h += '<div class="bankline"><span class="bank-name">' + esc(g.bank) + '</span> <span class="ctype">' + esc(g.card_type) + '</span></div>';
    h += '<div class="tags">' + tags.map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + '</div></div>';
    h += '<section class="blk wel" role="cell"><h3 class="blk-h">🎁 迎新</h3>' + (wel.length ? wel.map(welcomeItem).join('') : '<div class="none">暫無迎新</div>') + '</section>';
    h += '<section class="blk rew" role="cell"><h3 class="blk-h">💳 平時回贈</h3>' + (rew.length ? rew.map(rewardItem).join('') : '<div class="none">暫無平時回贈資料</div>') + feeLine(g) + '</section>';
    if (pro.length) h += '<section class="blk pro"><h3 class="blk-h">🔥 限時推廣（' + pro.length + '）</h3>' + pro.map(function (o) { return promoItem(o, false); }).join('') + '</section>';
    return h + '</article>';
  }
  function promoRow(g) {
    var o = g.offers[0];
    var h = '<article class="row promorow" data-gid="' + esc(g.id) + '">';
    h += '<div class="c-card"><div class="bank-name">' + esc(g.bank) + '</div><div class="small muted">' + esc(g.issuer_type) + '</div></div>';
    h += '<section class="blk pro">' + promoItem(o, true) + '</section></article>';
    return h;
  }

  function render() {
    var list = groups.filter(function (g) { return groupMatches(g); }).sort(sorter(state.sort));
    var cards = list.filter(function (g) { return g.kind === 'card'; });
    var promos = list.filter(function (g) { return g.kind === 'promo'; });
    $('rows').innerHTML = cards.map(cardRow).join('');
    $('promoRows').innerHTML = promos.map(promoRow).join('');
    $('promoSection').hidden = !promos.length;
    $('shown').textContent = cards.length;
    $('shownPromo').textContent = promos.length;
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
    groups = buildGroups();
    $('cardCount').textContent = groups.filter(function (g) { return g.kind === 'card'; }).length;
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
    // order banks by number of cards / promos (most first)
    var cnt = {}; groups.forEach(function (g) { cnt[g.bank] = (cnt[g.bank] || 0) + 1; });
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
    var onClick = function (e) {
      var b = e.target.closest('button.more'); if (!b) return;
      var id = b.dataset.oid; open[id] = !open[id]; render();
      var nb = document.querySelector('button.more[data-oid="' + id + '"]'); if (nb) nb.focus({ preventScroll: true });
    };
    $('rows').addEventListener('click', onClick);
    $('promoRows').addEventListener('click', onClick);
    update();
    // public API for the Q&A assistant (assets/assistant.js)
    window.RocBApp = {
      today: TODAY,
      getData: function () { return data; },
      getGroups: function () { return groups; },
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

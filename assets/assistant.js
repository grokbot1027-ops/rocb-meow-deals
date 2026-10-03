/* 問 Roc B — rule-based, client-side Q&A over data/offers.json (no API, no server).
   Every figure shown comes straight from offers.json fields; estimates are labelled as rough. */
(function () {
  'use strict';
  var DATA = null;
  var CAT_SYN = [
    ['網購', ['網購', '網上購物', '網上買', '網店', 'online', 'e-shop', '淘寶', 'taobao', 'amazon', 'hktvmall', '拼多多', '京東', 'jd.com', '小紅書', 'shopee', '網上']],
    ['餐飲', ['餐飲', '食飯', '食嘢', '食野', '餐廳', '飲食', '外賣', 'foodpanda', 'dining', 'restaurant', '食肆', '飲茶', '晚飯', '午餐']],
    ['日本', ['日本', 'japan', '日圓', '日元', '東京', '大阪']],
    ['海外', ['海外', '外幣', '旅行', '旅遊', '去旅', 'overseas', 'travel', 'foreign', '外國', '日本', 'japan', '韓國', 'korea', '台灣', '泰國', '歐洲', '美國', '出國', '出埠']],
    ['內地／澳門', ['內地', '大陸', '深圳', '北上', '澳門', '人民幣', 'china', 'mainland', 'macau', '雲閃付', '廣州']],
    ['超市', ['超市', 'supermarket', '百佳', '惠康', '買餸', 'grocery', '超級市場']],
    ['交通', ['交通', '港鐵', 'mtr', '巴士', '的士', '車費', 'transport', '八達通', 'octopus', '小巴', '渡輪']],
    ['電子錢包', ['電子錢包', 'apple pay', 'google pay', 'samsung pay', 'wechat', 'alipay', '支付寶', 'payme', '手機支付', '流動支付']],
    ['電子產品', ['iphone', '電話', '手機', '電子產品', '數碼', '買機', 'apple store']],
    ['繳費／保險', ['交稅', '繳費', '交費', '保險', '保費', 'tax', 'insurance', 'bill', '交學費']],
    ['分期', ['分期', 'instalment', 'installment']],
    ['里數', ['里數', '飛行里', 'miles', 'mile', 'asia miles', '亞洲萬里通', 'avios', '儲里', '飛行', '機票', '換機票', '航空', '里']],
    ['現金回贈', ['現金回贈', 'cashback', 'cash back', 'rebate', '回贈', '現金']],
    ['迎新', ['迎新', 'welcome', '新客', '開卡', '新卡', '申請卡', '開新卡']]
  ];
  var BANK_SYN = {
    hsbc: ['滙豐', '匯豐', 'hsbc'], hangseng: ['恒生', '恆生', 'hang seng', 'hangseng'], boc: ['中銀', '中國銀行', 'boc'],
    sc: ['渣打', 'standard chartered'], citi: ['花旗', 'citi'], dbs: ['星展', 'dbs'], bea: ['東亞', 'bea'],
    amex: ['美國運通', '運通', 'amex', 'american express'], aeon: ['aeon', '永旺'], dahsing: ['大新', 'dah sing'],
    icbc: ['工銀', 'icbc', '工商'], cncbi: ['信銀', '中信', 'cncbi'], ccba: ['建行', 'ccb'], fubon: ['富邦', 'fubon'],
    mox: ['mox'], primecredit: ['安信', 'wewa', 'earnmore', 'primecredit'], sim: ['sim卡', 'sim credit']
  };
  var STOP = { card: 1, credit: 1, visa: 1, world: 1, mastercard: 1, signature: 1, platinum: 1, infinite: 1, unionpay: 1, the: 1, hsbc: 1, citi: 1, dbs: 1, aeon: 1, bea: 1, mox: 1, sim: 1, bank: 1, express: 1, american: 1 };
  var CHIPS = ['網購邊張卡最抵', '儲 Asia Miles 用邊張', '去日本簽咩卡', '超市', '迎新最多', '唔使年費', '月簽 $5000 網購', '食飯用邊張'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function today() { return (window.RocBApp && window.RocBApp.today) || new Date().toISOString().slice(0, 10); }
  function daysLeft(iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 86400000); }
  function fmtDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function expired(o) { return o.expiry_date && daysLeft(o.expiry_date) < 0; }

  function normalize(q) {
    return String(q || '').replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/\u3000/g, ' ').toLowerCase().replace(/(\d),(?=\d{3})/g, '$1');
  }
  function has(t, kw) {
    if (/^[a-z][a-z .\-]*$/.test(kw)) return new RegExp('(^|[^a-z])' + kw.replace(/[.\-]/g, '\\$&') + '([^a-z]|$)').test(t);
    return t.indexOf(kw) >= 0;
  }

  // ---------- intent parsing ----------
  function parse(q) {
    var t = normalize(q), r = { raw: q, cats: [], banks: [], noFee: false, noReg: false, amount: null, period: '月', cards: [] };
    CAT_SYN.forEach(function (row) { if (row[1].some(function (k) { return has(t, k); }) && r.cats.indexOf(row[0]) < 0) r.cats.push(row[0]); });
    // "里" alone is too loose: only keep 里數 if a clearer word or "$/里" pattern is present
    if (r.cats.indexOf('里數') >= 0 && !/(里數|飛行|miles?|asia|avios|萬里通|儲里|機票|航空|\/里|一里|1里)/.test(t)) r.cats.splice(r.cats.indexOf('里數'), 1);
    if (/(唔使|免|冇|無|不用|零|no)\s*(annual\s*)?(年費|fee)/.test(t) || /永久免/.test(t)) { r.noFee = true; }
    if (/(唔使|免|冇|無|不用|no)\s*登記|no\s*registration/.test(t)) r.noReg = true;
    if (r.noFee) r.cats = r.cats.filter(function (c) { return c !== '現金回贈' || /回贈|cash/.test(t.replace(/年費/g, '')); });
    Object.keys(BANK_SYN).forEach(function (k) { if (BANK_SYN[k].some(function (s) { return has(t, s); })) r.banks.push(k); });
    // amount: "$5000", "月簽 5000", "5k", "5千", "1萬"
    var m = t.match(/(?:hk\$|\$|hkd|港幣|簽|spend|使)\s*(\d+(?:\.\d+)?)\s*(k|千|萬)?/) || t.match(/(\d+(?:\.\d+)?)\s*(k|千|萬|蚊|元|hkd)/);
    if (m) {
      var v = parseFloat(m[1]), u = m[2];
      if (u === 'k' || u === '千') v *= 1000; else if (u === '萬') v *= 10000;
      if (v >= 100) r.amount = v;
    }
    if (/(每年|一年|年簽|per year|yearly)/.test(t)) r.period = '年';
    // card names (latin tokens such as "red", "everymile", "mmpower", "chill", "smart")
    var seen = {};
    DATA.forEach(function (o) {
      (o.card.toLowerCase().match(/[a-z+]{3,}/g) || []).forEach(function (tok) {
        if (!STOP[tok] && has(t, tok) && !seen[o.card]) { seen[o.card] = 1; r.cards.push(o.card); }
      });
    });
    r.wantWelcome = r.cats.indexOf('迎新') >= 0 || /最多迎新|迎新最/.test(t);
    r.wantMiles = r.cats.indexOf('里數') >= 0;
    r.asiaMiles = /asia\s*miles?|亞洲萬里通|萬里通|國泰|cathay/i.test(t);
    r.wantCash = r.cats.indexOf('現金回贈') >= 0;
    r.spendCats = r.cats.filter(function (c) { return ['迎新', '里數', '現金回贈'].indexOf(c) < 0; });
    if (r.spendCats.indexOf('日本') >= 0 && r.spendCats.indexOf('海外') < 0) r.spendCats.push('海外');
    return r;
  }

  // ---------- ranking ----------
  function rateFor(o, cats) {
    for (var i = 0; i < cats.length; i++) {
      if (o.cat_rates && o.cat_rates[cats[i]] != null) return { rate: o.cat_rates[cats[i]], cat: cats[i], viaCat: true };
    }
    for (var j = 0; j < cats.length; j++) if (o.categories.indexOf(cats[j]) >= 0 && o.rebate_pct != null) return { rate: o.rebate_pct, cat: cats[j], viaCat: false };
    if (!cats.length && o.rebate_pct != null) return { rate: o.rebate_pct, cat: null, viaCat: false };
    return null;
  }
  function estimate(o, rf, amount) {
    if (!rf || !amount) return null;
    var e = { raw: amount * rf.rate / 100, capped: null, belowMin: false };
    var capUsable = o.rebate_cap_hkd != null && (rf.viaCat || !o.cat_rates);
    if (capUsable && e.raw > o.rebate_cap_hkd) e.capped = o.rebate_cap_hkd;
    if (o.min_spend_for_rate_hkd && amount < o.min_spend_for_rate_hkd) e.belowMin = true;
    e.value = e.belowMin ? 0 : (e.capped != null ? e.capped : e.raw);
    e.capUsable = capUsable;
    return e;
  }

  function answer(q) {
    var r = parse(q);
    var understood = r.cats.length || r.banks.length || r.noFee || r.noReg || r.cards.length;
    if (!understood) return { r: r, items: [], fallback: true };
    var pool = DATA.filter(function (o) { return !expired(o); });
    if (r.banks.length) pool = pool.filter(function (o) { return r.banks.indexOf(o.bank_key) >= 0; });
    if (r.cards.length) pool = pool.filter(function (o) { return r.cards.indexOf(o.card) >= 0; });
    if (r.noReg) pool = pool.filter(function (o) { return !o.requires_registration; });
    if (r.noFee) pool = pool.filter(function (o) { return o.annual_fee_hkd === 0 || /永久(豁)?免/.test(o.annual_fee_note || ''); });
    var mode;
    if (r.wantWelcome) {
      mode = 'welcome';
      pool = pool.filter(function (o) { return o.offer_type === '迎新' || o.categories.indexOf('迎新') >= 0; });
      if (r.wantMiles) pool = pool.filter(function (o) { return o.welcome_miles; });
      else if (r.wantCash) pool = pool.filter(function (o) { return o.welcome_value_hkd; });
    } else if (r.spendCats.length || r.wantCash) {
      mode = 'rate';
      pool = pool.filter(function (o) { return o.offer_type !== '迎新'; });
      if (r.wantMiles) {
        mode = 'mile';
        pool = pool.filter(function (o) { return o.hkd_per_mile != null && (!r.spendCats.length || r.spendCats.some(function (c) { return o.categories.indexOf(c) >= 0; })); });
      } else {
        pool = pool.filter(function (o) { return rateFor(o, r.spendCats) && (!r.spendCats.length || r.spendCats.some(function (c) { return o.categories.indexOf(c) >= 0 || (o.cat_rates && o.cat_rates[c] != null); })); });
      }
    } else if (r.wantMiles) {
      mode = 'mile';
      pool = pool.filter(function (o) { return o.offer_type !== '迎新' && o.hkd_per_mile != null; });
    } else {
      mode = 'list';
    }
    // "Asia Miles" asked explicitly: drop cards tied to other airline programmes (Avios / Fortune Wings / ANA)
    if (r.asiaMiles) pool = pool.filter(function (o) { return !/英國航空|Avios|香港航空|ANA|全日空/i.test(o.card + ' ' + o.title); });
    var scored = pool.map(function (o) {
      var rf = mode === 'rate' ? rateFor(o, r.spendCats) : null;
      var est = estimate(o, rf, r.amount);
      var metric;
      if (mode === 'welcome') metric = r.wantMiles ? (o.welcome_miles || 0) : (o.welcome_value_hkd || (o.welcome_miles ? 0.0001 : 0));
      else if (mode === 'mile') metric = -o.hkd_per_mile;
      else if (mode === 'rate') metric = est ? est.value : rf.rate;
      else metric = (o.offer_type === '迎新' ? (o.welcome_value_hkd || 0) : (o.rebate_pct || 0));
      return { o: o, rf: rf, est: est, metric: metric };
    });
    // in rate mode, drop base-level (<=1%) matches when better ones exist
    if (mode === 'rate' && scored.some(function (s) { return s.rf && s.rf.rate > 1; })) {
      scored = scored.filter(function (s) { return !s.rf || s.rf.rate > 1; });
    }
    // every offer is sourced from an official page; rank by the metric (offers with a dated expiry first on ties)
    scored.sort(function (a, b) { return (b.metric - a.metric) || ((a.o.expiry_date ? 0 : 1) - (b.o.expiry_date ? 0 : 1)); });
    var out = [], cards = {};
    for (var i = 0; i < scored.length && out.length < 5; i++) {
      var key = scored[i].o.card_id || scored[i].o.card;
      if (cards[key]) continue;
      cards[key] = 1; out.push(scored[i]);
    }
    return { r: r, mode: mode, items: out, total: pool.length };
  }

  // ---------- rendering ----------
  function keyLine(s, mode, r) {
    var o = s.o, bits = [];
    if (mode === 'welcome') {
      if (o.welcome_value_hkd) bits.push('迎新 $' + num(o.welcome_value_hkd));
      if (o.welcome_miles) bits.push('迎新 ' + num(o.welcome_miles) + ' 里');
      if (o.min_spend_hkd) bits.push('要簽 $' + num(o.min_spend_hkd));
    } else if (mode === 'mile') {
      bits.push('HK$' + o.hkd_per_mile + ' = 1 里');
    } else if (s.rf) {
      bits.push((s.rf.cat ? s.rf.cat + ' ' : '最高 ') + s.rf.rate + '%' + (s.rf.viaCat ? '' : '（呢張卡列明嘅最高回贈率）'));
    } else {
      if (o.rebate_pct != null) bits.push('最高 ' + o.rebate_pct + '%');
      if (o.hkd_per_mile != null) bits.push('HK$' + o.hkd_per_mile + '/里');
      if (o.welcome_value_hkd) bits.push('迎新 $' + num(o.welcome_value_hkd));
      if (o.welcome_miles) bits.push('迎新 ' + num(o.welcome_miles) + ' 里');
    }
    if (o.offer_type === '限時推廣') bits.push('限時推廣');
    if (o.requires_registration) bits.push('要登記');
    if (o.annual_fee_hkd === 0 || /永久(豁)?免/.test(o.annual_fee_note || '')) bits.push('免年費');
    return bits.join(' · ');
  }
  function estLine(s, r) {
    if (!s.est) return '';
    var per = r.period === '年' ? '' : '／' + (s.o.cap_period === '期' ? '月結單周期' : s.o.cap_period === '推廣期' ? '推廣期' : '月');
    if (s.est.belowMin) return '💡 簽 $' + num(r.amount) + ' 未夠呢個回贈率嘅門檻（要簽滿 $' + num(s.o.min_spend_for_rate_hkd) + per + '）。';
    var t = '💡 簽 $' + num(r.amount) + ' 按 ' + s.rf.rate + '% 粗略計約 $' + num(s.est.raw);
    if (s.est.capped != null) t += '，但受上限限制，最多約 $' + num(s.est.capped) + per;
    else if (!s.est.capUsable || s.o.rebate_cap_hkd == null) t += '（資料冇列明可用嘅上限數字，實際可能有上限）';
    if (r.period === '年') t += '（你講嘅係全年金額，上限多數按月／期計，請睇條件）';
    return t + '。';
  }
  function reason(s, mode, r) {
    var o = s.o;
    if (mode === 'welcome') return '迎新優惠' + (o.min_spend_hkd ? '，要喺指定期內簽滿 $' + num(o.min_spend_hkd) : '') + '。';
    if (mode === 'mile') return '每里成本喺符合條件嘅卡入面算低。';
    if (s.rf && s.rf.cat) return s.rf.cat + '類別有 ' + s.rf.rate + '% 回贈。';
    return '';
  }
  function itemHtml(s, mode, r, idx) {
    var o = s.o;
    var exp = o.expiry_date ? (fmtDate(o.expiry_date) + '（仲有 ' + daysLeft(o.expiry_date) + ' 日）') : (o.validity_text || '未有列明');
    var h = '<li class="qa-item">';
    h += '<div class="qa-title"><b>' + (idx + 1) + '. ' + esc(o.card) + '</b> <span class="qa-bank">' + esc(o.bank) + '</span></div>';
    h += '<div class="qa-key">' + esc(keyLine(s, mode, r)) + '</div>';
    var rs = reason(s, mode, r); if (rs) h += '<div class="qa-reason">' + esc(rs) + '</div>';
    var el = estLine(s, r); if (el) h += '<div class="qa-est">' + esc(el) + '</div>';
    if (o.caps) h += '<div class="qa-cap">上限／條件：' + esc(o.caps) + '</div>';
    if (o.requires_registration && o.registration_note_zh) {
      h += '<div class="qa-reg">' + esc(o.registration_note_zh) + (o.registration_url ? ' <a href="' + esc(o.registration_url) + '" target="_blank" rel="noopener">去登記 ↗</a>' : '') + '</div>';
    }
    var links = o.promo_url ? '<a href="' + esc(o.promo_url) + '" target="_blank" rel="noopener">官方推廣頁 ↗</a>' : '';
    if (!o.promo_url || o.promo_url !== o.source_url) links += (links ? ' · ' : '') + '<a href="' + esc(o.source_url) + '" target="_blank" rel="noopener">官方' + (o.promo_url ? '條款／' : '') + '來源 ↗</a>';
    h += '<div class="qa-meta">⏰ ' + esc(exp) + ' · ' + links + '</div>';
    h += '</li>';
    return h;
  }
  function filterFor(res) {
    var r = res.r, f = { cat: [], bank: [], q: '', sort: 'default' };
    var cats = r.spendCats.filter(function (c) { return !(c === '海外' && r.spendCats.indexOf('日本') >= 0); });
    if (res.mode === 'welcome') { f.cat = ['迎新']; if (r.wantMiles) f.cat.push('里數'); f.sort = 'welcome'; }
    else if (res.mode === 'mile') { f.cat = ['里數'].concat(cats.slice(0, 1)); f.sort = 'mile'; }
    else if (res.mode === 'rate') { f.cat = cats.slice(0, 1); if (!f.cat.length && r.wantCash) f.cat = ['現金回贈']; f.sort = 'rebate'; }
    if (r.banks.length) {
      var names = {}; DATA.forEach(function (o) { if (r.banks.indexOf(o.bank_key) >= 0) names[o.bank] = 1; });
      f.bank = Object.keys(names);
    }
    if (r.cards.length === 1) f.q = r.cards[0];
    if (r.noReg) f.onlyNoReg = true;
    return f;
  }
  function intro(res) {
    var r = res.r, parts = [];
    if (r.banks.length) parts.push('銀行：' + r.banks.map(function (k) { var o = DATA.find(function (x) { return x.bank_key === k; }); return o ? o.bank : k; }).join('、'));
    if (r.cards.length) parts.push('卡：' + r.cards.slice(0, 2).join('、'));
    if (r.spendCats.length) parts.push('類別：' + r.spendCats.join('、'));
    if (res.mode === 'welcome') parts.push('迎新' + (r.wantMiles ? '（里數）' : ''));
    if (res.mode === 'mile') parts.push('按每里成本排' + (r.asiaMiles ? '（已剔除英航 Avios／香港航空／ANA 聯名卡）' : ''));
    if (r.noFee) parts.push('免年費');
    if (r.noReg) parts.push('唔使登記');
    if (r.amount) parts.push('簽賬 $' + num(r.amount));
    return 'Roc B 理解為：' + (parts.join('｜') || '列出相關優惠') + '。';
  }
  function renderAnswer(res) {
    if (res.fallback) {
      return '<p>喵～Roc B 未識答呢條 😿 試下講清楚類別或者銀行，例如：「網購」、「儲里數」、「日本」、「超市」、「迎新最多」、「唔使年費」、「月簽 $5000 網購」、「滙豐」。</p>';
    }
    if (!res.items.length) {
      return '<p>' + esc(intro(res)) + '</p><p>搵唔到未過期又符合條件嘅優惠 😿 試下減少條件？</p>';
    }
    var h = '<p>' + esc(intro(res)) + ' 揀咗頭 ' + res.items.length + ' 個（共 ' + res.total + ' 項符合；全部附官方連結）：</p><ol class="qa-list">';
    res.items.forEach(function (s, i) { h += itemHtml(s, res.mode, res.r, i); });
    h += '</ol>';
    var f = filterFor(res);
    h += '<button type="button" class="qa-apply" data-filter="' + esc(JSON.stringify(f)) + '">📋 喺主列表顯示呢類優惠</button>';
    if (res.r.amount) h += '<p class="qa-note">估算只係用資料內嘅回贈率同上限粗略計，未計基本回贈、簽賬門檻細節同其他條件。</p>';
    return h;
  }

  // ---------- UI ----------
  function build() {
    var css = document.createElement('div');
    css.innerHTML =
      '<button type="button" class="qa-fab" id="qaFab" aria-haspopup="dialog" aria-controls="qaPanel"><img src="assets/rocb-cat.svg" alt="" width="34" height="34"><span>問 Roc B</span></button>' +
      '<section class="qa-panel" id="qaPanel" role="dialog" aria-label="問 Roc B 信用卡小助手" hidden>' +
      '<header class="qa-head"><img src="assets/rocb-cat.svg" alt="" width="36" height="36"><div><b>問 Roc B</b><small>信用卡優惠小助手（規則配對）</small></div><button type="button" class="qa-close" id="qaClose" aria-label="關閉">✕</button></header>' +
      '<div class="qa-msgs" id="qaMsgs" aria-live="polite"></div>' +
      '<div class="qa-chips" id="qaChips"></div>' +
      '<form class="qa-form" id="qaForm"><input id="qaInput" type="text" placeholder="例如：網購邊張卡最抵？" autocomplete="off" aria-label="輸入問題"><button type="submit">送出</button></form>' +
      '<p class="qa-disc">答案由規則自動配對網站資料（全部來自銀行官網），只供參考，唔係理財建議；以銀行官網條款為準。</p>' +
      '</section>';
    while (css.firstChild) document.body.appendChild(css.firstChild);
    var panel = document.getElementById('qaPanel'), msgs = document.getElementById('qaMsgs'), input = document.getElementById('qaInput');
    CHIPS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = c;
      b.addEventListener('click', function () { ask(c); }); document.getElementById('qaChips').appendChild(b);
    });
    function add(html, who) {
      var d = document.createElement('div'); d.className = 'qa-msg ' + who; d.innerHTML = html; msgs.appendChild(d);
      var q = d.previousElementSibling; msgs.scrollTop = who === 'bot' ? ((q && q.classList.contains('me')) ? q.offsetTop : d.offsetTop) - 8 : msgs.scrollHeight;
    }
    function ask(q) {
      q = String(q || '').trim(); if (!q) return;
      add(esc(q), 'me');
      if (!DATA) { add('<p>資料仲載入緊，請等等再問 🙏</p>', 'bot'); return; }
      add(renderAnswer(answer(q)), 'bot');
      input.value = '';
    }
    function openP() { panel.hidden = false; document.getElementById('qaFab').setAttribute('aria-expanded', 'true'); if (!msgs.children.length) add('<p>喵！我係 Roc B 🐱 想知邊張卡最抵？可以用廣東話、中文或者英文問我，例如「網購邊張卡最抵」、「儲 Asia Miles 用邊張」。</p>', 'bot'); setTimeout(function () { input.focus(); }, 50); }
    function closeP() { panel.hidden = true; document.getElementById('qaFab').setAttribute('aria-expanded', 'false'); }
    document.getElementById('qaFab').addEventListener('click', function () { panel.hidden ? openP() : closeP(); });
    document.getElementById('qaClose').addEventListener('click', closeP);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closeP(); });
    document.getElementById('qaForm').addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    msgs.addEventListener('click', function (e) {
      var b = e.target.closest('.qa-apply'); if (!b || !window.RocBApp) return;
      window.RocBApp.applyFilter(JSON.parse(b.dataset.filter));
      if (window.matchMedia('(max-width: 820px)').matches) closeP();
    });
    window.RocBAssistant = { ask: ask, answer: function (q) { return answer(q); }, parse: function (q) { return parse(q); }, open: openP };
  }

  document.addEventListener('rocb:data', function (e) { DATA = e.detail; });
  if (window.RocBApp) DATA = window.RocBApp.getData();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

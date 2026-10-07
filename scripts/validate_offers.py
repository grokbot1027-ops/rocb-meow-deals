#!/usr/bin/env python3
"""Validate data/offers.json before committing a refresh.
Usage: python3 scripts/validate_offers.py
Checks schema, types, enums, dates, duplicate ids, registration fields,
`added_date` (when the offer first appeared on the site, drives 「🆕 本月新優惠」),
`changes` (official T&C change log, drives 「⚠️ 條款有變」) and that EVERY link
(source, promo, registration, extra sources, change sources) is on an official
bank / issuer domain. Exits non-zero on error."""
import json, re, sys, pathlib
from datetime import date
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
REQUIRED = ['id', 'bank', 'bank_key', 'issuer_type', 'card', 'card_type', 'offer_type', 'title', 'categories',
            'summary_zh', 'validity_text', 'expiry_date', 'source_url', 'last_checked', 'added_date']
NUMERIC = ['rebate_cap_hkd', 'min_spend_for_rate_hkd', 'rebate_pct', 'hkd_per_mile', 'welcome_value_hkd', 'welcome_miles', 'min_spend_hkd', 'annual_fee_hkd', 'fx_fee_pct']
ENUMS = {
    'offer_type': {'迎新', '簽賬回贈', '限時推廣'},
    'card_type': {'現金回贈卡', '里數卡', '積分卡', '不限／多款'},
    'issuer_type': {'銀行', '虛擬銀行', '非銀行發卡機構', '卡組織／錢包'},
}
CATS = {'迎新', '現金回贈', '里數', '餐飲', '網購', '海外', '超市', '交通', '內地／澳門', '日本', '電子產品',
        '電子錢包', '購物', '繳費／保險', '分期', '生活'}
# Official bank / issuer / programme domains. A link to any other domain is an error.
OFFICIAL = ('hsbc.com.hk', 'hangseng.com', 'sc.com', 'bochk.com', 'citibank.com.hk', 'cncbinternational.com',
            'dbs.com.hk', 'hkbea.com', 'aeon.com.hk', 'primecredit.com', 'wewacard.com', 'mox.com',
            'americanexpress.com', 'fubonbank.com.hk', 'dahsing.com', 'asia.ccb.com', 'icbcasia.com', 'icbc.com.cn',
            'samsung.com', 'octopus.com.hk', 'unionpayintl.com')
BANNED_TEXT = ('未經官網核實', '第三方')
REG_METHODS = {'app', 'web', 'sms', 'other'}
# offers[].changes[].field — only genuine official term changes (not our own data corrections)
CHANGE_FIELDS = {'welcome', 'validity', 'rebate_pct', 'cap', 'min_spend', 'registration', 'other'}
SITE_START = '2026-10-03'  # first build of the site; no added_date / change can be earlier
ISO = re.compile(r'^\d{4}-\d{2}-\d{2}$')

def official(url):
    host = (urlparse(url).hostname or '').lower()
    return url.startswith('https://') and any(host == d or host.endswith('.' + d) for d in OFFICIAL)

def main():
    data = json.loads((ROOT / 'data' / 'offers.json').read_text(encoding='utf-8'))
    errs, warns, seen = [], [], set()
    if not isinstance(data, list):
        sys.exit('offers.json must be a JSON array')
    for i, o in enumerate(data):
        tag = f"[{i}] {o.get('id')}"
        for k in REQUIRED:
            if k not in o: errs.append(f'{tag}: missing {k}')
        if o.get('id') in seen: errs.append(f'{tag}: duplicate id')
        seen.add(o.get('id'))
        for k, allowed in ENUMS.items():
            if k in o and o[k] not in allowed: errs.append(f'{tag}: bad {k}={o[k]!r}')
        for c in o.get('categories', []):
            if c not in CATS: errs.append(f'{tag}: unknown category {c!r}')
        for k in NUMERIC:
            v = o.get(k)
            if v is not None and not isinstance(v, (int, float)): errs.append(f'{tag}: {k} must be number/null')
        for k in ('expiry_date', 'start_date', 'last_checked', 'registration_deadline', 'added_date'):
            v = o.get(k)
            if v is not None:
                if not ISO.match(str(v)): errs.append(f'{tag}: {k} not YYYY-MM-DD')
                else:
                    try: date.fromisoformat(v)
                    except ValueError: errs.append(f'{tag}: {k} invalid date')
        today = date.today().isoformat()
        ad = o.get('added_date')
        if isinstance(ad, str) and ISO.match(ad):
            if ad < SITE_START: errs.append(f'{tag}: added_date {ad} is before the site started ({SITE_START})')
            if ad > today: errs.append(f'{tag}: added_date {ad} is in the future')
        chs = o.get('changes')
        if chs is not None:
            if not isinstance(chs, list): errs.append(f'{tag}: changes must be an array')
            else:
                for j, c in enumerate(chs):
                    ct = f'{tag}: changes[{j}]'
                    if not isinstance(c, dict): errs.append(f'{ct} must be an object'); continue
                    cd = c.get('date')
                    if not (isinstance(cd, str) and ISO.match(cd)): errs.append(f'{ct}: date not YYYY-MM-DD')
                    else:
                        if cd < SITE_START: errs.append(f'{ct}: date before {SITE_START}')
                        if cd > today: errs.append(f'{ct}: date in the future')
                        if isinstance(ad, str) and cd < ad: warns.append(f'{ct}: date {cd} is before added_date {ad}')
                    if c.get('field') not in CHANGE_FIELDS: errs.append(f'{ct}: field must be one of {sorted(CHANGE_FIELDS)}')
                    for k in ('old_zh', 'new_zh'):
                        if not (isinstance(c.get(k), str) and c[k].strip()): errs.append(f'{ct}: {k} missing')
                    if c.get('old_zh') and c.get('old_zh') == c.get('new_zh'): errs.append(f'{ct}: old_zh == new_zh')
                    if not c.get('source_url'): errs.append(f'{ct}: source_url missing')
                    for k in ('source_url', 'old_source_url'):
                        if c.get(k) and not official(c[k]): errs.append(f'{ct}: {k} is not an official domain: {c[k]}')
                    extra = set(c) - {'date', 'field', 'old_zh', 'new_zh', 'note_zh', 'source_url', 'old_source_url'}
                    if extra: errs.append(f'{ct}: unknown keys {sorted(extra)}')
        cr = o.get('cat_rates')
        if cr is not None:
            if not isinstance(cr, dict): errs.append(f'{tag}: cat_rates must be object/null')
            else:
                for c, v in cr.items():
                    if c not in CATS or not isinstance(v, (int, float)): errs.append(f'{tag}: bad cat_rates entry {c}={v}')
        rcs = o.get('reward_categories')
        if rcs is not None:
            if not isinstance(rcs, list): errs.append(f'{tag}: reward_categories must be array/null')
            else:
                for c in rcs:
                    if not c.get('name'): errs.append(f'{tag}: reward_categories entry without name')
                    for sc in c.get('site_cats') or []:
                        if sc not in CATS: errs.append(f'{tag}: reward_categories {c.get("name")} unknown site_cat {sc!r}')
                    if c.get('rate_pct') is not None and not isinstance(c['rate_pct'], (int, float)): errs.append(f'{tag}: reward_categories rate_pct must be number')
                    for mk in ('merchants', 'merchants_en'):
                        m = c.get(mk)
                        if m is not None and not (isinstance(m, dict) and all(isinstance(v, list) and all(isinstance(x, str) for x in v) for v in m.values())):
                            errs.append(f'{tag}: reward_categories {c.get("name")} {mk} must be {{group: [names]}}')
        if o.get('merchant_list_url') and not official(o['merchant_list_url']): errs.append(f'{tag}: merchant_list_url is not an official domain')
        if o.get('cap_period') not in (None, '月', '期', '推廣期'): errs.append(f'{tag}: bad cap_period')
        # links: all must be official
        links = [('source_url', o.get('source_url')), ('promo_url', o.get('promo_url')), ('registration_url', o.get('registration_url'))]
        links += [('extra_sources', e.get('url')) for e in (o.get('extra_sources') or [])]
        for k, u in links:
            if u and not official(u): errs.append(f'{tag}: {k} is not an official domain: {u}')
        if not o.get('source_url'): errs.append(f'{tag}: source_url missing')
        if o.get('offer_type') == '限時推廣' and not o.get('promo_url'): errs.append(f'{tag}: 限時推廣 needs promo_url')
        if 'reference_sources' in o: errs.append(f'{tag}: reference_sources field is not allowed')
        blob = json.dumps(o, ensure_ascii=False)
        for w in BANNED_TEXT:
            if w in blob: errs.append(f'{tag}: contains banned wording {w!r}')
        # registration
        if o.get('requires_registration'):
            if o.get('registration_method') not in REG_METHODS: errs.append(f'{tag}: registration_method missing/invalid')
            if not o.get('registration_note_zh'): errs.append(f'{tag}: registration_note_zh missing')
            if not o.get('registration_confirmed'): warns.append(f'{tag}: registration method not confirmed on official page')
        elif o.get('registration_method'):
            errs.append(f'{tag}: registration_method set but requires_registration is false')
        if o.get('expiry_date') and o['expiry_date'] < date.today().isoformat(): warns.append(f'{tag}: expired ({o["expiry_date"]})')
    for w in warns: print('WARN', w)
    for e in errs: print('ERROR', e)
    ym = date.today().isoformat()[:7]
    new_promos = [o for o in data if o.get('offer_type') == '限時推廣' and str(o.get('added_date', '')).startswith(ym)
                  and not (o.get('expiry_date') and o['expiry_date'] < date.today().isoformat())]
    n_changes = sum(len(o.get('changes') or []) for o in data)
    print(f'{len(data)} offers, {len(errs)} errors, {len(warns)} warnings · 本月新限時推廣 {len(new_promos)} 個 · 條款變更紀錄 {n_changes} 項')
    sys.exit(1 if errs else 0)

if __name__ == '__main__':
    main()

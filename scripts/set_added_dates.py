#!/usr/bin/env python3
"""Fill in `added_date` (YYYY-MM-DD, Hong Kong time) for every offer in data/offers.json that doesn't have one.

- If the offer id already appears in an earlier commit of data/offers.json, use the HK date of the FIRST
  commit that contained it (so offers keep the date they really first appeared on the site).
- Otherwise (a brand-new offer added in today's refresh) use today's HK date.
- Existing `added_date` values are never changed.

Usage: python3 scripts/set_added_dates.py          # writes data/offers.json in place
       python3 scripts/set_added_dates.py --check  # only report, exit 1 if anything is missing
"""
import json, os, pathlib, subprocess, sys
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATH = ROOT / 'data' / 'offers.json'
HKT = timezone(timedelta(hours=8))


def first_seen():
    """id -> HK date of the first commit whose data/offers.json contains it."""
    seen = {}
    try:
        log = subprocess.check_output(['git', 'log', '--reverse', '--format=%H %ct', '--', 'data/offers.json'],
                                      cwd=ROOT, text=True)
    except (OSError, subprocess.CalledProcessError):
        return seen
    for line in log.split('\n'):
        if not line.strip():
            continue
        sha, ts = line.split()
        day = datetime.fromtimestamp(int(ts), HKT).date().isoformat()
        try:
            blob = subprocess.check_output(['git', 'show', f'{sha}:data/offers.json'], cwd=ROOT)
            ids = [o.get('id') for o in json.loads(blob)]
        except (subprocess.CalledProcessError, ValueError):
            continue
        for i in ids:
            seen.setdefault(i, day)
    return seen


def with_key_after(o, key, value, after='last_checked'):
    out = {}
    for k, v in o.items():
        out[k] = v
        if k == after:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


def main():
    check = '--check' in sys.argv
    data = json.loads(PATH.read_text(encoding='utf-8'))
    missing = [o for o in data if not o.get('added_date')]
    if check:
        for o in missing:
            print('missing added_date:', o.get('id'))
        sys.exit(1 if missing else 0)
    if not missing:
        print('all offers already have added_date')
        return
    seen = first_seen()
    today = datetime.now(HKT).date().isoformat()
    out = []
    for o in data:
        if not o.get('added_date'):
            d = seen.get(o.get('id'), today)
            o = with_key_after(o, 'added_date', d)
            print(f"{o['id']}: added_date = {d}")
        out.append(o)
    PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Extract (player name -> jersey number) from a SIDEARM roster page.

SIDEARM (Nuxt 3) roster pages embed a dehydrated `__NUXT_DATA__` payload in
the `flatted` format: one big JSON array where every nested value is stored by
integer index into that array. Player objects carry first_name/last_name/
full_name + jersey_number(+_label) as such indices, so we deref each.

Usage:  python3 extract_jerseys.py --url <roster_url>
Prints JSON: {"method": "...", "count": N, "players": [{"name","jersey"}...]}
"""
import argparse
import json
import re
import time
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def fetch(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # transient anti-bot / timeout — retry
            last = e
            time.sleep(2)
    raise last


def from_nuxt_data(html):
    m = re.search(
        r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S
    )
    if not m:
        return None
    try:
        arr = json.loads(m.group(1))
    except Exception:
        return None

    def deref(x):
        return arr[x] if isinstance(x, int) and 0 <= x < len(arr) else x

    # SIDEARM ships two key conventions across Nuxt versions:
    #   snake_case: jersey_number / jersey_number_label / full_name / first_name
    #   camelCase:  jerseyNumber / fullName / firstName / lastName
    JKEYS = ("jersey_number", "jerseyNumber")
    LABEL_KEYS = ("jersey_number_label",)
    FULL_KEYS = ("full_name", "fullName")
    FIRST_KEYS = ("first_name", "firstName")
    LAST_KEYS = ("last_name", "lastName")

    def first_present(d, keys):
        for k in keys:
            if k in d:
                return d[k]
        return None

    players = []
    seen = set()
    for v in arr:
        if not isinstance(v, dict):
            continue
        if not any(k in v for k in JKEYS):
            continue
        if not any(k in v for k in FULL_KEYS + FIRST_KEYS):
            continue
        name = deref(first_present(v, FULL_KEYS))
        if not isinstance(name, str) or not name.strip():
            fn = deref(first_present(v, FIRST_KEYS))
            ln = deref(first_present(v, LAST_KEYS))
            name = " ".join(p for p in [fn, ln] if isinstance(p, str)).strip()
        jersey = deref(first_present(v, LABEL_KEYS))
        if not (isinstance(jersey, str) and jersey.strip()):
            jn = deref(first_present(v, JKEYS))
            jersey = str(jn) if jn not in (None, "") else ""
        jersey = str(jersey).strip().lstrip("#").strip()
        if name and name not in seen:
            seen.add(name)
            players.append({"name": name, "jersey": jersey})
    return players if players else None


def from_legacy_html(html):
    """Legacy server-rendered SIDEARM: each player is an <li
    class="sidearm-roster-player"> carrying data-player-url (name slug) and a
    .sidearm-roster-player-jersey-number span."""
    blocks = re.split(r'<li[^>]*class="sidearm-roster-player"', html)[1:]
    players = []
    seen = set()
    for b in blocks:
        murl = re.search(r'data-player-url="[^"]*/roster/([a-z0-9-]+?)/\d+"', b)
        if not murl:
            continue
        name = murl.group(1).replace("-", " ").strip()
        mj = re.search(
            r'sidearm-roster-player-jersey-number"[^>]*>\s*#?\s*(\d{1,3})\s*<', b
        )
        jersey = mj.group(1) if mj else ""
        if name and name not in seen:
            seen.add(name)
            players.append({"name": name, "jersey": jersey})
    return players if players else None


def from_wmt_html(html):
    """WMT Digital roster (e.g. miamihurricanes.com): JS-rendered cards
    `<... class="player col">` with a slug link and a `.number` element.
    Only meaningful on rendered HTML."""
    blocks = re.split(r'<[a-z]+[^>]*class="player col"', html)[1:]
    players = []
    seen = set()
    for b in blocks:
        mslug = re.search(r"/roster/[^\"']*?/player/([a-z0-9-]+)", b)
        if not mslug:
            continue
        name = mslug.group(1).replace("-", " ").strip()
        mj = re.search(r'class="number"[^>]*>\s*#?\s*(\d{1,3})\s*<', b)
        jersey = mj.group(1) if mj else ""
        if name and name not in seen:
            seen.add(name)
            players.append({"name": name, "jersey": jersey})
    return players if players else None


def from_sidearm_dom(html):
    """Hydrated SIDEARM (Nuxt) DOM: some sites ship null jerseys in
    __NUXT_DATA__ and only fill them after hydration. Each player is an
    <li class="roster-list-item"> with a .roster-list-item__jersey-number and a
    /roster/player/<slug> link. Only meaningful on rendered HTML."""
    blocks = re.split(r'<li[^>]*class="[^"]*roster-list-item[^"]*"', html)[1:]
    players = []
    seen = set()
    for b in blocks:
        mslug = re.search(r"/roster/player/([a-z0-9-]+)", b)
        if not mslug:
            continue
        name = mslug.group(1).replace("-", " ").strip()
        mj = re.search(
            r'roster-list-item__jersey-number"?[^>]*>\s*#?\s*(\d{1,3})\s*<', b
        )
        jersey = mj.group(1) if mj else ""
        if name and name not in seen:
            seen.add(name)
            players.append({"name": name, "jersey": jersey})
    return players if players else None


def render(url):
    """Return fully-rendered HTML via headless Chromium (for JS-only sites)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page(user_agent=UA)
        try:
            pg.goto(url, wait_until="domcontentloaded", timeout=45000)
            for sel in ('.player.col', '[class*="jersey"]', 'a[href*="/roster/"]'):
                try:
                    pg.wait_for_selector(sel, timeout=8000)
                    break
                except Exception:
                    continue
            pg.wait_for_timeout(3500)
            return pg.content()
        finally:
            b.close()


def extract(html):
    """Run every parser, return (method, players) for whichever yields the most
    jerseys. Different SIDEARM/WMT layouts respond to different parsers, and a
    hydrated DOM can beat the embedded JSON, so pick the richest result."""
    best = (None, None, -1)
    for method, fn in (
        ("nuxt_data", from_nuxt_data),
        ("sidearm_dom", from_sidearm_dom),
        ("legacy_html", from_legacy_html),
        ("wmt_html", from_wmt_html),
    ):
        players = fn(html)
        if not players:
            continue
        n = sum(1 for p in players if p["jersey"])
        if n > best[2]:
            best = (method, players, n)
    if best[2] > 0:
        return best[0], best[1]
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument(
        "--render",
        action="store_true",
        help="render with headless Chromium before parsing (JS-only sites)",
    )
    args = ap.parse_args()
    try:
        html = render(args.url) if args.render else fetch(args.url)
    except Exception as e:
        print(json.dumps({"error": f"fetch failed: {e}", "players": []}))
        return
    method, players = extract(html)
    if players:
        with_j = [p for p in players if p["jersey"]]
        print(
            json.dumps(
                {
                    "method": method,
                    "count": len(players),
                    "with_jersey": len(with_j),
                    "players": players,
                }
            )
        )
    else:
        print(json.dumps({"method": "none", "count": 0, "players": []}))


if __name__ == "__main__":
    main()

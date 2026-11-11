"""Nightly price update from Pulitzer's official price-transparency files.

Pulitzer (chain 7291059100008) publishes its prices on the Cerberus FTP server
(url.retail.publishedprices.co.il, user "politzer", no password), as the Food Act
requires. This script finds the Karkur branch, downloads its latest full price
file, and writes ../prices.json for the app: { product name in the app: [price, unit, typical kilos per unit (optional)] }.
Which store item each app product is, is set in prices/mapping.json.

Run: python3 prices/update_prices.py [--dump]
  --dump also writes prices/karkur-items.json (every item in the branch), used to
  choose items for mapping.json.
Status of each run is written to prices/last-run.json.
"""
import datetime
import gzip
import io
import json
import os
import re
import sys
import traceback
import xml.etree.ElementTree as ET
import zipfile
from ftplib import FTP_TLS, error_perm

HOST = "url.retail.publishedprices.co.il"
USER = "politzer"
CHAIN = "7291059100008"
BRANCH_WORD = "כרכור"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TZ = datetime.timezone(datetime.timedelta(hours=2))


def now_il():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("Asia/Jerusalem"))
    except Exception:
        return datetime.datetime.now(TZ)


def connect():
    ftp = FTP_TLS(HOST, USER, "", timeout=120)
    setattr(ftp, "trust_server_pasv_ipv4_address", True)
    return ftp


def listing(ftp):
    names = []
    try:
        for name, _facts in ftp.mlsd():
            names.append(name)
    except error_perm:
        names = ftp.nlst()
    return names


def fetch(ftp, name):
    buf = io.BytesIO()
    ftp.retrbinary("RETR " + name, buf.write)
    data = buf.getvalue()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    elif data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            data = z.read(z.namelist()[0])
    return data


def parse_xml(data):
    # Some chains send UTF-16 or a BOM; ElementTree reads the declared encoding.
    data = data.lstrip(b"\xef\xbb\xbf")
    return ET.fromstring(data)


def text(el, *tags):
    for t in tags:
        for child in el.iter():
            if child.tag.lower() == t.lower() and child.text and child.text.strip():
                return child.text.strip()
    return ""


def stamp(name):
    """Date-time in a file name, e.g. ...-20261111-001010.gz -> 20261111001010."""
    m = re.search(r"-(\d{8})-?(\d{4,6})\.", name)
    return (m.group(1) + m.group(2).ljust(6, "0")) if m else ""


def find_store(ftp, names, status):
    stores = sorted([n for n in names if n.lower().startswith("store")], key=stamp)
    if not stores:
        raise RuntimeError("No Stores file on the server")
    root = parse_xml(fetch(ftp, stores[-1]))
    found = []
    for st in root.iter():
        if st.tag.lower() != "store":
            continue
        sid = text(st, "StoreId", "StoreID")
        nm = text(st, "StoreName")
        city = text(st, "City")
        found.append({"id": sid, "name": nm, "city": city})
    status["stores"] = found
    for s in found:
        if BRANCH_WORD in (s["name"] + " " + s["city"]):
            return s
    raise RuntimeError("Karkur branch not found in the Stores file")


def parse_items(root):
    items = []
    for it in root.iter():
        if it.tag.lower() != "item":
            continue
        code = text(it, "ItemCode")
        try:
            price = float(text(it, "ItemPrice") or "0")
        except ValueError:
            continue
        weighted = text(it, "bIsWeighted", "BisWeighted") in ("1", "true", "True")
        items.append({
            "code": code,
            "name": text(it, "ItemName", "ItemNm"),
            "maker": text(it, "ManufacturerName"),
            "price": price,
            "weighted": weighted,
            "unitQty": text(it, "UnitQty"),
            "qty": text(it, "Quantity"),
            "uomPrice": text(it, "UnitOfMeasurePrice"),
            "updated": text(it, "PriceUpdateDate"),
        })
    return items


def read_items(ftp, names, store_id):
    """Latest full price file of the branch, then the day's partial updates after it."""
    sid = str(int(store_id)) if store_id.isdigit() else store_id
    full_pat = re.compile(r"^pricefull\d+-\d+-0*%s-" % re.escape(sid), re.I)
    part_pat = re.compile(r"^price\d+-\d+-0*%s-" % re.escape(sid), re.I)
    fulls = sorted([n for n in names if full_pat.match(n)], key=stamp)
    if not fulls:
        raise RuntimeError("No PriceFull file for store %s" % store_id)
    base = fulls[-1]
    by_code = {i["code"]: i for i in parse_items(parse_xml(fetch(ftp, base)))}
    parts = sorted([n for n in names if part_pat.match(n) and stamp(n) > stamp(base)], key=stamp)
    for p in parts:
        for i in parse_items(parse_xml(fetch(ftp, p))):
            by_code[i["code"]] = i
    src = base + (" + %d updates (last %s)" % (len(parts), parts[-1]) if parts else "")
    return src, list(by_code.values())


def main():
    dump = "--dump" in sys.argv
    started = now_il()
    status = {"started": started.isoformat(timespec="seconds"), "ok": False}
    try:
        ftp = connect()
        names = listing(ftp)
        status["files_on_server"] = len(names)
        status["file_names"] = sorted(names)
        store = find_store(ftp, names, status)
        status["store"] = store
        src, items = read_items(ftp, names, store["id"])
        try:
            ftp.quit()
        except Exception:
            pass
        status["source_file"] = src
        status["items_in_branch"] = len(items)
        by_code = {i["code"]: i for i in items}

        if dump:
            slim = sorted(
                [[i["code"], i["name"], i["maker"], i["price"], 1 if i["weighted"] else 0, i["unitQty"], i["qty"]] for i in items],
                key=lambda r: r[1],
            )
            with open(os.path.join(HERE, "karkur-items.json"), "w", encoding="utf-8") as f:
                json.dump(slim, f, ensure_ascii=False, separators=(",", ":"))

        with open(os.path.join(HERE, "mapping.json"), encoding="utf-8") as f:
            mapping = json.load(f)
        prices, missing = {}, []
        for app_name, m in mapping.items():
            if app_name.startswith("_") or not m:
                continue
            it = by_code.get(str(m.get("code", "")))
            if not it or it["price"] <= 0:
                missing.append(app_name)
                continue
            unit = m.get("unit") or ("k" if it["weighted"] else "u")
            price = round(it["price"] * float(m.get("factor", 1)), 2)
            prices[app_name] = [price, unit] + ([float(m["unitKg"])] if m.get("unitKg") else [])
        status["mapped"] = len(prices)
        status["missing"] = missing

        # Every item in the branch, so the app can price a product the family added
        # by hand (matched by name in the app): [name, price, 1 if sold by weight].
        seen, allrows = set(), []
        for i in sorted(items, key=lambda i: (i["name"], i["code"])):
            nm = re.sub(r"\s+", " ", i["name"]).strip()
            if i["price"] <= 0 or not nm or nm in seen:
                continue
            seen.add(nm)
            allrows.append([nm, i["price"], 1 if i["weighted"] else 0])
        with open(os.path.join(HERE, "all.json"), "w", encoding="utf-8") as f:
            json.dump({"updated": started.strftime("%Y-%m-%d %H:%M"), "items": allrows}, f, ensure_ascii=False, separators=(",", ":"))
        status["all_items"] = len(allrows)

        out = {
            "updated": started.strftime("%Y-%m-%d %H:%M"),
            "store": store.get("name", ""),
            "source": src,
            "prices": dict(sorted(prices.items())),
        }
        with open(os.path.join(ROOT, "prices.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=0)
        status["ok"] = True
    except Exception as e:  # keep yesterday's prices.json; report the error
        status["error"] = "%s: %s" % (type(e).__name__, e)
        status["trace"] = traceback.format_exc()[-2000:]
    status["finished"] = now_il().isoformat(timespec="seconds")
    if not dump:
        status.pop("stores", None)
        status.pop("file_names", None)
    with open(os.path.join(HERE, "last-run.json"), "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in status.items() if k not in ("stores", "trace")}, ensure_ascii=False))
    return 0 if status["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

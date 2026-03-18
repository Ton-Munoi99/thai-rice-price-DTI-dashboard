#!/usr/bin/env python3
"""Fetch DIT rice prices and build split static snapshots for Netlify."""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

DEFAULT_BASE_URL = "https://dataapi.moc.go.th/gis-product-prices"
DEFAULT_PRODUCTS_URL = "https://dataapi.moc.go.th/gis-products"
DEFAULT_SOURCE_URL = "https://data.moc.go.th/OpenData/GISProductPrice"
DEFAULT_LATEST_BUNDLE_OUTPUT = "frontend/src/data/rice-latest.json"
DEFAULT_LATEST_PUBLIC_OUTPUT = "frontend/public/data/rice-latest.json"
DEFAULT_HISTORY_DIR = "frontend/public/data/rice-history"
DEFAULT_LEGACY_INPUT = "frontend/src/data/rice-dashboard.json"
DEFAULT_HISTORY_YEARS = 5

DEFAULT_PRODUCTS = [
    {"product_id": "R11029", "product_name": "ข้าวหอมมะลิ 100% ชั้น 1"},
    {"product_id": "R11031", "product_name": "ข้าวหอมมะลิ 100% ชั้น 2"},
    {"product_id": "R11037", "product_name": "ข้าวหอมปทุมธานี"},
    {"product_id": "R11035", "product_name": "ข้าวหอมจังหวัด"},
    {"product_id": "R11001", "product_name": "ข้าวขาว 100% ชั้น 1"},
    {"product_id": "R11003", "product_name": "ข้าวขาว 100% ชั้น 2"},
    {"product_id": "R11005", "product_name": "ข้าวขาว 100% ชั้น 3"},
    {"product_id": "R11007", "product_name": "ข้าวขาว 5%"},
    {"product_id": "R11009", "product_name": "ข้าวขาว 10%"},
    {"product_id": "R11018", "product_name": "ข้าวสารเหนียว กข.6"},
    {"product_id": "R11026", "product_name": "ข้าวนึ่ง 100%"},
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch DIT rice prices and generate split latest/history snapshots."
    )
    parser.add_argument(
        "--product-ids",
        default=",".join(item["product_id"] for item in DEFAULT_PRODUCTS),
        help="Comma-separated DIT product IDs",
    )
    parser.add_argument("--from-date", help="Start date in YYYY-MM-DD")
    parser.add_argument("--to-date", help="End date in YYYY-MM-DD")
    parser.add_argument(
        "--history-years",
        type=int,
        default=DEFAULT_HISTORY_YEARS,
        help="History years to fetch when --from-date is omitted",
    )
    parser.add_argument(
        "--chunk-days",
        type=int,
        default=28,
        help="Days per API request. Monthly windows are the most stable for DIT.",
    )
    parser.add_argument("--timeout", type=int, default=45, help="HTTP timeout in seconds")
    parser.add_argument("--max-workers", type=int, default=4, help="Parallel product workers")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="DIT price API base URL")
    parser.add_argument(
        "--products-url", default=DEFAULT_PRODUCTS_URL, help="DIT product catalog URL"
    )
    parser.add_argument(
        "--latest-bundle-output",
        default=DEFAULT_LATEST_BUNDLE_OUTPUT,
        help="Summary snapshot JSON path bundled into the frontend",
    )
    parser.add_argument(
        "--latest-public-output",
        default=DEFAULT_LATEST_PUBLIC_OUTPUT,
        help="Summary snapshot JSON path served as a static runtime file",
    )
    parser.add_argument(
        "--history-dir",
        default=DEFAULT_HISTORY_DIR,
        help="Output directory for per-product history JSON files",
    )
    parser.add_argument(
        "--legacy-input",
        default=DEFAULT_LEGACY_INPUT,
        help="Legacy monolithic snapshot JSON path used as a fallback source",
    )
    return parser.parse_args()


def bangkok_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=7)))


def resolve_date_window(args: argparse.Namespace) -> tuple[date, date]:
    to_date = (
        date.fromisoformat(args.to_date)
        if args.to_date
        else bangkok_now().date() - timedelta(days=1)
    )
    if args.from_date:
        from_date = date.fromisoformat(args.from_date)
    else:
        from_date = to_date - timedelta(days=(args.history_years * 365) - 1)
    if from_date > to_date:
        raise SystemExit("--from-date must be on or before --to-date")
    return from_date, to_date


def daterange_chunks(start: date, end: date, chunk_days: int) -> List[tuple[date, date]]:
    chunks = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=chunk_days - 1), end)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


def fetch_json(url: str, timeout: int) -> dict | list:
    with urlopen(url, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        payload = response.read().decode(charset)
    return json.loads(payload)


def build_price_url(base_url: str, product_id: str, start: date, end: date) -> str:
    query = urlencode(
        {
            "product_id": product_id,
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
        }
    )
    return f"{base_url}?{query}"


def build_products_url(products_url: str) -> str:
    query = urlencode({"keyword": "ข้าว", "sell_type": "wholesale"})
    return f"{products_url}?{query}"


def normalize_records(price_list: list, unit: str) -> List[Dict[str, object]]:
    records = []
    for item in price_list:
        raw_date = str(item.get("date", ""))[:10]
        price_min = float(item["price_min"])
        price_max = float(item["price_max"])
        records.append(
            {
                "date": raw_date,
                "price_min": price_min,
                "price_max": price_max,
                "price_avg": round((price_min + price_max) / 2, 2),
                "unit": unit,
            }
        )
    return records


def merge_records(records: List[Dict[str, object]]) -> List[Dict[str, object]]:
    merged: Dict[str, Dict[str, object]] = {}
    for record in records:
        merged[str(record["date"])] = record
    return [merged[key] for key in sorted(merged.keys())]


def cut_records(records: List[Dict[str, object]], days: int) -> List[Dict[str, object]]:
    if not records:
        return []
    latest_date = date.fromisoformat(str(records[-1]["date"]))
    cutoff = latest_date - timedelta(days=days - 1)
    return [record for record in records if date.fromisoformat(str(record["date"])) >= cutoff]


def average(items: List[Dict[str, object]], key: str) -> Optional[float]:
    if not items:
        return None
    return round(sum(float(item[key]) for item in items) / len(items), 2)


def min_value(items: List[Dict[str, object]], key: str) -> Optional[float]:
    if not items:
        return None
    return min(float(item[key]) for item in items)


def max_value(items: List[Dict[str, object]], key: str) -> Optional[float]:
    if not items:
        return None
    return max(float(item[key]) for item in items)


def latest_stats(records: List[Dict[str, object]]) -> tuple[Optional[dict], Optional[dict]]:
    latest = records[-1] if records else None
    previous = records[-2] if len(records) > 1 else None
    return latest, previous


def summary_from_records(records: List[Dict[str, object]]) -> dict:
    latest, previous = latest_stats(records)
    recent_30 = cut_records(records, 30)
    return {
        "latest": latest,
        "previous": previous,
        "summary_30d": {
            "avg": average(recent_30, "price_avg"),
            "low": min_value(recent_30, "price_min"),
            "high": max_value(recent_30, "price_max"),
        },
        "recent_points": [
            {"date": record["date"], "price_avg": record["price_avg"]}
            for record in records[-20:]
        ],
    }


def fetch_catalog(products_url: str, timeout: int) -> Dict[str, dict]:
    try:
        payload = fetch_json(build_products_url(products_url), timeout=timeout)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        payload = []
    if not isinstance(payload, list):
        return {}
    return {
        item.get("product_id", ""): item
        for item in payload
        if item.get("product_id", "").startswith("R11")
    }


def load_existing_history(history_dir: Path) -> Dict[str, dict]:
    existing = {}
    if not history_dir.exists():
        return existing
    for path in history_dir.glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        product_id = payload.get("meta", {}).get("product_id")
        if product_id:
            existing[product_id] = {
                "meta": payload.get("meta", {}),
                "records": payload.get("records", []),
                "summary": summary_from_records(payload.get("records", [])),
            }
    return existing


def load_legacy_snapshot(legacy_path: Path) -> Dict[str, dict]:
    if not legacy_path.exists():
        return {}

    try:
        payload = json.loads(legacy_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError:
        return {}

    result = {}
    for item in payload.get("products", []):
        product_id = item.get("product_id")
        if not product_id:
            continue
        records = merge_records(item.get("records", []))
        result[product_id] = {
            "meta": {
                "product_id": product_id,
                "product_name": item.get("product_name", product_id),
                "category_name": item.get("category_name", ""),
                "group_name": item.get("group_name", ""),
                "unit": item.get("unit", "บาท/100 กก."),
                "history_from": records[0]["date"] if records else "",
                "history_to": records[-1]["date"] if records else "",
                "record_count": len(records),
            },
            "records": records,
            "summary": summary_from_records(records),
        }
    return result


def build_product_history(
    product_id: str,
    catalog_entry: dict,
    args: argparse.Namespace,
    start: date,
    end: date,
) -> dict:
    all_records: List[Dict[str, object]] = []
    meta: dict = {}

    for chunk_start, chunk_end in daterange_chunks(start, end, args.chunk_days):
        payload = fetch_json(
            build_price_url(args.base_url, product_id, chunk_start, chunk_end),
            timeout=args.timeout,
        )
        if isinstance(payload, dict):
            meta = payload
            all_records.extend(
                normalize_records(payload.get("price_list", []), payload.get("unit", ""))
            )

    records = merge_records(all_records)
    product_name = (
        meta.get("product_name")
        or catalog_entry.get("product_name")
        or next(
            (item["product_name"] for item in DEFAULT_PRODUCTS if item["product_id"] == product_id),
            product_id,
        )
    )

    return {
        "meta": {
            "product_id": product_id,
            "product_name": product_name,
            "category_name": meta.get("category_name") or catalog_entry.get("category_name", ""),
            "group_name": meta.get("group_name") or catalog_entry.get("category_name", ""),
            "unit": meta.get("unit", "บาท/100 กก."),
            "history_from": records[0]["date"] if records else start.isoformat(),
            "history_to": records[-1]["date"] if records else end.isoformat(),
            "record_count": len(records),
        },
        "records": records,
        "summary": summary_from_records(records),
    }


def build_latest_index(product_payloads: List[dict], start: date, end: date) -> dict:
    history_from_values = [
        item["meta"].get("history_from")
        for item in product_payloads
        if item["meta"].get("history_from")
    ]
    history_to_values = [
        item["meta"].get("history_to")
        for item in product_payloads
        if item["meta"].get("history_to")
    ]
    history_from = min(history_from_values) if history_from_values else start.isoformat()
    history_to = max(history_to_values) if history_to_values else end.isoformat()
    history_years = round(
        ((date.fromisoformat(history_to) - date.fromisoformat(history_from)).days + 1) / 365, 1
    )

    products = []
    for payload in product_payloads:
        meta = payload["meta"]
        summary = payload["summary"]
        latest = summary["latest"]
        previous = summary["previous"]
        change_abs = (
            round(float(latest["price_avg"]) - float(previous["price_avg"]), 2)
            if latest and previous
            else None
        )
        change_pct = (
            round(
                ((float(latest["price_avg"]) - float(previous["price_avg"])))
                / float(previous["price_avg"])
                * 100,
                2,
            )
            if latest and previous and float(previous["price_avg"])
            else None
        )

        products.append(
            {
                "product_id": meta["product_id"],
                "product_name": meta["product_name"],
                "category_name": meta["category_name"],
                "group_name": meta["group_name"],
                "unit": meta["unit"],
                "history_file": f"/data/rice-history/{meta['product_id']}.json",
                "latest": latest,
                "previous": previous,
                "change_abs": change_abs,
                "change_pct": change_pct,
                "summary_30d": summary["summary_30d"],
                "recent_points": summary["recent_points"],
            }
        )

    return {
        "meta": {
            "source_name": "Department of Internal Trade (DIT)",
            "source_url": DEFAULT_SOURCE_URL,
            "generated_at": bangkok_now().isoformat(timespec="seconds"),
            "history_from": history_from,
            "history_to": history_to,
            "history_years": history_years,
            "product_count": len(products),
            "note": "หน้าแรกโหลด latest index ทันที ส่วนข้อมูลย้อนหลังถูกแยกไฟล์รายสินค้าเพื่อให้เว็บเปิดเร็ว",
        },
        "products": products,
    }


def write_history_files(history_dir: Path, product_payloads: List[dict]) -> None:
    history_dir.mkdir(parents=True, exist_ok=True)
    for path in history_dir.glob("*.json"):
        path.unlink()

    for payload in product_payloads:
        meta = payload["meta"]
        target = history_dir / f"{meta['product_id']}.json"
        out = {
            "meta": meta,
            "records": payload["records"],
        }
        target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    start, end = resolve_date_window(args)

    latest_bundle_output = Path(args.latest_bundle_output)
    latest_public_output = Path(args.latest_public_output)
    history_dir = Path(args.history_dir)
    legacy_input = Path(args.legacy_input)

    latest_bundle_output.parent.mkdir(parents=True, exist_ok=True)
    latest_public_output.parent.mkdir(parents=True, exist_ok=True)
    history_dir.mkdir(parents=True, exist_ok=True)

    catalog = fetch_catalog(args.products_url, timeout=args.timeout)
    existing_history = load_existing_history(history_dir)
    legacy_history = load_legacy_snapshot(legacy_input)
    fallback_history = {**legacy_history, **existing_history}
    product_ids = [item.strip() for item in args.product_ids.split(",") if item.strip()]

    payloads: List[Optional[dict]] = [None] * len(product_ids)
    warnings: List[str] = []

    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = {
            executor.submit(
                build_product_history,
                product_id,
                catalog.get(product_id, {}),
                args,
                start,
                end,
            ): index
            for index, product_id in enumerate(product_ids)
        }

        for future in as_completed(futures):
            index = futures[future]
            product_id = product_ids[index]
            try:
                payload = future.result()
                if not payload.get("records") and product_id in fallback_history:
                    payload = fallback_history[product_id]
                    warnings.append(f"{product_id}: API returned no rows, kept fallback history")
                payloads[index] = payload
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
                if product_id in fallback_history:
                    payloads[index] = fallback_history[product_id]
                    warnings.append(f"{product_id}: fetch failed, kept fallback history ({exc})")
                    continue
                warnings.append(f"{product_id}: fetch failed and was skipped ({exc})")
                payloads[index] = None

    final_payloads = [payload for payload in payloads if payload]
    write_history_files(history_dir, final_payloads)

    latest_index = build_latest_index(final_payloads, start, end)
    latest_payload = json.dumps(latest_index, ensure_ascii=False, indent=2) + "\n"
    latest_bundle_output.write_text(latest_payload, encoding="utf-8")
    latest_public_output.write_text(latest_payload, encoding="utf-8")

    print(
        f"Wrote latest index for {len(final_payloads)} rice products to "
        f"{latest_bundle_output} and {latest_public_output}, plus history files to {history_dir}"
    )
    for warning in warnings:
        print(f"WARNING: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

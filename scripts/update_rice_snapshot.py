#!/usr/bin/env python3
"""Fetch DIT rice prices for key rice products and write a static dashboard snapshot."""

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
DEFAULT_OUTPUT = "frontend/src/data/rice-dashboard.json"
DEFAULT_HISTORY_YEARS = 3

DEFAULT_PRODUCTS = [
    {"product_id": "R11029", "product_name": "ข้าวหอมมะลิ 100% ชั้น 1"},
    {"product_id": "R11037", "product_name": "ข้าวหอมปทุมธานี"},
    {"product_id": "R11035", "product_name": "ข้าวหอมจังหวัด"},
    {"product_id": "R11001", "product_name": "ข้าวขาว 100% ชั้น 1"},
    {"product_id": "R11007", "product_name": "ข้าวขาว 5%"},
    {"product_id": "R11018", "product_name": "ข้าวสารเหนียว กข.6"},
    {"product_id": "R11026", "product_name": "ข้าวนึ่ง 100%"},
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch DIT rice prices and generate a multi-product dashboard snapshot."
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
        help="Days per API request. Monthly windows are stable for DIT.",
    )
    parser.add_argument("--timeout", type=int, default=45, help="HTTP timeout in seconds")
    parser.add_argument("--max-workers", type=int, default=4, help="Parallel product workers")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Snapshot output file")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="DIT price API base URL")
    parser.add_argument(
        "--products-url", default=DEFAULT_PRODUCTS_URL, help="DIT product catalog URL"
    )
    return parser.parse_args()


def bangkok_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=7)))


def resolve_date_window(args: argparse.Namespace) -> tuple[date, date]:
    to_date = date.fromisoformat(args.to_date) if args.to_date else bangkok_now().date() - timedelta(days=1)
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


def load_existing_products(output_path: Path) -> Dict[str, dict]:
    if not output_path.exists():
        return {}
    try:
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {
        item.get("product_id", ""): item
        for item in payload.get("products", [])
        if item.get("product_id")
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


def build_product_entry(
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
            build_price_url(args.base_url, product_id, chunk_start, chunk_end), timeout=args.timeout
        )
        if isinstance(payload, dict):
            meta = payload
            all_records.extend(normalize_records(payload.get("price_list", []), payload.get("unit", "")))

    records = merge_records(all_records)

    product_name = (
        meta.get("product_name")
        or catalog_entry.get("product_name")
        or next((item["product_name"] for item in DEFAULT_PRODUCTS if item["product_id"] == product_id), product_id)
    )

    return {
        "product_id": product_id,
        "product_name": product_name,
        "category_name": meta.get("category_name") or catalog_entry.get("category_name", ""),
        "group_name": meta.get("group_name") or catalog_entry.get("category_name", ""),
        "unit": meta.get("unit", "บาท/100 กก."),
        "records": records,
    }


def build_snapshot(products: List[dict], start: date, end: date) -> dict:
    history_years = round(((end - start).days + 1) / 365, 1)
    return {
        "meta": {
            "source_name": "Department of Internal Trade (DIT)",
            "source_url": DEFAULT_SOURCE_URL,
            "generated_at": bangkok_now().isoformat(timespec="seconds"),
            "history_from": start.isoformat(),
            "history_to": end.isoformat(),
            "history_years": history_years,
            "product_count": len(products),
            "note": "Snapshot นี้เก็บราคาข้าวหลายชนิดสำหรับหน้า dashboard ล่าสุดและการดูย้อนหลัง 3 ปี โดยไม่ต้องยิง API ตอนเปิดเว็บ",
        },
        "products": products,
    }


def main() -> int:
    args = parse_args()
    start, end = resolve_date_window(args)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    existing_products = load_existing_products(output_path)
    catalog = fetch_catalog(args.products_url, timeout=args.timeout)
    product_ids = [item.strip() for item in args.product_ids.split(",") if item.strip()]

    products: List[Optional[dict]] = [None] * len(product_ids)

    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = {
            executor.submit(build_product_entry, product_id, catalog.get(product_id, {}), args, start, end): idx
            for idx, product_id in enumerate(product_ids)
        }

        for future in as_completed(futures):
            index = futures[future]
            product_id = product_ids[index]
            try:
                products[index] = future.result()
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
                if product_id in existing_products:
                    products[index] = existing_products[product_id]
                    continue
                raise SystemExit(f"Failed to fetch {product_id}: {exc}") from exc

    snapshot = build_snapshot([product for product in products if product], start, end)
    output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(snapshot['products'])} rice products to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

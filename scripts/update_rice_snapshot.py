#!/usr/bin/env python3
"""Fetch DIT rice prices and write a static snapshot JSON for the frontend."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


DEFAULT_BASE_URL = "https://dataapi.moc.go.th/gis-product-prices"
DEFAULT_SOURCE_URL = "https://data.moc.go.th/OpenData/GISProductPrice"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch DIT rice price data and update frontend snapshot JSON."
    )
    parser.add_argument("--product-id", default="R11001", help="DIT product id")
    parser.add_argument("--from-date", required=True, help="Start date in YYYY-MM-DD")
    parser.add_argument("--to-date", required=True, help="End date in YYYY-MM-DD")
    parser.add_argument("--chunk-days", type=int, default=7, help="Max days per API request")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument(
        "--output",
        default="frontend/src/data/rice-price.json",
        help="Snapshot output file",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="DIT API base URL",
    )
    return parser.parse_args()


def daterange_chunks(start: date, end: date, chunk_days: int) -> List[tuple[date, date]]:
    chunks = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=chunk_days - 1), end)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


def fetch_json(url: str, timeout: int) -> dict:
    with urlopen(url, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        payload = response.read().decode(charset)
    return json.loads(payload)


def build_chunk_url(base_url: str, product_id: str, start: date, end: date) -> str:
    query = urlencode(
        {
            "product_id": product_id,
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
        }
    )
    return f"{base_url}?{query}"


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


def merge_records(chunks: List[Dict[str, object]]) -> List[Dict[str, object]]:
    merged: Dict[str, Dict[str, object]] = {}
    for record in chunks:
        merged[str(record["date"])] = record
    return [merged[key] for key in sorted(merged.keys())]


def build_snapshot(meta_source: dict, records: List[Dict[str, object]], start: date, end: date) -> dict:
    bangkok_tz = timezone(timedelta(hours=7))
    return {
        "meta": {
            "source_name": "Department of Internal Trade (DIT)",
            "source_url": DEFAULT_SOURCE_URL,
            "product_id": meta_source.get("product_id", ""),
            "product_name": meta_source.get("product_name", ""),
            "product_desc_th": meta_source.get("product_desc_th", ""),
            "product_desc_en": meta_source.get("product_desc_en", ""),
            "category_name": meta_source.get("category_name", ""),
            "group_name": meta_source.get("group_name", ""),
            "unit": meta_source.get("unit", ""),
            "generated_at": datetime.now(bangkok_tz).isoformat(timespec="seconds"),
            "default_from": start.isoformat(),
            "default_to": end.isoformat(),
            "max_range_days": 7,
            "note": "ข้อมูล snapshot ที่บันทึกไว้ล่วงหน้าเพื่อให้หน้าเว็บเปิดแล้วเห็นข้อมูลทันที โดยอ้างอิงข้อมูลจาก DIT",
        },
        "records": records,
    }


def main() -> int:
    args = parse_args()
    start = date.fromisoformat(args.from_date)
    end = date.fromisoformat(args.to_date)
    if start > end:
        raise SystemExit("--from-date must be on or before --to-date")
    if args.chunk_days < 1:
        raise SystemExit("--chunk-days must be >= 1")

    all_records: List[Dict[str, object]] = []
    latest_meta: dict | None = None

    for chunk_start, chunk_end in daterange_chunks(start, end, args.chunk_days):
        url = build_chunk_url(args.base_url, args.product_id, chunk_start, chunk_end)
        try:
            payload = fetch_json(url, timeout=args.timeout)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Failed to fetch DIT data for {chunk_start} to {chunk_end}: {exc}") from exc

        latest_meta = payload
        all_records.extend(normalize_records(payload.get("price_list", []), payload.get("unit", "")))

    records = merge_records(all_records)
    snapshot = build_snapshot(latest_meta or {}, records, start, end)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(records)} records to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

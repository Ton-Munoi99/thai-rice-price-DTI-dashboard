from __future__ import annotations

from datetime import date
from typing import Any

import requests
from dateutil import parser

from .config import settings
from .schemas import CommodityKPI, DashboardMeta, LatestPriceRow, PriceSummary, RiceDashboardResponse, TimeSeriesPoint


class DitApiError(RuntimeError):
    pass


def _coerce_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def _parse_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if not value:
        raise DitApiError("DIT response did not include a valid date.")
    return parser.parse(str(value)).date()


def _unwrap_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict) and "price_list" in payload:
        return payload
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        if "price_list" in payload[0]:
            return payload[0]
    if isinstance(payload, dict):
        for key in ("data", "result", "results"):
            nested = payload.get(key)
            if isinstance(nested, list) and nested and isinstance(nested[0], dict) and "price_list" in nested[0]:
                return nested[0]
            if isinstance(nested, dict) and "price_list" in nested:
                return nested
    raise DitApiError("DIT response format was not recognized.")


def _fetch_prices(from_date: date, to_date: date) -> dict[str, Any]:
    response = requests.get(
        f"{settings.dit_base_url.rstrip('/')}/gis-product-prices",
        params={
            "product_id": settings.dit_rice_product_id,
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
        },
        timeout=settings.request_timeout_seconds,
    )
    response.raise_for_status()
    return _unwrap_payload(response.json())


def _build_points(price_list: list[dict[str, Any]]) -> list[TimeSeriesPoint]:
    points: list[TimeSeriesPoint] = []
    for row in price_list:
        point_date = _parse_date(row.get("date"))
        price_min = _coerce_float(row.get("price_min"))
        price_max = _coerce_float(row.get("price_max"))
        points.append(
            TimeSeriesPoint(
                date=point_date,
                value=round((price_min + price_max) / 2, 2),
                min_value=price_min,
                max_value=price_max,
            )
        )
    return sorted(points, key=lambda item: item.date)


def _weekly_average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _resolve_range(from_date: date | None, to_date: date | None) -> tuple[date, date]:
    resolved_from = from_date or _parse_date(settings.dit_default_from_date)
    resolved_to = to_date or _parse_date(settings.dit_default_to_date)
    if resolved_from > resolved_to:
        raise DitApiError("from_date must be on or before to_date.")
    if (resolved_to - resolved_from).days + 1 > settings.dit_max_range_days:
        raise DitApiError(f"Please select a date range of {settings.dit_max_range_days} days or less.")
    return resolved_from, resolved_to


def get_rice_dashboard(from_date: date | None = None, to_date: date | None = None) -> RiceDashboardResponse:
    from_date, to_date = _resolve_range(from_date=from_date, to_date=to_date)
    payload = _fetch_prices(from_date=from_date, to_date=to_date)
    points = _build_points(payload.get("price_list", []))

    if not points:
        raise DitApiError("DIT returned no price rows for the selected date range.")

    latest_point = points[-1]
    latest_values = [point.value for point in points[-7:]]
    previous_values = [point.value for point in points[-14:-7]]
    latest_weekly = _weekly_average(latest_values)
    previous_weekly = _weekly_average(previous_values)
    wow_change = None
    if latest_weekly is not None and previous_weekly not in (None, 0):
        wow_change = round(((latest_weekly - previous_weekly) / previous_weekly) * 100, 2)

    latest_rows = [
        LatestPriceRow(
            date=point.date,
            price_min=point.min_value,
            price_max=point.max_value,
            price_avg=point.value,
            unit=payload.get("unit"),
        )
        for point in reversed(points[-20:])
    ]

    spreads = [point.max_value - point.min_value for point in points]

    return RiceDashboardResponse(
        meta=DashboardMeta(
            source_name="Department of Internal Trade (DIT)",
            source_url="https://data.moc.go.th/OpenData/GISProductPrice",
            product_id=payload.get("product_id") or settings.dit_rice_product_id,
            product_name=payload.get("product_name") or "Rice",
            product_desc_th=payload.get("product_desc_th"),
            product_desc_en=payload.get("product_desc_en"),
            category_name=payload.get("category_name"),
            group_name=payload.get("group_name"),
            unit=payload.get("unit"),
            date_from=points[0].date,
            date_to=points[-1].date,
            note="ควรเลือกช่วงวันที่สั้น ๆ เพราะ DIT API อาจตอบช้าหรือหมดเวลาเมื่อขอข้อมูลช่วงกว้างหรือช่วงใหม่เกินไป",
            max_range_days=settings.dit_max_range_days,
        ),
        overview=CommodityKPI(
            commodity_key="RICE",
            commodity_th=payload.get("product_desc_th") or payload.get("product_name") or "Rice",
            latest_daily_price=latest_point.value,
            latest_weekly_price=latest_weekly,
            wow_change_pct=wow_change,
        ),
        points=points,
        latest_rows=latest_rows,
        summary=PriceSummary(
            latest_min=latest_point.min_value,
            latest_max=latest_point.max_value,
            latest_avg=latest_point.value,
            period_min=min(point.min_value for point in points),
            period_max=max(point.max_value for point in points),
            average_spread=round(sum(spreads) / len(spreads), 2),
        ),
    )

from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class CommodityKPI(BaseModel):
    commodity_key: str
    commodity_th: str
    latest_daily_price: Optional[float] = None
    wow_change_pct: Optional[float] = None
    latest_weekly_price: Optional[float] = None


class TimeSeriesPoint(BaseModel):
    date: date
    value: float
    min_value: float
    max_value: float


class LatestPriceRow(BaseModel):
    date: date
    price_min: float
    price_max: float
    price_avg: float
    unit: Optional[str] = None


class PriceSummary(BaseModel):
    latest_min: float
    latest_max: float
    latest_avg: float
    period_min: float
    period_max: float
    average_spread: float


class DashboardMeta(BaseModel):
    source_name: str
    source_url: str
    product_id: str
    product_name: str
    product_desc_th: Optional[str] = None
    product_desc_en: Optional[str] = None
    category_name: Optional[str] = None
    group_name: Optional[str] = None
    unit: Optional[str] = None
    date_from: date
    date_to: date
    note: Optional[str] = None
    max_range_days: int


class RiceDashboardResponse(BaseModel):
    meta: DashboardMeta
    overview: CommodityKPI
    points: List[TimeSeriesPoint]
    latest_rows: List[LatestPriceRow]
    summary: PriceSummary

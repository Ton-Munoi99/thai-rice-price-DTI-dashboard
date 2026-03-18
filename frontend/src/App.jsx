import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sparkline from "./components/Sparkline";
import TrendChart from "./components/TrendChart";
import latestFallback from "./data/rice-latest.json";

const RANGE_OPTIONS = [
  { label: "30 วัน", days: 30 },
  { label: "6 เดือน", days: 183 },
  { label: "1 ปี", days: 365 },
  { label: "3 ปี", days: 365 * 3 },
  { label: "5 ปี", days: 365 * 5 },
];

const CATEGORY_OPTIONS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "jasmine", label: "หอมมะลิ" },
  { key: "fragrant", label: "ข้าวหอม" },
  { key: "white", label: "ข้าวขาว" },
  { key: "sticky", label: "เหนียว" },
  { key: "parboiled", label: "นึ่ง" },
  { key: "broken", label: "ปลายข้าว" },
];

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function latestDateAcrossProducts(products) {
  const dates = products.map((product) => product.latest?.date).filter(Boolean);
  if (!dates.length) return null;
  return dates.sort().at(-1) ?? null;
}

function cutRecords(records, days) {
  if (!records.length) return [];
  const latestDate = new Date(records[records.length - 1].date);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return records.filter((record) => new Date(record.date) >= cutoff);
}

function productCategory(productName) {
  if (productName.includes("หอมมะลิ")) return "jasmine";
  if (productName.includes("ปลายข้าว")) return "broken";
  if (productName.includes("เหนียว")) return "sticky";
  if (productName.includes("นึ่ง")) return "parboiled";
  if (productName.includes("หอม")) return "fragrant";
  if (productName.includes("ข้าวขาว")) return "white";
  return "other";
}

function buildLatestUrl() {
  const stamp = Date.now();
  return `${import.meta.env.BASE_URL}data/rice-latest.json?t=${stamp}`;
}

function buildHistoryUrl(productId, versionStamp) {
  const stamp = encodeURIComponent(versionStamp || Date.now());
  return `${import.meta.env.BASE_URL}data/rice-history/${productId}.json?v=${stamp}`;
}

export default function App() {
  const [latestIndex, setLatestIndex] = useState(latestFallback);
  const [selectedProductId, setSelectedProductId] = useState(
    latestFallback.products?.[0]?.product_id ?? ""
  );
  const [rangeDays, setRangeDays] = useState(365);
  const [searchText, setSearchText] = useState("");
  const [categoryKey, setCategoryKey] = useState("all");
  const [historyCache, setHistoryCache] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [latestRefreshing, setLatestRefreshing] = useState(false);
  const [latestError, setLatestError] = useState("");

  const refreshLatest = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLatestRefreshing(true);
    }
    setLatestError("");

    try {
      const response = await fetch(buildLatestUrl(), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!payload?.products?.length) {
        throw new Error("snapshot ว่างเปล่า");
      }
      setLatestIndex(payload);
    } catch (error) {
      setLatestError(error.message || "โหลดข้อมูลล่าสุดไม่สำเร็จ");
    } finally {
      if (!silent) {
        setLatestRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshLatest({ silent: true });
  }, [refreshLatest]);

  const products = latestIndex.products ?? [];

  useEffect(() => {
    if (!products.length) return;
    const hasSelected = products.some((product) => product.product_id === selectedProductId);
    if (!hasSelected) {
      setSelectedProductId(products[0].product_id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    setHistoryCache({});
  }, [latestIndex.meta?.generated_at]);

  const catalogProducts = useMemo(() => {
    return products
      .map((product) => ({
        ...product,
        uiCategory: productCategory(product.product_name),
      }))
      .filter((product) => {
        const matchesCategory = categoryKey === "all" || product.uiCategory === categoryKey;
        const keyword = searchText.trim().toLowerCase();
        const matchesSearch =
          !keyword ||
          product.product_name.toLowerCase().includes(keyword) ||
          product.product_id.toLowerCase().includes(keyword);
        return matchesCategory && matchesSearch;
      });
  }, [products, categoryKey, searchText]);

  useEffect(() => {
    if (!catalogProducts.length) return;
    const selectedVisible = catalogProducts.some(
      (product) => product.product_id === selectedProductId
    );
    if (!selectedVisible) {
      setSelectedProductId(catalogProducts[0].product_id);
    }
  }, [catalogProducts, selectedProductId]);

  const selectedProduct =
    catalogProducts.find((product) => product.product_id === selectedProductId) ??
    products.find((product) => product.product_id === selectedProductId) ??
    catalogProducts[0] ??
    products[0] ??
    null;

  useEffect(() => {
    if (!selectedProduct?.product_id || historyCache[selectedProduct.product_id]) {
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");

    fetch(buildHistoryUrl(selectedProduct.product_id, latestIndex.meta?.generated_at), {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setHistoryCache((previous) => ({
          ...previous,
          [selectedProduct.product_id]: payload.records ?? [],
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setHistoryError(error.message || "โหลดข้อมูลย้อนหลังไม่สำเร็จ");
      })
      .finally(() => {
        if (cancelled) return;
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, historyCache, latestIndex.meta?.generated_at]);

  const selectedHistoryRecords = selectedProduct
    ? historyCache[selectedProduct.product_id] ?? []
    : [];
  const selectedRangeRecords = useMemo(
    () => cutRecords(selectedHistoryRecords, rangeDays),
    [selectedHistoryRecords, rangeDays]
  );

  const selectedLatest = selectedProduct?.latest ?? null;
  const selectedAverage = selectedProduct?.summary_30d?.avg ?? null;
  const selectedLow = selectedProduct?.summary_30d?.low ?? null;
  const selectedHigh = selectedProduct?.summary_30d?.high ?? null;
  const latestMarketDate = latestDateAcrossProducts(products);
  const selectedDeltaClass =
    selectedProduct?.change_abs == null ? "" : selectedProduct.change_abs >= 0 ? "up" : "down";

  const recentRows = [...selectedRangeRecords].slice(-12).reverse();

  if (!selectedProduct) {
    return (
      <div className="app-shell">
        <div className="history-placeholder error">
          ยังไม่พบข้อมูลราคา กรุณารัน <code>scripts/update_rice_snapshot.py</code> เพื่อสร้าง
          snapshot ก่อนใช้งาน
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Thailand Rice Price Monitor</span>
          <h1>แดชบอร์ดราคาข้าว</h1>
          <p className="subtitle">
            โฟกัสที่ราคาล่าสุดของสินค้าข้าวหลายชนิด พร้อมเลือกดูแนวโน้มย้อนหลังได้ทันทีแบบไม่ต้องรอโหลดทั้งหน้า
          </p>
        </div>
        <div className="topbar-actions">
          <div className="meta-stack">
            <div className="meta-chip">
              <span>อัปเดต snapshot ล่าสุด</span>
              <strong>{formatDateTime(latestIndex.meta?.generated_at)} น.</strong>
            </div>
            <div className="meta-chip">
              <span>วันที่ราคาล่าสุดในระบบ</span>
              <strong>{formatDate(latestMarketDate)}</strong>
            </div>
          </div>
          <button
            type="button"
            className="refresh-button"
            onClick={() => void refreshLatest()}
            disabled={latestRefreshing}
          >
            {latestRefreshing ? "กำลังอัปเดต..." : "อัปเดตข้อมูลล่าสุด"}
          </button>
        </div>
      </header>

      {latestError ? <div className="status-banner error">{latestError}</div> : null}

      <section className="summary-hero">
        <div className="summary-main">
          <div className="section-kicker">สินค้าที่เลือก</div>
          <div className="summary-head">
            <div>
              <h2>{selectedProduct.product_name}</h2>
              <p>
                {selectedProduct.category_name} | {selectedProduct.unit}
              </p>
            </div>
            <div className="select-wrap compact">
              <label>จำนวนสินค้าข้าวใน snapshot</label>
              <div className="count-pill">{products.length} รายการ</div>
            </div>
          </div>
          <div className="price-hero">
            <div>
              <span className="price-caption">ราคาล่าสุด</span>
              <strong className="price-value">
                {formatNumber(selectedLatest?.price_avg)} {selectedProduct.unit}
              </strong>
              <p className="price-note">ข้อมูลวันที่ {formatDate(selectedLatest?.date)}</p>
            </div>
            <div className={`change-badge ${selectedDeltaClass}`}>
              <span>เทียบวันก่อนหน้า</span>
              <strong>
                {selectedProduct?.change_abs == null
                  ? "-"
                  : `${selectedProduct.change_abs >= 0 ? "+" : ""}${formatNumber(
                      selectedProduct.change_abs
                    )}`}
              </strong>
              <small>
                {selectedProduct?.change_pct == null
                  ? "ไม่มีข้อมูลเปรียบเทียบ"
                  : `${selectedProduct.change_pct >= 0 ? "+" : ""}${formatNumber(
                      selectedProduct.change_pct,
                      2
                    )}%`}
              </small>
            </div>
          </div>
        </div>

        <div className="summary-side">
          <div className="mini-metric">
            <span>เฉลี่ย 30 วันล่าสุด</span>
            <strong>{formatNumber(selectedAverage)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
          <div className="mini-metric">
            <span>ต่ำสุด 30 วันล่าสุด</span>
            <strong>{formatNumber(selectedLow)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
          <div className="mini-metric">
            <span>สูงสุด 30 วันล่าสุด</span>
            <strong>{formatNumber(selectedHigh)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="section-block explorer-panel">
          <div className="section-head compact">
            <div>
              <div className="section-kicker">Product Explorer</div>
              <h3>ค้นหาและเลือกสินค้าข้าว</h3>
            </div>
          </div>

          <div className="explorer-toolbar stacked">
            <input
              type="search"
              className="search-input"
              placeholder="ค้นหาชื่อสินค้า หรือรหัสสินค้า"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <div className="category-chips">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={categoryKey === option.key ? "active" : ""}
                  onClick={() => setCategoryKey(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="explorer-meta vertical">
            <span>
              แสดง {catalogProducts.length} จาก {products.length} รายการ
            </span>
            <span>เลือกสินค้าทางซ้าย แล้วกราฟย้อนหลังด้านขวาจะเปลี่ยนทันที</span>
          </div>

          {catalogProducts.length ? (
            <div className="explorer-list compact">
              {catalogProducts.map((product) => {
                const sparklineValues = (product.recent_points ?? []).map((record) => record.price_avg);
                const deltaClass =
                  product.change_abs == null ? "" : product.change_abs >= 0 ? "up" : "down";
                return (
                  <button
                    key={product.product_id}
                    type="button"
                    className={`list-card ${
                      product.product_id === selectedProduct.product_id ? "active" : ""
                    }`}
                    onClick={() => setSelectedProductId(product.product_id)}
                  >
                    <div className="list-card-head">
                      <div>
                        <strong>{product.product_name}</strong>
                        <span>
                          {product.product_id} | {product.unit}
                        </span>
                      </div>
                      <span className={`delta-pill ${deltaClass}`}>
                        {product.change_abs == null
                          ? "-"
                          : `${product.change_abs >= 0 ? "+" : ""}${formatNumber(
                              product.change_abs
                            )}`}
                      </span>
                    </div>
                    <div className="list-card-body compact">
                      <div className="latest-stack">
                        <span>ราคาล่าสุด</span>
                        <strong>{formatNumber(product.latest?.price_avg)}</strong>
                        <small>{formatDate(product.latest?.date)}</small>
                      </div>
                      <div className="spark-cell">
                        <Sparkline values={sparklineValues} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">ไม่พบสินค้าข้าวตามคำค้นหาหรือหมวดที่เลือก</div>
          )}
        </aside>

        <section className="section-block history-panel">
          <div className="history-header">
            <div className="history-heading">
              <div className="section-kicker">History</div>
              <h3>ดูราคาย้อนหลัง</h3>
              <p>{selectedProduct.product_name}</p>
            </div>
            <div className="history-controls">
              <div className="range-switch">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    className={rangeDays === option.days ? "active" : ""}
                    onClick={() => setRangeDays(option.days)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="history-info-strip">
            <div>
              <span>ราคาล่าสุด</span>
              <strong>{formatNumber(selectedLatest?.price_avg)}</strong>
            </div>
            <div>
              <span>วันที่ล่าสุด</span>
              <strong>{formatDate(selectedLatest?.date)}</strong>
            </div>
            <div>
              <span>ช่วงข้อมูลในกราฟ</span>
              <strong>{RANGE_OPTIONS.find((item) => item.days === rangeDays)?.label}</strong>
            </div>
          </div>

          <div className="history-layout">
            <div className="chart-panel">
              {historyLoading && !selectedRangeRecords.length ? (
                <div className="history-placeholder">กำลังโหลดข้อมูลย้อนหลัง...</div>
              ) : historyError && !selectedRangeRecords.length ? (
                <div className="history-placeholder error">
                  โหลดข้อมูลย้อนหลังไม่สำเร็จ: {historyError}
                </div>
              ) : (
                <TrendChart records={selectedRangeRecords} color="#15623a" unit={selectedProduct.unit} />
              )}
            </div>

            <div className="table-panel">
              <div className="table-head">
                <strong>ราคาย้อนหลังล่าสุด</strong>
                <span>{selectedRangeRecords.length} ระเบียน</span>
              </div>
              {selectedRangeRecords.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ต่ำสุด</th>
                      <th>สูงสุด</th>
                      <th>เฉลี่ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.map((record) => (
                      <tr key={`${selectedProduct.product_id}-${record.date}`}>
                        <td>{formatDate(record.date)}</td>
                        <td>{formatNumber(record.price_min)}</td>
                        <td>{formatNumber(record.price_max)}</td>
                        <td>{formatNumber(record.price_avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="history-placeholder">
                  {historyLoading ? "กำลังโหลดข้อมูลย้อนหลัง..." : "ยังไม่มีข้อมูลย้อนหลังให้แสดง"}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

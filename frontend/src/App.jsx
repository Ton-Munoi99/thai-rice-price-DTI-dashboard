import React, { useMemo, useState } from "react";
import Sparkline from "./components/Sparkline";
import TrendChart from "./components/TrendChart";
import dashboard from "./data/rice-dashboard.json";

const RANGE_OPTIONS = [
  { label: "30 วัน", days: 30 },
  { label: "6 เดือน", days: 183 },
  { label: "1 ปี", days: 365 },
  { label: "3 ปี", days: 365 * 3 },
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

function latestStats(product) {
  const latest = product.records[product.records.length - 1] ?? null;
  const previous = product.records[product.records.length - 2] ?? null;
  const changeAbs =
    latest && previous ? Number((latest.price_avg - previous.price_avg).toFixed(2)) : null;
  const changePct =
    latest && previous && previous.price_avg
      ? Number((((latest.price_avg - previous.price_avg) / previous.price_avg) * 100).toFixed(2))
      : null;

  return { latest, previous, changeAbs, changePct };
}

function average(items, key) {
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + item[key], 0) / items.length;
}

function minOf(items, key) {
  return items.length ? Math.min(...items.map((item) => item[key])) : null;
}

function maxOf(items, key) {
  return items.length ? Math.max(...items.map((item) => item[key])) : null;
}

function latestDateAcrossProducts(products) {
  const dates = products
    .map((product) => product.records[product.records.length - 1]?.date)
    .filter(Boolean);
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

export default function App() {
  const products = dashboard.products;
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.product_id ?? "");
  const [rangeDays, setRangeDays] = useState(365);

  const selectedProduct =
    products.find((product) => product.product_id === selectedProductId) ?? products[0];

  const selectedRangeRecords = useMemo(
    () => cutRecords(selectedProduct?.records ?? [], rangeDays),
    [selectedProduct, rangeDays]
  );

  const selectedStats = latestStats(selectedProduct);
  const selectedAverage = average(selectedRangeRecords, "price_avg");
  const selectedLow = minOf(selectedRangeRecords, "price_min");
  const selectedHigh = maxOf(selectedRangeRecords, "price_max");
  const latestMarketDate = latestDateAcrossProducts(products);

  const recentRows = [...selectedRangeRecords].slice(-12).reverse();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Thailand Rice Price Monitor</span>
          <h1>แดชบอร์ดราคาข้าว</h1>
          <p className="subtitle">
            โฟกัสที่ราคาล่าสุดเป็นหลัก แล้วค่อยกดดูย้อนหลังได้สูงสุด 3 ปี
          </p>
        </div>
        <div className="meta-stack">
          <div className="meta-chip">
            <span>อัปเดตระบบ</span>
            <strong>{formatDateTime(dashboard.meta.generated_at)} น.</strong>
          </div>
          <div className="meta-chip">
            <span>วันที่ราคาล่าสุด</span>
            <strong>{formatDate(latestMarketDate)}</strong>
          </div>
        </div>
      </header>

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
            <div className="select-wrap">
              <label htmlFor="product-select">เลือกสินค้า</label>
              <select
                id="product-select"
                value={selectedProduct.product_id}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.product_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="price-hero">
            <div>
              <span className="price-caption">ราคาล่าสุด</span>
              <strong className="price-value">
                {formatNumber(selectedStats.latest?.price_avg)} {selectedProduct.unit}
              </strong>
              <p className="price-note">ข้อมูลวันที่ {formatDate(selectedStats.latest?.date)}</p>
            </div>
            <div className={`change-badge ${selectedStats.changeAbs >= 0 ? "up" : "down"}`}>
              <span>เทียบวันก่อนหน้า</span>
              <strong>
                {selectedStats.changeAbs == null
                  ? "-"
                  : `${selectedStats.changeAbs >= 0 ? "+" : ""}${formatNumber(
                      selectedStats.changeAbs
                    )}`}
              </strong>
              <small>
                {selectedStats.changePct == null
                  ? "ไม่มีข้อมูลเปรียบเทียบ"
                  : `${selectedStats.changePct >= 0 ? "+" : ""}${formatNumber(
                      selectedStats.changePct,
                      2
                    )}%`}
              </small>
            </div>
          </div>
        </div>

        <div className="summary-side">
          <div className="mini-metric">
            <span>ค่าเฉลี่ยย้อนหลัง</span>
            <strong>{formatNumber(selectedAverage)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
          <div className="mini-metric">
            <span>ต่ำสุดในช่วง</span>
            <strong>{formatNumber(selectedLow)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
          <div className="mini-metric">
            <span>สูงสุดในช่วง</span>
            <strong>{formatNumber(selectedHigh)}</strong>
            <small>{selectedProduct.unit}</small>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <div className="section-kicker">Latest Board</div>
            <h3>ราคาล่าสุดของสินค้าข้าว</h3>
          </div>
        </div>
        <div className="product-grid">
          {products.map((product) => {
            const stats = latestStats(product);
            const sparklineValues = product.records.slice(-30).map((record) => record.price_avg);
            const deltaClass =
              stats.changeAbs == null ? "" : stats.changeAbs >= 0 ? "up" : "down";
            return (
              <button
                key={product.product_id}
                type="button"
                className={`product-card ${
                  product.product_id === selectedProduct.product_id ? "active" : ""
                }`}
                onClick={() => setSelectedProductId(product.product_id)}
              >
                <div className="product-card-head">
                  <div>
                    <strong>{product.product_name}</strong>
                    <span>{product.product_id}</span>
                  </div>
                  <span className={`delta-pill ${deltaClass}`}>
                    {stats.changeAbs == null
                      ? "-"
                      : `${stats.changeAbs >= 0 ? "+" : ""}${formatNumber(stats.changeAbs)}`}
                  </span>
                </div>
                <div className="latest-row">
                  <span>ล่าสุด</span>
                  <strong>{formatNumber(stats.latest?.price_avg)}</strong>
                </div>
                <div className="card-foot">
                  <span>{formatDate(stats.latest?.date)}</span>
                  <span>{product.unit}</span>
                </div>
                <Sparkline values={sparklineValues} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-block history-section">
        <div className="section-head">
          <div>
            <div className="section-kicker">History</div>
            <h3>ดูราคาย้อนหลัง</h3>
          </div>
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

        <div className="history-layout">
          <div className="chart-panel">
            <TrendChart
              records={selectedRangeRecords}
              color="#15623a"
              unit={selectedProduct.unit}
            />
          </div>

          <div className="table-panel">
            <div className="table-head">
              <strong>ราคาย้อนหลังล่าสุด</strong>
              <span>
                {selectedRangeRecords.length} ระเบียน | ช่วง {RANGE_OPTIONS.find((x) => x.days === rangeDays)?.label}
              </span>
            </div>
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
          </div>
        </div>
      </section>
    </div>
  );
}

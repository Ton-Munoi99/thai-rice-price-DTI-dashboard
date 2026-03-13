import React, { useEffect, useState } from "react";
import { api } from "./api";
import Sparkline from "./components/Sparkline";

const TABS = [
  { key: "overview", label: "ภาพรวมข้าว" },
  { key: "trend", label: "แนวโน้มรายวัน" },
  { key: "records", label: "รายการข้อมูลรายวัน" },
];

function number(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", { maximumFractionDigits: digits });
}

function percent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(2)}%`;
}

function formatRange(minValue, maxValue, unit) {
  if (minValue === null || maxValue === null || minValue === undefined || maxValue === undefined) {
    return "-";
  }
  return `${number(minValue, 2)} - ${number(maxValue, 2)} ${unit || ""}`.trim();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH");
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [fromDate, setFromDate] = useState("2025-01-01");
  const [toDate, setToDate] = useState("2025-01-07");

  async function loadDashboard(nextRange) {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.getRiceDashboard(nextRange || { fromDate, toDate });
      setDashboard(response);
      setFromDate(String(response.meta.date_from));
      setToDate(String(response.meta.date_to));
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = dashboard?.points || [];
  const latestRows = dashboard?.latest_rows || [];
  const meta = dashboard?.meta;
  const overview = dashboard?.overview;
  const summary = dashboard?.summary;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="eyebrow">ระบบราคาข้าว DIT</div>
          <h1>แดชบอร์ดราคาข้าวไทย</h1>
          <p>
            ข้อมูลราคาข้าวย้อนหลังจากกรมการค้าภายใน (DIT)
            โดยอ้างอิงรหัสสินค้า <strong>R11001</strong>
          </p>
          <div className="notice-bar">
            <span className="notice-pill">แหล่งข้อมูลทางการ</span>
            <span>
              API source: <a href={meta?.source_url || "https://data.moc.go.th/OpenData/GISProductPrice"} target="_blank" rel="noreferrer">DIT Open Data</a>
            </span>
          </div>
        </div>
        <div className="actions">
          <div className="date-controls">
            <label>
              <span>ตั้งแต่</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label>
              <span>ถึง</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
          <button onClick={() => loadDashboard({ fromDate, toDate })}>รีเฟรชข้อมูลราคา</button>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-card">
          <span className="hero-label">สินค้า</span>
          <strong>{meta?.product_desc_th || meta?.product_name || "ข้าว"}</strong>
          <p>{meta?.product_desc_en || "ข้อมูลสินค้าข้าวจาก DIT API"}</p>
        </div>
          <div className="hero-card">
            <span className="hero-label">ช่วงวันที่</span>
            <strong>{meta ? `${formatDate(meta.date_from)} ถึง ${formatDate(meta.date_to)}` : "-"}</strong>
            <p>{meta?.note || (meta?.unit ? `Unit: ${meta.unit}` : "Daily price records from DIT")}</p>
          </div>
      </section>

      <section className="filter-bar">
        <div className="filter-copy">
          <strong>เลือกช่วงวันที่</strong>
          <p>เพื่อให้ DIT ตอบกลับได้เสถียร ระบบจำกัดคำขอไว้ไม่เกิน {meta?.max_range_days || 7} วันต่อครั้ง</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => loadDashboard({ fromDate, toDate })}
        >
          ใช้ช่วงวันที่นี้
        </button>
      </section>

      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? "tab active" : "tab"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {isLoading && <div className="status">กำลังโหลดข้อมูลราคาข้าวจาก DIT...</div>}
      {!!error && <div className="status error">{error}</div>}

      {!isLoading && !error && tab === "overview" && (
        <div>
          <section className="executive-board">
            <div className="executive-copy">
              <span className="hero-label">ภาพรวมผู้บริหาร</span>
              <h2>{meta?.product_desc_th || "ข้าว"}</h2>
              <p>
                แสดงช่วงราคาประจำวันจาก DIT และตัวชี้วัดสรุปรายสัปดาห์
                สำหรับสินค้าข้าวในช่วงวันที่ที่เลือก
              </p>
            </div>
            <div className="stat-strip">
              <article className="stat-card">
                <span>ราคาเฉลี่ยล่าสุด</span>
                <strong>{number(overview?.latest_daily_price, 2)}</strong>
                <small>{meta?.unit || ""}</small>
              </article>
              <article className="stat-card">
                <span>เฉลี่ย 7 วันล่าสุด</span>
                <strong>{number(overview?.latest_weekly_price, 2)}</strong>
                <small>{meta?.unit || ""}</small>
              </article>
              <article className="stat-card">
                <span>เปลี่ยนแปลง WoW</span>
                <strong className={overview?.wow_change_pct > 0 ? "up" : overview?.wow_change_pct < 0 ? "down" : ""}>
                  {percent(overview?.wow_change_pct)}
                </strong>
                <small>เทียบกับ 7 วันก่อนหน้า</small>
              </article>
              <article className="stat-card">
                <span>ช่วงราคาล่าสุด</span>
                <strong>{formatRange(summary?.latest_min, summary?.latest_max, meta?.unit)}</strong>
                <small>ตามวันสำรวจล่าสุด</small>
              </article>
            </div>
            <p className="executive-note">
              รหัสสินค้า: {meta?.product_id || "R11001"} | หมวดหมู่: {meta?.category_name || "-"} | กลุ่ม: {meta?.group_name || "-"}
            </p>
          </section>

          <div className="cards">
            <article className="card spotlight">
              <h4>ราคาต่ำสุดในช่วง</h4>
              <div className="metric">
                <span>ค่าต่ำสุดที่พบ</span>
                <strong>{number(summary?.period_min, 2)} {meta?.unit || ""}</strong>
              </div>
            </article>
            <article className="card">
              <h4>ราคาสูงสุดในช่วง</h4>
              <div className="metric">
                <span>ค่าสูงสุดที่พบ</span>
                <strong>{number(summary?.period_max, 2)} {meta?.unit || ""}</strong>
              </div>
            </article>
            <article className="card">
              <h4>ส่วนต่างราคาเฉลี่ย</h4>
              <div className="metric">
                <span>ส่วนต่าง min-max เฉลี่ยต่อวัน</span>
                <strong>{number(summary?.average_spread, 2)} {meta?.unit || ""}</strong>
              </div>
            </article>
          </div>
        </div>
      )}

      {!isLoading && !error && tab === "trend" && (
        <div>
          <div className="panel">
            <h3>แนวโน้มราคาเฉลี่ยรายวัน</h3>
            <p className="panel-note">ราคาเฉลี่ยคำนวณจากค่ากลางระหว่างราคาต่ำสุดและราคาสูงสุดรายวันของ DIT</p>
            <Sparkline values={points.map((point) => point.value)} />
            <div className="row-grid">
              <div>
                <strong>ราคาเฉลี่ยล่าสุด</strong>
                <div>{number(overview?.latest_daily_price, 2)} {meta?.unit || ""}</div>
              </div>
              <div>
                <strong>ราคาต่ำสุดล่าสุด</strong>
                <div>{number(summary?.latest_min, 2)} {meta?.unit || ""}</div>
              </div>
              <div>
                <strong>ราคาสูงสุดล่าสุด</strong>
                <div>{number(summary?.latest_max, 2)} {meta?.unit || ""}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>ราคาเฉลี่ยรายวันล่าสุด</h3>
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>เฉลี่ย</th>
                  <th>ต่ำสุด</th>
                  <th>สูงสุด</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((row) => (
                  <tr key={row.date}>
                    <td>{formatDate(row.date)}</td>
                    <td>{number(row.price_avg, 2)}</td>
                    <td>{number(row.price_min, 2)}</td>
                    <td>{number(row.price_max, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && !error && tab === "records" && (
        <div className="panel">
          <h3>รายการข้อมูลราคาประจำวันจาก DIT</h3>
          <p className="panel-note">
            ฟิลด์ที่ใช้ตรงตามโครงสร้างของ DIT API ได้แก่ date, price_min และ price_max
          </p>
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ราคาต่ำสุด</th>
                <th>ราคาสูงสุด</th>
                <th>ราคาเฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.map((row) => (
                <tr key={`record-${row.date}`}>
                  <td>{formatDate(row.date)}</td>
                  <td>{number(row.price_min, 2)} {row.unit || meta?.unit || ""}</td>
                  <td>{number(row.price_max, 2)} {row.unit || meta?.unit || ""}</td>
                  <td>{number(row.price_avg, 2)} {row.unit || meta?.unit || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";
import Sparkline from "./components/Sparkline";
import snapshot from "./data/rice-price.json";

const tabs = [
  { id: "overview", label: "ภาพรวมราคา" },
  { id: "trend", label: "แนวโน้มรายวัน" },
  { id: "records", label: "ตารางข้อมูล" },
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

function computeAverage(items, key) {
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + item[key], 0) / items.length;
}

function computeWow(records) {
  if (records.length < 4) return null;
  const midpoint = Math.floor(records.length / 2);
  const previous = records.slice(0, midpoint);
  const recent = records.slice(midpoint);
  const previousAvg = computeAverage(previous, "price_avg");
  const recentAvg = computeAverage(recent, "price_avg");
  if (!previousAvg || previousAvg === 0 || recentAvg == null) return null;
  return ((recentAvg - previousAvg) / previousAvg) * 100;
}

export default function App() {
  const meta = snapshot.meta;
  const records = snapshot.records;
  const minDate = records[0]?.date ?? "";
  const maxDate = records[records.length - 1]?.date ?? "";
  const [activeTab, setActiveTab] = useState("overview");
  const [fromDate, setFromDate] = useState(meta.default_from);
  const [toDate, setToDate] = useState(meta.default_to);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const afterStart = !fromDate || record.date >= fromDate;
      const beforeEnd = !toDate || record.date <= toDate;
      return afterStart && beforeEnd;
    });
  }, [fromDate, toDate]);

  const latestRecord = filteredRecords[filteredRecords.length - 1] ?? null;
  const latestAvg = latestRecord?.price_avg ?? null;
  const latestMin = latestRecord?.price_min ?? null;
  const latestMax = latestRecord?.price_max ?? null;
  const periodAvg = computeAverage(filteredRecords, "price_avg");
  const avgSpread = filteredRecords.length
    ? computeAverage(
        filteredRecords.map((record) => ({
          spread: record.price_max - record.price_min,
        })),
        "spread"
      )
    : null;
  const periodLow = filteredRecords.length
    ? Math.min(...filteredRecords.map((record) => record.price_min))
    : null;
  const periodHigh = filteredRecords.length
    ? Math.max(...filteredRecords.map((record) => record.price_max))
    : null;
  const wowChange = computeWow(filteredRecords);
  const sparklineValues = filteredRecords.map((record) => record.price_avg);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">Netlify Static Snapshot</span>
          <h1>แดชบอร์ดราคาข้าวไทย</h1>
          <p>
            หน้าเว็บอ่านข้อมูลจากไฟล์ snapshot JSON ที่ bundle มาพร้อมแอป
            เพื่อให้เปิดแล้วเห็นราคาทันที โดยใช้ข้อมูลจาก DIT สินค้า{" "}
            <strong>{meta.product_name}</strong> รหัส <strong>{meta.product_id}</strong>
          </p>
          <div className="notice-bar">
            <span className="notice-pill">พร้อมใช้งานทันที</span>
            <span>
              แหล่งข้อมูล:{" "}
              <a href={meta.source_url} target="_blank" rel="noreferrer">
                {meta.source_name}
              </a>
            </span>
            <span>อัปเดต snapshot ล่าสุด: {formatDateTime(meta.generated_at)} น.</span>
          </div>
        </div>

        <div className="actions">
          <div className="date-controls">
            <label>
              จากวันที่
              <input
                type="date"
                value={fromDate}
                min={minDate}
                max={maxDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label>
              ถึงวันที่
              <input
                type="date"
                value={toDate}
                min={minDate}
                max={maxDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              setFromDate(meta.default_from);
              setToDate(meta.default_to);
            }}
          >
            รีเซ็ตช่วงมาตรฐาน
          </button>
        </div>
      </header>

      <section className="hero-strip">
        <article className="hero-card">
          <span className="hero-label">สินค้า</span>
          <strong>{meta.product_name}</strong>
          <p>
            หมวด {meta.category_name} | หน่วย {meta.unit}
          </p>
        </article>
        <article className="hero-card">
          <span className="hero-label">ช่วงข้อมูลที่แสดง</span>
          <strong>
            {formatDate(filteredRecords[0]?.date)} - {formatDate(latestRecord?.date)}
          </strong>
          <p>
            แสดง {filteredRecords.length} ระเบียน จาก snapshot ช่วง{" "}
            {formatDate(meta.default_from)} - {formatDate(meta.default_to)}
          </p>
        </article>
      </section>

      <div className="filter-bar">
        <div className="filter-copy">
          <strong>โหมด Static</strong>
          <p>
            หน้าเว็บนี้ไม่รอ backend ตอนเปิดใช้งาน จึงเหมาะกับการแชร์ผ่าน Netlify
            และการเปิดดูข้อมูลอย่างรวดเร็ว
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => window.location.reload()}
        >
          โหลดหน้าใหม่
        </button>
      </div>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {!filteredRecords.length ? (
        <div className="status error">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</div>
      ) : (
        <>
          <section className="executive-board">
            <div className="executive-copy">
              <span className="hero-label">Executive Snapshot</span>
              <h2>{meta.product_name}</h2>
              <p>
                ราคาเฉลี่ยล่าสุด {formatNumber(latestAvg)} {meta.unit} จากวันที่{" "}
                {formatDate(latestRecord?.date)} พร้อมกรอบราคา {formatNumber(latestMin)} -{" "}
                {formatNumber(latestMax)} {meta.unit}
              </p>
              <p className="executive-note">{meta.note}</p>
            </div>

            <div className="stat-strip">
              <div className="stat-card">
                <span>ราคาเฉลี่ยล่าสุด</span>
                <strong>{formatNumber(latestAvg)}</strong>
                <small>{meta.unit}</small>
              </div>
              <div className="stat-card">
                <span>ค่าเฉลี่ยทั้งช่วง</span>
                <strong>{formatNumber(periodAvg)}</strong>
                <small>{meta.unit}</small>
              </div>
              <div className="stat-card">
                <span>การเปลี่ยนแปลงเทียบช่วงก่อนหน้า</span>
                <strong>{wowChange == null ? "-" : `${formatNumber(wowChange, 2)}%`}</strong>
                <small>{wowChange == null ? "ข้อมูลยังไม่พอ" : "คำนวณจากครึ่งช่วงก่อนหน้า"}</small>
              </div>
              <div className="stat-card">
                <span>ส่วนต่างราคาเฉลี่ย</span>
                <strong>{formatNumber(avgSpread)}</strong>
                <small>{meta.unit}</small>
              </div>
            </div>
          </section>

          {activeTab === "overview" && (
            <>
              <section className="cards">
                <article className="card spotlight">
                  <h4>กรอบราคาล่าสุด</h4>
                  <div className="metric">
                    <span>ต่ำสุด</span>
                    <strong>{formatNumber(latestMin)}</strong>
                  </div>
                  <div className="metric">
                    <span>สูงสุด</span>
                    <strong>{formatNumber(latestMax)}</strong>
                  </div>
                </article>
                <article className="card">
                  <h4>ราคาต่ำสุดของช่วง</h4>
                  <div className="metric">
                    <span>ต่ำสุด</span>
                    <strong>{formatNumber(periodLow)}</strong>
                  </div>
                  <div className="metric">
                    <span>อิงจากทุกวันในช่วงที่เลือก</span>
                    <strong>{meta.unit}</strong>
                  </div>
                </article>
                <article className="card">
                  <h4>ราคาสูงสุดของช่วง</h4>
                  <div className="metric">
                    <span>สูงสุด</span>
                    <strong>{formatNumber(periodHigh)}</strong>
                  </div>
                  <div className="metric">
                    <span>อิงจากทุกวันในช่วงที่เลือก</span>
                    <strong>{meta.unit}</strong>
                  </div>
                </article>
              </section>

              <section className="two-column">
                <article className="panel">
                  <h3>แนวโน้มราคาเฉลี่ย</h3>
                  <p className="panel-note">
                    ใช้ค่า midpoint ของราคา `min` และ `max` เพื่อให้เห็นภาพทิศทางราคาอย่างเร็ว
                  </p>
                  <Sparkline values={sparklineValues} />
                </article>
                <article className="panel">
                  <h3>ข้อมูลอ้างอิง</h3>
                  <div className="row-grid">
                    <div>
                      <strong>แหล่งข้อมูล</strong>
                      <div>{meta.source_name}</div>
                    </div>
                    <div>
                      <strong>กลุ่มข้อมูล</strong>
                      <div>{meta.group_name}</div>
                    </div>
                    <div>
                      <strong>หน่วยราคา</strong>
                      <div>{meta.unit}</div>
                    </div>
                    <div>
                      <strong>วันที่สร้าง snapshot</strong>
                      <div>{formatDateTime(meta.generated_at)} น.</div>
                    </div>
                  </div>
                </article>
              </section>
            </>
          )}

          {activeTab === "trend" && (
            <section className="panel">
              <h3>แนวโน้มราคารายวัน</h3>
              <p className="panel-note">
                ตารางนี้แสดงราคา `ต่ำสุด`, `สูงสุด` และ `เฉลี่ย` ของแต่ละวันที่ถูกบันทึกไว้ใน snapshot
              </p>
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>ต่ำสุด</th>
                    <th>สูงสุด</th>
                    <th>เฉลี่ย</th>
                    <th>ส่วนต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.date}>
                      <td>{formatDate(record.date)}</td>
                      <td>{formatNumber(record.price_min)}</td>
                      <td>{formatNumber(record.price_max)}</td>
                      <td>{formatNumber(record.price_avg)}</td>
                      <td>{formatNumber(record.price_max - record.price_min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "records" && (
            <section className="panel">
              <h3>ตารางข้อมูล snapshot</h3>
              <p className="panel-note">
                เหมาะสำหรับการตรวจเลขก่อนนำไปใช้อ้างอิงหรือเทียบกับ snapshot รอบถัดไป
              </p>
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>Price Min</th>
                    <th>Price Max</th>
                    <th>Price Avg</th>
                    <th>หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.date}>
                      <td>{record.date}</td>
                      <td>{formatNumber(record.price_min)}</td>
                      <td>{formatNumber(record.price_max)}</td>
                      <td>{formatNumber(record.price_avg)}</td>
                      <td>{record.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}

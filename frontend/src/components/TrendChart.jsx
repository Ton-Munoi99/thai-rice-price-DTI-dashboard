import React from "react";

function toPoints(records, width, height) {
  if (!records.length) return { line: "", area: "" };
  const values = records.map((record) => record.price_avg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = records.map((record, index) => {
    const x = (index / Math.max(records.length - 1, 1)) * width;
    const y = height - ((record.price_avg - min) / range) * height;
    return [x, y];
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return { line, area };
}

export default function TrendChart({ records = [], color = "#15623a", unit = "" }) {
  const width = 860;
  const height = 280;
  const { line, area } = toPoints(records, width, height);
  const values = records.map((record) => record.price_avg);
  const low = values.length ? Math.min(...values) : null;
  const high = values.length ? Math.max(...values) : null;

  return (
    <div className="trend-chart">
      <div className="trend-meta">
        <div>
          <span>ต่ำสุด</span>
          <strong>{low == null ? "-" : low.toLocaleString("th-TH")}</strong>
        </div>
        <div>
          <span>สูงสุด</span>
          <strong>{high == null ? "-" : high.toLocaleString("th-TH")}</strong>
        </div>
        <div>
          <span>หน่วย</span>
          <strong>{unit || "-"}</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 24}`} role="img" aria-label="price trend chart">
        <defs>
          <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="24" fill="#f6fbf6" />
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

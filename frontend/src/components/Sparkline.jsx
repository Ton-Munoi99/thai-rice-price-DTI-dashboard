import React from "react";

function toPath(values, width, height) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function Sparkline({ values = [], color = "#1f8d49" }) {
  return (
    <svg viewBox="0 0 140 36" className="sparkline" role="img" aria-label="sparkline">
      <path d={toPath(values, 140, 36)} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

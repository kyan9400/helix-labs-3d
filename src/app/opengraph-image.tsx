import { ImageResponse } from "next/og";

export const alt = "Helix Labs — genomic medicine clinic. A DNA double helix in coral, amber, teal and indigo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = ["#D9472F", "#E9A23B", "#1E9C8F", "#3F51C9"];
const COMP = [1, 0, 3, 2];

function helixSvg() {
  const n = 26;
  let rungs = "";
  let a1 = "";
  let a2 = "";
  let nodes = "";
  let seed = 11;
  for (let i = 0; i < n; i++) {
    seed = (seed * 48271) % 2147483647;
    const b = seed % 4;
    const t = i / (n - 1);
    const ang = t * Math.PI * 2 * 2.4;
    const y = 30 + t * 560;
    const ax = 200 + Math.cos(ang) * 110;
    const bx = 200 + Math.cos(ang + Math.PI * 0.75) * 110;
    const mid = (ax + bx) / 2;
    rungs += `<line x1="${ax.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(mid - 3).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COLORS[b]}" stroke-width="9" stroke-linecap="round"/>`;
    rungs += `<line x1="${(mid + 3).toFixed(1)}" y1="${y.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COLORS[COMP[b]]}" stroke-width="9" stroke-linecap="round"/>`;
    a1 += `${i ? "L" : "M"}${ax.toFixed(1)} ${y.toFixed(1)} `;
    a2 += `${i ? "L" : "M"}${bx.toFixed(1)} ${y.toFixed(1)} `;
    nodes += `<circle cx="${ax.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="#134E4A"/><circle cx="${bx.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="#1D2748"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 620"><g transform="rotate(-18 200 310)">${rungs}<path d="${a1}" fill="none" stroke="#2F6E68" stroke-width="5"/><path d="${a2}" fill="none" stroke="#36437A" stroke-width="5"/>${nodes}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F4F1EA",
          color: "#10201F",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: "#0F6E68", textTransform: "uppercase" }}>
            HX—00 · Genomic medicine clinic
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: -2, fontWeight: 600 }}>Read the code</div>
            <div style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: -2, fontWeight: 600, color: "#AE3520" }}>
              you were born with.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30 }}>
            <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: "#0F6E68" }} />
            Helix Labs
            <div style={{ display: "flex", color: "#3A4B48", fontSize: 22, marginLeft: 12 }}>
              Sequencing · Cell therapy · Diagnostics · Longevity
            </div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={helixSvg()} width={400} height={620} alt="" style={{ position: "absolute", right: 60, top: 5 }} />
      </div>
    ),
    size,
  );
}

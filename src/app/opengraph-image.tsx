import { ImageResponse } from "next/og";

export const alt = "Ahead — Know if the work is working.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#050505",
          color: "#f5f5f3",
          padding: "72px 80px",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em" }}>Ahead</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 500,
              letterSpacing: "-0.045em",
              lineHeight: 1.05,
              maxWidth: 920,
            }}
          >
            Know if the work is working.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(245, 245, 243, 0.55)",
              maxWidth: 740,
              lineHeight: 1.35,
            }}
          >
            Training, recovery and races — what’s changing, and what to do next.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#00e05a" }}>getahead.fit</div>
      </div>
    ),
    { ...size },
  );
}

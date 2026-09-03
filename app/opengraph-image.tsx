import { ImageResponse } from "next/og";

export const alt = "Axion — Les interventions terrain, enfin maîtrisées.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const jobs = [
  { time: "08:30", title: "Maintenance préventive", tone: "#E9ECFF" },
  { time: "10:15", title: "Contrôle sur site", tone: "#EEF1FF" },
  { time: "14:00", title: "Rapport et signature", tone: "#E5F1F2" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        position: "relative",
        overflow: "hidden",
        padding: "64px 70px",
        color: "#FFFFFF",
        background:
          "linear-gradient(135deg, #151C31 0%, #202B56 52%, #3347A3 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          border: "1px solid rgba(143, 161, 255, 0.2)",
          borderRadius: 260,
          right: -190,
          top: -230,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          border: "1px solid rgba(143, 161, 255, 0.13)",
          borderRadius: 150,
          left: -140,
          bottom: -190,
        }}
      />

      <div
        style={{
          width: "58%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingRight: 46,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "linear-gradient(145deg, #6175E8, #4054BD)",
            }}
          >
            <div
              style={{
                width: 27,
                height: 27,
                border: "6px solid #FFFFFF",
                borderLeftColor: "transparent",
                borderRadius: 18,
                transform: "rotate(-35deg)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 16,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            axion
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: "auto",
              alignSelf: "flex-start",
              marginBottom: 22,
              padding: "9px 14px",
              border: "1px solid rgba(189, 199, 255, 0.28)",
              borderRadius: 999,
              color: "#BDC7FF",
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            Gestion des interventions
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 62,
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: -2.8,
            }}
          >
            <span>Le terrain,</span>
            <span style={{ color: "#9BACFF" }}>enfin maîtrisé.</span>
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 570,
              marginTop: 22,
              color: "#CFD5E8",
              fontSize: 23,
              lineHeight: 1.35,
            }}
          >
            Planifiez, suivez et clôturez chaque mission depuis un espace unique.
          </div>
        </div>

        <div style={{ display: "flex", color: "#919CB9", fontSize: 17 }}>
          Planning · Suivi terrain · Rapports signés
        </div>
      </div>

      <div
        style={{
          width: "42%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 430,
            display: "flex",
            flexDirection: "column",
            padding: 24,
            border: "1px solid rgba(255, 255, 255, 0.55)",
            borderRadius: 28,
            background: "rgba(248, 249, 255, 0.96)",
            boxShadow: "0 28px 80px rgba(8, 14, 35, 0.28)",
            color: "#172033",
            transform: "rotate(1.5deg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, color: "#697386" }}>AUJOURD’HUI</span>
              <span style={{ marginTop: 5, fontSize: 25, fontWeight: 700 }}>
                Planning terrain
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 11px",
                borderRadius: 999,
                color: "#3045AD",
                background: "#E9ECFF",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              3 missions
            </div>
          </div>

          {jobs.map((job, index) => (
            <div
              key={job.time}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "17px 0",
                borderTop: index === 0 ? "1px solid #E3E7EF" : "1px solid #E3E7EF",
              }}
            >
              <span style={{ width: 64, fontSize: 17, fontWeight: 700 }}>
                {job.time}
              </span>
              <span
                style={{
                  width: 11,
                  height: 11,
                  marginRight: 15,
                  borderRadius: 6,
                  background: index === 2 ? "#4C8790" : "#6175DD",
                  boxShadow: `0 0 0 6px ${job.tone}`,
                }}
              />
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{job.title}</span>
                <span style={{ marginTop: 5, color: "#697386", fontSize: 13 }}>
                  {index === 0 ? "Atelier Berthier" : index === 1 ? "Maison Lenoir" : "Café Auguste"}
                </span>
              </span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 18,
              padding: "16px 18px",
              borderRadius: 16,
              background: "#202B56",
              color: "#FFFFFF",
            }}
          >
            <span style={{ fontSize: 15 }}>Taux de complétion</span>
            <span style={{ color: "#9BACFF", fontSize: 23, fontWeight: 700 }}>
              92%
            </span>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}

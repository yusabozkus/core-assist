import type { LandingDemoProduct } from "@/lib/api/landing-demo"

type Props = {
  kind: LandingDemoProduct["art"]
  className?: string
}

const palettes = {
  jogger: {
    background: "#e9e7dc",
    accent: "#c8d2b8",
    garment: "#7f886d",
    detail: "#59644d",
  },
  denim: {
    background: "#dde8ed",
    accent: "#b7cfd9",
    garment: "#567889",
    detail: "#355568",
  },
  top: {
    background: "#eee7de",
    accent: "#dccaba",
    garment: "#b89078",
    detail: "#856a58",
  },
  dress: {
    background: "#eee4e7",
    accent: "#dbc4cf",
    garment: "#a57b8c",
    detail: "#795768",
  },
  jacket: {
    background: "#e5e9e0",
    accent: "#cdd6c6",
    garment: "#727f68",
    detail: "#4d5c48",
  },
} satisfies Record<Props["kind"], Record<string, string>>

export function LandingDemoProductArt({ kind, className }: Props) {
  const palette = palettes[kind]

  return (
    <svg
      viewBox="0 0 180 180"
      fill="none"
      role="img"
      aria-label="Örnek ürün çizimi"
      className={className}
    >
      <rect width="180" height="180" rx="24" fill={palette.background} />
      <circle cx="143" cy="34" r="51" fill={palette.accent} opacity=".55" />
      <circle cx="25" cy="161" r="51" fill={palette.accent} opacity=".4" />
      <path
        d="M25 143c28 10 58 8 91-2 18-6 32-8 48-5"
        stroke={palette.detail}
        strokeOpacity=".14"
        strokeWidth="2"
      />
      {kind === "jogger" || kind === "denim" ? (
        <g>
          <path
            d="M57 42h66l-5 38-9 65c-1 6-5 10-11 10h-9l-6-59-7 59H65c-6 0-10-4-11-10L61 81z"
            fill={palette.garment}
            stroke={palette.detail}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M58 54h64M90 56l-7 40M61 80l15 6m42-6-15 6"
            stroke={palette.detail}
            strokeOpacity=".65"
            strokeWidth="2"
          />
          {kind === "jogger" ? (
            <path
              d="M65 145h14m14 0h15M88 54v22m4-22v18"
              stroke={palette.detail}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M65 59l10 15m40-15-10 15M67 132l-2 12m40-12 2 12"
              stroke={palette.detail}
              strokeOpacity=".55"
              strokeWidth="2"
            />
          )}
        </g>
      ) : null}
      {kind === "top" ? (
        <g>
          <path
            d="M63 35h17c1 6 5 9 10 9s9-3 10-9h17l16 25-18 12-6-10v87H71V62l-6 10-18-12z"
            fill={palette.garment}
            stroke={palette.detail}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M73 37c2 12 8 19 17 19s15-7 17-19M72 137h37"
            stroke={palette.detail}
            strokeOpacity=".6"
            strokeWidth="2"
          />
        </g>
      ) : null}
      {kind === "dress" ? (
        <g>
          <path
            d="M69 33h11c1 7 5 10 10 10s9-3 10-10h11l15 29-17 9-8-13-1 25 28 65H52l28-65-1-25-8 13-17-9z"
            fill={palette.garment}
            stroke={palette.detail}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M74 84c11 6 23 6 33 0m-20 4 11 11m-4-12-9 13"
            stroke={palette.detail}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : null}
      {kind === "jacket" ? (
        <g>
          <path
            d="m64 34-18 13-12 46 19 5 10-29 3 79h48l3-79 10 29 19-5-12-46-18-13-26 12z"
            fill={palette.garment}
            stroke={palette.detail}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M64 34 90 48l26-14M90 48v100M66 90h14m20 0h14M65 138h49"
            stroke={palette.detail}
            strokeWidth="2"
            strokeOpacity=".7"
          />
        </g>
      ) : null}
      <ellipse
        cx="90"
        cy="160"
        rx="40"
        ry="4"
        fill={palette.detail}
        opacity=".12"
      />
    </svg>
  )
}

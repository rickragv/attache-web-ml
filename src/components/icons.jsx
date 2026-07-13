/** Inline icon set — 24px grid, stroke-based, tuned for the instrument look. */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconAsk = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
    <path d="M11 8.2v.01M11 11v3" />
  </svg>
)

export const IconLibrary = (p) => (
  <svg {...base} {...p}>
    <path d="M4 19.5V5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v13" />
    <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" />
    <path d="M9 4v17M20 18H5.5" />
  </svg>
)

export const IconRouting = (p) => (
  <svg {...base} {...p}>
    <path d="M4 6h9M4 12h6M4 18h9" />
    <circle cx="17" cy="6" r="2.4" />
    <circle cx="14" cy="12" r="2.4" />
    <circle cx="17" cy="18" r="2.4" />
  </svg>
)

export const IconCompare = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
    <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
    <path d="M7 9h0M17 9h0M7 13h0M17 13h0" />
  </svg>
)

export const IconSystem = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 13.5a7.5 7.5 0 1 1 15 0" />
    <path d="M12 13.5 15.5 9" />
    <path d="M4 18.5h16" />
  </svg>
)

export const IconMic = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
)

export const IconUpload = (p) => (
  <svg {...base} {...p}>
    <path d="M12 16V5m0 0 4 4m-4-4-4 4" />
    <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
  </svg>
)

export const IconOffline = (p) => (
  <svg {...base} {...p}>
    <path d="M6.3 6.5A5.5 5.5 0 0 0 7 17.5h10a4 4 0 0 0 2.6-7" />
    <path d="m3 3 18 18" />
  </svg>
)

export const IconZap = (p) => (
  <svg {...base} {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
  </svg>
)

export const IconShield = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.8 4-1.8 7-5.4 7-9.8V5.8L12 3Z" />
    <path d="m9 11.5 2.2 2.2L15.5 9" />
  </svg>
)

export const IconAlert = (p) => (
  <svg {...base} {...p}>
    <path d="M12 4 2.8 20h18.4L12 4Z" />
    <path d="M12 10.5v4M12 17.5v.01" />
  </svg>
)

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6" />
    <path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6A1.5 1.5 0 0 0 16.5 20l1-13.5" />
  </svg>
)

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconClose = (p) => (
  <svg {...base} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const IconScan = (p) => (
  <svg {...base} {...p}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M7 12h10" />
  </svg>
)

export const IconArrowUp = (p) => (
  <svg {...base} {...p}>
    <path d="M12 19V5m0 0-5 5m5-5 5 5" />
  </svg>
)

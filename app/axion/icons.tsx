import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "alert"
  | "arrow-right"
  | "arrow-up-right"
  | "bell"
  | "building"
  | "calendar"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "clock"
  | "cloud"
  | "download"
  | "euro"
  | "file"
  | "home"
  | "mail"
  | "log-out"
  | "map-pin"
  | "menu"
  | "more"
  | "plus"
  | "receipt"
  | "route"
  | "search"
  | "sparkles"
  | "trending"
  | "upload"
  | "users"
  | "wifi-off"
  | "wrench"
  | "x";

const icons: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" />,
  alert: (
    <>
      <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M7 7h10v10" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M2 21h20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  cloud: (
    <>
      <path d="M17.5 19H6a4 4 0 0 1-.6-8A7 7 0 0 1 19 9.5 4.8 4.8 0 0 1 17.5 19Z" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
  euro: (
    <>
      <path d="M18 7.5A7 7 0 1 0 18 16.5" />
      <path d="M4 10h10M4 14h9" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 13h6M9 17h6" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  "log-out": (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  receipt: (
    <>
      <path d="M6 3h12v19l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h3a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z" />
      <path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8zM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6z" />
    </>
  ),
  trending: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  upload: <path d="M12 21V9m-5 5 5-5 5 5M5 3h14" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="m2 2 20 20M8.5 8.5A9.5 9.5 0 0 1 21 9M5 12.5a10 10 0 0 1 2.1-1.6M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 9a15 15 0 0 1 2.2-1.5" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17a2.1 2.1 0 1 0 3 3z" />
      <path d="m15 13 6 6" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {icons[name]}
    </svg>
  );
}

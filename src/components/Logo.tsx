export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="17" height="17" rx="5" stroke="url(#logo-grad)" strokeWidth="2.4" />
      <rect x="13" y="13" width="17" height="17" rx="5" fill="url(#logo-grad)" fillOpacity="0.85" />
    </svg>
  );
}

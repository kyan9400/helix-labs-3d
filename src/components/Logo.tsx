export default function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M9 3c0 7 14 7 14 13S9 22 9 29" fill="none" stroke="#0F6E68" strokeWidth="3" strokeLinecap="round" />
      <path d="M23 3c0 7-14 7-14 13s14 6 14 13" fill="none" stroke="#D9472F" strokeWidth="3" strokeLinecap="round" />
      <path d="M11.5 7.5h9M11.5 24.5h9" stroke="#10201F" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

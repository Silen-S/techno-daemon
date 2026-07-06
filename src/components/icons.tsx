// UIボタン用のインラインSVGアイコン。currentColorで色を継承する。
type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
});

export const PlayIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />
  </svg>
);

export const StopIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);

// 曲調を変える: 2本の矢印で入れ替わりを表す
export const TransformIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
);

// 変化させる: きらめき(局所的な変異)
export const MutateIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" fill="currentColor" stroke="none" />
    <path d="M18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9z" fill="currentColor" stroke="none" />
  </svg>
);

export const AcceptIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 6.5" />
  </svg>
);

export const RevertIcon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 5 5v1" />
  </svg>
);

// ミュート: スピーカー。muted時は×付き
export const MuteIcon = ({ size = 18, muted = false }: IconProps & { muted?: boolean }) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
    {muted ? (
      <path d="M16 9l5 6M21 9l-5 6" />
    ) : (
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    )}
  </svg>
);

// 変化の対象: 照準(このトラックを変化させる)
export const TargetIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

// 言語切替: 地球
export const GlobeIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);

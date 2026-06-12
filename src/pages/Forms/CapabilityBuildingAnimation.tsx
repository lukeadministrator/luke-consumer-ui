// A little worker in a hard hat tightening a bolt with a wrench — shown while
// LukeTalks builds the form. Pure inline SVG + SMIL animation, no assets/libs.

const CX = 106; // bolt center x
const CY = 86; // bolt center y

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export default function CapabilityBuildingAnimation() {
  return (
    <svg viewBox="0 0 160 140" className="size-36" role="img" aria-label="Building your capability">
      {/* base plate + loose bolts */}
      <rect x="16" y="114" width="128" height="10" rx="5" className="fill-gray-200 dark:fill-gray-700" />
      <circle cx="34" cy="119" r="2.5" className="fill-gray-400 dark:fill-gray-500" />
      <circle cx="126" cy="119" r="2.5" className="fill-gray-400 dark:fill-gray-500" />

      {/* worker (gentle bob) */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -2; 0 0" dur="1.1s" repeatCount="indefinite" />
        {/* body */}
        <rect x="28" y="82" width="26" height="34" rx="10" className="fill-brand-500" />
        {/* head */}
        <circle cx="41" cy="70" r="12" fill="#f1c27d" />
        {/* eyes + smile */}
        <circle cx="44" cy="69" r="1.4" fill="#3f2d1d" />
        <circle cx="49" cy="69" r="1.4" fill="#3f2d1d" />
        <path d="M43 75 Q47 78 51 75" fill="none" stroke="#3f2d1d" strokeWidth="1.3" strokeLinecap="round" />
        {/* hard hat */}
        <path d="M28 70 A13 13 0 0 1 54 70 Z" fill="#f59e0b" />
        <rect x="27" y="69" width="28" height="4" rx="2" fill="#f59e0b" />
        <rect x="39" y="58" width="4" height="5" rx="2" fill="#fbbf24" />
        {/* arm reaching to the wrench */}
        <rect x="50" y="85" width="24" height="6" rx="3" fill="#f1c27d" transform="rotate(-18 52 88)" />
      </g>

      {/* wrench — swings back and forth, pivoting on the bolt */}
      <g>
        <animateTransform attributeName="transform" type="rotate" values={`-14 ${CX} ${CY}; 8 ${CX} ${CY}; -14 ${CX} ${CY}`} dur="1.1s" repeatCount="indefinite" />
        <rect x="64" y="81" width="44" height="9" rx="4.5" className="fill-gray-400 dark:fill-gray-500" transform={`rotate(-7 ${CX} ${CY})`} />
        <circle cx={CX} cy={CY} r="18" fill="none" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="7" />
      </g>

      {/* bolt — spins as it's tightened */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur="3s" repeatCount="indefinite" />
        <polygon points={hexPoints(CX, CY, 13)} className="fill-gray-500 dark:fill-gray-400" />
        <circle cx={CX} cy={CY} r="5" className="fill-gray-200 dark:fill-gray-700" />
      </g>

      {/* sparks near the bolt */}
      <g className="fill-amber-400">
        <circle cx="124" cy="71" r="2">
          <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.45;0.6;0.8" dur="1.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="120" cy="64" r="1.5">
          <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.5;0.66;0.85" dur="1.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="128" cy="78" r="1.5">
          <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.55;0.7;0.9" dur="1.1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

const frameProps = {
  viewBox: "0 0 220 150",
  fill: "none",
  "aria-hidden": true,
  focusable: "false",
  className: "h-full w-full",
} as const;

const guide = "#2c2c2c";
const line = "#8a8a8a";
const soft = "#4b4b4b";
const surface = "#131313";

/** A modular workspace: four modules, one active, wired to the rest. */
export const WorkspaceIllustration = () => (
  <svg {...frameProps}>
    <path d="M18 126H202" stroke={guide} strokeWidth="1" />
    <path d="M28 132H72M148 132H192" stroke={guide} strokeWidth="1" strokeDasharray="2 5" />

    <g className="illustration-float">
      <path d="M62 52H44V30" stroke={soft} strokeWidth="1" strokeDasharray="3 4" />
      <path d="M158 52H178V32" stroke={soft} strokeWidth="1" strokeDasharray="3 4" />
      <path d="M62 100H40V116" stroke={soft} strokeWidth="1" strokeDasharray="3 4" />

      <circle cx="44" cy="30" r="3.5" fill="#fafafa" />
      <rect x="174.5" y="24.5" width="7" height="7" stroke={line} />
      <circle cx="40" cy="119.5" r="3.5" stroke={line} />

      <rect x="58" y="30" width="104" height="84" fill={surface} stroke={line} strokeWidth="1.25" />
      <path d="M58 48H162" stroke={guide} />
      <path d="M66 40H74M80 40H88M94 40H102" stroke={soft} strokeLinecap="square" />

      <rect x="68" y="58" width="38" height="22" stroke={soft} />
      <path d="M68 72H106" stroke={guide} />
      <rect x="114" y="58" width="38" height="22" stroke={soft} />
      <path d="M114 72H152" stroke={guide} />

      <rect x="68" y="86" width="38" height="18" stroke={soft} />
      <path d="M74 95H90" stroke={soft} />

      <g className="illustration-slide">
        <rect x="114" y="86" width="38" height="18" fill="#fafafa" />
        <path d="M122 95H130M134 95H142" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="square" />
      </g>

      <path d="M58 114V30H162V114" stroke={line} strokeOpacity="0" />
    </g>

    <path d="M18 126V120M202 126V120" stroke={guide} strokeWidth="1" />
  </svg>
);

/** Roles and permissions: three access rows, one granted, one pending. */
export const AccessIllustration = () => (
  <svg {...frameProps}>
    <path d="M18 126H202" stroke={guide} strokeWidth="1" />

    <g className="illustration-float">
      <rect x="46" y="24" width="92" height="96" stroke={soft} strokeDasharray="3 4" />
      <rect x="58" y="34" width="104" height="86" fill={surface} stroke={line} strokeWidth="1.25" />
      <path d="M58 50H162" stroke={guide} />
      <circle cx="68" cy="42" r="2.5" fill="#fafafa" />
      <path d="M76 42H104" stroke={soft} />

      <g>
        <rect x="70" y="60" width="12" height="12" stroke={soft} />
        <path d="M90 66H112" stroke={soft} />
        <circle cx="150" cy="66" r="2" fill={soft} />
      </g>

      <g>
        <rect x="70" y="80" width="12" height="12" fill="#fafafa" />
        <path d="M73 86L76 89L80 83" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="square" />
        <path d="M90 86H124" stroke="#d8d8d8" />
        <circle cx="150" cy="86" r="2" fill="#fafafa" />
      </g>

      <g>
        <rect x="70" y="100" width="12" height="12" stroke={soft} />
        <path d="M90 106H104" stroke={soft} />
        <path d="M148 106H152" stroke={soft} />
      </g>

      <g className="illustration-slide">
        <path d="M172 36V22" stroke={soft} />
        <path d="M166 22H178V28" stroke={line} />
        <rect x="182" y="34" width="8" height="8" fill="#fafafa" />
      </g>
    </g>

    <path d="M18 126V120M202 126V120" stroke={guide} strokeWidth="1" />
  </svg>
);

/** A small sales pipeline with one deal moving between stages. */
export const PipelineIllustration = () => (
  <svg {...frameProps}>
    <path d="M18 126H202" stroke={guide} strokeWidth="1" />

    <g className="illustration-float">
      <rect x="28" y="30" width="46" height="78" stroke={soft} />
      <rect x="87" y="30" width="46" height="78" stroke={soft} />
      <rect x="146" y="30" width="46" height="78" stroke={soft} />

      <path d="M28 42H74M87 42H133M146 42H192" stroke={guide} />
      <path d="M36 37H54M95 37H113M154 37H172" stroke={soft} />

      <rect x="36" y="52" width="30" height="20" fill={surface} stroke={soft} />
      <circle cx="43" cy="59" r="2" fill="#d8d8d8" />
      <path d="M49 59H60M49 64H58" stroke={soft} />

      <rect x="36" y="78" width="30" height="20" fill={surface} stroke={soft} />
      <circle cx="43" cy="85" r="2" fill={soft} />
      <path d="M49 85H60M49 90H56" stroke={soft} />

      <rect x="95" y="52" width="30" height="20" fill={surface} stroke={soft} />
      <circle cx="102" cy="59" r="2" fill="#d8d8d8" />
      <path d="M108 59H119M108 64H115" stroke={soft} />

      <g className="illustration-slide">
        <rect x="95" y="84" width="30" height="20" fill="#fafafa" />
        <circle cx="102" cy="91" r="2" fill="#0a0a0a" />
        <path d="M108 91H119M108 96H115" stroke="#0a0a0a" />
      </g>

      <rect x="154" y="52" width="30" height="20" fill={surface} stroke={soft} />
      <circle cx="161" cy="59" r="2" fill={soft} />
      <path d="M167 59H178M167 64H174" stroke={soft} />

      <path d="M70 64C79 64 79 94 91 94" stroke={line} strokeDasharray="3 4" strokeLinecap="square" />
      <path d="M86 90L92 94L86 98" stroke={line} strokeLinecap="square" />
    </g>

    <path d="M18 126V120M202 126V120" stroke={guide} strokeWidth="1" />
  </svg>
);

/** Spreadsheet in, structured records out. */
export const ImportIllustration = () => (
  <svg {...frameProps}>
    <path d="M18 126H202" stroke={guide} strokeWidth="1" />

    <g className="illustration-float">
      <rect x="26" y="38" width="74" height="58" fill={surface} stroke={line} strokeWidth="1.25" />
      <path d="M26 50H100M26 64H100M26 78H100" stroke={guide} />
      <path d="M44 38V96M62 38V96M80 38V96" stroke={guide} />
      <rect x="26" y="38" width="74" height="12" fill="#1d1d1d" />
      <path d="M31 44H36M50 44H55M69 44H74M87 44H92" stroke={line} />
      <path d="M31 58H37M50 58H56M69 58H75M87 58H93" stroke={soft} />
      <path d="M31 71H37M50 71H56M69 71H75M87 71H93" stroke={soft} />
      <path d="M31 84H37M50 84H56M69 84H75M87 84H93" stroke={soft} />

      <path d="M112 68H136" stroke={line} strokeDasharray="3 4" strokeLinecap="square" />
      <path d="M130 63L137 68L130 73" stroke={line} strokeLinecap="square" />

      <g className="illustration-slide">
        <rect x="148" y="34" width="44" height="64" fill={surface} stroke={line} strokeWidth="1.25" />
        <path d="M158 48H182M158 58H176M158 68H182M158 78H170" stroke="#d8d8d8" />
        <path d="M150 44H158M150 54H158M150 64H158M150 74H158" stroke={soft} />
      </g>

      <rect x="154" y="102" width="34" height="9" stroke={soft} />
      <path d="M160 106H176" stroke={soft} />
      <path d="M171 106L193 106" stroke={guide} />
    </g>

    <path d="M18 126V120M202 126V120" stroke={guide} strokeWidth="1" />
  </svg>
);

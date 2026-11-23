const HATCH_PATTERN_ID = "qone-wireframe-hatch";
const NEON_GLOW_ID = "qone-pink-neon-glow";

type GlyphSpec = {
  id: string;
  fillPath: string;
  neonPath: string;
  guides: Array<[number, number, number, number]>;
  anchors: Array<[number, number]>;
  delay: string;
};

const GLYPHS: GlyphSpec[] = [
  {
    id: "q",
    fillPath:
      "M 15 20 H 135 V 195 H 105 V 160 H 15 Z M 45 50 V 130 H 105 V 50 Z",
    neonPath: "M 15 20 H 135 V 195 H 105 V 160 H 15 Z",
    guides: [
      [45, 50, 105, 50],
      [105, 50, 105, 130],
      [105, 130, 45, 130],
      [45, 130, 45, 50],
      [45, 80, 105, 80],
    ],
    anchors: [
      [15, 20],
      [135, 20],
      [135, 195],
      [105, 195],
      [105, 160],
      [15, 160],
      [45, 50],
      [105, 50],
      [45, 80],
      [105, 80],
      [45, 130],
      [105, 130],
    ],
    delay: "0s",
  },
  {
    id: "o",
    fillPath: "M 165 20 H 285 V 160 H 165 Z M 195 50 V 130 H 255 V 50 Z",
    neonPath: "M 165 20 H 285 V 160 H 165 Z",
    guides: [
      [195, 50, 255, 50],
      [255, 50, 255, 130],
      [255, 130, 195, 130],
      [195, 130, 195, 50],
      [195, 80, 255, 80],
    ],
    anchors: [
      [165, 20],
      [285, 20],
      [285, 160],
      [165, 160],
      [195, 50],
      [255, 50],
      [195, 80],
      [255, 80],
      [195, 130],
      [255, 130],
    ],
    delay: "-1.2s",
  },
  {
    id: "n",
    fillPath:
      "M 315 20 H 405 V 50 H 435 V 160 H 405 V 80 H 345 V 160 H 315 Z",
    neonPath:
      "M 315 20 H 405 V 50 H 435 V 160 H 405 V 80 H 345 V 160 H 315 Z",
    guides: [
      [345, 50, 405, 50],
      [345, 50, 345, 80],
      [405, 50, 405, 80],
      [345, 160, 405, 160],
    ],
    anchors: [
      [315, 20],
      [405, 20],
      [405, 50],
      [435, 50],
      [435, 160],
      [405, 160],
      [405, 80],
      [345, 80],
      [345, 160],
      [315, 160],
      [345, 50],
    ],
    delay: "-2.4s",
  },
  {
    id: "e",
    fillPath:
      "M 465 20 H 585 V 110 H 495 V 130 H 585 V 160 H 465 Z M 495 50 V 80 H 555 V 50 Z",
    neonPath: "M 465 20 H 585 V 110 H 495 V 130 H 585 V 160 H 465 Z",
    guides: [
      [495, 50, 555, 50],
      [555, 50, 555, 80],
      [555, 80, 495, 80],
      [495, 80, 495, 50],
    ],
    anchors: [
      [465, 20],
      [585, 20],
      [585, 110],
      [495, 110],
      [495, 130],
      [585, 130],
      [585, 160],
      [465, 160],
      [495, 50],
      [555, 50],
      [555, 80],
      [495, 80],
    ],
    delay: "-3.6s",
  },
];

export const FooterWordmark = () => {
  return (
    <div aria-hidden="true" className="w-full pt-8 pb-4 select-none">
      <svg
        viewBox="0 0 600 212"
        className="h-auto w-full overflow-visible"
        fill="none"
      >
        <defs>
          <pattern
            id={HATCH_PATTERN_ID}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#101010" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#232323" strokeWidth="1" />
          </pattern>

          <filter
            id={NEON_GLOW_ID}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {GLYPHS.map((glyph) => (
          <g key={glyph.id}>
            <path
              d={glyph.fillPath}
              fill={`url(#${HATCH_PATTERN_ID})`}
              fillRule="evenodd"
              stroke="#343434"
              strokeWidth="0.9"
            />

            {glyph.guides.map(([x1, y1, x2, y2], idx) => (
              <line
                key={`${glyph.id}-g-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#303030"
                strokeWidth="0.85"
              />
            ))}

            <path
              d={glyph.neonPath}
              pathLength={100}
              fill="none"
              stroke="#ff5c9e"
              strokeWidth="1.4"
              strokeLinecap="square"
              filter={`url(#${NEON_GLOW_ID})`}
              className="qone-neon-trace"
              style={{ animationDelay: glyph.delay }}
            />

            {glyph.anchors.map(([cx, cy], idx) => (
              <rect
                key={`${glyph.id}-a-${idx}`}
                x={cx - 1.8}
                y={cy - 1.8}
                width="3.6"
                height="3.6"
                fill="#0a0a0a"
                stroke="#4a4a4a"
                strokeWidth="0.85"
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
};

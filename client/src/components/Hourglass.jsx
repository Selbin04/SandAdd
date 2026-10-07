import { useEffect, useRef, useState } from "react";
import "./Hourglass.css";

const CX = 110;
const TOP_Y = 64;
const NECK_Y = 206;
const BOT_Y = 348;
const MAX_HALF = 58;
const MIN_HALF = 3.2;

/** Curved upper chamber outline (left → neck → right → top) */
const TOP_BULB =
  "M52 56 C52 56, 52 120, 107 200 C108.5 203, 111.5 203, 113 200 C168 120, 168 56, 168 56 C168 50, 162 46, 110 46 C58 46, 52 50, 52 56 Z";
const BOT_BULB =
  "M107 212 C108.5 209, 111.5 209, 113 212 C168 292, 168 356, 168 356 C168 362, 162 366, 110 366 C58 366, 52 362, 52 356 C52 356, 52 292, 107 212 Z";

function readTheme() {
  try {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function topSandPath(progress) {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 0.992) return "";
  const t = Math.pow(p, 0.92);
  const y = TOP_Y + t * (NECK_Y - 10 - TOP_Y);
  const half = MAX_HALF * (1 - t) + MIN_HALF * t;
  const dip = 2 + (1 - t) * 5;
  return `M ${CX - half} ${y}
    Q ${CX} ${y + dip} ${CX + half} ${y}
    L ${CX + MIN_HALF} ${NECK_Y - 6}
    Q ${CX} ${NECK_Y - 2} ${CX - MIN_HALF} ${NECK_Y - 6}
    Z`;
}

function bottomSandPath(progress) {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0.01) return "";
  const mound = Math.pow(p, 0.85);
  const peakY = BOT_Y - mound * (BOT_Y - NECK_Y - 14);
  const baseHalf = MAX_HALF * Math.min(1, 0.22 + p * 0.78);
  const shoulder = baseHalf * 0.72;
  return `M ${CX} ${peakY}
    C ${CX + shoulder * 0.35} ${peakY + 8}, ${CX + shoulder} ${BOT_Y - 18}, ${CX + baseHalf} ${BOT_Y}
    L ${CX - baseHalf} ${BOT_Y}
    C ${CX - shoulder} ${BOT_Y - 18}, ${CX - shoulder * 0.35} ${peakY + 8}, ${CX} ${peakY}
    Z`;
}

function spawnGrain() {
  return {
    id: Math.random().toString(36).slice(2),
    x: CX + (Math.random() - 0.5) * 3.5,
    y: NECK_Y - 8,
    vx: (Math.random() - 0.5) * 0.35,
    vy: 1.1 + Math.random() * 0.9,
    r: 0.7 + Math.random() * 0.9,
    life: 1,
  };
}

export default function Hourglass({ progress, pouring, finished }) {
  const [grains, setGrains] = useState([]);
  const [theme, setTheme] = useState(readTheme);
  const grainsRef = useRef([]);
  const pouringRef = useRef(pouring);
  const progressRef = useRef(progress);

  pouringRef.current = pouring;
  progressRef.current = progress;

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let raf;
    let acc = 0;
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      let next = grainsRef.current;

      if (pouringRef.current && progressRef.current < 1) {
        acc += dt;
        while (acc > 28) {
          acc -= 28;
          next = [...next, spawnGrain()];
          if (Math.random() > 0.35) next = [...next, spawnGrain()];
        }
      } else {
        acc = 0;
      }

      next = next
        .map((g) => ({
          ...g,
          x: g.x + g.vx * (dt / 16),
          y: g.y + g.vy * (dt / 16),
          vy: g.vy + 0.12,
          life: g.y > BOT_Y - 40 ? g.life - dt / 220 : g.life,
        }))
        .filter((g) => g.y < BOT_Y - 4 && g.life > 0);

      if (next.length > 55) next = next.slice(next.length - 55);

      grainsRef.current = next;
      setGrains(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const topPath = topSandPath(progress);
  const botPath = bottomSandPath(progress);
  const remaining = Math.max(0, 1 - progress);
  const topSurfaceY = TOP_Y + Math.pow(progress, 0.92) * (NECK_Y - 10 - TOP_Y);
  const isLight = theme === "light";
  const glassFill = isLight ? "url(#glassBodyLite)" : "url(#glassBodyDark)";

  return (
    <svg
      className={`hourglass-svg ${finished ? "is-done" : ""} ${pouring ? "is-pouring" : ""} ${isLight ? "is-light" : "is-dark"}`}
      viewBox="0 0 220 420"
      role="img"
      aria-label="Hourglass"
    >
      <defs>
        <linearGradient id="capMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ad4ff" />
          <stop offset="35%" stopColor="#2bb0ff" />
          <stop offset="70%" stopColor="#0077c2" />
          <stop offset="100%" stopColor="#0a3d66" />
        </linearGradient>
        <linearGradient id="pillarMetal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a222c" />
          <stop offset="35%" stopColor="#4a5564" />
          <stop offset="65%" stopColor="#2c3440" />
          <stop offset="100%" stopColor="#12171e" />
        </linearGradient>
        <linearGradient id="sandFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe2a0" />
          <stop offset="40%" stopColor="#e8b85a" />
          <stop offset="100%" stopColor="#c4892a" />
        </linearGradient>
        <linearGradient id="sandLite" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="45%" stopColor="rgba(255,240,200,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="glassBodyLite" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(170,210,240,0.55)" />
          <stop offset="40%" stopColor="rgba(120,170,210,0.28)" />
          <stop offset="100%" stopColor="rgba(70,120,170,0.32)" />
        </radialGradient>
        {/* Dark theme: flat glass — no bright reflection hotspot */}
        <radialGradient id="glassBodyDark" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="rgba(28,52,78,0.42)" />
          <stop offset="55%" stopColor="rgba(22,42,64,0.48)" />
          <stop offset="100%" stopColor="rgba(16,32,50,0.55)" />
        </radialGradient>
        <linearGradient id="glassEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a8fb8" />
          <stop offset="45%" stopColor="#2f6f9e" />
          <stop offset="100%" stopColor="#4a7fa8" />
        </linearGradient>
        <pattern id="grainNoise" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="2" r="0.6" fill="rgba(120,70,20,0.25)" />
          <circle cx="4" cy="1" r="0.45" fill="rgba(255,255,255,0.2)" />
          <circle cx="3" cy="4.5" r="0.5" fill="rgba(90,50,10,0.2)" />
        </pattern>
        <filter id="glassSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b" />
          <feOffset dy="1" result="o" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="o" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="top-bulb">
          <path d={TOP_BULB} />
        </clipPath>
        <clipPath id="bot-bulb">
          <path d={BOT_BULB} />
        </clipPath>
      </defs>

      {/* Frame — top cap */}
      <rect x="34" y="22" width="152" height="22" rx="4" fill="url(#pillarMetal)" />
      <rect x="34" y="20" width="152" height="12" rx="4" fill="url(#capMetal)" />
      <rect x="42" y="24" width="8" height="8" rx="4" fill="#0a2a44" opacity="0.45" />
      <rect x="170" y="24" width="8" height="8" rx="4" fill="#0a2a44" opacity="0.45" />

      {/* Festive Santa Claus Cap on top of Hourglass */}
      <g className="hourglass-santa-cap" aria-hidden="true">
        {/* Main Red Cap fold */}
        <path
          d="M 74,12 C 72,-8 95,-24 125,-26 C 146,-28 168,-14 165,6 C 160,20 140,24 114,24 Z"
          fill="#e53935"
        />
        {/* Darker red shadow / depth */}
        <path
          d="M 80,12 C 78,-4 98,-18 125,-20 C 140,-22 158,-10 155,6 C 150,18 135,22 110,22 Z"
          fill="#b71c1c"
          opacity="0.85"
        />
        {/* Soft highlight */}
        <path
          d="M 88,4 C 86,-8 105,-18 128,-18"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* White fluffy pom-pom at tip */}
        <circle cx="165" cy="8" r="9" fill="#ffffff" />
        <circle cx="163" cy="6" r="6" fill="#f5f5f5" />
        {/* White fluffy brim resting on top metal plate */}
        <rect x="68" y="10" width="84" height="14" rx="7" fill="#ffffff" />
        <rect x="72" y="12" width="76" height="10" rx="5" fill="#f0f0f0" opacity="0.75" />
      </g>

      {/* Side pillars */}
      <rect x="38" y="42" width="12" height="336" rx="3" fill="url(#pillarMetal)" />
      <rect x="170" y="42" width="12" height="336" rx="3" fill="url(#pillarMetal)" />
      <rect x="40" y="48" width="3" height="320" rx="1" fill="rgba(255,255,255,0.12)" />
      <rect x="172" y="48" width="3" height="320" rx="1" fill="rgba(255,255,255,0.12)" />

      {/* Bottom cap */}
      <rect x="34" y="376" width="152" height="22" rx="4" fill="url(#pillarMetal)" />
      <rect x="34" y="386" width="152" height="12" rx="4" fill="url(#capMetal)" />
      <rect x="42" y="388" width="8" height="8" rx="4" fill="#0a2a44" opacity="0.45" />
      <rect x="170" y="388" width="8" height="8" rx="4" fill="#0a2a44" opacity="0.45" />

      {/* Glass chambers — dark outline first so shape reads on light bg */}
      <path d={TOP_BULB} fill="none" stroke="#1a3a55" strokeWidth="4.5" opacity="0.35" />
      <path d={BOT_BULB} fill="none" stroke="#1a3a55" strokeWidth="4.5" opacity="0.35" />
      <path
        d={TOP_BULB}
        fill={glassFill}
        stroke="url(#glassEdge)"
        strokeWidth="2.8"
        filter={isLight ? "url(#glassSoft)" : undefined}
      />
      <path
        d={BOT_BULB}
        fill={glassFill}
        stroke="url(#glassEdge)"
        strokeWidth="2.8"
        filter={isLight ? "url(#glassSoft)" : undefined}
      />

      {/* Inner glass rim near neck */}
      <ellipse cx={CX} cy={NECK_Y} rx="9" ry="4" fill="none" stroke="#3a6f98" strokeWidth="1.4" opacity="0.7" />

      {/* Top sand */}
      <g clipPath="url(#top-bulb)">
        {topPath && (
          <>
            <path d={topPath} fill="url(#sandFill)" />
            <path d={topPath} fill="url(#grainNoise)" opacity="0.55" />
            <path d={topPath} fill="url(#sandLite)" opacity="0.4" />
          </>
        )}
        {remaining > 0.03 && (
          <ellipse
            cx={CX}
            cy={topSurfaceY + 2}
            rx={MAX_HALF * remaining + MIN_HALF}
            ry={3.5 + remaining * 3}
            fill="#ffe9b8"
            opacity="0.55"
          />
        )}
      </g>

      {/* Bottom sand mound */}
      <g clipPath="url(#bot-bulb)">
        {botPath && (
          <>
            <path d={botPath} fill="url(#sandFill)" />
            <path d={botPath} fill="url(#grainNoise)" opacity="0.5" />
            <path d={botPath} fill="url(#sandLite)" opacity="0.35" />
          </>
        )}
      </g>

      {/* Falling stream */}
      {pouring && progress < 1 && (
        <g className="sand-stream">
          <rect x={CX - 1.1} y={NECK_Y - 6} width="2.2" height="28" rx="1.1" fill="#e8b85a" opacity="0.95" />
          <rect x={CX - 0.45} y={NECK_Y - 6} width="0.9" height="28" rx="0.45" fill="#fff0c8" opacity="0.7" />
        </g>
      )}

      {grains.map((g) => (
        <circle
          key={g.id}
          cx={g.x}
          cy={g.y}
          r={g.r}
          fill="#e0b04a"
          opacity={Math.max(0.25, g.life)}
        />
      ))}

      {/* Specular highlights on glass — light theme only */}
      <g className="glass-specular" aria-hidden="true">
        <path
          d="M64 70 C72 110, 88 155, 104 198"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M68 72 C76 108, 90 150, 103 196"
          fill="none"
          stroke="rgba(80,130,180,0.35)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M66 330 C80 295, 94 250, 106 218"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M156 78 C148 120, 132 160, 116 198"
          fill="none"
          stroke="rgba(40,80,120,0.28)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* Neck collar */}
      <rect x="98" y="198" width="24" height="16" rx="3" fill="url(#capMetal)" />
      <rect x="102" y="201" width="16" height="10" rx="2" fill="#062238" opacity="0.55" />
      <rect x="104" y="203" width="4" height="6" rx="1" fill="rgba(255,255,255,0.15)" />

      {finished && (
        <g className="done-stamp">
          <rect x="48" y="188" width="124" height="36" rx="4" fill="rgba(10, 60, 100, 0.92)" />
          <text
            x="110"
            y="212"
            textAnchor="middle"
            fill="#d7ecff"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="16"
            fontWeight="600"
            letterSpacing="2"
          >
            DONE
          </text>
        </g>
      )}
    </svg>
  );
}

import { useEffect, useState } from "react";
import type { MascotState, MascotVariant } from "./mascotState";

interface MascotProps {
  state: MascotState;
  variant: MascotVariant | null;
}

function Mascot({ state, variant }: MascotProps) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let blinkTimer = 0;
    let finishTimer = 0;
    let active = true;

    const scheduleBlink = () => {
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 8000 + Math.random() * 5000
        : 3800 + Math.random() * 3300;
      blinkTimer = window.setTimeout(() => {
        if (!active) return;
        setBlinking(true);
        finishTimer = window.setTimeout(() => {
          if (!active) return;
          setBlinking(false);
          scheduleBlink();
        }, 160);
      }, delay);
    };

    scheduleBlink();
    return () => {
      active = false;
      window.clearTimeout(blinkTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  return (
    <svg
      className="mascot-art"
      viewBox="0 0 420 420"
      role="img"
      aria-label={`Mascotte: ${state}`}
      data-state={state}
      data-variant={variant ?? undefined}
      data-blinking={blinking}
    >
      <defs>
        <linearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4cb70" />
          <stop offset="0.55" stopColor="#d99a3b" />
          <stop offset="1" stopColor="#b9702f" />
        </linearGradient>
        <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e7b553" stopOpacity="0.18" />
          <stop offset="0.55" stopColor="#f2c466" stopOpacity="0.86" />
          <stop offset="1" stopColor="#d18436" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="light" cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff0bd" stopOpacity="0.52" />
          <stop offset="1" stopColor="#fff0bd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="mascot-drift">
        <ellipse cx="211" cy="324" rx="74" ry="9" fill="#604b34" opacity="0.12" />
        <g className="mascot-flow">
          <path d="M142 263c8-32 1-67 15-93 13-25 34-41 58-43 25-2 43 12 43 32 0 19-17 33-37 34-18 1-32-7-43 4-13 13-10 37 5 51 18 18 47 17 70 3 21-13 36-36 54-66-8 39-27 75-58 96-33 23-76 25-97 5-11-10-15-22-10-36Z" fill="url(#amber)" />
          <path d="M178 235c-21 1-44-13-57-33 7 28 24 48 48 55 18 6 36 1 50-8-13-7-23-15-41-14Z" fill="url(#ribbon)" />
          <path d="M236 174c26-20 45-47 46-73 16 24 9 54-10 76-10 12-24 20-40 23 5-9 7-17 4-26Z" fill="url(#ribbon)" />
          <path d="M165 179c10-21 28-35 47-39 18-4 34 1 42 13-19-8-38-4-52 8-11 9-17 22-18 36-10-1-17-7-19-18Z" fill="url(#light)" />
        </g>
        <g className="mascot-eyes" fill="#332d26">
          <ellipse className="mascot-eye mascot-eye-left" cx="190" cy="181" rx="4.2" ry="7" />
          <ellipse className="mascot-eye mascot-eye-right" cx="220" cy="178" rx="4" ry="6.6" />
        </g>
        <g className="mascot-thinking-dots" fill="#8d632f">
          <circle cx="293" cy="145" r="4" />
          <circle cx="308" cy="136" r="4" />
          <circle cx="323" cy="145" r="4" />
        </g>
        <g className="mascot-action-prop mascot-prop-document" stroke="#9c6a32" strokeWidth="2" strokeLinejoin="round">
          <path d="M286 220h18l6 6h25v42h-49z" fill="#fffdf7" />
          <path d="M296 237h29M296 246h23M296 255h17" fill="none" strokeLinecap="round" />
          <path d="M286 220v-5h17l5 5" fill="#f3d9a1" />
        </g>
        <g className="mascot-action-prop mascot-prop-folder" stroke="#9c6a32" strokeWidth="2" strokeLinejoin="round">
          <path d="M283 229h20l6 7h30v31h-56z" fill="#e6c27b" />
          <path d="M283 236h56l-7 31h-56z" fill="#f3d9a1" />
          <path d="M294 247h31" fill="none" strokeLinecap="round" />
        </g>
        <g className="mascot-action-prop mascot-prop-search" fill="none" stroke="#9c6a32" strokeLinecap="round" strokeWidth="6">
          <circle cx="306" cy="239" r="18" fill="#fffdf7" strokeWidth="3" />
          <path d="m319 252 17 17" strokeWidth="7" />
          <path d="M298 239h16m-8-8v16" strokeWidth="2" />
        </g>
        <g className="mascot-success-mark">
          <circle cx="321" cy="163" r="18" fill="#5f886f" />
          <path d="m312 163 6 6 12-13" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </g>
        <g className="mascot-error-mark">
          <circle cx="321" cy="163" r="18" fill="#bd765c" />
          <path d="M321 153v12m0 6v.5" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="3" />
        </g>
        <g className="mascot-error-brows" fill="none" stroke="#75532f" strokeLinecap="round" strokeWidth="2.8">
          <path d="M182 169q7-8 15-2" />
          <path d="M214 167q8-6 15 2" />
        </g>
        <g className="mascot-approval-brows" fill="none" stroke="#75532f" strokeLinecap="round" strokeWidth="2.4">
          <path d="m184 166 11-3" />
          <path d="m216 163 10 3" />
        </g>
        <g className="mascot-brows" fill="none" stroke="#75532f" strokeLinecap="round" strokeWidth="2.4">
          {state === "error" ? (
            <>
              <path d="m184 169 11-2" />
              <path d="m216 171 10 3" />
            </>
          ) : state === "thinking" ? (
            <>
              <path d="m184 170 10-3" />
              <path d="m216 167 10 1" />
            </>
          ) : (
            <>
              <path d="m184 168 10-2" />
              <path d="m216 166 10 2" />
            </>
          )}
        </g>
        <g className="mascot-mouth" fill="none" stroke="#493a2a" strokeLinecap="round" strokeWidth="2.8">
          {state === "error" ? (
            <path className="mascot-mouth-sad" d="M198 202c5-5 12-5 17 0" />
          ) : state === "thinking" || state === "approval" ? (
            <ellipse cx="207" cy="199" rx="3.5" ry="4.5" fill="#493a2a" />
          ) : state === "speaking" ? (
            <ellipse className="mascot-talking-mouth" cx="207" cy="196" rx="5" ry="5" fill="#493a2a" />
          ) : state === "acting" ? (
            <path d="M198 198q8 10 17 0" />
          ) : (
            <path d="M198 198c5 4 12 4 17-1" />
          )}
        </g>
      </g>
    </svg>
  );
}

export default Mascot;

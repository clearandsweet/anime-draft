import React, { useEffect, useState } from "react";

export function ThanksgivingTheme() {
  const [isNovember, setIsNovember] = useState(false);

  useEffect(() => {
    const month = new Date().getMonth();
    setIsNovember(month === 10); // 0-indexed, 10 is November
  }, []);

  if (!isNovember) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Mood Lamp Vibe Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-transparent to-amber-900/20 mix-blend-overlay animate-pulse" style={{ animationDuration: "10s" }} />

      {/* Tiled Scrolling Turkeys */}
      <div className="absolute inset-0 opacity-5 animate-scroll-diagonal"
        style={{
          backgroundImage: "url('/turkey_outline.png')",
          backgroundSize: "150px 150px",
          backgroundRepeat: "repeat"
        }}
      />

      <style jsx global>{`
        @keyframes scroll-diagonal {
          0% { background-position: 0 0; }
          100% { background-position: 150px 150px; }
        }
        .animate-scroll-diagonal {
          animation: scroll-diagonal 20s linear infinite;
        }
        /* Custom Cursor - Turkey Leg */
        body {
          cursor: url('/turkey_leg_cursor.png') 4 24, auto;
        }
        /* Fallback if image fails or for pointers */
        a, button, [role="button"] {
          cursor: url('/turkey_leg_cursor.png') 4 24, pointer;
        }
      `}</style>
    </div>
  );
}

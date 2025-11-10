import React from 'react';

interface SubtitleOverlayProps {
  lines: string[];
  visible?: boolean;
  fontSizePx?: number;
  opacity?: number;
  position?: 'bottom' | 'top';
  maxLines?: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  lines,
  visible = true,
  fontSizePx = 20,
  opacity = 0.9,
  position = 'bottom',
  maxLines = 3,
}) => {
  if (!visible || lines.length === 0) return null;
  const show = lines.slice(-maxLines);
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 ${position === 'bottom' ? 'bottom-6' : 'top-6'} z-50`}
      style={{ fontSize: `${fontSizePx}px` }}
   >
      <div
        className="px-4 py-2 rounded-xl shadow-lg"
        style={{
          backgroundColor: `rgba(17, 24, 39, ${opacity})`,
          color: '#fff',
          backdropFilter: 'blur(6px)',
        }}
      >
        {show.map((l, i) => (
          <div key={i} className="leading-snug">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};
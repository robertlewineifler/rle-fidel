import React from 'react';

interface KeySignatureProps {
  accidentals: number;
}

const KeySignature: React.FC<KeySignatureProps> = ({ accidentals }) => {
  const isSharp = accidentals > 0;
  const count = Math.abs(accidentals);

  const staffY = [35, 45, 55, 65, 75];
  const sharpY = [35, 50, 30, 45, 60, 40, 55];
  const flatY = [55, 40, 60, 45, 65, 50, 70];

  const svgWidth = 40 + count * 14 + 8;

  return (
    <div className="bg-[#fdf6e3] rounded-md px-2 py-1 shadow-md border border-slate-300 flex items-center justify-center overflow-hidden">
      <svg width={svgWidth} height="70" viewBox={`0 0 ${svgWidth} 95`}>
        {staffY.map(y => (
          <line key={y} x1="0" y1={y} x2={svgWidth} y2={y} stroke="#666" strokeWidth="1" />
        ))}
        <text x="12" y={45} fontSize="55" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
        {Array.from({ length: count }).map((_, i) => {
          const x = 28 + i * 13;
          const y = isSharp ? sharpY[i] : flatY[i];
          return (
            <text
              key={i}
              x={x}
              y={y - 1}
              fontSize="22"
              fill="#000"
              fontFamily="Arial, sans-serif"
              dominantBaseline="central"
              textAnchor="middle"
            >
              {isSharp ? '♯' : '♭'}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default KeySignature;

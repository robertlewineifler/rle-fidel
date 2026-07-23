import React from 'react';

interface KeySignatureProps {
  accidentals: number;
}

const LINE_SPACING = 10;
const getY = (step: number) => 30 + (11 - step) * (LINE_SPACING / 2);

const SIG_SCALE = 1.0;
const SIG_X = -2;
const SIG_Y = -12;
const SIG_LEFT_PAD = 8;
const SIG_LINE_WIDTH = 110;

const SHARP_STEPS = [10, 7, 12, 8, 4, 11, 6];
const FLAT_STEPS = [6, 9, 5, 8, 4, 7, 2];

const KeySignature: React.FC<KeySignatureProps> = ({ accidentals }) => {
  const isSharp = accidentals > 0;
  const count = Math.abs(accidentals);

  const sharpY = SHARP_STEPS.map(s => getY(s));
  const flatY = FLAT_STEPS.map(s => getY(s));

  const keySigEnd = 40 + count * 14;
  const viewBoxW = keySigEnd + 16;

  return (
    <div className="bg-[#fdf6e3] rounded-md px-1 py-0.5 shadow-md border border-slate-300 flex items-center justify-center overflow-hidden w-full aspect-[3/2]">
      <svg width="100%" height="100%" overflow="visible">
        <g transform={`translate(${SIG_X}, ${SIG_Y}) scale(${SIG_SCALE})`}>
          {[2, 4, 6, 8, 10].map(step => (
            <line key={step} x1={SIG_LEFT_PAD} y1={getY(step)} x2={SIG_LINE_WIDTH} y2={getY(step)} stroke="#666" strokeWidth="1" />
          ))}
          <text x={15} y={getY(8)} fontSize="55" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
          {Array.from({ length: count }).map((_, i) => {
            const x = 40 + i * 14;
            const y = isSharp ? sharpY[i] : flatY[i];
            return (
              <text
                key={i}
                x={x}
                y={isSharp ? y - 1 : y - 5}
                fontSize="26"
                fill="#000"
                fontFamily="Arial, sans-serif"
                dominantBaseline="central"
                textAnchor="middle"
              >
                {isSharp ? '♯' : '♭'}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default KeySignature;

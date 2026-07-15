import React from 'react';

interface KeySignatureProps {
  accidentals: number;
}

const KeySignature: React.FC<KeySignatureProps> = ({ accidentals }) => {
  const isSharp = accidentals > 0;
  const count = Math.abs(accidentals);
  
  // Vertical positions for Sharps (F, C, G, D, A, E, B) relative to staff top (y=10)
  const sharpPositions = [10, 25, 5, 20, 35, 15, 30]; 
    
  // Vertical positions for Flats (B, E, A, D, G, C, F)
  const flatPositions = [30, 15, 35, 20, 40, 25, 45];

  return (
    <div className="bg-[#fdf6e3] rounded-md px-3 py-1 shadow-md border border-slate-300 flex items-center justify-center h-[70px] min-w-[50px] overflow-hidden">
      <svg width={45 + count * 14} height="80" viewBox={`0 0 ${45 + count * 14} 80`}>
        {/* Staff Lines */}
        <g transform="translate(0, 10)">
          {[10, 20, 30, 40, 50].map(y => (
            <line key={y} x1="0" y1={y} x2="100%" y2={y} stroke="#666" strokeWidth="1" />
          ))}
          
          {/* Treble Clef - matched to ScaleNotation style */}
          <text x="15" y={20} fontSize="65" fontFamily="Times New Roman, serif" fill="#000" textAnchor="middle" dominantBaseline="central">𝄞</text>
          
          {/* Accidentals */}
          {Array.from({ length: count }).map((_, i) => {
            const x = 32 + i * 14;
            const y = isSharp ? sharpPositions[i] : flatPositions[i];
            
            return (
               <text
                   key={i}
                   x={x}
                   y={y - 1} 
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

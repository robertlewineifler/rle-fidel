import React, { useMemo, useCallback } from 'react';
import { NOTE_TO_INDEX, PREFERRED_ROOT_NAMES_MAJOR, PREFERRED_ROOT_NAMES_MINOR } from '../constants';

interface CircleOfFifthsProps {
  root: string;
  isMajor: boolean;
  minorVariant: string;
  transpose: number;
  onRootChange: (root: string) => void;
  onModeChange: (isMajor: boolean) => void;
  onVariantChange: (variant: string) => void;
  onTransposeChange: (semitones: number) => void;
}

const CX = 250, CY = 250;
const OUTER_OUT = 232, OUTER_IN = 188;
const MID_OUT = 185, MID_IN = 148;
const INNER_OUT = 145, INNER_IN = 98;
const toRad = (deg: number) => (deg * Math.PI) / 180;

interface SlotData {
  majorName: string;
  minorName: string;
  semitoneIdx: number;
  accidentals: number;
}

const CIRCLE_SLOTS: SlotData[] = [
  { majorName: 'C',   minorName: 'a',   semitoneIdx: 3,  accidentals: 0 },
  { majorName: 'G',   minorName: 'e',   semitoneIdx: 10, accidentals: 1 },
  { majorName: 'D',   minorName: 'h',   semitoneIdx: 5,  accidentals: 2 },
  { majorName: 'A',   minorName: 'fis', semitoneIdx: 0,  accidentals: 3 },
  { majorName: 'E',   minorName: 'cis', semitoneIdx: 7,  accidentals: 4 },
  { majorName: 'H',   minorName: 'gis', semitoneIdx: 2,  accidentals: 5 },
  { majorName: 'Fis', minorName: 'dis', semitoneIdx: 9,  accidentals: 6 },
  { majorName: 'Des', minorName: 'b',   semitoneIdx: 4,  accidentals: -5 },
  { majorName: 'As',  minorName: 'f',   semitoneIdx: 11, accidentals: -4 },
  { majorName: 'Es',  minorName: 'c',   semitoneIdx: 6,  accidentals: -3 },
  { majorName: 'B',   minorName: 'g',   semitoneIdx: 1,  accidentals: -2 },
  { majorName: 'F',   minorName: 'd',   semitoneIdx: 8,  accidentals: -1 },
];

function slotAngleDeg(i: number): number {
  return -90 + i * 30;
}

function dotRadius(outerR: number, innerR: number): number {
  return (outerR + innerR) / 2;
}

function sectorPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number): string {
  const s = toRad(startDeg), e = toRad(endDeg);
  const x1 = cx + outerR * Math.cos(s), y1 = cy + outerR * Math.sin(s);
  const x2 = cx + outerR * Math.cos(e), y2 = cy + outerR * Math.sin(e);
  const x3 = cx + innerR * Math.cos(e), y3 = cy + innerR * Math.sin(e);
  const x4 = cx + innerR * Math.cos(s), y4 = cy + innerR * Math.sin(s);
  const la = endDeg - startDeg > 180 ? 1 : 0;
  return `M${x1},${y1} A${outerR},${outerR} 0 ${la} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${la} 0 ${x4},${y4} Z`;
}

function formatAccidental(count: number): string {
  if (count === 0) return '';
  const sym = count > 0 ? '\u266F' : '\u266D';
  return sym.repeat(Math.abs(count));
}

const MINOR_VARIANTS = [
  { short: 'Natürlich', full: 'Moll (Natürlich)' },
  { short: 'Harmonisch', full: 'Moll (Harmonisch)' },
  { short: 'Melodisch', full: 'Moll (Melodisch)' },
];

const SHARP_STEPS = [10, 7, 12, 8, 4, 11, 6];
const FLAT_STEPS = [6, 9, 5, 8, 4, 7, 2];

const CircleOfFifths: React.FC<CircleOfFifthsProps> = ({
  root, isMajor, minorVariant, transpose,
  onRootChange, onModeChange, onVariantChange, onTransposeChange,
}) => {
  const rootIndex = useMemo(() => NOTE_TO_INDEX[root] ?? 3, [root]);
  const transposedIdx = (rootIndex + transpose + 72) % 12;

  const handleMajorClick = useCallback((majorName: string) => {
    onRootChange(majorName);
    onModeChange(true);
    onVariantChange('Moll (Natürlich)');
    onTransposeChange(0);
  }, [onRootChange, onModeChange, onVariantChange, onTransposeChange]);

  const handleMinorClick = useCallback((minorName: string) => {
    onRootChange(minorName.charAt(0).toUpperCase() + minorName.slice(1));
    onModeChange(false);
    onTransposeChange(0);
  }, [onRootChange, onModeChange, onTransposeChange]);

  return (
    <div className="w-full flex flex-col items-center select-none">
      <svg viewBox="0 0 500 500" className="w-full max-w-[600px]">
        {/* Outer ring — major keys */}
        {(() => {
          const segments = CIRCLE_SLOTS.map((slot, i) => {
            const selected = isMajor && slot.semitoneIdx === rootIndex;
            const transposed = isMajor && slot.semitoneIdx === transposedIdx && !selected && transpose !== 0;
            return {
              i, selected, transposed,
              isSpecial: selected || transposed,
              stroke: transpose === 0 ? '#334155' : selected ? '#334155' : transposed ? '#f59e0b' : '#334155',
              fill: selected ? '#f59e0b' : '#1e293b',
              majorName: slot.majorName,
            };
          });
          // Render non-special first, special on top (so special strokes overwrite non-special at shared edges)
          const ordered = [...segments.filter(s => !s.isSpecial), ...segments.filter(s => s.isSpecial)];

          return ordered.map(seg => {
            const i = seg.i;
            const sAngle = slotAngleDeg(i) - 15, eAngle = slotAngleDeg(i) + 15;
            const path = sectorPath(CX, CY, OUTER_IN, OUTER_OUT, sAngle, eAngle);
            const angle = slotAngleDeg(i);
            const r = dotRadius(OUTER_OUT, OUTER_IN);
            return (
              <g key={`outer-${i}`}>
                <path d={path} fill={seg.fill} stroke={seg.stroke} strokeWidth="1.5"
                      className="cursor-pointer" onClick={() => handleMajorClick(seg.majorName)} />
                {!seg.selected && (
                  <path d={path} fill="transparent" className="cursor-pointer hover:fill-slate-700/40"
                        onClick={() => handleMajorClick(seg.majorName)} />
                )}
                <text x={CX + r * Math.cos(toRad(angle))} y={CY + r * Math.sin(toRad(angle))}
                      textAnchor="middle" dominantBaseline="central"
                      fill={seg.selected ? '#0f172a' : '#94a3b8'} fontSize="15" fontWeight="bold"
                      className="pointer-events-none">{seg.majorName}</text>
              </g>
            );
          });
        })()}

        {/* Middle ring — accidental counts or minor variant buttons */}
        {CIRCLE_SLOTS.map((slot, i) => {
          const sAngle = slotAngleDeg(i) - 15, eAngle = slotAngleDeg(i) + 15;
          const minorIdx = NOTE_TO_INDEX[slot.minorName] ?? -1;
          const isMinorSlot = !isMajor && minorIdx === rootIndex;
          const angle = slotAngleDeg(i);
          const r = dotRadius(MID_OUT, MID_IN);

          if (isMinorSlot) {
            const subLabels = ['N', 'H', 'M'];
            const subWidth = 10;
            return (
              <g key={`mid-${i}`}>
                <line x1={CX + MID_IN * Math.cos(toRad(sAngle))} y1={CY + MID_IN * Math.sin(toRad(sAngle))}
                      x2={CX + MID_OUT * Math.cos(toRad(sAngle))} y2={CY + MID_OUT * Math.sin(toRad(sAngle))}
                      stroke="#1e293b" strokeWidth="1.5" className="pointer-events-none" />
                <line x1={CX + MID_IN * Math.cos(toRad(eAngle))} y1={CY + MID_IN * Math.sin(toRad(eAngle))}
                      x2={CX + MID_OUT * Math.cos(toRad(eAngle))} y2={CY + MID_OUT * Math.sin(toRad(eAngle))}
                      stroke="#1e293b" strokeWidth="1.5" className="pointer-events-none" />
                {subLabels.map((label, si) => {
                  const subStart = sAngle + si * subWidth;
                  const subEnd = subStart + subWidth;
                  const subMid = subStart + subWidth / 2;
                  const isVariantActive = minorVariant === MINOR_VARIANTS[si].full;
                  const subPath = sectorPath(CX, CY, MID_IN, MID_OUT, subStart, subEnd);
                  const tx = CX + r * Math.cos(toRad(subMid));
                  const ty = CY + r * Math.sin(toRad(subMid));
                  return (
                    <g key={`mid-sub-${si}`} className="cursor-pointer"
                       onClick={() => onVariantChange(MINOR_VARIANTS[si].full)}>
                      <path d={subPath} fill={isVariantActive ? '#6366f1' : '#1e293b'}
                            className={isVariantActive ? '' : 'hover:fill-slate-700'} />
                      {si > 0 && (
                        <line x1={CX + MID_IN * Math.cos(toRad(subStart))} y1={CY + MID_IN * Math.sin(toRad(subStart))}
                              x2={CX + MID_OUT * Math.cos(toRad(subStart))} y2={CY + MID_OUT * Math.sin(toRad(subStart))}
                              stroke="#1e293b" strokeWidth="1" className="pointer-events-none" />
                      )}
                      <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
                            fill={isVariantActive ? '#ffffff' : '#64748b'}
                            fontSize="11" fontWeight="bold" className="pointer-events-none">{label}</text>
                    </g>
                  );
                })}
              </g>
            );
          }

          return (
            <g key={`mid-${i}`}>
              {(() => {
                const acc = slot.accidentals;
                if (acc === 0) return null;
                const isSharp = acc > 0;
                const steps = isSharp ? SHARP_STEPS : FLAT_STEPS;
                const n = Math.abs(acc);
                const stepX = 8;
                const totalWidth = (n - 1) * stepX;
                const bx = CX + r * Math.cos(toRad(angle));
                const by = CY + r * Math.sin(toRad(angle));
                let sumY = 0;
                for (let j = 0; j < n; j++) sumY += 30 + (11 - steps[j]) * 5;
                const meanY = sumY / n;
                return Array.from({ length: n }).map((_, ai) => {
                  const sy = 30 + (11 - steps[ai]) * 5;
                  const dy = (sy - meanY) * 0.5;
                  return (
                    <text key={ai} x={bx - totalWidth / 2 + ai * stepX} y={by + dy}
                          textAnchor="middle" dominantBaseline="central"
                          fill="#64748b" fontSize="12" fontWeight="bold"
                          className="pointer-events-none">{isSharp ? '\u266F' : '\u266D'}</text>
                  );
                });
              })()}
            </g>
          );
        })}

        {/* Inner ring — minor keys */}
        {(() => {
          const segments = CIRCLE_SLOTS.map((slot, i) => {
            const minorIdx = NOTE_TO_INDEX[slot.minorName] ?? -1;
            const selected = !isMajor && minorIdx === rootIndex;
            const transposed = !isMajor && minorIdx === transposedIdx && !selected && transpose !== 0;
            return {
              i, selected, transposed,
              isSpecial: selected || transposed,
              stroke: transpose === 0 ? '#334155' : selected ? '#334155' : transposed ? '#6366f1' : '#334155',
              fill: selected ? '#6366f1' : '#1e293b',
              fillOpacity: selected ? 1 : 0.5,
              minorName: slot.minorName,
            };
          });
          const ordered = [...segments.filter(s => !s.isSpecial), ...segments.filter(s => s.isSpecial)];

          return ordered.map(seg => {
            const i = seg.i;
            const sAngle = slotAngleDeg(i) - 15, eAngle = slotAngleDeg(i) + 15;
            const path = sectorPath(CX, CY, INNER_IN, INNER_OUT, sAngle, eAngle);
            const angle = slotAngleDeg(i);
            const r = dotRadius(INNER_OUT, INNER_IN);
            return (
              <g key={`inner-${i}`}>
                <path d={path} fill={seg.fill} fillOpacity={seg.fillOpacity} stroke={seg.stroke} strokeWidth="1.5"
                      className="cursor-pointer" onClick={() => handleMinorClick(seg.minorName)} />
                {!seg.selected && (
                  <path d={path} fill="transparent" className="cursor-pointer hover:fill-slate-700/40"
                        onClick={() => handleMinorClick(seg.minorName)} />
                )}
                <text x={CX + r * Math.cos(toRad(angle))} y={CY + r * Math.sin(toRad(angle))}
                      textAnchor="middle" dominantBaseline="central"
                      fill={seg.selected ? '#ffffff' : '#94a3b8'} fontSize="13" fontWeight="bold"
                      className="pointer-events-none">{seg.minorName}</text>
              </g>
            );
          });
        })()}

        {/* Center text */}
        {(() => {
          const disp = isMajor
            ? PREFERRED_ROOT_NAMES_MAJOR[rootIndex]
            : PREFERRED_ROOT_NAMES_MINOR[rootIndex];
          const color = isMajor ? '#f59e0b' : '#6366f1';
          const variantText = !isMajor ? minorVariant.replace('Moll (', '').replace(')', '') : '';
          if (transpose === 0) {
            return (
              <>
                <text x={CX} y={variantText ? CY - 9 : CY} textAnchor="middle" dominantBaseline="central"
                      fill={color} fontSize="15" fontWeight="bold" className="pointer-events-none">
                  {disp} {isMajor ? 'Dur' : 'Moll'}
                </text>
                {variantText && (
                  <text x={CX} y={CY + 14} textAnchor="middle" dominantBaseline="central"
                        fill={color} fontSize="12" opacity="0.7" className="pointer-events-none">
                    ({variantText})
                  </text>
                )}
              </>
            );
          }
          const transposedIdx = (rootIndex + transpose + 72) % 12;
          const transposedName = isMajor
            ? PREFERRED_ROOT_NAMES_MAJOR[transposedIdx]
            : PREFERRED_ROOT_NAMES_MINOR[transposedIdx];
          return (
            <>
              <text x={CX} y={CY - 20} textAnchor="middle" dominantBaseline="central"
                    fill="#94a3b8" fontSize="14" fontWeight="bold" className="pointer-events-none">
                {disp} {isMajor ? 'Dur' : 'Moll'}
              </text>
              <text x={CX} y={CY - 2} textAnchor="middle" dominantBaseline="central"
                    fill="#94a3b8" fontSize="16" className="pointer-events-none">
                {'\u2193'}
              </text>
              <text x={CX} y={CY + 16} textAnchor="middle" dominantBaseline="central"
                    fill={color} fontSize="14" fontWeight="bold" className="pointer-events-none">
                {transposedName} {isMajor ? 'Dur' : 'Moll'}
              </text>
              {variantText && (
                <text x={CX} y={CY + 32} textAnchor="middle" dominantBaseline="central"
                      fill={color} fontSize="12" opacity="0.7" className="pointer-events-none">
                  ({variantText})
                </text>
              )}
            </>
          );
        })()}

      </svg>
    </div>
  );
};

export default CircleOfFifths;

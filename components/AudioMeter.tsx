
import React from 'react';
import { Zap, Mic, MicOff, Activity } from 'lucide-react';

interface AudioMeterProps {
  volume: number;
  sensitivity: number;
  inputGain: number;
  isListening: boolean;
  onToggleListening: () => void;
  onSensitivityChange: (val: number) => void;
  onInputGainChange: (val: number) => void;
}

const AudioMeter: React.FC<AudioMeterProps> = ({ 
  volume, 
  sensitivity, 
  inputGain, 
  isListening,
  onToggleListening,
  onSensitivityChange, 
  onInputGainChange 
}) => {
  // Increased Visual Scale to provide more headroom (0.5 RMS is quite loud)
  const MAX_VISUAL_VOLUME = 0.5; 

  return (
    <div className="flex flex-col gap-4 w-full h-full">
       
       {/* Top Row: Main Controls */}
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
             <Activity size={14} />
             <span>Input Signal</span>
          </div>
          <button 
                onClick={onToggleListening}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-xs transition-all duration-200 border
                    ${isListening 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                    }
                `}
            >
                {isListening ? (
                    <> <Mic size={14} /> <span>AN</span> </>
                ) : (
                    <> <MicOff size={14} /> <span>AUS</span> </>
                )}
            </button>
       </div>

       {/* Visual Meter */}
       <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden relative border border-slate-700/50 shadow-inner">
           <div 
             className="absolute top-0 bottom-0 left-0 transition-all duration-75 ease-out"
             style={{ 
                 width: `${Math.min(100, (volume / MAX_VISUAL_VOLUME) * 100)}%`,
                 // Custom gradient: Green until 70%, Yellow 70-85%, Red 85-100%
                 background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 70%, #eab308 85%, #ef4444 100%)'
             }}
           ></div>
           
           {/* Threshold Marker */}
           <div 
             className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)] z-10"
             style={{ left: `${Math.min(100, (sensitivity / MAX_VISUAL_VOLUME) * 100)}%` }}
           ></div>
       </div>

       {/* Settings */}
       <div className="grid grid-cols-2 gap-4">
          {/* Sensitivity */}
          <div className="flex flex-col gap-1">
             <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium uppercase">
                <span>Gate</span>
                <span>{(sensitivity * 100).toFixed(1)}%</span>
             </div>
             <input 
               type="range" 
               min="0.001" 
               max="0.1" 
               step="0.001"
               value={sensitivity}
               onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
               className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400 hover:accent-slate-200"
             />
          </div>

          {/* Input Gain */}
          <div className="flex flex-col gap-1">
             <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium uppercase">
                <span className="flex items-center gap-1"><Zap size={10} /> Boost</span>
                <span>{inputGain.toFixed(1)}x</span>
             </div>
             <input 
               type="range" 
               min="1.0" 
               max="20.0" 
               step="0.1"
               value={inputGain}
               onChange={(e) => onInputGainChange(parseFloat(e.target.value))}
               className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
             />
          </div>
       </div>
    </div>
  );
};

export default AudioMeter;

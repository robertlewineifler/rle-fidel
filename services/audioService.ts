
import { AUDIO_CONTEXT_CONFIG } from '../constants';

export class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;     // Filtered (Violin)
  private rawAnalyser: AnalyserNode | null = null;  // Unfiltered (Full Spectrum)
  private mediaStream: MediaStream | null = null;
  private buffer: Float32Array = new Float32Array(AUDIO_CONTEXT_CONFIG.fftSize);
  private rawBuffer: Float32Array = new Float32Array(AUDIO_CONTEXT_CONFIG.fftSize);
  
  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Tone Generation (Polyphonic)
  private activeOscillators = new Map<number, { osc: OscillatorNode, gain: GainNode }>();
  private masterGain: GainNode | null = null;

  // Audio Player State
  private originalBuffer: AudioBuffer | null = null; 
  private activeSource: AudioBufferSourceNode | null = null;
  private playerGain: GainNode | null = null;
  private playerVolume: number = 0.8; // Default player volume
  
  private isPlayerPlaying: boolean = false;
  private playerStartTime: number = 0; 
  private playerOffset: number = 0; 
  private playerTranspose: number = 0; 

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5; // Master volume for generated tones
      this.masterGain.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  async start(minFreq: number = 180): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.mediaStream && this.mediaStream.active) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1
        } 
      });

      const source = ctx.createMediaStreamSource(this.mediaStream);
      
      // Path A: Filtered (for Tuner / Violin specific)
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = minFreq > 0 ? minFreq : 180; 

      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 20000;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = AUDIO_CONTEXT_CONFIG.fftSize;
      
      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(this.analyser);

      // Path B: Unfiltered (for Key Detection / Full Spectrum)
      this.rawAnalyser = ctx.createAnalyser();
      this.rawAnalyser.fftSize = AUDIO_CONTEXT_CONFIG.fftSize;
      // Connect direct source to raw analyser
      source.connect(this.rawAnalyser);

    } catch (err) {
      console.error("Fehler beim Zugriff auf das Mikrofon:", err);
      throw err;
    }
  }

  stop(): void {
    this.stopAllTones();
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.analyser = null;
    this.rawAnalyser = null;
    this.stopBuffer(true);
  }

  // --- RECORDING FUNCTIONS ---

  startRecording() {
    if (!this.mediaStream) return;
    this.recordedChunks = [];
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 128000 } 
        : undefined;
        
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    
    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(new Blob(this.recordedChunks, { type: 'audio/webm' }));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.recordedChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    });
  }

  getAnalysis(
      threshold: number = 0.005, 
      inputGain: number = 1.0, 
      includeRaw: boolean = false
  ): { pitch: number; volume: number; rawPitch: number } {
    if (!this.analyser || !this.audioContext) return { pitch: -1, volume: 0, rawPitch: -1 };

    // 1. Process Filtered Audio (Tuner)
    this.analyser.getFloatTimeDomainData(this.buffer);
    
    let rms = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = this.buffer[i] * inputGain;
      rms += this.buffer[i] * this.buffer[i];
    }
    rms = Math.sqrt(rms / this.buffer.length);

    let pitch = -1;
    if (rms >= threshold) {
      pitch = this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
    }

    // 2. Process Raw Audio (Key Detection) - Only if requested to save CPU
    let rawPitch = -1;
    if (includeRaw && this.rawAnalyser) {
        this.rawAnalyser.getFloatTimeDomainData(this.rawBuffer);
        
        let rawRms = 0;
        for (let i = 0; i < this.rawBuffer.length; i++) {
            this.rawBuffer[i] = this.rawBuffer[i] * inputGain;
            rawRms += this.rawBuffer[i] * this.rawBuffer[i];
        }
        rawRms = Math.sqrt(rawRms / this.rawBuffer.length);

        if (rawRms >= threshold) {
            rawPitch = this.autoCorrelate(this.rawBuffer, this.audioContext.sampleRate);
        }
    }

    return { pitch, volume: rms, rawPitch };
  }

  async analyzeAudioFile(
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<{ noteCounts: number[], avgCentsDeviation: number, totalFrames: number }> {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    
    if (onProgress) onProgress(10); 
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (onProgress) onProgress(20);

    const rawData = audioBuffer.getChannelData(0); 
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 2048;
    const stepSize = Math.floor(sampleRate * 0.02); 
    
    const noteCounts = new Array(12).fill(0);
    const tempBuffer = new Float32Array(fftSize);
    
    let totalCentsDeviation = 0;
    let validSamples = 0;

    const totalSteps = Math.floor((rawData.length - fftSize) / stepSize);
    let currentStep = 0;

    const CHUNK_SIZE = 1000;

    for (let i = 0; i < rawData.length - fftSize; i += stepSize) {
      currentStep++;
      if (currentStep % CHUNK_SIZE === 0) {
        if (onProgress) {
          const percent = 20 + Math.round((currentStep / totalSteps) * 80);
          onProgress(percent);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      for (let j = 0; j < fftSize; j++) {
        tempBuffer[j] = rawData[i + j];
      }

      let rms = 0;
      for (let j = 0; j < fftSize; j++) {
        rms += tempBuffer[j] * tempBuffer[j];
      }
      rms = Math.sqrt(rms / fftSize);

      if (rms > 0.002) { 
        const pitch = this.autoCorrelate(tempBuffer, sampleRate);
        if (pitch !== -1 && pitch > 50 && pitch < 4000) {
           const semitonesFromA4 = 12 * Math.log2(pitch / 440);
           const noteIndex = Math.round(semitonesFromA4);
           const rawCents = (semitonesFromA4 - noteIndex) * 100;
           const nameIndex = ((noteIndex % 12) + 12) % 12;

           noteCounts[nameIndex]++;
           totalCentsDeviation += rawCents;
           validSamples++;
        }
      }
    }
    
    await ctx.close();
    if (onProgress) onProgress(100);

    const avgCentsDeviation = validSamples > 0 ? totalCentsDeviation / validSamples : 0;

    return { 
      noteCounts, 
      avgCentsDeviation,
      totalFrames: validSamples
    };
  }

  // --- PLAYER FUNCTIONS ---

  async loadPlayerFile(file: File): Promise<number> {
    const ctx = this.getContext();
    const arrayBuffer = await file.arrayBuffer();
    this.originalBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.playerTranspose = 0;
    this.playerOffset = 0;
    this.isPlayerPlaying = false;
    this.stopBuffer(true);
    return this.originalBuffer.duration;
  }

  setPlayerPitch(semitones: number) {
    const oldTranspose = this.playerTranspose;
    this.playerTranspose = semitones;
    const newRate = Math.pow(2, semitones / 12);

    if (this.isPlayerPlaying && this.activeSource && this.audioContext) {
      const now = this.audioContext.currentTime;
      const oldRate = Math.pow(2, oldTranspose / 12);
      const elapsedWall = now - this.playerStartTime;
      const elapsedBuffer = elapsedWall * oldRate;
      this.playerOffset += elapsedBuffer;
      this.playerStartTime = now;
      this.activeSource.playbackRate.setValueAtTime(newRate, now);
    }
  }

  setPlayerVolume(volume: number) {
    this.playerVolume = Math.max(0, Math.min(1, volume));
    if (this.playerGain && this.audioContext) {
        this.playerGain.gain.setValueAtTime(this.playerVolume, this.audioContext.currentTime);
    }
  }

  playBuffer() {
    if (!this.originalBuffer) return;

    const ctx = this.getContext();
    if (ctx.state === 'suspended') ctx.resume();

    this.stopBuffer(false);

    this.activeSource = ctx.createBufferSource();
    this.activeSource.buffer = this.originalBuffer;
    
    const rate = Math.pow(2, this.playerTranspose / 12);
    this.activeSource.playbackRate.value = rate;
    
    this.playerGain = ctx.createGain();
    this.playerGain.gain.value = this.playerVolume; // Apply stored volume
    this.activeSource.connect(this.playerGain);
    this.playerGain.connect(ctx.destination);

    if (this.playerOffset >= this.originalBuffer.duration) this.playerOffset = 0;

    this.activeSource.start(0, this.playerOffset);
    
    this.playerStartTime = ctx.currentTime;
    this.isPlayerPlaying = true;
    
    const currentSource = this.activeSource;
    this.activeSource.onended = () => {
        if (this.isPlayerPlaying && this.activeSource === currentSource) {
           const rate = Math.pow(2, this.playerTranspose / 12);
           const elapsedWall = ctx.currentTime - this.playerStartTime;
           const currentPos = this.playerOffset + elapsedWall * rate;

           if (currentPos >= this.originalBuffer!.duration - 0.2) {
             this.isPlayerPlaying = false;
             this.playerOffset = 0;
           }
        }
    };
  }

  pauseBuffer() {
    if (this.activeSource && this.isPlayerPlaying && this.audioContext) {
        const now = this.audioContext.currentTime;
        const rate = Math.pow(2, this.playerTranspose / 12);
        const elapsedWall = now - this.playerStartTime;
        this.playerOffset += elapsedWall * rate;
        
        try {
            this.activeSource.stop();
            this.activeSource.disconnect();
        } catch(e) {}
        
        this.activeSource = null;
        this.isPlayerPlaying = false;
    }
  }

  stopBuffer(resetOffset: boolean = true) {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch(e) {}
      this.activeSource = null;
    }
    this.isPlayerPlaying = false;
    
    if (resetOffset) {
        this.playerOffset = 0;
    }
  }

  seekTo(progress0to1: number) {
    if (!this.originalBuffer) return;
    
    const wasPlaying = this.isPlayerPlaying;
    if (wasPlaying) {
       this.stopBuffer(false); 
    }
    
    this.playerOffset = this.originalBuffer.duration * progress0to1;
    
    if (wasPlaying) {
        this.playBuffer();
    }
  }

  getPlayerState() {
    const ctx = this.audioContext;
    const dur = this.originalBuffer ? this.originalBuffer.duration : 0;
    
    let current = this.playerOffset;
    if (this.isPlayerPlaying && ctx) {
        const rate = Math.pow(2, this.playerTranspose / 12);
        const elapsed = ctx.currentTime - this.playerStartTime;
        current = this.playerOffset + (elapsed * rate);
    }
    
    if (dur > 0) {
        current = Math.max(0, Math.min(current, dur));
    }

    return {
      isPlaying: this.isPlayerPlaying,
      currentTime: current,
      duration: dur
    };
  }

  // --- TONE GENERATOR (POLYPHONIC) ---

  async playTone(frequency: number) {
    this.stopAllTones();
    this.startTone(frequency);
  }

  async startTone(frequency: number) {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (this.activeOscillators.has(frequency)) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);

    osc.connect(gainNode);
    if (this.masterGain) {
        gainNode.connect(this.masterGain);
    } else {
        gainNode.connect(ctx.destination);
    }
    
    osc.start();

    this.activeOscillators.set(frequency, { osc, gain: gainNode });
  }

  stopTone(frequency: number = 0) {
    if (frequency === 0 && this.activeOscillators.size === 1) {
         const key = this.activeOscillators.keys().next().value;
         if (key) this.stopTone(key);
         return;
    }

    const voice = this.activeOscillators.get(frequency);
    if (voice && this.audioContext) {
        const { osc, gain } = voice;
        const now = this.audioContext.currentTime;
        
        try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.stop(now + 0.15);
        } catch (e) {}

        setTimeout(() => {
            try {
                osc.disconnect();
                gain.disconnect();
            } catch(e) {}
        }, 200);

        this.activeOscillators.delete(frequency);
    }
  }

  updateTone(frequency: number) {
     if (this.activeOscillators.size === 1) {
         const oldFreq = this.activeOscillators.keys().next().value;
         if (oldFreq && this.audioContext) {
             const voice = this.activeOscillators.get(oldFreq);
             if (voice) {
                 const now = this.audioContext.currentTime;
                 voice.osc.frequency.linearRampToValueAtTime(frequency, now + 0.05);
                 this.activeOscillators.delete(oldFreq);
                 this.activeOscillators.set(frequency, voice);
             }
         }
     }
  }

  stopAllTones() {
    this.activeOscillators.forEach((_, freq) => {
        this.stopTone(freq);
    });
  }

  // --- ANALYSIS ---

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    const THRESHOLD = 0.75; 

    let i = 0;
    while (i < MAX_SAMPLES && buffer[i] > buffer[i + 1]) {
      i++;
    }

    const correlations = new Float32Array(MAX_SAMPLES);
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
        let sum = 0;
        for (let k = 0; k < MAX_SAMPLES; k++) {
            sum += buffer[k] * buffer[k+offset];
        }
        correlations[offset] = sum;
    }

    const maxEnergy = correlations[0];
    if (maxEnergy < 0.0001) return -1; 

    let d = 0;
    while (correlations[d] > correlations[d+1]) d++; 
    
    for (let k = d; k < MAX_SAMPLES; k++) {
        if (correlations[k] > correlations[k-1] && correlations[k] > correlations[k+1]) {
            const normalizedPeak = correlations[k] / maxEnergy;
            if (normalizedPeak > THRESHOLD) {
                const prev = correlations[k-1];
                const next = correlations[k+1];
                const current = correlations[k];
                
                const shift = (next - prev) / (2 * (2 * current - next - prev));
                return sampleRate / (k + shift);
            }
        }
    }

    return -1;
  }
}

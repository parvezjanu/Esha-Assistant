/**
 * AudioStreamer handles:
 * 1. Capture microphone input at 16kHz, convert to 16-bit PCM little-endian, and stream as base64.
 * 2. Playback base64-encoded 24kHz 16-bit PCM little-endian audio chunks gaplessly using Web Audio API.
 * 3. Immediate interruption support to stop playback and flush audio queue.
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  
  constructor() {}

  /**
   * Start recording from microphone and stream 16kHz PCM chunks
   */
  async startRecording(onAudioChunk: (base64: string) => void): Promise<void> {
    try {
      // Request microphone access
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create AudioContext specifically running at 16000Hz (perfect for Gemini Live input)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
      
      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      
      // Use standard ScriptProcessorNode (2048 buffer size for ultra low latency)
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      
      this.micProcessor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = this.float32ToPCM16(float32);
        const base64 = this.arrayBufferToBase64(pcm16);
        onAudioChunk(base64);
      };

      this.micSource.connect(this.micProcessor);
      this.micProcessor.connect(this.inputAudioCtx.destination);

      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }
    } catch (err) {
      console.error("Failed to start audio recording:", err);
      this.stopRecording();
      throw err;
    }
  }

  /**
   * Stop microphone capture
   */
  stopRecording(): void {
    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch (e) {}
      this.micProcessor = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }
  }

  /**
   * Play a 24kHz PCM chunk from Gemini Live gaplessly
   */
  playPCMChunk(base64: string): void {
    try {
      if (!this.outputAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
        this.nextStartTime = 0;
      }

      if (this.outputAudioCtx.state === "suspended") {
        this.outputAudioCtx.resume();
      }

      const float32 = this.base64ToFloat32(base64);
      if (float32.length === 0) return;

      const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        // Fallbehind protection: add a slight buffer delay to offset network jitter
        this.nextStartTime = currentTime + 0.05;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx > -1) {
          this.activeSources.splice(idx, 1);
        }
      };
    } catch (err) {
      console.error("Error playing back audio chunk:", err);
    }
  }

  /**
   * Interrupt audio playback instantly
   */
  stopPlayback(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
  }

  /**
   * Release all audio contexts
   */
  destroy(): void {
    this.stopRecording();
    this.stopPlayback();
    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }
  }

  // Helper: Convert Float32Array to 16-bit PCM ArrayBuffer
  private float32ToPCM16(float32: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); // true = little-endian
    }
    return buffer;
  }

  // Helper: Convert base64 arraybuffer to Float32Array
  private base64ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const len = binary.length / 2;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const low = binary.charCodeAt(i * 2);
      const high = binary.charCodeAt(i * 2 + 1);
      let val = low | (high << 8);
      if (val & 0x8000) {
        val |= ~0xffff; // sign-extend to 32-bit integer
      }
      float32[i] = val / 32768; // normalize
    }
    return float32;
  }

  // Helper: Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

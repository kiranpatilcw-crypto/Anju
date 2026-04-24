export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioQueue: Float32Array[] = [];
  private isProcessingQueue = false;
  private nextStartTime = 0;

  constructor(private sampleRate: number = 16000) {}

  async start(onAudioData: (base64: string) => void) {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Using ScriptProcessorNode for wide compatibility in this environment
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = this.float32ToPcm16(inputData);
      const base64 = this.arrayBufferToBase64(pcm16.buffer);
      onAudioData(base64);
    };
  }

  stop() {
    this.processor?.disconnect();
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.processor = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.clearQueue();
  }

  // Play audio from the model (Expects 24kHz PCM16)
  async playAudioChunk(base64: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    const arrayBuffer = this.base64ToArrayBuffer(base64);
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = this.pcm16ToFloat32(pcm16);
    
    this.audioQueue.push(float32);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.audioQueue.length === 0 || !this.audioContext) return;
    this.isProcessingQueue = true;

    while (this.audioQueue.length > 0) {
      const float32 = this.audioQueue.shift()!;
      const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      
      // We don't await the end here to allow gapless playback scheduling
      // but we wait a tiny bit to not overwhelm the scheduler
      await new Promise(r => setTimeout(r, 10));
    }

    this.isProcessingQueue = false;
  }

  clearQueue() {
    this.audioQueue = [];
    this.nextStartTime = 0;
  }

  private float32ToPcm16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const val = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = val < 0 ? val * 0x8000 : val * 0x7fff;
    }
    return pcm16;
  }

  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export class AudioManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Ошибка инициализации аудио: ${error}`);
    }
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.warn('Пользователь отказал в доступе к микрофону:', error);
      return false;
    }
  }

  async checkMicrophonePermission(): Promise<boolean> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state === 'granted';
      }
      
      return await this.requestMicrophonePermission();
    } catch {
      return await this.requestMicrophonePermission();
    }
  }

  getVolumeLevel(): number {
    if (!this.analyser || !this.audioContext) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (const value of dataArray) {
      sum += value;
    }
    
    const average = sum / dataArray.length;
    return Math.min(average / 128, 1);
  }

  stop(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
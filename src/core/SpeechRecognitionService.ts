import { PlatformAdapter } from './PlatformAdapter';
import {
  SpeechRecognitionConfig,
  RecognitionResult,
  SpeechRecognitionError
} from './types';

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private lastFinalResult = '';
  private debounceTimeout: number | null = null;
  private readonly DEBOUNCE_DELAY = 300;
  private onResultCallback: ((result: RecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: SpeechRecognitionError) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor(config: SpeechRecognitionConfig = {}) {
    console.log('=== СОЗДАНИЕ SpeechRecognitionService ===');
    
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    
    console.log('SpeechRecognition:', hasSpeechRecognition);
    console.log('webkitSpeechRecognition:', hasWebkitSpeechRecognition);
    console.log('window.SpeechRecognition:', (window as any).SpeechRecognition);
    console.log('window.webkitSpeechRecognition:', (window as any).webkitSpeechRecognition);

    if (!hasSpeechRecognition && !hasWebkitSpeechRecognition) {
      const errorMsg = PlatformAdapter.isIOS() 
        ? 'Web Speech API не поддерживается в вашем Safari. Требуется iOS 14.1+'
        : 'Web Speech API is not supported in this browser';
      throw new Error(errorMsg);
    }

    const SpeechRecognition = PlatformAdapter.getSpeechRecognition();
    console.log('Получен SpeechRecognition:', SpeechRecognition);

    if (!SpeechRecognition) {
      throw new Error('Не удалось получить SpeechRecognition конструктор');
    }

    try {
      this.recognition = new SpeechRecognition();
      console.log('✅ SpeechRecognition создан успешно');
    } catch (creationError) {
      console.error('❌ Ошибка создания SpeechRecognition:', creationError);
      throw new Error(`Не удалось создать распознаватель: ${creationError}`);
    }

    this.recognition.lang = config.language || 'ru-RU';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = config.maxAlternatives || 1;

    if (PlatformAdapter.isIOS()) {
      console.log('Применяем настройки для iOS Safari');
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }

    console.log('Настройки распознавателя:', {
      lang: this.recognition.lang,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults
    });

    this.setupEventListeners();
    console.log('✅ SpeechRecognitionService создан');
  }

  private setupEventListeners(): void {
    this.recognition.onresult = (event: any) => this.handleResult(event);
    this.recognition.onerror = (event: any) => this.handleError(event);
    this.recognition.onstart = () => this.handleStart();
    this.recognition.onend = () => this.handleEnd();
  }

  private handleResult(event: any): void {
    const results = event.results;
    const lastResultIndex = results.length - 1;
    const lastResult = results[lastResultIndex];
    const transcript = lastResult[0].transcript.trim();
    const confidence = lastResult[0].confidence;
    const isFinal = lastResult.isFinal;

    if (!isFinal) {
      const result: RecognitionResult = {
        transcript: this.cleanText(transcript),
        confidence: confidence,
        isFinal: false,
        timestamp: Date.now()
      };
      if (this.onResultCallback) {
        this.onResultCallback(result);
      }
      return;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      const normalizedNew = this.normalizeText(transcript);
      const normalizedLast = this.normalizeText(this.lastFinalResult);

      if (normalizedLast && normalizedNew.includes(normalizedLast) && normalizedNew.length - normalizedLast.length < 10) {
        console.log('Пропускаем похожую фразу:', transcript);
        return;
      }

      const cleanedTranscript = this.cleanText(transcript);
      const result: RecognitionResult = {
        transcript: cleanedTranscript,
        confidence: confidence,
        isFinal: true,
        timestamp: Date.now()
      };

      this.lastFinalResult = cleanedTranscript;
      if (this.onResultCallback) {
        this.onResultCallback(result);
      }

      this.debounceTimeout = null;
    }, this.DEBOUNCE_DELAY);
  }

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanText(text: string): string {
    let cleaned = text;
    if (cleaned.toLowerCase().startsWith('скажи мне')) {
      cleaned = cleaned.substring(9);
    } else if (cleaned.toLowerCase().startsWith('скажи')) {
      cleaned = cleaned.substring(6);
    } else if (cleaned.toLowerCase().startsWith('мне')) {
      cleaned = cleaned.substring(4);
    }

    if (!/[.!?]$/.test(cleaned)) {
      if (cleaned.toLowerCase().includes('почему') ||
          cleaned.toLowerCase().includes('зачем') ||
          cleaned.toLowerCase().includes('как') ||
          cleaned.toLowerCase().includes('сколько') ||
          cleaned.toLowerCase().startsWith('кто') ||
          cleaned.toLowerCase().startsWith('что') ||
          cleaned.toLowerCase().startsWith('где') ||
          cleaned.toLowerCase().startsWith('когда')) {
        cleaned += '?';
      } else if (cleaned.toLowerCase().startsWith('сделай') ||
                 cleaned.toLowerCase().startsWith('открой') ||
                 cleaned.toLowerCase().startsWith('закрой') ||
                 cleaned.toLowerCase().startsWith('включи') ||
                 cleaned.toLowerCase().includes('пожалуйста') ||
                 cleaned.toLowerCase().startsWith('ах') ||
                 cleaned.toLowerCase().startsWith('ох') ||
                 cleaned.toLowerCase().startsWith('ура')) {
        cleaned += '!';
      } else {
        cleaned += '.';
      }
    }

    cleaned = cleaned.replace(/^./, char => char.toUpperCase());
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    return cleaned;
  }

  private handleError(event: any): void {
    const errorType = this.mapErrorCode(event.error);
    const error: SpeechRecognitionError = {
      type: errorType,
      message: event.message || 'Unknown recognition error',
      timestamp: Date.now()
    };

    this.isListening = false;
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  private mapErrorCode(code: string): SpeechRecognitionError['type'] {
    switch (code) {
      case 'no-speech': return 'no-speech';
      case 'aborted': return 'aborted';
      case 'audio-capture': return 'audio-capture';
      case 'network': return 'network';
      case 'not-allowed': return 'not-allowed';
      case 'service-not-allowed': return 'service-not-allowed';
      case 'bad-grammar': return 'bad-grammar';
      case 'language-not-supported': return 'language-not-supported';
      default: return 'network';
    }
  }

  private handleStart(): void {
    this.isListening = true;
    this.lastFinalResult = '';
    if (this.onStartCallback) {
      this.onStartCallback();
    }
  }

  private handleEnd(): void {
    this.isListening = false;
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  start(): void {
    if (this.isListening) return;
    try {
      this.recognition.start();
    } catch (error) {
      const speechError: SpeechRecognitionError = {
        type: 'aborted',
        message: 'Failed to start recognition',
        timestamp: Date.now()
      };
      if (this.onErrorCallback) {
        this.onErrorCallback(speechError);
      }
    }
  }

  stop(): void {
    if (!this.isListening) return;
    try {
      this.recognition.stop();
    } catch (error) {
    }
  }

  setLanguage(language: string): void {
    this.recognition.lang = language;
  }

  setContinuous(continuous: boolean): void {
    console.log(`SpeechRecognitionService: установка continuous = ${continuous}`);
    this.recognition.continuous = continuous;
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.onResultCallback = callback;
  }

  onError(callback: (error: SpeechRecognitionError) => void): void {
    this.onErrorCallback = callback;
  }

  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  isActive(): boolean {
    return this.isListening;
  }

  destroy(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.stop();
    this.recognition = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStartCallback = null;
    this.onEndCallback = null;
  }
}
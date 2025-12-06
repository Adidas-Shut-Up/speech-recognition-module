import { PlatformAdapter } from './PlatformAdapter';
import { AudioManager } from './AudioManager';
import { SpeechRecognitionService } from './SpeechRecognitionService';
import { ModuleConfig, ModuleStatus, RecognitionResult, SpeechRecognitionError } from './types';

export class SpeechToTextModule {
  private config: ModuleConfig;
  private audioManager: AudioManager;
  private recognitionService: SpeechRecognitionService | null = null;
  private status: ModuleStatus;
  private isInitialized = false;
  private onResultCallbacks: Array<(result: RecognitionResult) => void> = [];
  private onErrorCallbacks: Array<(error: SpeechRecognitionError) => void> = [];
  private onStatusChangeCallbacks: Array<(status: ModuleStatus) => void> = [];

  constructor(config: ModuleConfig = {}) {
    this.config = {
      language: 'ru-RU',
      continuous: true,
      autoStart: false,
      visualFeedback: true,
      debug: false,
      ...config
    };

    this.audioManager = new AudioManager();

    this.status = {
      isListening: false,
      isInitialized: false,
      hasPermission: false,
      language: this.config.language!,
      errors: [],
      debug: this.config.debug || false
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('=== ИНИЦИАЛИЗАЦИЯ МОДУЛЯ ===');
    console.log('UserAgent:', navigator.userAgent);
    console.log('iOS:', PlatformAdapter.isIOS());
    console.log('Safari:', PlatformAdapter.isSafari());

    try {
      const hasSpeechRecognition = 'SpeechRecognition' in window;
      const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
      
      console.log('SpeechRecognition in window:', hasSpeechRecognition);
      console.log('webkitSpeechRecognition in window:', hasWebkitSpeechRecognition);
      
      if (!hasSpeechRecognition && !hasWebkitSpeechRecognition) {
        let errorMsg = 'Ваш браузер не поддерживает распознавание речи.';
        
        if (PlatformAdapter.isIOS()) {
          errorMsg += '\n\nТребуется:';
          errorMsg += '\n• iOS 14.1 или выше';
          errorMsg += '\n• Safari браузер (не Chrome на iOS)';
          errorMsg += '\n• HTTPS соединение (кроме localhost)';
        }
        
        throw new Error(errorMsg);
      }

      console.log('Web Speech API поддерживается');

      const SpeechRecognition = PlatformAdapter.getSpeechRecognition();
      if (!SpeechRecognition) {
        throw new Error('Не удалось получить SpeechRecognition API');
      }
      console.log('SpeechRecognition API получен:', SpeechRecognition);

      if (PlatformAdapter.isIOS()) {
        console.log('iOS: пропускаем проверку микрофона до жеста пользователя');
        this.status.hasPermission = false;
      } else {
        try {
          const hasPermission = await this.audioManager.checkMicrophonePermission();
          this.status.hasPermission = hasPermission;
          console.log('Доступ к микрофону:', hasPermission ? 'РАЗРЕШЕН' : 'ОТКАЗАНО');
        } catch (micError) {
          console.warn('Ошибка проверки микрофона:', micError);
          this.status.hasPermission = false;
        }
      }

      this.recognitionService = new SpeechRecognitionService({
        language: this.config.language,
        continuous: this.config.continuous,
        interimResults: true
      });

      this.setupRecognitionHandlers();

      this.isInitialized = true;
      this.status.isInitialized = true;
      this.updateStatus();

      console.log('✅ Модуль успешно инициализирован');

    } catch (error) {
      console.error('❌ ОШИБКА ИНИЦИАЛИЗАЦИИ:', error);
      
      let userMessage = 'Неизвестная ошибка инициализации';
      if (error instanceof Error) {
        userMessage = error.message;
        
        if (userMessage.includes('не поддерживает распознавание речи')) {
          userMessage = 'Ваш браузер не поддерживает голосовой ввод.';
          if (PlatformAdapter.isIOS()) {
            userMessage += ' Используйте Safari на iOS 14.1+.';
          }
        }
      }

      const speechError: SpeechRecognitionError = {
        type: 'service-not-allowed',
        message: userMessage,
        timestamp: Date.now()
      };

      this.status.errors.push(speechError);
      this.updateStatus();
      
      throw new Error(`Инициализация не удалась: ${userMessage}\nUserAgent: ${navigator.userAgent}`);
    }
  }

  async requestMicrophoneAccess(): Promise<boolean> {
    console.log('Запрос доступа к микрофону...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      stream.getTracks().forEach(track => track.stop());

      console.log('Доступ к микрофону РАЗРЕШЕН');
      this.status.hasPermission = true;

      await this.audioManager.initialize();
      this.updateStatus();

      return true;

    } catch (error) {
      console.error('Доступ к микрофону ЗАПРЕЩЕН:', error);
      this.status.hasPermission = false;
      this.updateStatus();
      return false;
    }
  }

  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.recognitionService) {
      throw new Error('Recognition service not initialized');
    }

    if (this.status.isListening) {
      return;
    }

    if (!this.status.hasPermission) {
      console.log('Нет разрешения, запрашиваем доступ к микрофону...');

      const granted = await this.requestMicrophoneAccess();
      if (!granted) {
        throw new Error('Пользователь отказал в доступе к микрофону');
      }
    }

    try {
      this.recognitionService.start();
    } catch (error) {
      console.error('Ошибка запуска распознавания:', error);
      
      const speechError: SpeechRecognitionError = {
        type: 'service-not-allowed',
        message: 'Не удалось начать прослушивание',
        timestamp: Date.now()
      };
      
      this.status.errors.push(speechError);
      this.updateStatus();
      throw error;
    }
  }

  stopListening(): void {
    if (!this.recognitionService || !this.status.isListening) {
      return;
    }
    this.recognitionService.stop();
  }

  toggleListening(): void {
    if (this.status.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  setLanguage(language: string): void {
    this.config.language = language;
    this.status.language = language;
    if (this.recognitionService) {
      this.recognitionService.setLanguage(language);
    }
    this.updateStatus();
  }

  setContinuous(continuous: boolean): void {
    console.log(`Установка непрерывного режима: ${continuous}`);
    this.config.continuous = continuous;
    if (this.recognitionService) {
      this.recognitionService.setContinuous(continuous);
    }
  }

  getVolumeLevel(): number {
    if (!this.audioManager.isReady()) {
      return 0;
    }
    return this.audioManager.getVolumeLevel();
  }

  onResult(callback: (result: RecognitionResult) => void): void {
    this.onResultCallbacks.push(callback);
  }

  onError(callback: (error: SpeechRecognitionError) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  onStatusChange(callback: (status: ModuleStatus) => void): void {
    this.onStatusChangeCallbacks.push(callback);
  }

  getStatus(): ModuleStatus {
    return { ...this.status };
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognitionService) return;

    this.recognitionService.onStart(() => {
      this.status.isListening = true;
      this.updateStatus();
    });

    this.recognitionService.onEnd(() => {
      this.status.isListening = false;
      this.updateStatus();
    });

    this.recognitionService.onResult((result) => {
      this.onResultCallbacks.forEach(callback => callback(result));
    });

    this.recognitionService.onError((error) => {
      this.status.errors.push(error);
      this.updateStatus();
      this.onErrorCallbacks.forEach(callback => callback(error));
    });
  }

  private updateStatus(): void {
    this.onStatusChangeCallbacks.forEach(callback => callback(this.getStatus()));
  }

  destroy(): void {
    this.stopListening();
    if (this.recognitionService) {
      this.recognitionService.destroy();
      this.recognitionService = null;
    }
    this.audioManager.stop();
    this.isInitialized = false;
    this.status.isInitialized = false;
    this.status.isListening = false;
    this.onResultCallbacks = [];
    this.onErrorCallbacks = [];
    this.onStatusChangeCallbacks = [];
    this.updateStatus();
  }

  isReady(): boolean {
    return this.isInitialized && this.status.hasPermission;
  }
}

import { SpeechToTextModule } from './core/SpeechToTextModule';
import { VoiceButton } from './ui/components/VoiceButton';
import { VoiceVisualizer } from './ui/components/VoiceVisualizer';
import { PlatformAdapter } from './core/PlatformAdapter';

interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

interface RecognitionError {
  type: string;
  message: string;
  timestamp: number;
}

interface ModuleStatus {
  isListening: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  language: string;
  errors: RecognitionError[];
}

class RecordingTimer {
  private startTime: number = 0;
  private timerInterval: number | null = null;
  private displayElement: HTMLElement | null = null;
  private isRunning = false;

  constructor(elementId: string) {
    this.displayElement = document.getElementById(elementId);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    this.updateDisplay();
    this.timerInterval = window.setInterval(() => {
      this.updateDisplay();
    }, 1000);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.displayElement) {
      this.displayElement.textContent = 'Запись: 0:00';
    }
  }

  reset(): void {
    this.stop();
    if (this.displayElement) {
      this.displayElement.textContent = 'Запись: 0:00';
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private updateDisplay(): void {
    if (!this.displayElement || !this.isRunning) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    this.displayElement.textContent = `Запись: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

class DemoApplication {
  private speechModule: SpeechToTextModule;
  private voiceButton: VoiceButton;
  private voiceVisualizer: VoiceVisualizer;
  private recordingTimer: RecordingTimer;
  private isInitialized = false;
  private recognitionHistory: Array<{ text: string, timestamp: number, wordCount: number }> = [];
  private volumeCheckInterval: number | null = null;
  private shouldAutoStart: boolean;

  constructor() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===');
    console.log('UserAgent:', navigator.userAgent);
    console.log('iOS:', PlatformAdapter.isIOS(), 'Safari:', PlatformAdapter.isSafari());
    console.log('Web Speech API:', PlatformAdapter.isWebSpeechAPISupported());

    this.speechModule = new SpeechToTextModule({
      language: 'ru-RU',
      continuous: false,
      visualFeedback: true,
      debug: true
    });

    const buttonContainer = document.getElementById('voiceButton')!;
    this.voiceButton = new VoiceButton(buttonContainer);

    const visualizerContainer = document.getElementById('voiceVisualizer')!;
    this.voiceVisualizer = new VoiceVisualizer(visualizerContainer);

    this.recordingTimer = new RecordingTimer('recordingTimer');

    const autoStartCheckbox = document.getElementById('autoStart') as HTMLInputElement;
    const continuousModeCheckbox = document.getElementById('continuousMode') as HTMLInputElement;

    const savedAutoStart = localStorage.getItem('voiceModule_autoStart') === 'true';
    autoStartCheckbox.checked = savedAutoStart;
    this.shouldAutoStart = savedAutoStart;

    const savedContinuous = localStorage.getItem('voiceModule_continuousMode') === 'true';
    continuousModeCheckbox.checked = savedContinuous;
    this.speechModule.setContinuous(savedContinuous);

    autoStartCheckbox.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      localStorage.setItem('voiceModule_autoStart', isChecked.toString());
      this.shouldAutoStart = isChecked;
      this.showNotification(`Автозапуск: ${isChecked ? 'сохранен' : 'выключен'}`);
    });

    continuousModeCheckbox.addEventListener('change', (e) => {
      const isContinuous = (e.target as HTMLInputElement).checked;
      this.speechModule.setContinuous(isContinuous);
      localStorage.setItem('voiceModule_continuousMode', isContinuous.toString());
      this.showNotification(`Режим: ${isContinuous ? 'непрерывный' : 'по фразам'}`);
    });

    this.setupEventListeners();
    this.initializeModule();
  }

  private async initializeModule(): Promise<void> {
    try {
      console.log('=== НАЧАЛО ИНИЦИАЛИЗАЦИИ ===');
      console.log('Платформа:', PlatformAdapter.getBrowserInfo());
      console.log('Мобильное устройство:', PlatformAdapter.isMobile());
      
      this.updateStatus('Проверка поддержки браузера...', 'initializing');
      
      if (!PlatformAdapter.isWebSpeechAPISupported()) {
        let errorMsg = 'Ваш браузер не поддерживает голосовой ввод.';
        
        if (PlatformAdapter.isIOS()) {
          errorMsg += '\n\nДля iOS требуется:\n';
          errorMsg += '• Версия iOS 14.1 или выше\n';
          errorMsg += '• Браузер Safari (Chrome на iOS не поддерживает Web Speech API)\n';
          errorMsg += '• Разрешение на использование микрофона\n\n';
          errorMsg += 'Пожалуйста, откройте эту страницу в Safari.';
        }
        
        throw new Error(errorMsg);
      }
      
      this.updateStatus('Инициализация модуля...', 'initializing');
      
      await this.speechModule.initialize();
      
      const status = this.speechModule.getStatus();
      console.log('Статус после инициализации:', status);
      
      if (status.errors.length > 0) {
        console.error('Ошибки при инициализации:', status.errors);
        throw new Error(status.errors[0].message);
      }
      
      this.isInitialized = true;
      
      if (PlatformAdapter.isIOS()) {
        this.updateStatus('Нажмите и удерживайте для начала', 'ready');
        
        setTimeout(() => {
          this.showIOSWelcomeMessage();
        }, 500);
        
      } else {
        this.updateStatus('Готов к работе', 'ready');
      }
      
      this.voiceButton.enable();
      this.setupModuleHandlers();
      
      console.log('✅ Модуль успешно инициализирован');
      
      if (this.shouldAutoStart && !PlatformAdapter.isIOS()) {
        setTimeout(() => {
          const continuousMode = document.getElementById('continuousMode') as HTMLInputElement;
          const isContinuous = continuousMode.checked;
          this.speechModule.setContinuous(isContinuous);
          console.log(`Автозапуск: начата запись (режим: ${isContinuous ? 'непрерывный' : 'по фразам'})`);
          this.handleVoiceButtonClick();
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ ОШИБКА ИНИЦИАЛИЗАЦИИ МОДУЛЯ:', error);
      
      let errorMessage = 'Неизвестная ошибка';
      let showDetailedError = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('не поддерживает') || errorMessage.includes('Web Speech API')) {
          errorMessage = 'Ваш браузер не поддерживает голосовой ввод.';
          if (PlatformAdapter.isIOS()) {
            errorMessage += ' Используйте Safari на iOS 14.1+.';
          }
        } else if (errorMessage.includes('микрофон')) {
          errorMessage = 'Ошибка доступа к микрофону.';
        }
        
        showDetailedError = errorMessage.length < 100;
      }
      
      this.showError(errorMessage);
      
      if (this.speechModule.getStatus().debug && showDetailedError) {
        console.error('Детали ошибки:', error);
        this.showError(`${errorMessage}\n\n(Детали: ${error instanceof Error ? error.message : 'нет'})`);
      }
      
      this.updateStatus('Ошибка инициализации', 'error');
      this.voiceButton.disable();
      
      this.showRetryButton();
    }
  }

  private showIOSWelcomeMessage(): void {
    const container = document.querySelector('.voice-interface');
    if (!container) return;

    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'ios-welcome';
    welcomeDiv.innerHTML = `
      <div class="welcome-content">
        <h3>🎤 Голосовой ввод на iOS</h3>
        <p>Для использования голосового ввода в Safari:</p>
        <ol>
          <li><strong>Нажмите и УДЕРЖИВАЙТЕ</strong> кнопку микрофона</li>
          <li>В появившемся диалоге выберите <strong>"Разрешить"</strong></li>
          <li>Отпустите кнопку</li>
          <li>Снова нажмите и удерживайте для записи голоса</li>
        </ol>
        <button id="iosTestBtn">Проверить микрофон</button>
      </div>
    `;

    const existingWelcome = document.querySelector('.ios-welcome');
    if (!existingWelcome) {
      container.prepend(welcomeDiv);
    }

    document.getElementById('iosTestBtn')?.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        alert('✅ Микрофон работает! Теперь нажмите и удерживайте кнопку для записи.');
        stream.getTracks().forEach(track => track.stop());
        welcomeDiv.remove();
      } catch (err) {
        alert('❌ Ошибка доступа к микрофону: ' + (err as Error).message);
      }
    });
  }

  private showRetryButton(): void {
    const container = document.querySelector('.voice-interface');
    if (!container) return;

    const retryDiv = document.createElement('div');
    retryDiv.className = 'retry-container';
    retryDiv.innerHTML = `
      <div class="retry-content">
        <p>Не удалось инициализировать модуль распознавания речи</p>
        <button id="retryInitBtn" class="retry-button">Попробовать снова</button>
        <button id="debugInfoBtn" class="debug-button">Информация для разработчика</button>
      </div>
    `;

    const existingRetry = document.querySelector('.retry-container');
    if (!existingRetry) {
      container.prepend(retryDiv);
    }

    document.getElementById('retryInitBtn')?.addEventListener('click', async () => {
      retryDiv.remove();
      await this.initializeModule();
    });

    document.getElementById('debugInfoBtn')?.addEventListener('click', () => {
      const debugInfo = `
        UserAgent: ${navigator.userAgent}
        iOS: ${PlatformAdapter.isIOS()}
        Safari: ${PlatformAdapter.isSafari()}
        Web Speech API: ${PlatformAdapter.isWebSpeechAPISupported()}
        MediaDevices: ${!!navigator.mediaDevices.getUserMedia}
        HTTPS: ${window.location.protocol === 'https:'}
      `;
      alert(debugInfo);
    });
  }

  private setupModuleHandlers(): void {
    this.speechModule.onResult((result: RecognitionResult) => {
      console.log('Получен результат:', result);
      this.handleRecognitionResult(result);
    });

    this.speechModule.onError((error: RecognitionError) => {
      console.error('Ошибка распознавания:', error);
      this.handleRecognitionError(error);
    });

    this.speechModule.onStatusChange((status: ModuleStatus) => {
      console.log('Статус изменился:', status);
      
      this.updateStatus(
        status.isListening ? 'Слушаю...' :
        status.isInitialized ? 'Готов' : 'Не готов',
        status.isListening ? 'listening' :
        status.errors.length > 0 ? 'error' : 'ready'
      );

      if (status.isListening) {
        this.startVolumeMonitoring();
        console.log('Запущен мониторинг громкости');
      } else {
        this.stopVolumeMonitoring();
        console.log('Остановлен мониторинг громкости');
        if (this.recordingTimer.isActive()) {
          this.recordingTimer.stop();
          console.log('Таймер остановлен');
        }
      }
    });
  }

  private setupEventListeners(): void {
    this.voiceButton.onClick(() => {
      this.handleVoiceButtonClick();
    });

    const clearButton = document.getElementById('clearButton')!;
    clearButton.addEventListener('click', () => {
      this.clearResults();
    });

    const copyButton = document.getElementById('copyButton')!;
    copyButton.addEventListener('click', () => {
      this.copyToClipboard();
    });

    const settingsToggle = document.getElementById('settingsToggle')!;
    const settingsContent = document.getElementById('settingsContent')!;
    const settingsArrow = document.getElementById('settingsArrow')!;
    
    settingsToggle.addEventListener('click', () => {
      settingsContent.classList.toggle('open');
      settingsArrow.textContent = settingsContent.classList.contains('open') ? '▲' : '▼';
    });

    const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    languageSelect.addEventListener('change', (e) => {
      const language = (e.target as HTMLSelectElement).value;
      this.speechModule.setLanguage(language);
      this.showNotification(`Язык изменен на: ${this.getLanguageName(language)}`);
    });
  }

  private async handleVoiceButtonClick(): Promise<void> {
    if (!this.isInitialized) {
      this.showError('Модуль не инициализирован');
      return;
    }

    try {
      const currentStatus = this.speechModule.getStatus();
      
      if (currentStatus.isListening) {
        this.speechModule.stopListening();
        this.recordingTimer.stop();
        this.voiceButton.setActive(false);
        console.log('Остановлена запись');
      } else {
        if (PlatformAdapter.isIOS() && !currentStatus.hasPermission) {
          console.log('iOS: первый запуск - запрашиваем микрофон');
          this.updateStatus('Запрос доступа к микрофону...', 'listening');
        }
        
        await this.speechModule.startListening();
        this.recordingTimer.start();
        this.voiceButton.setActive(true);
        console.log('Начата запись');
      }
    } catch (error) {
      console.error('Voice button error:', error);
      this.showError('Не удалось начать запись');
      this.recordingTimer.stop();
      this.voiceButton.setActive(false);
    }
  }

  private handleRecognitionResult(result: RecognitionResult): void {
    const continuousMode = document.getElementById('continuousMode') as HTMLInputElement;
    const isContinuous = continuousMode.checked;
    const currentStatus = this.speechModule.getStatus();

    if (!result.transcript) {
      console.warn('Пустой результат');
      return;
    }

    if (result.isFinal) {
      console.log('Финальный результат получен');
      this.recordingTimer.stop();

      const resultsText = document.getElementById('resultsText')!;
      const wordsCount = document.getElementById('wordsCount')!;
      const lastUpdate = document.getElementById('lastUpdate')!;

      resultsText.textContent = result.transcript;
      const wordCount = this.countWords(result.transcript);
      wordsCount.textContent = `Слов: ${wordCount}`;

      const time = new Date(result.timestamp).toLocaleTimeString();
      lastUpdate.textContent = time;

      this.addToHistory(result.transcript, result.timestamp);
      this.voiceButton.showSuccess();
      this.showNotification('Текст распознан', 'success');
      this.voiceButton.setActive(false);

      if (!isContinuous) {
        console.log('Непрерывный режим ВЫКЛЮЧЕН - останавливаем запись');
        if (currentStatus.isListening) {
          this.speechModule.stopListening();
          this.voiceButton.setActive(false);
          this.updateStatus('Готов', 'ready');
        }
      }
    }
  }

  private countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    const words = text.trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    return words.length;
  }

  private handleRecognitionError(error: RecognitionError): void {
    console.error('Recognition error:', error);
    this.recordingTimer.stop();

    let errorMessage = 'Произошла ошибка распознавания';
    switch (error.type) {
      case 'no-speech':
        errorMessage = 'Речь не обнаружена. Пожалуйста, говорите громче.';
        break;
      case 'audio-capture':
        errorMessage = 'Не удалось получить доступ к микрофону. Проверьте подключение микрофона.';
        break;
      case 'not-allowed':
        errorMessage = 'Доступ к микрофону запрещен. Пожалуйста, предоставьте разрешение в настройках браузера.';
        break;
      case 'network':
        errorMessage = 'Сетевая ошибка. Проверьте подключение к интернету.';
        break;
    }

    this.showError(errorMessage);
    this.voiceButton.showError();
    this.updateStatus('Ошибка', 'error');
  }

  private updateStatus(text: string, state: 'initializing' | 'ready' | 'listening' | 'error'): void {
    const statusText = document.getElementById('statusText')!;
    const statusPanel = document.getElementById('statusPanel')!;
    
    statusText.textContent = text;
    statusPanel.className = 'status-panel';
    
    if (state === 'listening') {
      statusPanel.classList.add('listening');
    } else if (state === 'error') {
      statusPanel.classList.add('error');
    }

    const statusOrb = document.getElementById('statusOrb')!;
    statusOrb.className = 'status-orb';
    
    if (state === 'listening') {
      statusOrb.style.animation = 'orbPulse 1.5s infinite';
    } else {
      statusOrb.style.animation = '';
    }
  }

  private showError(message: string): void {
    const errorContainer = document.getElementById('errorContainer')!;
    const errorMessage = document.getElementById('errorMessage')!;
    
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-header">
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="notification-title">${type === 'success' ? 'Успешно' : 'Ошибка'}</span>
      </div>
      <div class="notification-message">${message}</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(120%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  private clearResults(): void {
    const resultsText = document.getElementById('resultsText')!;
    const wordsCount = document.getElementById('wordsCount')!;
    const lastUpdate = document.getElementById('lastUpdate')!;
    
    resultsText.textContent = '';
    wordsCount.textContent = 'Слов: 0';
    lastUpdate.textContent = '--:--:--';
    this.recordingTimer.reset();
    this.showNotification('Текст очищен');
  }

  private async copyToClipboard(): Promise<void> {
    const resultsText = document.getElementById('resultsText')!;
    const text = resultsText.textContent || '';

    if (!text.trim()) {
      this.showNotification('Нет текста для копирования', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Текст скопирован в буфер обмена');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showNotification('Не удалось скопировать текст', 'error');
    }
  }

  private addToHistory(text: string, timestamp: number): void {
    console.log('Добавление в историю:', text.substring(0, 50) + '...');
    
    const wordCount = this.countWords(text);
    const historyItem = { text, timestamp, wordCount };
    this.recognitionHistory.unshift(historyItem);
    
    if (this.recognitionHistory.length > 10) {
      this.recognitionHistory.pop();
    }
    
    this.updateHistoryDisplay();
  }

  private updateHistoryDisplay(): void {
    const historyList = document.getElementById('historyList')!;
    const historyEmpty = document.getElementById('historyEmpty')!;

    if (this.recognitionHistory.length === 0) {
      historyList.innerHTML = '';
      historyEmpty.style.display = 'block';
      return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    this.recognitionHistory.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-text">${item.text}</div>
        <div class="history-meta">
          <div class="history-time">
            ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div class="history-words">
            <span>${item.wordCount} слов</span>
          </div>
        </div>
      `;

      historyItem.addEventListener('click', () => {
        const resultsText = document.getElementById('resultsText')!;
        const wordsCount = document.getElementById('wordsCount')!;
        const lastUpdate = document.getElementById('lastUpdate')!;
        
        resultsText.textContent = item.text;
        wordsCount.textContent = `Слов: ${item.wordCount}`;
        const time = new Date(item.timestamp).toLocaleTimeString();
        lastUpdate.textContent = time;
        this.showNotification('Текст восстановлен из истории');
      });

      historyList.appendChild(historyItem);
    });
  }

  private startVolumeMonitoring(): void {
    this.stopVolumeMonitoring();

    const updateVolume = () => {
      if (!this.speechModule.getStatus().isListening) return;
      
      try {
        const volume = this.speechModule.getVolumeLevel();
        this.voiceVisualizer.updateVolume(volume);
      } catch (error) {
        console.warn('Ошибка получения уровня громкости:', error);
      }
      
      this.volumeCheckInterval = window.setTimeout(updateVolume, 50);
    };

    updateVolume();
  }

  private stopVolumeMonitoring(): void {
    if (this.volumeCheckInterval) {
      clearTimeout(this.volumeCheckInterval);
      this.volumeCheckInterval = null;
    }
    this.voiceVisualizer.reset();
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'ru-RU': 'Русский',
      'en-US': 'Английский (США)',
      'en-GB': 'Английский (Великобритания)',
      'de-DE': 'Немецкий',
      'fr-FR': 'Французский',
      'es-ES': 'Испанский',
      'it-IT': 'Итальянский',
      'ja-JP': 'Японский',
      'ko-KR': 'Корейский',
      'zh-CN': 'Китайский',
      'zh-TW': 'Китайский (Традиционный)'
    };
    return languages[code] || code;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new DemoApplication();
    (window as any).speechApp = app;
    console.log('Speech recognition module initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    const statusText = document.getElementById('statusText');
    if (statusText) {
      statusText.textContent = 'Ошибка инициализации приложения';
    }
  }
});
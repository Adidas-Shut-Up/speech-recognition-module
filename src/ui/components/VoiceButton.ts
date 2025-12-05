export class VoiceButton {
  private button: HTMLButtonElement;
  private isActive = false;
  private isEnabled = true;
  private onClickCallback: (() => void) | null = null;
  private pulseElement: HTMLDivElement;
  private iconElement: HTMLDivElement;
  private pressTimer: number | null = null;
  private readonly LONG_PRESS_DELAY = 500; // 0.5 секунды для долгого нажатия

  constructor(container: HTMLElement) {
    // Создаем кнопку
    this.button = document.createElement('button');
    this.button.className = 'voice-button';
    this.button.innerHTML = `
      <div class="voice-button-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </div>
      <div class="voice-button-pulse"></div>
    `;

    // Находим элементы
    this.iconElement = this.button.querySelector('.voice-button-icon') as HTMLDivElement;
    this.pulseElement = this.button.querySelector('.voice-button-pulse') as HTMLDivElement;

    // Настройка кнопки
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'Нажмите для записи голоса');
    this.button.setAttribute('role', 'button');
    this.button.tabIndex = 0;

    // Добавляем обработчики событий
    this.setupEventListeners();
    
    // Добавляем в контейнер
    container.innerHTML = ''; // Очищаем контейнер
    container.appendChild(this.button);
  }

  private setupEventListeners(): void {
    // Мышиные события
    this.button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handlePressStart();
    });

    this.button.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.handlePressEnd();
    });

    this.button.addEventListener('mouseleave', () => {
      this.handlePressCancel();
    });

    // Сенсорные события (для мобильных устройств)
    this.button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handlePressStart();
    });

    this.button.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handlePressEnd();
    });

    this.button.addEventListener('touchcancel', () => {
      this.handlePressCancel();
    });

    // Клик (для клавиатуры и быстрого нажатия)
    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleClick();
    });

    // Клавиатурные события
    this.button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handlePressStart();
      }
    });

    this.button.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handlePressEnd();
      }
    });
  }

  private handlePressStart(): void {
    if (!this.isEnabled) return;

    // Запускаем таймер для долгого нажатия
    this.pressTimer = window.setTimeout(() => {
      if (this.isEnabled) {
        this.startListening();
        this.pressTimer = null;
      }
    }, this.LONG_PRESS_DELAY);

    this.button.classList.add('pressing');
  }

  private handlePressEnd(): void {
    if (!this.isEnabled) return;

    // Очищаем таймер
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
      
      // Быстрое нажатие - просто переключаем состояние
      this.toggle();
      if (this.onClickCallback) {
        this.onClickCallback();
      }
    } else if (this.isActive) {
      // Если было долгое нажатие и мы слушали - останавливаем
      this.stopListening();
    }

    this.button.classList.remove('pressing');
  }

  private handlePressCancel(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    this.button.classList.remove('pressing');
    
    if (this.isActive) {
      this.stopListening();
    }
  }

  private handleClick(): void {
    // Для быстрого нажатия (уже обработано в handlePressEnd)
  }

  private startListening(): void {
    this.isActive = true;
    this.updateVisualState();
  }

  private stopListening(): void {
    this.isActive = false;
    this.updateVisualState();
  }

  private toggle(): void {
    this.isActive = !this.isActive;
    this.updateVisualState();
  }

  private updateVisualState(): void {
    // Очищаем все состояния
    this.button.classList.remove('active', 'listening', 'success', 'error');
    this.pulseElement.classList.remove('active');

    if (!this.isEnabled) {
      this.button.classList.add('disabled');
      return;
    }

    this.button.classList.remove('disabled');

    if (this.isActive) {
      this.button.classList.add('active', 'listening');
      this.pulseElement.classList.add('active');
      this.button.setAttribute('aria-label', 'Слушаю... Говорите');
    } else {
      this.button.setAttribute('aria-label', 'Нажмите для записи голоса');
    }
  }

  // Публичные методы

  setActive(active: boolean): void {
    if (active) {
      this.startListening();
    } else {
      this.stopListening();
    }
  }

  showSuccess(): void {
    this.button.classList.remove('active', 'listening', 'error');
    this.button.classList.add('success');
    this.pulseElement.classList.remove('active');
    
    setTimeout(() => {
      if (this.button.classList.contains('success')) {
        this.button.classList.remove('success');
      }
    }, 1000);
  }

  showError(): void {
    this.button.classList.remove('active', 'listening', 'success');
    this.button.classList.add('error');
    this.pulseElement.classList.remove('active');
    
    setTimeout(() => {
      if (this.button.classList.contains('error')) {
        this.button.classList.remove('error');
      }
    }, 2000);
  }

  onClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  setText(text: string): void {
    this.button.setAttribute('aria-label', text);
    
    // Можно добавить всплывающую подсказку
    this.button.title = text;
  }

  disable(): void {
    this.isEnabled = false;
    this.isActive = false;
    this.button.disabled = true;
    this.updateVisualState();
    
    // Очищаем таймер, если он есть
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  enable(): void {
    this.isEnabled = true;
    this.button.disabled = false;
    this.updateVisualState();
  }

  isListening(): boolean {
    return this.isActive && this.isEnabled;
  }

  reset(): void {
    this.isActive = false;
    this.button.classList.remove('active', 'listening', 'success', 'error');
    this.pulseElement.classList.remove('active');
    this.updateVisualState();
  }

  destroy(): void {
    // Очищаем таймер
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    
    // Удаляем обработчики событий
    this.button.replaceWith(this.button.cloneNode(true));
    
    // Удаляем элемент
    this.button.remove();
  }
}


export class PlatformAdapter {
  static isWebSpeechAPISupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  static getSpeechRecognition(): any {
    if ('SpeechRecognition' in window) {
      return (window as any).SpeechRecognition;
    } else if ('webkitSpeechRecognition' in window) {
      return (window as any).webkitSpeechRecognition;
    }
    return null;
  }

  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  static isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  static isMobile(): boolean {
    return this.isIOS() || this.isAndroid();
  }

  static isChrome(): boolean {
    return /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
  }

  static isSafari(): boolean {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  }

  static getBrowserInfo(): string {
    if (this.isChrome()) return 'Chrome';
    if (this.isSafari()) return 'Safari';
    return 'Unknown';
  }
}
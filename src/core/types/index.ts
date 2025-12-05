export interface SpeechRecognitionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  duration?: number;
}

export interface SpeechRecognitionError {
  type: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  message: string;
  timestamp: number;
}

export interface ModuleConfig {
  language?: string;
  continuous?: boolean;
  autoStart?: boolean;
  visualFeedback?: boolean;
  debug?: boolean;
}

export interface ModuleStatus {
  debug: boolean;
  isListening: boolean;
  isInitialized: boolean;
  hasPermission: boolean;
  language: string;
  errors: SpeechRecognitionError[];
}
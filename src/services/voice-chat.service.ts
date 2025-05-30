import { GoogleGenerativeAI } from '@google/generative-ai';

export type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceChatConfig {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
}

export interface AudioVisualizationData {
  volume: number;
  isListening: boolean;
  isSpeaking: boolean;
}

export class VoiceChatService {
  private genAI: GoogleGenerativeAI;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isRecording = false;
  private state: VoiceChatState = 'idle';
  private session: any = null;
  private audioChunks: Blob[] = [];
  
  // Callbacks
  private onStateChange?: (state: VoiceChatState) => void;
  private onAudioVisualization?: (data: AudioVisualizationData) => void;
  private onTranscript?: (text: string, isFinal: boolean) => void;
  private onResponse?: (text: string) => void;
  private onError?: (error: Error) => void;

  constructor(config: VoiceChatConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  // Set up callbacks
  setCallbacks(callbacks: {
    onStateChange?: (state: VoiceChatState) => void;
    onAudioVisualization?: (data: AudioVisualizationData) => void;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
  }) {
    this.onStateChange = callbacks.onStateChange;
    this.onAudioVisualization = callbacks.onAudioVisualization;
    this.onTranscript = callbacks.onTranscript;
    this.onResponse = callbacks.onResponse;
    this.onError = callbacks.onError;
  }

  private setState(newState: VoiceChatState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  // Initialize audio context and microphone
  async initializeAudio(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Set up MediaRecorder for audio capture
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioData();
      };

      this.startAudioVisualization();
    } catch (error) {
      this.onError?.(new Error('Failed to initialize audio: ' + (error as Error).message));
    }
  }

  private startAudioVisualization() {
    const updateVisualization = () => {
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i] * this.dataArray[i];
        }
        const volume = Math.sqrt(sum / this.dataArray.length) / 255;

        this.onAudioVisualization?.({
          volume,
          isListening: this.state === 'listening',
          isSpeaking: this.state === 'speaking'
        });
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }

  // Start listening for voice input
  async startListening(): Promise<void> {
    if (!this.audioContext || !this.mediaRecorder) {
      await this.initializeAudio();
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.audioChunks = [];
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.setState('listening');
    }
  }

  // Stop listening and process the audio
  stopListening(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.setState('processing');
    }
  }

  // Process the recorded audio data
  private async processAudioData(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      
      // Convert to the format expected by Gemini (16-bit PCM, 16kHz)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to mono 16-bit PCM
      const pcmData = this.convertToPCM16(audioBuffer);
      
      // Send to Gemini Live API
      await this.sendAudioToGemini(pcmData);
      
    } catch (error) {
      this.onError?.(new Error('Failed to process audio: ' + (error as Error).message));
      this.setState('idle');
    }
  }

  private convertToPCM16(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const pcm16 = new Int16Array(length);
    
    // Get the first channel (mono)
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
      // Convert float32 sample to int16
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    return pcm16.buffer;
  }

  // Initialize Gemini Live API session
  async initializeSession(): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-live-001" 
      });

      // For now, we'll use the regular Gemini API as the Live API WebSocket
      // integration requires more complex setup. This is a simplified version.
      this.setState('idle');
    } catch (error) {
      this.onError?.(new Error('Failed to initialize Gemini session: ' + (error as Error).message));
    }
  }

  private async sendAudioToGemini(pcmData: ArrayBuffer): Promise<void> {
    try {
      // For now, we'll simulate the Live API response
      // In a full implementation, this would use WebSocket connection to Gemini Live API
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate transcript
      this.onTranscript?.("I heard you speak", true);
      
      // Start speaking state
      this.setState('speaking');
      
      // Simulate AI response
      const responses = [
        "Hello! I heard what you said. How can I help you today?",
        "That's interesting! Tell me more about that.",
        "I understand. Let me think about that for a moment.",
        "Great question! Here's what I think about that topic."
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      this.onResponse?.(response);
      
      // Simulate speech synthesis and playback
      await this.speakResponse(response);
      
      this.setState('idle');
      
    } catch (error) {
      this.onError?.(new Error('Failed to send audio to Gemini: ' + (error as Error).message));
      this.setState('idle');
    }
  }

  private async speakResponse(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = () => {
        resolve();
      };
      
      utterance.onerror = () => {
        resolve(); // Continue even if speech synthesis fails
      };
      
      speechSynthesis.speak(utterance);
    });
  }

  // Toggle listening state
  toggleListening(): void {
    if (this.state === 'listening') {
      this.stopListening();
    } else if (this.state === 'idle') {
      this.startListening();
    }
  }

  // Get current state
  getState(): VoiceChatState {
    return this.state;
  }

  // Clean up resources
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    speechSynthesis.cancel();
    this.setState('idle');
  }
} 
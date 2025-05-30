import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
  TurnCoverage,
} from '@google/genai';

export type LiveChatState = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

export interface LiveChatConfig {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
}

export interface AudioVisualizationData {
  volume: number;
  isListening: boolean;
  isSpeaking: boolean;
}

export class GeminiLiveChatService {
  private apiKey: string;
  private model: string;
  private systemInstruction: string;
  private state: LiveChatState = 'idle';
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private volumeData: Float32Array = new Float32Array(256);
  private isRunning = false;
  private audioPlayer: AudioContext | null = null;
  private responseQueue: LiveServerMessage[] = [];
  private audioParts: string[] = [];
  
  // Callbacks
  private onStateChange?: (state: LiveChatState) => void;
  private onAudioVisualization?: (data: AudioVisualizationData) => void;
  private onTranscript?: (text: string) => void;
  private onResponse?: (text: string) => void;
  private onError?: (error: Error) => void;

  // Audio configuration
  private readonly SEND_SAMPLE_RATE = 16000;
  private readonly RECEIVE_SAMPLE_RATE = 24000;
  private readonly CHANNELS = 1;
  private readonly CHUNK_SIZE = 1024;

  private lastAudioSent = 0;
  private readonly AUDIO_SEND_INTERVAL = 100; // Send audio every 100ms

  constructor(config: LiveChatConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.5-flash-preview-native-audio-dialog";
    this.systemInstruction = config.systemInstruction || "Your Name is GAIA, You are a helpful AI Assistant.";
    
    this.ai = new GoogleGenAI({
      apiKey: this.apiKey,
    });
  }

  // Set up callbacks
  setCallbacks(callbacks: {
    onStateChange?: (state: LiveChatState) => void;
    onAudioVisualization?: (data: AudioVisualizationData) => void;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string) => void;
    onError?: (error: Error) => void;
  }) {
    this.onStateChange = callbacks.onStateChange;
    this.onAudioVisualization = callbacks.onAudioVisualization;
    this.onTranscript = callbacks.onTranscript;
    this.onResponse = callbacks.onResponse;
    this.onError = callbacks.onError;
  }

  private setState(newState: LiveChatState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  // Initialize audio context and microphone
  private async initializeAudio(): Promise<void> {
    try {
      console.log('Requesting microphone access...');
      
      // Get user media with explicit constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.SEND_SAMPLE_RATE,
          channelCount: this.CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      console.log('Microphone access granted');

      // Create audio context for input
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.SEND_SAMPLE_RATE,
      });

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('Audio context created, state:', this.audioContext.state);

      // Create audio context for output
      this.audioPlayer = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.RECEIVE_SAMPLE_RATE,
      });

      // Set up analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.microphone.connect(this.analyser);

      console.log('Microphone connected to analyser');

      // Load and create audio worklet for processing
      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([this.getAudioWorkletCode()], { type: 'application/javascript' }))
      );

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      this.microphone.connect(this.audioWorkletNode);

      console.log('Audio worklet node created and connected');

      // Handle audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-data' && this.isRunning) {
          this.sendAudioToGemini(event.data.audioData);
        }
      };

      this.startAudioVisualization();
      console.log('Audio initialization complete');
      
    } catch (error) {
      console.error('Audio initialization error:', error);
      this.onError?.(new Error('Failed to initialize audio: ' + (error as Error).message));
      this.setState('error');
    }
  }

  // Audio worklet processor code
  private getAudioWorkletCode(): string {
    return `
      class AudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = ${this.CHUNK_SIZE};
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
          this.isRunning = false;
          
          this.port.onmessage = (event) => {
            if (event.data.type === 'start') {
              this.isRunning = true;
              console.log('Audio processor started');
            } else if (event.data.type === 'stop') {
              this.isRunning = false;
              console.log('Audio processor stopped');
            }
          };
        }

        process(inputs, outputs, parameters) {
          if (!this.isRunning) return true;

          const input = inputs[0];
          const inputChannel = input[0];

          if (inputChannel) {
            for (let i = 0; i < inputChannel.length; i++) {
              this.buffer[this.bufferIndex] = inputChannel[i];
              this.bufferIndex++;

              if (this.bufferIndex >= this.bufferSize) {
                // Convert to 16-bit PCM
                const pcmData = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  const sample = Math.max(-1, Math.min(1, this.buffer[j]));
                  pcmData[j] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }

                this.port.postMessage({
                  type: 'audio-data',
                  audioData: pcmData.buffer
                });

                this.bufferIndex = 0;
              }
            }
          }

          return true;
        }
      }

      registerProcessor('audio-processor', AudioProcessor);
    `;
  }

  // Start audio visualization
  private startAudioVisualization() {
    const updateVisualization = () => {
      if (this.analyser && this.volumeData) {
        // Use time domain data for better volume detection
        const timeData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(timeData);
        
        // Calculate volume (RMS) from time domain data
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const normalized = (timeData[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const volume = Math.min(rms * 5, 1); // Amplify the signal for better visualization

        //console.log('Audio volume:', volume.toFixed(3)); // Debug logging

        this.onAudioVisualization?.({
          volume: volume,
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

  // Connect to Gemini Live API using the official SDK
  private async connectToGemini(): Promise<void> {
    try {
      this.setState('connecting');

      const config = {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr',
            }
          }
        },
        contextWindowCompression: {
          triggerTokens: '25600',
          slidingWindow: { targetTokens: '12800' },
        },
        systemInstruction: {
          parts: [{
            text: this.systemInstruction,
          }]
        },
      };

      console.debug('Attempting to connect to Gemini Live API...');

      this.session = await this.ai.live.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            console.debug('Gemini Live API connection opened');
            // Use a timeout to ensure session is fully initialized
            setTimeout(() => {
              if (this.session) {
                console.debug('Session methods:', Object.getOwnPropertyNames(this.session));
                console.debug('Session prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.session)));
                
                // Check for send method or similar
                const sessionMethods = Object.getOwnPropertyNames(this.session);
                const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.session));
                console.debug('Available methods:', [...sessionMethods, ...prototypeMethods]);
              }
              this.setState('connected');
            }, 100);
          },
          onmessage: (message: LiveServerMessage) => {
            console.log('Raw message received:', message);
            this.responseQueue.push(message);
            this.handleModelMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live API error:', e.message);
            this.onError?.(new Error('Live API error: ' + e.message));
            this.setState('error');
          },
          onclose: (e: CloseEvent) => {
            console.debug('Gemini Live API connection closed:', e.reason);
            if (this.state !== 'idle') {
              this.setState('error');
              this.onError?.(new Error('Connection closed unexpectedly: ' + e.reason));
            }
          },
        },
        config
      });

      console.debug('Session created:', !!this.session);
      
      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      this.onError?.(new Error('Failed to connect to Gemini: ' + (error as Error).message));
      this.setState('error');
      throw error;
    }
  }

  // Handle messages from Gemini
  private handleModelMessage(message: LiveServerMessage) {
    try {
      console.log('Received message from Gemini:', message);
      
      // Handle server content (text and audio responses)
      if (message.serverContent?.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;
        
        for (const part of parts) {
          // Handle text responses
          if (part.text) {
            console.log('Gemini text response:', part.text);
            this.onTranscript?.(part.text);
            this.onResponse?.(part.text);
          }

          // Handle audio responses  
          if (part.inlineData && part.inlineData.data) {
            console.log('Gemini audio response received');
            this.setState('speaking');
            this.handleAudioResponse(part.inlineData);
          }
        }
      }

      // Handle turn completion
      if (message.serverContent?.turnComplete) {
        console.log('Turn complete, returning to listening');
        this.setState('listening');
      }

      // Handle interruptions
      if (message.serverContent?.interrupted) {
        console.log('Response was interrupted');
        this.setState('listening');
      }

      // Handle generation completion
      if (message.serverContent?.generationComplete) {
        console.log('Generation complete');
        this.setState('listening');
      }

      // Handle transcriptions (if enabled)
      if (message.serverContent?.inputTranscription?.text) {
        console.log('Input transcription:', message.serverContent.inputTranscription.text);
        this.onTranscript?.(message.serverContent.inputTranscription.text);
      }

      if (message.serverContent?.outputTranscription?.text) {
        console.log('Output transcription:', message.serverContent.outputTranscription.text);
        this.onTranscript?.(message.serverContent.outputTranscription.text);
      }

    } catch (error) {
      console.error('Error handling model message:', error);
    }
  }

  // Handle audio response from Gemini
  private handleAudioResponse(inlineData: any) {
    try {
      if (inlineData.data) {
        // Store audio part
        this.audioParts.push(inlineData.data);
        
        // Convert and play audio
        const audioBuffer = this.convertToWav(this.audioParts, inlineData.mimeType || 'audio/pcm;rate=24000');
        this.playAudioBuffer(audioBuffer);
      }
    } catch (error) {
      console.error('Error handling audio response:', error);
      this.setState('listening');
    }
  }

  // Convert audio data to WAV format (adapted from the documentation)
  private convertToWav(rawData: string[], mimeType: string): ArrayBuffer {
    const options = this.parseMimeType(mimeType);
    const dataLength = rawData.reduce((a, b) => a + b.length, 0);
    const wavHeader = this.createWavHeader(dataLength, options);
    const audioData = rawData.map(data => {
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    });

    const combinedLength = audioData.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Uint8Array(new Uint8Array(wavHeader).byteLength + combinedLength);
    combined.set(new Uint8Array(wavHeader), 0);
    
    let offset = new Uint8Array(wavHeader).byteLength;
    for (const arr of audioData) {
      combined.set(arr, offset);
      offset += arr.length;
    }

    return combined.buffer;
  }

  // Parse MIME type for audio format
  private parseMimeType(mimeType: string) {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [_, format] = fileType.split('/');

    const options = {
      numChannels: 1,
      bitsPerSample: 16,
      sampleRate: this.RECEIVE_SAMPLE_RATE,
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options;
  }

  // Create WAV header
  private createWavHeader(dataLength: number, options: any): ArrayBuffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // WAV header
    view.setUint32(0, 0x46464952, true);          // "RIFF"
    view.setUint32(4, 36 + dataLength, true);     // ChunkSize
    view.setUint32(8, 0x45564157, true);          // "WAVE"
    view.setUint32(12, 0x20746D66, true);         // "fmt "
    view.setUint32(16, 16, true);                 // Subchunk1Size
    view.setUint16(20, 1, true);                  // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);        // NumChannels
    view.setUint32(24, sampleRate, true);         // SampleRate
    view.setUint32(28, byteRate, true);           // ByteRate
    view.setUint16(32, blockAlign, true);         // BlockAlign
    view.setUint16(34, bitsPerSample, true);      // BitsPerSample
    view.setUint32(36, 0x61746164, true);         // "data"
    view.setUint32(40, dataLength, true);         // Subchunk2Size

    return buffer;
  }

  // Play audio buffer
  private async playAudioBuffer(audioBuffer: ArrayBuffer) {
    try {
      if (!this.audioPlayer) return;

      const audioData = await this.audioPlayer.decodeAudioData(audioBuffer);
      const source = this.audioPlayer.createBufferSource();
      source.buffer = audioData;
      source.connect(this.audioPlayer.destination);

      source.onended = () => {
        if (this.state === 'speaking') {
          // Clear audio parts for next response
          this.audioParts = [];
          this.setState('listening');
        }
      };

      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      this.setState('listening');
    }
  }

  // Send audio data to Gemini
  private sendAudioToGemini(audioData: ArrayBuffer) {
    if (this.session && this.isRunning) {
      // Throttle audio sending to prevent overwhelming the API
      const now = Date.now();
      if (now - this.lastAudioSent < this.AUDIO_SEND_INTERVAL) {
        return;
      }
      this.lastAudioSent = now;

      try {
        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(audioData);
        
        // Use sendRealtimeInput for streaming audio data with correct structure
        this.session.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: `audio/pcm;rate=${this.SEND_SAMPLE_RATE}`
          }
        });
        
        console.log('Audio data sent to Gemini via sendRealtimeInput');
        
      } catch (error) {
        console.error('Error sending audio to Gemini:', error);
        // If the connection is closed, stop trying to send audio
        if (error instanceof Error && error.message && error.message.includes('CLOSING or CLOSED')) {
          console.log('Connection closed, stopping audio transmission');
          this.isRunning = false;
        }
      }
    }
  }

  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Start conversation
  async startConversation(): Promise<void> {
    try {
      console.log('Starting conversation...');
      
      await this.initializeAudio();
      await this.connectToGemini();
      
      this.isRunning = true;
      this.setState('listening');
      
      // Start audio processing
      if (this.audioWorkletNode) {
        console.log('Starting audio worklet...');
        this.audioWorkletNode.port.postMessage({ type: 'start' });
        
        // Wait a moment to ensure the worklet is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('Audio worklet started');
      } else {
        console.error('Audio worklet node not available');
      }
      
      console.log('Conversation started successfully');
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      this.onError?.(new Error('Failed to start conversation: ' + (error as Error).message));
      this.setState('error');
    }
  }

  // Stop conversation
  stopConversation(): void {
    try {
      console.log('Stopping conversation...');
      this.isRunning = false;

      // Stop audio processing
      if (this.audioWorkletNode) {
        console.log('Stopping audio worklet...');
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
      }

      // Close session
      if (this.session) {
        console.log('Closing session...');
        this.session.close();
        this.session = null;
      }

      // Clean up audio resources
      this.cleanupAudio();
      
      this.setState('idle');
      console.log('Conversation stopped successfully');
      
    } catch (error) {
      console.error('Failed to stop conversation:', error);
      this.onError?.(new Error('Failed to stop conversation: ' + (error as Error).message));
    }
  }

  // Clean up audio resources
  private cleanupAudio(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.audioPlayer && this.audioPlayer.state !== 'closed') {
      this.audioPlayer.close();
      this.audioPlayer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Clear audio parts
    this.audioParts = [];
    this.responseQueue = [];
  }

  // Get current state
  getState(): LiveChatState {
    return this.state;
  }

  // Dispose resources
  dispose(): void {
    this.stopConversation();
  }
} 
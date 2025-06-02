import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
  TurnCoverage,
  StartSensitivity,
  EndSensitivity,
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
  speakingVolume?: number;
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
  private gainNode: GainNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private volumeData: Float32Array = new Float32Array(256);
  private isRunning = false;
  private audioPlayer: AudioContext | null = null;
  private responseQueue: LiveServerMessage[] = [];
  private audioParts: string[] = [];
  private accumulatedAudioData: Int16Array = new Int16Array(0);
  private isPlayingAudio = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  
  // Add these for speech activity detection
  private speechAnalyser: AnalyserNode | null = null;
  private speechVolumeData: Float32Array = new Float32Array(256);
  private currentSpeechVolume: number = 0;
  
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
  private readonly AUDIO_SEND_INTERVAL = 50; // Reduced from 100ms to 50ms for faster response
  
  constructor(config: LiveChatConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.5-flash-preview-native-audio-dialog";
    this.systemInstruction = config.systemInstruction || "You are Mahasen, a highly intelligent and helpful AI assistant. Always talk in English Language.";
    
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
      
      // Check if running in a secure context
      if (!window.isSecureContext) {
        throw new Error('MediaDevices API requires a secure context (HTTPS)');
      }
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser');
      }
      
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
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        throw new Error('AudioContext is not supported in this browser');
      }
      
      this.audioContext = new AudioContext({
        sampleRate: this.SEND_SAMPLE_RATE,
      });

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('Audio context created, state:', this.audioContext.state);

      // Create audio context for output
      this.audioPlayer = new AudioContext({
        sampleRate: this.RECEIVE_SAMPLE_RATE,
      });

      // Set up analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create gain node to boost microphone volume
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 3.5; // Increase microphone volume by 2.5x
      
      // Connect microphone -> gain -> analyser
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      console.log('Microphone connected with gain boost:', this.gainNode.gain.value);

      // Check if AudioWorklet is supported
      if (!this.audioContext.audioWorklet) {
        console.warn('AudioWorklet is not supported in this browser, using ScriptProcessor fallback');
        this.setupScriptProcessorFallback();
      } else {
        // Load and create audio worklet for processing
        await this.audioContext.audioWorklet.addModule(
          URL.createObjectURL(new Blob([this.getAudioWorkletCode()], { type: 'application/javascript' }))
        );

        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
        this.gainNode.connect(this.audioWorkletNode);

        console.log('Audio worklet node created and connected with gain boost');

        // Handle audio data from worklet
        this.audioWorkletNode.port.onmessage = (event) => {
          if (event.data.type === 'audio-data' && this.isRunning) {
            this.sendAudioToGemini(event.data.audioData);
          }
        };
      }

      this.startAudioVisualization();
      console.log('Audio initialization complete');
      
    } catch (error) {
      console.error('Audio initialization error:', error);
      this.onError?.(new Error('Failed to initialize audio: ' + (error as Error).message));
      this.setState('error');
      throw error; // Re-throw to allow the caller to handle it
    }
  }

  // Set up ScriptProcessor as a fallback for browsers without AudioWorklet
  private setupScriptProcessorFallback(): void {
    if (!this.audioContext || !this.gainNode) return;
    
    console.log('Setting up ScriptProcessor fallback');
    
    // Create script processor node (deprecated but widely supported)
    const scriptProcessor = this.audioContext.createScriptProcessor(this.CHUNK_SIZE, 1, 1);
    
    // Connect gain node to script processor
    this.gainNode.connect(scriptProcessor);
    scriptProcessor.connect(this.audioContext.destination);
    
    // Buffer for collecting audio data
    let buffer = new Float32Array(this.CHUNK_SIZE / 2);
    let bufferIndex = 0;
    
    // Process audio data
    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      if (!this.isRunning) return;
      
      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
      
      for (let i = 0; i < inputData.length; i++) {
        // Apply soft clipping to prevent distortion
        let sample = inputData[i];
        if (sample > 0.95) sample = 0.95;
        if (sample < -0.95) sample = -0.95;
        
        buffer[bufferIndex] = sample;
        bufferIndex++;
        
        if (bufferIndex >= buffer.length) {
          // Convert to 16-bit PCM
          const pcmData = new Int16Array(buffer.length);
          for (let j = 0; j < buffer.length; j++) {
            const normalizedSample = Math.max(-1, Math.min(1, buffer[j]));
            pcmData[j] = normalizedSample < 0 ? normalizedSample * 0x8000 : normalizedSample * 0x7FFF;
          }
          
          // Send audio data to Gemini
          this.sendAudioToGemini(pcmData.buffer);
          
          bufferIndex = 0;
        }
      }
    };
    
    // Store reference to script processor to prevent garbage collection
    (this as any).scriptProcessor = scriptProcessor;
  }

  // Audio worklet processor code
  private getAudioWorkletCode(): string {
    return `
      class AudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = ${this.CHUNK_SIZE / 2}; // Reduced buffer size for lower latency
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
              // Apply some normalization to handle the increased gain
              let sample = inputChannel[i];
              
              // Soft clipping to prevent harsh distortion from gain boost
              if (sample > 0.95) sample = 0.95;
              if (sample < -0.95) sample = -0.95;
              
              this.buffer[this.bufferIndex] = sample;
              this.bufferIndex++;

              if (this.bufferIndex >= this.bufferSize) {
                // Convert to 16-bit PCM with improved quality handling
                const pcmData = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  const normalizedSample = Math.max(-1, Math.min(1, this.buffer[j]));
                  pcmData[j] = normalizedSample < 0 ? normalizedSample * 0x8000 : normalizedSample * 0x7FFF;
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
        const volume = Math.min(rms * 3, 1); // Adjusted for boosted input

        // Detect speech activity during AI playback
        let speakingVolume = 0;
        if (this.state === 'speaking' && this.speechAnalyser) {
          const speechTimeData = new Uint8Array(this.speechAnalyser.frequencyBinCount);
          this.speechAnalyser.getByteTimeDomainData(speechTimeData);
          
          // Calculate speech volume (RMS) from AI audio output
          let speechSum = 0;
          for (let i = 0; i < speechTimeData.length; i++) {
            const normalized = (speechTimeData[i] - 128) / 128;
            speechSum += normalized * normalized;
          }
          const speechRms = Math.sqrt(speechSum / speechTimeData.length);
          speakingVolume = Math.min(speechRms * 5, 1); // Amplify speech detection
          
          // Smooth the speech volume to avoid jitter
          this.currentSpeechVolume = this.currentSpeechVolume * 0.7 + speakingVolume * 0.3;
          speakingVolume = this.currentSpeechVolume;
        } else {
          // Gradually fade out speech volume when not speaking
          this.currentSpeechVolume = this.currentSpeechVolume * 0.9;
          speakingVolume = this.currentSpeechVolume;
        }

        this.onAudioVisualization?.({
          volume: volume,
          isListening: this.state === 'listening',
          isSpeaking: this.state === 'speaking',
          speakingVolume: speakingVolume
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
        systemInstruction: {
          parts: [{
            text: this.systemInstruction,
          }]
        },
        // Add proper VAD configuration
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false, // Use automatic VAD
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 300,
            silenceDurationMs: 1000, // 1 second of silence before considering speech ended
          }
        }
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
            console.log('📨 Received message from Gemini at:', Date.now());
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
      console.log('📨 Processing message from Gemini at:', Date.now());
      
      // Handle server content (text and audio responses)
      if (message.serverContent?.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;
        
        // Set state to speaking when we start receiving AI response
        if (this.state === 'listening') {
          console.log('🎤➡️🗣️ Transitioning from listening to speaking');
          this.setState('speaking');
        }
        
        for (const part of parts) {
          // Handle text responses
          if (part.text) {
            console.log('📝 Gemini text response:', part.text);
            this.onResponse?.(part.text);
          }

          // Handle audio responses  
          if (part.inlineData && part.inlineData.data) {
            console.log('🎵 Gemini audio response received at:', Date.now());
            this.handleAudioResponse(part.inlineData);
          }
        }
      }

      // Handle generation completion
      if (message.serverContent?.generationComplete) {
        console.log('✅ Generation complete - playing accumulated audio at:', Date.now());
        // Play all accumulated audio when generation is finished
        this.playAccumulatedAudio();
      }

      // Handle turn completion - this indicates the AI finished its response
      if (message.serverContent?.turnComplete) {
        console.log('🏁 Turn complete, AI finished speaking at:', Date.now());
        // Ensure audio is played if not already started
        if (this.accumulatedAudioData.length > 0 && !this.isPlayingAudio) {
          this.playAccumulatedAudio();
        } else if (this.accumulatedAudioData.length === 0) {
          // No audio to play, transition back to listening immediately
          console.log('🗣️➡️🎤 No audio to play, transitioning back to listening');
          this.setState('listening');
        }
      }

      // Handle interruptions
      if (message.serverContent?.interrupted) {
        console.log('⚠️ Response was interrupted at:', Date.now());
        // Stop current audio playback immediately and clear accumulated data
        if (this.currentAudioSource) {
          this.currentAudioSource.stop();
          this.currentAudioSource = null;
        }
        this.isPlayingAudio = false;
        this.accumulatedAudioData = new Int16Array(0);
        this.setState('listening');
      }

      // Handle transcriptions (user speech recognition)
      if (message.serverContent?.inputTranscription?.text) {
        console.log('🎤 User speech transcription at:', Date.now(), ':', message.serverContent.inputTranscription.text);
        this.onTranscript?.(message.serverContent.inputTranscription.text);
      }

    } catch (error) {
      console.error('Error handling model message:', error);
    }
  }

  // Handle audio response from Gemini
  private handleAudioResponse(inlineData: any) {
    try {
      if (inlineData.data) {
        console.log('Accumulating audio chunk');
        
        // Accumulate audio data - don't play immediately
        this.accumulateAudioChunk(inlineData.data, inlineData.mimeType || 'audio/pcm;rate=24000');
      }
    } catch (error) {
      console.error('Error handling audio response:', error);
      this.setState('listening');
    }
  }

  // Accumulate audio chunk data
  private accumulateAudioChunk(rawData: string, mimeType: string): void {
    try {
      // Convert base64 to PCM data
      const binaryString = atob(rawData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM 16-bit)
      const newPcmData = new Int16Array(bytes.buffer);
      
      // Accumulate with existing data
      const combinedLength = this.accumulatedAudioData.length + newPcmData.length;
      const combined = new Int16Array(combinedLength);
      combined.set(this.accumulatedAudioData, 0);
      combined.set(newPcmData, this.accumulatedAudioData.length);
      
      this.accumulatedAudioData = combined;
      
      console.log(`Accumulated audio chunk: ${newPcmData.length} samples, total: ${this.accumulatedAudioData.length} samples`);
      
    } catch (error) {
      console.error('Error accumulating audio chunk:', error);
    }
  }

  // Play the complete accumulated audio when generation is finished
  private async playAccumulatedAudio(): Promise<void> {
    if (!this.audioPlayer || this.accumulatedAudioData.length === 0) return;
    
    try {
      console.log(`Playing accumulated audio: ${this.accumulatedAudioData.length} samples`);
      
      // Stop any currently playing audio
      if (this.currentAudioSource) {
        this.currentAudioSource.stop();
        this.currentAudioSource = null;
      }
      
      // Create speech analyser if it doesn't exist
      if (!this.speechAnalyser) {
        this.speechAnalyser = this.audioPlayer.createAnalyser();
        this.speechAnalyser.fftSize = 512;
        this.speechAnalyser.smoothingTimeConstant = 0.3;
      }
      
      // Create audio buffer from accumulated data
      const sampleRate = this.RECEIVE_SAMPLE_RATE;
      const numChannels = 1;
      const audioBuffer = this.audioPlayer.createBuffer(numChannels, this.accumulatedAudioData.length, sampleRate);
      
      // Convert Int16 to Float32 and copy to audio buffer
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < this.accumulatedAudioData.length; i++) {
        channelData[i] = this.accumulatedAudioData[i] / 32768; // Convert to -1.0 to 1.0 range
      }
      
      // Create and play audio source
      const source = this.audioPlayer.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect source -> analyser -> destination for speech activity detection
      source.connect(this.speechAnalyser);
      this.speechAnalyser.connect(this.audioPlayer.destination);
      
      this.currentAudioSource = source;
      
      this.isPlayingAudio = true;
      this.setState('speaking');
      
      // Set up completion handler
      source.onended = () => {
        console.log('🔊 Audio playback completed, transitioning back to listening');
        this.isPlayingAudio = false;
        this.currentAudioSource = null;
        this.accumulatedAudioData = new Int16Array(0); // Clear accumulated data
        this.setState('listening');
      };
      
      source.start();
      console.log('🔊 Audio playback started');
      
    } catch (error) {
      console.error('Error playing accumulated audio:', error);
      this.isPlayingAudio = false;
      this.setState('listening');
    }
  }

  // Convert single audio chunk to WAV format
  private convertSingleAudioChunk(rawData: string, mimeType: string): ArrayBuffer {
    const options = this.parseMimeType(mimeType);
    const binaryString = atob(rawData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const wavHeader = this.createWavHeader(bytes.length, options);
    const combined = new Uint8Array(new Uint8Array(wavHeader).byteLength + bytes.length);
    combined.set(new Uint8Array(wavHeader), 0);
    combined.set(bytes, new Uint8Array(wavHeader).byteLength);
    
    return combined.buffer;
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

  // Send audio stream end signal when microphone is paused
  private sendAudioStreamEnd() {
    if (this.session && this.isRunning) {
      try {
        this.session.sendRealtimeInput({ audioStreamEnd: true });
        console.log('Audio stream end signal sent to Gemini');
      } catch (error) {
        console.error('Error sending audio stream end:', error);
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
      
      // Initialize audio first
      try {
        await this.initializeAudio();
      } catch (error) {
        console.error('Audio initialization failed:', error);
        this.onError?.(new Error('Audio initialization failed: ' + (error as Error).message));
        // Don't return here, still try to connect to Gemini for text-only mode
      }
      
      // Connect to Gemini
      await this.connectToGemini();
      
      this.isRunning = true;
      this.setState('listening');
      
      // Start audio processing if audio was successfully initialized
      if (this.audioWorkletNode) {
        console.log('Starting audio worklet...');
        this.audioWorkletNode.port.postMessage({ type: 'start' });
        
        // Wait a moment to ensure the worklet is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('Audio worklet started');
      } else {
        console.log('Audio worklet not available - running in text-only mode');
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

      // Send audio stream end signal before stopping
      this.sendAudioStreamEnd();

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
    // Stop current audio playback
    if (this.currentAudioSource) {
      this.currentAudioSource.stop();
      this.currentAudioSource = null;
    }

    // Reset audio state and clear accumulated data
    this.isPlayingAudio = false;
    this.accumulatedAudioData = new Int16Array(0);

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    // Clean up script processor fallback if it exists
    if ((this as any).scriptProcessor) {
      (this as any).scriptProcessor.disconnect();
      (this as any).scriptProcessor = null;
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
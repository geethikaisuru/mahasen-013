import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
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
  private isRunning = false;
  private audioPlayer: AudioContext | null = null;
  private accumulatedAudioData: Int16Array = new Int16Array(0);
  private isPlayingAudio = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  
  // Message handling
  private messageProcessor: ((message: LiveServerMessage) => void) | null = null;
  private isProcessingMessages = false;
  
  // Audio visualization
  private visualizationFrame: number | null = null;
  private currentVolume: number = 0;
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
  private readonly AUDIO_SEND_INTERVAL = 100; // Send audio every 100ms as recommended
  
  constructor(config: LiveChatConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.0-flash-live-001"; // Use the recommended cascaded model
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
      
      if (!window.isSecureContext) {
        throw new Error('Microphone access requires a secure context (HTTPS)');
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not available');
      }
      
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

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }

      // Create audio context for input
      this.audioContext = new AudioContextClass({
        sampleRate: this.SEND_SAMPLE_RATE,
      });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('Audio context created, state:', this.audioContext.state);

      // Create audio context for output
      this.audioPlayer = new AudioContextClass({
        sampleRate: this.RECEIVE_SAMPLE_RATE,
      });

      // Resume audio player context if suspended (required for user interaction)
      if (this.audioPlayer.state === 'suspended') {
        await this.audioPlayer.resume();
      }

      console.log('Audio player context created, state:', this.audioPlayer.state);

      // Set up analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 2.0; // Moderate gain boost
      
      this.microphone.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      console.log('Microphone connected with gain boost:', this.gainNode.gain.value);

      if (!this.audioContext.audioWorklet) {
        throw new Error('AudioWorklet not supported');
      }

      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([this.getAudioWorkletCode()], { type: 'application/javascript' }))
      );

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      this.gainNode.connect(this.audioWorkletNode);

      console.log('Audio worklet node created and connected');

      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-data' && this.isRunning) {
          this.sendAudioToGemini(event.data.audioData);
        }
      };

      this.startAudioVisualization();
      console.log('Audio initialization complete');
      
    } catch (error) {
      console.error('Audio initialization error:', error);
      this.cleanupAudio();
      this.onError?.(new Error('Failed to initialize audio: ' + (error as Error).message));
      this.setState('error');
      throw error;
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
              let sample = inputChannel[i];
              
              // Soft clipping
              if (sample > 0.95) sample = 0.95;
              if (sample < -0.95) sample = -0.95;
              
              this.buffer[this.bufferIndex] = sample;
              this.bufferIndex++;

              if (this.bufferIndex >= this.bufferSize) {
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

  // Start audio visualization with proper throttling
  private startAudioVisualization() {
    let lastVisualizationUpdate = 0;
    let lastVolume = 0;
    
    const updateVisualization = () => {
      const now = Date.now();
      
      // Throttle to ~20fps to prevent React overload
      if (now - lastVisualizationUpdate < 50) {
        if (this.audioContext && this.audioContext.state !== 'closed') {
          this.visualizationFrame = requestAnimationFrame(updateVisualization);
        }
        return;
      }
      
      lastVisualizationUpdate = now;
      
      if (this.analyser) {
        const timeData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(timeData);
        
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const normalized = (timeData[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const volume = Math.min(rms * 2, 1);

        // Smooth the volume to prevent jitter
        this.currentVolume = this.currentVolume * 0.7 + volume * 0.3;

        // Only call the callback if there's a significant change
        const significantChange = Math.abs(this.currentVolume - lastVolume) > 0.02;
        
        if (this.onAudioVisualization && significantChange) {
          lastVolume = this.currentVolume;
          this.onAudioVisualization({
            volume: this.currentVolume,
            isListening: this.state === 'listening',
            isSpeaking: this.state === 'speaking',
            speakingVolume: this.currentSpeechVolume
          });
        }
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.visualizationFrame = requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }

  // Connect to Gemini Live API with proper configuration
  private async connectToGemini(): Promise<void> {
    try {
      this.setState('connecting');

      const config = {
        responseModalities: [Modality.AUDIO], // Audio response for natural conversation
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        systemInstruction: {
          parts: [{
            text: this.systemInstruction,
          }]
        },
        // Enable input transcription to see what user is saying
        inputAudioTranscription: {},
        // Configure VAD properly for responsive interaction
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 200,
            silenceDurationMs: 800, // Respond after 800ms of silence
          }
        }
      };

      console.log('Connecting to Gemini Live API with config:', config);

      this.session = await this.ai.live.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live API connection opened');
            this.setState('connected');
            this.startMessageProcessing();
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleIncomingMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('❌ Gemini Live API error:', e.message);
            this.onError?.(new Error('Live API error: ' + e.message));
            this.setState('error');
          },
          onclose: (e: CloseEvent) => {
            console.log('🔌 Gemini Live API connection closed:', e.reason);
            if (this.state !== 'idle') {
              this.setState('error');
              this.onError?.(new Error('Connection closed unexpectedly: ' + e.reason));
            }
          },
        },
        config
      });

      console.log('📡 Session created successfully');
      
    } catch (error) {
      console.error('❌ Failed to connect to Gemini:', error);
      this.onError?.(new Error('Failed to connect to Gemini: ' + (error as Error).message));
      this.setState('error');
      throw error;
    }
  }

  // Handle incoming messages from Gemini
  private handleIncomingMessage(message: LiveServerMessage) {
    console.log('📨 Received message from Gemini:', message);
    
    try {
      // Handle server content (text and audio responses)
      if (message.serverContent?.modelTurn?.parts) {
        const parts = message.serverContent.modelTurn.parts;
        
        // Transition to speaking when we start receiving AI response
        if (this.state === 'listening') {
          console.log('🎤➡️🗣️ AI started responding');
          this.setState('speaking');
        }
        
        for (const part of parts) {
          if (part.text) {
            console.log('📝 Gemini text response:', part.text);
            this.onResponse?.(part.text);
          }

          if (part.inlineData && part.inlineData.data) {
            console.log('🎵 Gemini audio response received - accumulating');
            this.handleAudioResponse(part.inlineData);
          }
        }
      }

      // Handle generation complete - this means all content has been generated
      if (message.serverContent?.generationComplete) {
        console.log('✅ Generation complete - checking if we have audio to play');
        if (this.accumulatedAudioData.length > 0) {
          console.log(`🔊 Playing accumulated audio: ${this.accumulatedAudioData.length} samples`);
          this.playAccumulatedAudio();
        } else {
          console.log('🔇 No audio accumulated, transitioning back to listening');
          this.setState('listening');
        }
      }

      // Handle turn completion - this indicates the AI finished its response
      if (message.serverContent?.turnComplete) {
        console.log('🏁 Turn complete, AI finished speaking');
        // Only play if we haven't started playing already and have audio
        if (!this.isPlayingAudio && this.accumulatedAudioData.length > 0) {
          console.log('🔊 Turn complete - playing remaining audio');
          this.playAccumulatedAudio();
        } else if (this.accumulatedAudioData.length === 0) {
          console.log('🔇 Turn complete - no audio to play, back to listening');
          this.setState('listening');
        }
      }

      // Handle interruptions
      if (message.serverContent?.interrupted) {
        console.log('⚠️ Response was interrupted');
        this.stopCurrentAudio();
        this.setState('listening');
      }

      // Handle input transcriptions
      if (message.serverContent?.inputTranscription?.text) {
        console.log('🎤 User speech:', message.serverContent.inputTranscription.text);
        this.onTranscript?.(message.serverContent.inputTranscription.text);
      }

    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  // Start message processing loop
  private startMessageProcessing() {
    if (this.isProcessingMessages) return;
    
    this.isProcessingMessages = true;
    console.log('🔄 Started message processing');
  }

  // Handle audio response from Gemini
  private handleAudioResponse(inlineData: any) {
    try {
      if (inlineData.data) {
        this.accumulateAudioChunk(inlineData.data, inlineData.mimeType || 'audio/pcm;rate=24000');
      }
    } catch (error) {
      console.error('❌ Error handling audio response:', error);
    }
  }

  // Accumulate audio chunk data
  private accumulateAudioChunk(rawData: string, mimeType: string): void {
    try {
      if (!rawData || rawData.length === 0) {
        console.log('⚠️ Empty audio data received, skipping');
        return;
      }
      
      const binaryString = atob(rawData);
      if (binaryString.length === 0) {
        console.log('⚠️ Empty binary string after base64 decode, skipping');
        return;
      }
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Ensure we have valid PCM data (should be even number of bytes for 16-bit)
      if (bytes.length % 2 !== 0) {
        console.log('⚠️ Invalid PCM data length (not even), padding with zero');
        const paddedBytes = new Uint8Array(bytes.length + 1);
        paddedBytes.set(bytes);
        paddedBytes[bytes.length] = 0;
        // Use the padded bytes for further processing
        const newPcmData = new Int16Array(paddedBytes.buffer);
        
        if (newPcmData.length === 0) {
          console.log('⚠️ No PCM samples generated, skipping');
          return;
        }
        
        const combinedLength = this.accumulatedAudioData.length + newPcmData.length;
        const combined = new Int16Array(combinedLength);
        combined.set(this.accumulatedAudioData, 0);
        combined.set(newPcmData, this.accumulatedAudioData.length);
        
        this.accumulatedAudioData = combined;
        
        console.log(`🎵 Accumulated audio (padded): ${newPcmData.length} samples, total: ${this.accumulatedAudioData.length}`);
        return;
      }

      const newPcmData = new Int16Array(bytes.buffer);
      
      if (newPcmData.length === 0) {
        console.log('⚠️ No PCM samples generated, skipping');
        return;
      }
      
      const combinedLength = this.accumulatedAudioData.length + newPcmData.length;
      const combined = new Int16Array(combinedLength);
      combined.set(this.accumulatedAudioData, 0);
      combined.set(newPcmData, this.accumulatedAudioData.length);
      
      this.accumulatedAudioData = combined;
      
      console.log(`🎵 Accumulated audio: ${newPcmData.length} samples, total: ${this.accumulatedAudioData.length}`);
      
    } catch (error) {
      console.error('❌ Error accumulating audio:', error);
      console.log('🔍 Audio chunk info:', {
        rawDataLength: rawData?.length || 0,
        mimeType,
        currentAccumulatedLength: this.accumulatedAudioData.length
      });
    }
  }

  // Play accumulated audio
  private async playAccumulatedAudio(): Promise<void> {
    if (!this.audioPlayer || this.accumulatedAudioData.length === 0) {
      // No audio to play, transition back to listening
      console.log('🔇 No audio data to play, transitioning back to listening');
      this.setState('listening');
      return;
    }
    
    try {
      console.log(`🔊 Playing accumulated audio: ${this.accumulatedAudioData.length} samples`);
      
      // Ensure audio player context is running
      if (this.audioPlayer.state === 'suspended') {
        console.log('🎵 Resuming suspended audio player context');
        await this.audioPlayer.resume();
      }
      
      // Store reference to audio data before clearing current playback
      const audioDataToPlay = this.accumulatedAudioData;
      
      // Stop any currently playing audio (but don't clear the data we want to play)
      if (this.currentAudioSource) {
        this.currentAudioSource.stop();
        this.currentAudioSource = null;
      }
      this.isPlayingAudio = false;
      
      // Validate audio data before creating buffer
      if (audioDataToPlay.length === 0) {
        console.log('⚠️ Audio data is empty after validation, skipping playback');
        this.setState('listening');
        return;
      }
      
      const sampleRate = this.RECEIVE_SAMPLE_RATE;
      const numChannels = 1;
      
      // Ensure we have valid audio data length
      const audioDataLength = audioDataToPlay.length;
      if (audioDataLength <= 0) {
        console.log('⚠️ Invalid audio data length:', audioDataLength);
        this.setState('listening');
        return;
      }
      
      console.log(`🎵 Creating audio buffer: ${audioDataLength} samples at ${sampleRate}Hz`);
      console.log(`🎵 Audio player state: ${this.audioPlayer.state}`);
      
      const audioBuffer = this.audioPlayer.createBuffer(numChannels, audioDataLength, sampleRate);
      
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < audioDataLength; i++) {
        channelData[i] = audioDataToPlay[i] / 32768;
      }
      
      const source = this.audioPlayer.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create a gain node for volume control
      const gainNode = this.audioPlayer.createGain();
      gainNode.gain.value = 1.0; // Full volume
      source.connect(gainNode);
      gainNode.connect(this.audioPlayer.destination);
      
      this.currentAudioSource = source;
      this.isPlayingAudio = true;
      this.setState('speaking');
      
      // Clear the accumulated data only after successfully setting up playback
      this.accumulatedAudioData = new Int16Array(0);
      
      source.onended = () => {
        console.log('🔊 Audio playback completed');
        this.isPlayingAudio = false;
        this.currentAudioSource = null;
        this.setState('listening');
      };
      
      source.start();
      console.log('🔊 Audio playback started successfully');
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      console.log('🔍 Audio data info:', {
        length: this.accumulatedAudioData.length,
        sampleRate: this.RECEIVE_SAMPLE_RATE,
        audioPlayerState: this.audioPlayer?.state,
        audioPlayerSampleRate: this.audioPlayer?.sampleRate
      });
      
      // Clear the problematic audio data and transition back to listening
      this.accumulatedAudioData = new Int16Array(0);
      this.isPlayingAudio = false;
      this.setState('listening');
    }
  }

  // Stop current audio playback
  private stopCurrentAudio(clearAccumulated: boolean = true) {
    if (this.currentAudioSource) {
      this.currentAudioSource.stop();
      this.currentAudioSource = null;
    }
    this.isPlayingAudio = false;
    if (clearAccumulated) {
      this.accumulatedAudioData = new Int16Array(0);
    }
  }

  // Send audio data to Gemini
  private sendAudioToGemini(audioData: ArrayBuffer) {
    if (!this.session || !this.isRunning) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAudioSent < this.AUDIO_SEND_INTERVAL) {
      return;
    }
    this.lastAudioSent = now;

    try {
      const base64Audio = this.arrayBufferToBase64(audioData);
      
      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: `audio/pcm;rate=${this.SEND_SAMPLE_RATE}`
        }
      });
      
      // Don't log every audio send to reduce console spam
      
    } catch (error) {
      console.error('❌ Error sending audio:', error);
      if (error instanceof Error && error.message.includes('CLOSING or CLOSED')) {
        this.isRunning = false;
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

  // Ensure audio contexts are ready for playback
  private async ensureAudioContextsReady(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('✅ Input audio context resumed');
      } catch (error) {
        console.warn('⚠️ Failed to resume input audio context:', error);
      }
    }

    if (this.audioPlayer && this.audioPlayer.state === 'suspended') {
      try {
        await this.audioPlayer.resume();
        console.log('✅ Output audio context resumed');
      } catch (error) {
        console.warn('⚠️ Failed to resume output audio context:', error);
      }
    }
  }

  // Start conversation
  async startConversation(): Promise<void> {
    try {
      console.log('🚀 Starting conversation...');
      
      let audioInitialized = false;
      try {
        await this.initializeAudio();
        audioInitialized = true;
        console.log('✅ Audio initialization successful');
      } catch (audioError) {
        console.error('❌ Audio initialization failed:', audioError);
      }
      
      await this.connectToGemini();
      
      // Ensure audio contexts are ready after user interaction
      if (audioInitialized) {
        await this.ensureAudioContextsReady();
      }
      
      this.isRunning = true;
      
      if (audioInitialized) {
        this.setState('listening');
        
        if (this.audioWorkletNode) {
          console.log('🎤 Starting audio worklet...');
          this.audioWorkletNode.port.postMessage({ type: 'start' });
          
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log('✅ Audio worklet started');
        } else {
          console.error('❌ Audio worklet node not available');
          this.setState('connected');
        }
      } else {
        this.setState('connected');
        console.log('⚠️ Conversation started in text-only mode');
      }
      
      console.log('✅ Conversation started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start conversation:', error);
      this.onError?.(new Error('Failed to start conversation: ' + (error as Error).message));
      this.setState('error');
    }
  }

  // Stop conversation
  stopConversation(): void {
    try {
      console.log('🛑 Stopping conversation...');
      this.isRunning = false;
      this.isProcessingMessages = false;

      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
      }

      if (this.session) {
        this.session.close();
        this.session = null;
      }

      this.cleanupAudio();
      this.setState('idle');
      console.log('✅ Conversation stopped successfully');
      
    } catch (error) {
      console.error('❌ Failed to stop conversation:', error);
      this.onError?.(new Error('Failed to stop conversation: ' + (error as Error).message));
    }
  }

  // Clean up audio resources
  private cleanupAudio(): void {
    this.stopCurrentAudio();

    if (this.visualizationFrame) {
      cancelAnimationFrame(this.visualizationFrame);
      this.visualizationFrame = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

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
  }

  // Get current state
  getState(): LiveChatState {
    return this.state;
  }

  // Check if audio features are available
  isAudioAvailable(): boolean {
    return !!(this.audioContext && this.audioWorkletNode && this.mediaStream);
  }

  // Check microphone availability
  static async checkMicrophoneAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      if (!window.isSecureContext) {
        return {
          available: false,
          error: 'Microphone access requires a secure context (HTTPS)'
        };
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          available: false,
          error: 'Media devices API not available'
        };
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        return {
          available: false,
          error: 'AudioContext not supported'
        };
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Dispose resources
  dispose(): void {
    this.stopConversation();
  }
} 
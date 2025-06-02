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
  
  // Advanced real-time audio streaming with seamless buffering
  private audioQueue: Int16Array[] = [];
  private isPlayingAudio = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private nextPlayTime = 0;
  private audioChunkDuration = 0.05; // 50ms chunks for ultra-low latency
  private isFirstChunk = true;
  
  // Seamless audio concatenation system
  private accumulatedAudioData: Int16Array[] = [];
  private minimumBufferSize = 1200; // 50ms at 24kHz for smooth streaming
  private isBuffering = true;
  private playbackStarted = false;
  
  // Audio timing optimization
  private audioStartTime = 0;
  private totalAudioDuration = 0;
  private scheduledEndTime = 0;
  
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
          // Reset playback state for new response
          this.resetPlaybackState();
        }
        
        for (const part of parts) {
          if (part.text) {
            console.log('📝 Gemini text response:', part.text);
            this.onResponse?.(part.text);
          }

          if (part.inlineData && part.inlineData.data) {
            console.log('🎵 Gemini audio response received - processing for seamless playback');
            this.handleAudioResponse(part.inlineData);
          }
        }
      }

      // Handle generation complete
      if (message.serverContent?.generationComplete) {
        console.log('✅ Generation complete - letting remaining audio finish');
        // Don't reset here, let audio finish naturally
      }

      // Handle turn completion
      if (message.serverContent?.turnComplete) {
        console.log('🏁 Turn complete - audio should finish naturally');
        // Mark that no more audio is coming
        setTimeout(() => {
          if (this.accumulatedAudioData.length === 0 && this.playbackStarted) {
            this.checkPlaybackCompletion();
          }
        }, 100);
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

  // Handle audio response from Gemini with new buffering system
  private handleAudioResponse(inlineData: any) {
    try {
      if (inlineData.data) {
        this.accumulateAudioChunk(inlineData.data, inlineData.mimeType || 'audio/pcm;rate=24000');
      }
    } catch (error) {
      console.error('❌ Error handling audio response:', error);
    }
  }

  // Accumulate audio chunk data with advanced buffering
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
        
        const newPcmData = new Int16Array(paddedBytes.buffer);
        this.processNewAudioChunk(newPcmData);
        
      } else {
        const newPcmData = new Int16Array(bytes.buffer);
        this.processNewAudioChunk(newPcmData);
      }
      
    } catch (error) {
      console.error('❌ Error accumulating audio:', error);
    }
  }

  // Process new audio chunk with intelligent buffering
  private processNewAudioChunk(audioData: Int16Array): void {
    if (audioData.length === 0) {
      console.log('⚠️ No PCM samples generated, skipping');
      return;
    }

    // Add to accumulated buffer
    this.accumulatedAudioData.push(audioData);
    
    const totalSamples = this.accumulatedAudioData.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`🎵 Accumulated ${audioData.length} samples, total: ${totalSamples}`);

    // If we're still buffering, check if we have enough data to start
    if (this.isBuffering) {
      if (totalSamples >= this.minimumBufferSize || this.accumulatedAudioData.length >= 3) {
        console.log('🎵 Buffer ready, starting seamless playback');
        this.isBuffering = false;
        this.startSeamlessPlayback();
      }
    } else {
      // Continue feeding the playback system
      this.feedPlaybackSystem();
    }
  }

  // Start seamless playback with optimal buffering
  private async startSeamlessPlayback(): Promise<void> {
    if (!this.audioPlayer || this.accumulatedAudioData.length === 0 || this.playbackStarted) {
      return;
    }

    try {
      // Ensure audio player context is running
      if (this.audioPlayer.state === 'suspended') {
        console.log('🎵 Resuming suspended audio player context');
        await this.audioPlayer.resume();
      }

      this.playbackStarted = true;
      this.isPlayingAudio = true;
      this.setState('speaking');
      
      // Start with current time plus minimal delay
      this.audioStartTime = this.audioPlayer.currentTime + 0.002; // 2ms minimal delay
      this.nextPlayTime = this.audioStartTime;
      this.totalAudioDuration = 0;

      console.log('🎵 Starting seamless audio playback');
      
      // Start playing chunks immediately
      this.playNextSeamlessChunk();
      
    } catch (error) {
      console.error('❌ Error starting seamless playback:', error);
      this.resetPlaybackState();
    }
  }

  // Play next chunk in seamless manner
  private async playNextSeamlessChunk(): Promise<void> {
    if (!this.audioPlayer || !this.playbackStarted) {
      return;
    }

    // Get the next chunk to play
    const audioChunk = this.getNextOptimalChunk();
    if (!audioChunk) {
      // No more chunks available, wait for more or finish
      this.scheduleNextChunkCheck();
      return;
    }

    try {
      const sampleRate = this.RECEIVE_SAMPLE_RATE;
      const audioBuffer = this.audioPlayer.createBuffer(1, audioChunk.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert Int16 to Float32 with optimal precision
      for (let i = 0; i < audioChunk.length; i++) {
        channelData[i] = audioChunk[i] / 32768;
      }

      const source = this.audioPlayer.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create gain node for volume control
      const gainNode = this.audioPlayer.createGain();
      gainNode.gain.value = 1.0;
      source.connect(gainNode);
      gainNode.connect(this.audioPlayer.destination);

      // Calculate precise timing for seamless concatenation
      const chunkDuration = audioChunk.length / sampleRate;
      const startTime = this.nextPlayTime;
      
      // Update timing for next chunk
      this.nextPlayTime = startTime + chunkDuration;
      this.totalAudioDuration += chunkDuration;
      this.scheduledEndTime = this.nextPlayTime;

      // Set up completion handler
      source.onended = () => {
        this.currentAudioSource = null;
        // Immediately try to play next chunk
        this.playNextSeamlessChunk();
      };

      this.currentAudioSource = source;
      source.start(startTime);
      
      console.log(`🔊 Seamless chunk: ${audioChunk.length} samples, duration: ${chunkDuration.toFixed(3)}s, start: ${startTime.toFixed(3)}`);
      
    } catch (error) {
      console.error('❌ Error playing seamless chunk:', error);
      this.playNextSeamlessChunk(); // Try to continue
    }
  }

  // Get next optimal chunk for playback
  private getNextOptimalChunk(): Int16Array | null {
    if (this.accumulatedAudioData.length === 0) {
      return null;
    }

    // For optimal streaming, prefer smaller chunks that arrive first
    const chunk = this.accumulatedAudioData.shift();
    return chunk || null;
  }

  // Schedule check for next chunk
  private scheduleNextChunkCheck(): void {
    if (!this.playbackStarted) return;

    // Wait a very short time for more chunks
    setTimeout(() => {
      if (this.accumulatedAudioData.length > 0) {
        this.playNextSeamlessChunk();
      } else {
        // Check if we should finish playback
        this.checkPlaybackCompletion();
      }
    }, 10); // Very short 10ms check interval
  }

  // Check if playback should be completed
  private checkPlaybackCompletion(): void {
    if (!this.audioPlayer || !this.playbackStarted) return;

    const currentTime = this.audioPlayer.currentTime;
    const timeSinceLastChunk = currentTime - this.scheduledEndTime;

    // If we haven't received chunks for a reasonable time, transition to listening
    if (timeSinceLastChunk > 0.1 && this.accumulatedAudioData.length === 0) {
      console.log('🔇 No more audio chunks, completing playback');
      this.resetPlaybackState();
      this.setState('listening');
    } else if (this.accumulatedAudioData.length > 0) {
      // More chunks arrived, continue playing
      this.playNextSeamlessChunk();
    } else {
      // Wait a bit more
      this.scheduleNextChunkCheck();
    }
  }

  // Feed the playback system with new chunks
  private feedPlaybackSystem(): void {
    if (!this.playbackStarted && !this.isBuffering) {
      this.startSeamlessPlayback();
    }
  }

  // Reset playback state
  private resetPlaybackState(): void {
    this.isFirstChunk = true;
    this.nextPlayTime = 0;
    this.playbackStarted = false;
    this.isBuffering = true;
    this.accumulatedAudioData = [];
    this.audioStartTime = 0;
    this.totalAudioDuration = 0;
    this.scheduledEndTime = 0;
    this.isPlayingAudio = false;
  }

  // Legacy method - redirect to new system
  private async playNextAudioChunk(): Promise<void> {
    // This method is kept for compatibility but redirects to new system
    if (!this.playbackStarted) {
      this.startSeamlessPlayback();
    }
  }

  // Stop current audio playback
  private stopCurrentAudio(clearQueue: boolean = true) {
    if (this.currentAudioSource) {
      this.currentAudioSource.stop();
      this.currentAudioSource = null;
    }
    
    if (clearQueue) {
      this.audioQueue = [];
    }
    
    this.resetPlaybackState();
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
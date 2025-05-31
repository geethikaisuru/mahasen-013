import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GlossyCircleProps {
  className?: string;
  isExpanded?: boolean;
  voiceState?: 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';
  audioVolume?: number;
  speakingVolume?: number;
  onClick?: () => void;
}

export const GlossyCircle: React.FC<GlossyCircleProps> = ({ 
  className = '', 
  isExpanded = false, 
  voiceState = 'idle',
  audioVolume = 0,
  speakingVolume = 0,
  onClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const circleRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Add state for CSS transform scaling
  const [circleScale, setCircleScale] = useState(1);
  const currentScaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  
  const size = isExpanded ? 40 : 120; // Size reduced by 3x when expanded
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous renderer if it exists
    if (rendererRef.current) {
      if (containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Setup camera
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 1.2;
    
    // Setup renderer with alpha and antialias
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true 
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);
    
    // Create circle geometry
    const geometry = new THREE.CircleGeometry(1, 64);
    
    // Create shader material with dynamic colors based on voice state
    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(size, size) },
        voiceState: { value: 0 }, // 0: idle, 1: listening, 2: connecting, 3: connected, 4: speaking, 5: error
        audioVolume: { value: 0 },
        speakingVolume: { value: 0 }, // Add speakingVolume uniform
        scale: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;
        uniform float voiceState;
        uniform float audioVolume;
        uniform float speakingVolume;
        uniform float scale;
        varying vec2 vUv;
        
        void main() {
          vec2 fragCoord = vUv * iResolution;
          float mr = min(iResolution.x, iResolution.y);
          vec2 uv = (fragCoord * 2.0 - iResolution) / mr;
          
          // Apply scale based on audio volume
          uv /= scale;
          
          float d = -iTime * 0.5;
          float a = 0.0;
          for (float i = 0.0; i < 8.0; ++i) {
            a += cos(i - d - a * uv.x);
            d += sin(uv.y * i + a);
          }
          d += iTime * 0.5;
          
          // Base colors
          vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
          col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
          
          // State-based color modifications
          if (voiceState == 1.0) {
            // Listening - greenish color with pulse
            vec3 greenTint = vec3(0.3, 1.0, 0.4);
            float pulse = sin(iTime * 3.0) * 0.3 + 0.7;
            col = mix(col, greenTint, 0.6 * pulse);
          } else if (voiceState == 2.0) {
            // Connecting - yellow/orange color
            vec3 connectingTint = vec3(1.0, 0.8, 0.2);
            col = mix(col, connectingTint, 0.5);
          } else if (voiceState == 3.0) {
            // Connected - blue color
            vec3 connectedTint = vec3(0.3, 0.5, 1.0);
            col = mix(col, connectedTint, 0.5);
          } else if (voiceState == 4.0) {
            // Speaking - enhanced default with speech activity detection
            // Only pulse when there's actual speech audio (speakingVolume > threshold)
            float speechThreshold = 0.05;
            if (speakingVolume > speechThreshold) {
              float speakingPulse = sin(iTime * 8.0 + speakingVolume * 15.0) * 0.5 + 0.8;
              col *= speakingPulse;
            } else {
              // Fade to normal when no speech detected
              col *= 0.7;
            }
          } else if (voiceState == 5.0) {
            // Error - red color
            vec3 errorTint = vec3(1.0, 0.3, 0.3);
            col = mix(col, errorTint, 0.5);
          }
          
          // Add inner glow with enhanced intensity based on state
          float dist = length(uv);
          float glowIntensity = voiceState == 1.0 ? 1.0 : 0.75;
          float glow = smoothstep(0.75, 1.0, dist);
          vec3 glowColor = voiceState == 1.0 ? vec3(0.4, 1.0, 0.5) : vec3(0.5, 0.8, 1.0);
          col = mix(col, col + glowColor, glow * glowIntensity);
          
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: true
    });
    
    materialRef.current = material;
    
    // Create mesh from geometry and material
    const circle = new THREE.Mesh(geometry, material);
    circleRef.current = circle;
    scene.add(circle);
    
    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (material.uniforms) {
        material.uniforms.iTime.value += 0.01;
        
        // Update voice state uniform
        let stateValue = 0;
        switch (voiceState) {
          case 'listening': stateValue = 1; break;
          case 'connecting': stateValue = 2; break;
          case 'connected': stateValue = 3; break;
          case 'speaking': stateValue = 4; break;
          case 'error': stateValue = 5; break;
          default: stateValue = 0;
        }
        material.uniforms.voiceState.value = stateValue;
        
        // Update audio volume uniforms
        material.uniforms.audioVolume.value = audioVolume;
        material.uniforms.speakingVolume.value = speakingVolume;
        
        // Calculate scale based on voice state and appropriate volume
        let targetScale = 1.0;
        if (voiceState === 'listening') {
          targetScale = 1.0 + audioVolume * 0.3; // Scale up based on input volume
        } else if (voiceState === 'speaking') {
          // Use speakingVolume for speech-responsive scaling
          const speechThreshold = 0.05;
          if (speakingVolume > speechThreshold) {
            targetScale = 1.0 + speakingVolume * 0.8; // More dramatic scaling for actual speech
          } else {
            targetScale = 1.0; // Normal size during pauses
          }
        } else if (voiceState === 'connecting') {
          targetScale = 1.1; // Slightly larger when connecting
        }
        
        // Update target scale reference
        targetScaleRef.current = targetScale;
        
        // Smooth interpolation for CSS transform scale
        const currentScale = currentScaleRef.current;
        const newScale = currentScale + (targetScale - currentScale) * 0.15;
        currentScaleRef.current = newScale;
        setCircleScale(newScale);
        
        // Keep shader scale at 1.0 since we're now using CSS transforms
        material.uniforms.scale.value = 1.0;
        
        // Remove continuous position animation - only add subtle base movement
        circle.position.y = Math.sin(Date.now() * 0.0005) * 0.02;
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (!renderer || !material.uniforms) return;
      renderer.setSize(size, size);
      material.uniforms.iResolution.value = new THREE.Vector2(size, size);
    };

    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      window.removeEventListener('resize', handleResize);
      
      // Properly dispose of Three.js resources
      if (geometry) geometry.dispose();
      if (material) material.dispose();
      
      // Clean up scene
      if (scene) {
        scene.clear();
      }
      
      // Remove DOM element safely
      if (renderer && containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      // Dispose renderer
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [size, voiceState, audioVolume, speakingVolume]); // Added voiceState, audioVolume, and speakingVolume as dependencies
  
  // Get status text based on voice state
  const getStatusText = () => {
    switch (voiceState) {
      case 'listening': return 'Listening...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Error';
      default: return 'Talk to Mahasen';
    }
  };

  // Get text color based on voice state
  const getTextColor = () => {
    switch (voiceState) {
      case 'listening': return 'from-green-400 to-emerald-300';
      case 'connecting': return 'from-yellow-400 to-orange-300';
      case 'connected': return 'from-blue-400 to-cyan-300';
      case 'speaking': return 'from-purple-400 to-pink-300';
      case 'error': return 'from-red-400 to-rose-300';
      default: return 'from-blue-400 to-cyan-300';
    }
  };
  
  return (
    <div 
      className={`group flex flex-col items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div 
        ref={containerRef}
        className={`rounded-full overflow-hidden transition-all duration-200 ease-out ${
          isHovered ? 'transform -translate-y-2' : ''
        }`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter: `drop-shadow(0 0 20px rgba(100, 200, 255, ${voiceState === 'listening' ? '0.6' : '0.3'}))`,
          willChange: 'transform',
          transform: `scale(${circleScale}) ${isHovered ? 'translateY(-8px)' : ''}`,
        }}
      />
      <div 
        className={`mt-2 font-montserrat font-bold text-lg bg-gradient-to-r ${getTextColor()} bg-clip-text text-transparent transition-all duration-300 ease-out ${
          isHovered || voiceState !== 'idle'
            ? 'opacity-100 transform translate-y-0' 
            : 'opacity-0 transform -translate-y-4'
        }`}
      >
        <strong>{getStatusText()}</strong>
      </div>
    </div>
  );
}; 
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GlossyCircleProps {
  className?: string;
  isExpanded?: boolean;
}

export const GlossyCircle: React.FC<GlossyCircleProps> = ({ className = '', isExpanded = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const size = isExpanded ? 40 : 120; // Size reduced by 3x when expanded
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    
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
    containerRef.current.appendChild(renderer.domElement);
    
    // Create circle geometry
    const geometry = new THREE.CircleGeometry(1, 64);
    
    // Create shader material with glossy gradient and enhanced inner glow
    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(size, size) }
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
        varying vec2 vUv;
        
        void main() {
          vec2 fragCoord = vUv * iResolution;
          float mr = min(iResolution.x, iResolution.y);
          vec2 uv = (fragCoord * 2.0 - iResolution) / mr;
          
          float d = -iTime * 0.5;
          float a = 0.0;
          for (float i = 0.0; i < 8.0; ++i) {
            a += cos(i - d - a * uv.x);
            d += sin(uv.y * i + a);
          }
          d += iTime * 0.5;
          vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
          col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
          
          // Add inner glow with 50% more intensity
          float dist = length(uv);
          float glow = smoothstep(0.75, 1.0, dist);
          vec3 glowColor = vec3(0.5, 0.8, 1.0);
          col = mix(col, col + glowColor, glow * 0.75);
          
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: true
    });
    
    // Create mesh from geometry and material
    const circle = new THREE.Mesh(geometry, material);
    scene.add(circle);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      material.uniforms.iTime.value += 0.01;
      circle.position.y = Math.sin(Date.now() * 0.001) * 0.05;
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      const { current } = containerRef;
      if (!current) return;
      renderer.setSize(size, size);
      material.uniforms.iResolution.value = new THREE.Vector2(size, size);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
    };
  }, [size]); // Added size as dependency
  
  return (
    <div 
      className={`group flex flex-col items-center ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        ref={containerRef}
        className={`rounded-full overflow-hidden transition-all duration-300 ease-out ${
          isHovered ? 'transform -translate-y-2' : ''
        }`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter: 'drop-shadow(0 0 20px rgba(100, 200, 255, 0.3))',
          willChange: 'transform'
        }}
      />
      <div 
        className={`mt-2 font-montserrat font-bold text-lg bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent transition-all duration-300 ease-out ${
          isHovered 
            ? 'opacity-100 transform translate-y-0' 
            : 'opacity-0 transform -translate-y-4'
        }`}
      >
        <strong>Talk to GAIA</strong>
      </div>
    </div>
  );
}; 
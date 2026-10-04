import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Disc, RotateCw, Eye } from 'lucide-react';

export const FlightCore3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const coreGroupRef = useRef<THREE.Group | null>(null);
  const wireframeMeshes = useRef<THREE.Mesh[]>([]);
  const targetRotation = useRef({ x: 0.1, y: -0.4 });
  const currentRotation = useRef({ x: 0.1, y: -0.4 });
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 2, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);

    // 2. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(10, 15, 10);
    scene.add(keyLight);

    const rimLightBlue = new THREE.DirectionalLight(0x06b6d4, 3);
    rimLightBlue.position.set(-10, -5, -8);
    scene.add(rimLightBlue);

    // Glowing Amber Pointlight from the REC LED
    const recLight = new THREE.PointLight(0xf59e0b, 5, 15);
    recLight.position.set(1.5, 0.5, 2.5);
    scene.add(recLight);

    // 3. Central Hardware Flight Unit Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);
    coreGroupRef.current = coreGroup;

    // A. Main Titanium Chassis
    const chassisGeo = new THREE.BoxGeometry(6, 4, 4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x12141a,
      metalness: 0.85,
      roughness: 0.25,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    coreGroup.add(chassis);
    wireframeMeshes.current.push(chassis);

    // B. Bezel Faceplate (Front Panel)
    const faceGeo = new THREE.BoxGeometry(5.6, 3.6, 0.3);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x090a0f,
      metalness: 0.9,
      roughness: 0.15,
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0, 2.05);
    coreGroup.add(face);
    wireframeMeshes.current.push(face);

    // C. Glowing Amber REC Status Diode
    const diodeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16);
    const diodeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });
    const diode = new THREE.Mesh(diodeGeo, diodeMat);
    diode.rotation.x = Math.PI / 2;
    diode.position.set(1.5, 0.5, 2.2);
    coreGroup.add(diode);

    // D. Gold Plated Fiber / Coaxial Connectors
    const connectorMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.95,
      roughness: 0.1,
    });

    const conn1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16), connectorMat);
    conn1.rotation.x = Math.PI / 2;
    conn1.position.set(2.0, -0.6, 2.3);
    coreGroup.add(conn1);

    const conn2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16), connectorMat);
    conn2.rotation.x = Math.PI / 2;
    conn2.position.set(2.0, -1.4, 2.3);
    coreGroup.add(conn2);

    // E. Heat Sinks on Sides
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      metalness: 0.7,
      roughness: 0.4,
    });
    for (let i = -1.2; i <= 1.2; i += 0.4) {
      const finLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 0.1), finMat);
      finLeft.position.set(-3.05, 0, i);
      coreGroup.add(finLeft);

      const finRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 0.1), finMat);
      finRight.position.set(3.05, 0, i);
      coreGroup.add(finRight);
    }

    // 4. Orbiting Holographic Rings & Data Coordinate Brackets
    const ringGeo = new THREE.TorusGeometry(5.0, 0.02, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.5;
    scene.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.015, 16, 100), new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.25,
    }));
    ring2.rotation.y = Math.PI / 3;
    scene.add(ring2);

    // 5. Interactive Drag & Mouse Orbit
    const handlePointerDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;
        targetRotation.current.y += deltaX * 0.008;
        targetRotation.current.x += deltaY * 0.008;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      } else {
        // Subtle mouse parallax
        const rect = renderer.domElement.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width - 0.5;
        const normY = (e.clientY - rect.top) / rect.height - 0.5;
        if (normX >= -0.5 && normX <= 0.5 && normY >= -0.5 && normY <= 0.5) {
          targetRotation.current.y = -0.4 + normX * 0.6;
          targetRotation.current.x = 0.1 + normY * 0.4;
        }
      }
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // 6. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous rotation if enabled
      if (isRotating && !isDragging.current) {
        targetRotation.current.y += 0.002;
      }

      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * 0.06;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.06;

      coreGroup.rotation.x = currentRotation.current.x;
      coreGroup.rotation.y = currentRotation.current.y;

      // Pulse amber diode and light
      const pulse = 3 + Math.sin(elapsedTime * 6) * 1.5;
      recLight.intensity = pulse;
      diodeMat.emissiveIntensity = pulse * 0.8;

      // Rotate orbital rings
      ring1.rotation.z = elapsedTime * 0.15;
      ring2.rotation.x = elapsedTime * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isRotating]);

  const toggleWireframe = () => {
    setWireframeMode(!wireframeMode);
    wireframeMeshes.current.forEach((m) => {
      if (m.material instanceof THREE.MeshStandardMaterial) {
        m.material.wireframe = !wireframeMode;
      }
    });
  };

  return (
    <div className="relative w-full max-w-3xl aspect-[16/10] rounded-3xl overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.9)] border border-white/10 group mb-16 apple-glass-card">
      {/* 3D Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
      />

      {/* Floating Badges */}
      <div className="absolute top-5 left-5 flex items-center gap-2.5 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-[11px] font-mono text-zinc-300 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
        <span>Black Box Flight Recorder • 3D Hardware Model</span>
      </div>

      <div className="absolute bottom-5 right-5 flex items-center gap-3 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-[11px] font-mono text-zinc-400 pointer-events-none">
        <span>Latency: &lt; 0.2ms</span>
        <span className="text-zinc-600">•</span>
        <span className="text-emerald-400 font-semibold">Replay Cost: $0.00</span>
      </div>

      {/* Control Actions */}
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <button
          onClick={toggleWireframe}
          className={`p-2 rounded-xl border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
            wireframeMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-black/80 text-zinc-400 hover:text-white border-white/10'
          }`}
          title="Toggle Wireframe View"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Wireframe</span>
        </button>

        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`p-2 rounded-xl border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
            isRotating
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-black/80 text-zinc-400 hover:text-white border-white/10'
          }`}
          title="Toggle Auto Rotation"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Spin</span>
        </button>
      </div>

      {/* Drag instruction overlay */}
      <div className="absolute bottom-5 left-5 text-[10px] font-mono text-zinc-500 pointer-events-none hidden sm:block">
        DRAG TO ROTATE 360° • REAL-TIME HARDWARE SHADER
      </div>
    </div>
  );
};

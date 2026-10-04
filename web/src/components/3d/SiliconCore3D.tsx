import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';

interface SiliconCore3DProps {
  activeLayerName: string;
}

export const SiliconCore3D: React.FC<SiliconCore3DProps> = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);

  // References to steady core lighting & materials (consistent luxury gold colorway, no distracting color flashing)
  const coreLightRef = useRef<THREE.PointLight | null>(null);
  const dieMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 550;
    let height = mount.clientHeight || 550;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000);
    camera.position.set(0, 9.5, 14.0);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15; // Soft, natural, non-glaring exposure
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // 2. Balanced Matte Studio Lighting (Prevents blinding glare and washed out corners)
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x0b0e17, 1.8);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    // Gentle Overhead Diffused Softbox
    const topSoftbox = new THREE.DirectionalLight(0xfffbeb, 1.8);
    topSoftbox.position.set(0, 18, 6);
    scene.add(topSoftbox);

    // Soft Beauty Fill
    const frontFill = new THREE.DirectionalLight(0xf8fafc, 1.4);
    frontFill.position.set(-6, 12, 12);
    scene.add(frontFill);

    const goldRim = new THREE.DirectionalLight(0xf59e0b, 2.2);
    goldRim.position.set(12, 6, -8);
    scene.add(goldRim);

    // Warm Steady Core Point Light Illuminating Silicon Circuitry
    const coreLight = new THREE.PointLight(0xf59e0b, 2.5, 14);
    coreLight.position.set(0, 1.4, 0);
    scene.add(coreLight);
    coreLightRef.current = coreLight;

    const chipGroup = new THREE.Group();
    scene.add(chipGroup);

    // 3. Materials
    // Matte Obsidian Ceramic Substrate (Deep velvety matte ceramic, 100% glare-free)
    const substrateMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f16,
      metalness: 0.05,
      roughness: 0.90,
    });

    // Warm 24K Gold for Bonding Wires & Land Grid Array Contacts
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.20,
    });

    // Dark Brushed Titanium Die Frame / Package Ring
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      metalness: 0.70,
      roughness: 0.40,
    });

    // Ceramic SMD Capacitor Body & Solder Ends
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });
    const solderMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.96, roughness: 0.08 });

    // A. Main Multilayer PCB Carrier Package (Substrate)
    const substrate = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.38, 8.6), substrateMat);
    chipGroup.add(substrate);

    // Gold Edge Contact Notches (LGA Perimeter Pins)
    for (let c = -3.8; c <= 3.8; c += 0.8) {
      [-4.3, 4.3].forEach((edgeZ) => {
        const notch = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.40, 0.12), goldMat);
        notch.position.set(c, 0, edgeZ);
        chipGroup.add(notch);
      });
      [-4.3, 4.3].forEach((edgeX) => {
        const notch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.40, 0.35), goldMat);
        notch.position.set(edgeX, 0, c);
        chipGroup.add(notch);
      });
    }

    // B. Substrate Circuit Interconnects Texture (High-Density Serpentine Traces & Vias)
    const traceCanvas = document.createElement('canvas');
    traceCanvas.width = 1024;
    traceCanvas.height = 1024;
    const tCtx = traceCanvas.getContext('2d')!;

    tCtx.fillStyle = '#090c12';
    tCtx.fillRect(0, 0, 1024, 1024);

    // Serpentine High-Speed Differential Traces
    tCtx.strokeStyle = '#d4af37';
    tCtx.lineWidth = 2.5;

    // Radial gold bond fingers radiating from die perimeter to package edges
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 32) {
      const x1 = 512 + Math.cos(angle) * 280;
      const y1 = 512 + Math.sin(angle) * 280;
      const x2 = 512 + Math.cos(angle) * 480;
      const y2 = 512 + Math.sin(angle) * 480;

      tCtx.beginPath();
      tCtx.moveTo(x1, y1);
      tCtx.lineTo(x2, y2);
      tCtx.stroke();

      // Micro via pads
      tCtx.fillStyle = '#f59e0b';
      tCtx.beginPath();
      tCtx.arc(x2, y2, 4.5, 0, Math.PI * 2);
      tCtx.fill();
    }

    // Concentric ground-plane guard rings
    [270, 350, 430, 485].forEach((r) => {
      tCtx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
      tCtx.lineWidth = 1.5;
      tCtx.beginPath();
      tCtx.arc(512, 512, r, 0, Math.PI * 2);
      tCtx.stroke();
    });

    // Corner alignment fiducial markings
    tCtx.strokeStyle = '#d4af37';
    tCtx.lineWidth = 2;
    tCtx.strokeRect(45, 45, 934, 934);

    // Micro grid test points
    tCtx.fillStyle = '#f59e0b';
    for (let gx = 100; gx <= 924; gx += 64) {
      for (let gy = 100; gy <= 924; gy += 64) {
        if (Math.hypot(gx - 512, gy - 512) > 300) {
          tCtx.fillRect(gx - 2, gy - 2, 4, 4);
        }
      }
    }

    const traceTexture = new THREE.CanvasTexture(traceCanvas);
    const tracePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 8.5),
      new THREE.MeshStandardMaterial({
        map: traceTexture,
        metalness: 0.05,
        roughness: 0.85,
      })
    );
    tracePlane.rotation.x = -Math.PI / 2;
    tracePlane.position.y = 0.20;
    chipGroup.add(tracePlane);

    // C. Outer Titanium Package Retainer Ring
    const packageRing = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.16, 6.4),
      frameMat
    );
    packageRing.position.y = 0.26;
    chipGroup.add(packageRing);

    // Inner Cavity Bevel in Gold
    const cavityGoldBevel = new THREE.Mesh(
      new THREE.BoxGeometry(5.62, 0.18, 5.62),
      goldMat
    );
    cavityGoldBevel.position.y = 0.28;
    chipGroup.add(cavityGoldBevel);

    // Recessed Die Cavity Bed in Obsidian
    const cavityBed = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.20, 5.5),
      substrateMat
    );
    cavityBed.position.y = 0.29;
    chipGroup.add(cavityBed);

    // D. PHOTOREALISTIC 4nm SILICON DIE WITH NANOMETER CIRCUIT EMBEDDINGS
    // Render an ultra-detailed 2048x2048 photolithographic floorplan of the 4nm BPU
    const dieCanvas = document.createElement('canvas');
    dieCanvas.width = 2048;
    dieCanvas.height = 2048;
    const dCtx = dieCanvas.getContext('2d')!;

    // 1. Deep Silicon Crystal Substrate with Thin-Film Iridescent Sheen
    dCtx.fillStyle = '#060911';
    dCtx.fillRect(0, 0, 2048, 2048);

    // Subtle dark blue / teal crystalline wafer gradient
    const waferGrad = dCtx.createRadialGradient(1024, 1024, 100, 1024, 1024, 1000);
    waferGrad.addColorStop(0, '#0c1626');
    waferGrad.addColorStop(0.5, '#070d18');
    waferGrad.addColorStop(1, '#030509');
    dCtx.fillStyle = waferGrad;
    dCtx.fillRect(0, 0, 2048, 2048);

    // 2. High-Density Micro-Circuit Floorplan Grid (Nanometer Logic Topography)
    // Floorplan Area A: Central GNN Shapley Tensor Processing Core Array (8x8 Grid)
    dCtx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    dCtx.fillRect(524, 524, 1000, 1000);
    dCtx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    dCtx.lineWidth = 3;
    dCtx.strokeRect(524, 524, 1000, 1000);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = 544 + col * 120;
        const cy = 544 + row * 120;

        // Core unit tile
        dCtx.fillStyle = (row + col) % 2 === 0 ? 'rgba(56, 189, 248, 0.06)' : 'rgba(245, 158, 11, 0.06)';
        dCtx.fillRect(cx, cy, 110, 110);
        dCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        dCtx.lineWidth = 1;
        dCtx.strokeRect(cx, cy, 110, 110);

        // Internal ALU / Matrix multiply bus lines
        dCtx.strokeStyle = (row + col) % 2 === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(245, 158, 11, 0.4)';
        dCtx.lineWidth = 1;
        for (let l = 15; l < 100; l += 15) {
          dCtx.beginPath();
          dCtx.moveTo(cx + 10, cy + l);
          dCtx.lineTo(cx + 100, cy + l);
          dCtx.stroke();
        }

        // Micro-core status LED dot
        dCtx.fillStyle = (row === 3 && col === 3) || (row === 4 && col === 4) ? '#f59e0b' : '#38bdf8';
        dCtx.fillRect(cx + 50, cy + 50, 6, 6);
      }
    }

    // Floorplan Area B: Flanking SRAM L3 Cache Blocks (Dense Memory Stripe Pitch)
    const drawCacheArray = (x: number, y: number, w: number, h: number, label: string) => {
      dCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      dCtx.fillRect(x, y, w, h);
      dCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      dCtx.lineWidth = 2;
      dCtx.strokeRect(x, y, w, h);

      // Nanometer memory bitline pitch
      dCtx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      dCtx.lineWidth = 1;
      for (let s = 10; s < h; s += 8) {
        dCtx.beginPath();
        dCtx.moveTo(x + 5, y + s);
        dCtx.lineTo(x + w - 5, y + s);
        dCtx.stroke();
      }

      // Block Label
      dCtx.font = '600 18px "JetBrains Mono", monospace';
      dCtx.fillStyle = '#94a3b8';
      dCtx.fillText(label, x + 16, y + 28);
    };

    drawCacheArray(120, 524, 360, 480, 'SRAM L3 [BANK 0]');
    drawCacheArray(120, 1044, 360, 480, 'SRAM L3 [BANK 1]');
    drawCacheArray(1568, 524, 360, 480, 'SRAM L3 [BANK 2]');
    drawCacheArray(1568, 1044, 360, 480, 'SRAM L3 [BANK 3]');

    // Floorplan Area C: Top & Bottom DAG Traversal Engine & SHA-256 Accelerators
    drawCacheArray(524, 120, 1000, 360, 'DETERMINISTIC INGESTION & MERKLE DAG ACCELERATOR // 4nm');
    drawCacheArray(524, 1568, 1000, 360, 'COUNTERFACTUAL REPLAY EXECUTION PIPELINE // ZERO TOKEN');

    // High-Speed Interconnect Bus Lines (Crossbar Routing)
    dCtx.strokeStyle = '#f59e0b';
    dCtx.lineWidth = 2.5;
    [500, 1548].forEach((bx) => {
      dCtx.beginPath();
      dCtx.moveTo(bx, 100);
      dCtx.lineTo(bx, 1948);
      dCtx.stroke();
    });
    [500, 1548].forEach((by) => {
      dCtx.beginPath();
      dCtx.moveTo(100, by);
      dCtx.lineTo(1948, by);
      dCtx.stroke();
    });

    // 3. Laser-Etched Foundry Markings on Silicon Die Surface
    dCtx.font = 'italic 700 36px "Cormorant Garamond", Georgia, serif';
    dCtx.fillStyle = '#f59e0b';
    dCtx.fillText('BLACK BOX BPU-4nm', 840, 260);

    dCtx.font = '600 20px "JetBrains Mono", monospace';
    dCtx.fillStyle = '#38bdf8';
    dCtx.fillText('CAUSAL SILICON ENGINE MK-IV  |  TSMC N4X', 760, 300);

    dCtx.font = '16px "JetBrains Mono", monospace';
    dCtx.fillStyle = '#64748b';
    dCtx.fillText('PROCESS: 4nm FINFET • SHAPLEY CORES: 64 • MERKLE: SHA-256', 740, 335);
    dCtx.fillText('P/N: BB-BPU-9824X   S/N: AF-7091B-REV4   LOT: 884-A', 770, 365);

    // Micro 2D Data Matrix on Die Corner
    dCtx.fillStyle = '#f59e0b';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if ((r + c) % 2 === 0 || r === 0 || c === 0 || r === 9 || c === 9) {
          dCtx.fillRect(1600 + c * 10, 1640 + r * 10, 8, 8);
        }
      }
    }

    // 4. Perimeter Gold Wire-Bond Landing Pads (64 Micro-Pads along Die Edges)
    const padCoords: { x: number; y: number }[] = [];
    const padSize = 24;

    // Top & Bottom edges (16 pads each)
    for (let i = 0; i < 16; i++) {
      const px = 200 + i * 108;
      // Top
      dCtx.fillStyle = '#f59e0b';
      dCtx.fillRect(px, 30, padSize, padSize);
      dCtx.strokeStyle = '#ffffff';
      dCtx.lineWidth = 1;
      dCtx.strokeRect(px, 30, padSize, padSize);
      padCoords.push({ x: px + padSize / 2, y: 30 + padSize / 2 });

      // Bottom
      dCtx.fillStyle = '#f59e0b';
      dCtx.fillRect(px, 1994, padSize, padSize);
      dCtx.strokeRect(px, 1994, padSize, padSize);
      padCoords.push({ x: px + padSize / 2, y: 1994 + padSize / 2 });
    }

    // Left & Right edges (16 pads each)
    for (let i = 0; i < 16; i++) {
      const py = 200 + i * 108;
      // Left
      dCtx.fillStyle = '#f59e0b';
      dCtx.fillRect(30, py, padSize, padSize);
      dCtx.strokeRect(30, py, padSize, padSize);
      padCoords.push({ x: 30 + padSize / 2, y: py + padSize / 2 });

      // Right
      dCtx.fillStyle = '#f59e0b';
      dCtx.fillRect(1994, py, padSize, padSize);
      dCtx.strokeRect(1994, py, padSize, padSize);
      padCoords.push({ x: 1994 + padSize / 2, y: py + padSize / 2 });
    }

    const dieTexture = new THREE.CanvasTexture(dieCanvas);
    dieTexture.anisotropy = 16;

    // Bare Silicon Wafer Die Material with Subtle Steady Amber Core Glow
    const siliconDieMat = new THREE.MeshStandardMaterial({
      map: dieTexture,
      color: 0xffffff,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.50,
    });
    dieMatRef.current = siliconDieMat;

    // Central Main Silicon Compute Die (4.6 x 0.12 x 4.6)
    const mainDie = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.12, 4.6),
      siliconDieMat
    );
    mainDie.position.y = 0.38;
    chipGroup.add(mainDie);

    // Polished Silicon Die Chamfer / Perimeter Mirror Bevel
    const dieBezel = new THREE.Mesh(
      new THREE.BoxGeometry(4.66, 0.08, 4.66),
      new THREE.MeshStandardMaterial({ color: 0x222a3a, metalness: 0.98, roughness: 0.04 })
    );
    dieBezel.position.y = 0.34;
    chipGroup.add(dieBezel);

    // E. 64 ARCHED GOLD MICRO-BONDING WIRES WITH BALL-BONDS
    // Wires originate from gold substrate bond pads and arch gracefully onto the 64 die landing pads
    const wireCount = 64;
    for (let i = 0; i < wireCount; i++) {
      const angle = (i / wireCount) * Math.PI * 2;
      const innerR = 2.25; // lands precisely on the outer perimeter of the 4.6 x 4.6 die
      const outerR = 3.65; // originates on the package substrate fingers

      const p0 = new THREE.Vector3(Math.cos(angle) * innerR, 0.44, Math.sin(angle) * innerR);
      const p1 = new THREE.Vector3(Math.cos(angle) * (innerR + 0.65), 0.95, Math.sin(angle) * (innerR + 0.65));
      const p2 = new THREE.Vector3(Math.cos(angle) * outerR, 0.22, Math.sin(angle) * outerR);

      // Graceful catenary loop curve
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const wireGeo = new THREE.TubeGeometry(curve, 18, 0.018, 8, false);
      const wireMesh = new THREE.Mesh(wireGeo, goldMat);
      chipGroup.add(wireMesh);

      // Microscopic Gold Ball-Bond at the landing pad
      const ballBond = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), goldMat);
      ballBond.position.copy(p0);
      chipGroup.add(ballBond);

      // Substrate bond stitch foot
      const stitchFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8), goldMat);
      stitchFoot.position.copy(p2);
      chipGroup.add(stitchFoot);
    }

    // F. SMD Ceramic Decoupling Capacitors (36 MLCC chips around the die perimeter)
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const r = 3.25;
      const cx = Math.cos(angle) * r;
      const cz = Math.sin(angle) * r;

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.13), ceramicMat);
      cap.position.set(cx, 0.26, cz);
      cap.rotation.y = angle;
      chipGroup.add(cap);

      // Solder endcaps
      const end1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.14), solderMat);
      end1.position.set(cx + Math.cos(angle + Math.PI / 2) * 0.11, 0.26, cz + Math.sin(angle + Math.PI / 2) * 0.11);
      chipGroup.add(end1);

      const end2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.14), solderMat);
      end2.position.set(cx - Math.cos(angle + Math.PI / 2) * 0.11, 0.26, cz - Math.sin(angle + Math.PI / 2) * 0.11);
      chipGroup.add(end2);
    }

    // G. Subtle Radial Contact Ground Shadow in Open Space
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(256, 256, 10, 256, 256, 250);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 512, 512);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.65 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.8;
    scene.add(shadowPlane);

    // H. Orbital Logic Rings in Site Colors (Ice-Cyan & Warm 24K Gold)
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.012, 16, 120), ringMat1);
    ring1.rotation.x = Math.PI / 2;
    ringGroup.add(ring1);

    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.25 });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.01, 16, 120), ringMat2);
    ring2.rotation.x = Math.PI / 2.2;
    ringGroup.add(ring2);

    // 4. Interactive Drag Orbit & Parallax
    const targetRot = { x: 0.64, y: -0.40 };
    const currentRot = { x: 0.64, y: -0.40 };
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      setIsInteracting(true);
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        targetRot.y += dx * 0.008;
        targetRot.x += dy * 0.008;
        prevMouse = { x: e.clientX, y: e.clientY };
      } else {
        const rect = mount.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        if (isRotating) {
          targetRot.x = 0.64 + ny * 0.25;
        }
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      setTimeout(() => setIsInteracting(false), 2000);
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    // 5. Animation Loop
    let animId: number;
    let clockTime = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clockTime += 0.016;

      if (isRotating && !isDragging) {
        targetRot.y += 0.0035;
      }

      // Smooth damping
      currentRot.x += (targetRot.x - currentRot.x) * 0.08;
      currentRot.y += (targetRot.y - currentRot.y) * 0.08;
      chipGroup.rotation.x = currentRot.x;
      chipGroup.rotation.y = currentRot.y;

      // Zero-gravity oscillation
      chipGroup.position.y = Math.sin(clockTime * 1.3) * 0.10;

      // Pulsing core light simulating neural computation
      const p = 3.8 + Math.sin(clockTime * 3.8) * 1.4;
      coreLight.intensity = p;
      siliconDieMat.emissiveIntensity = 0.45 + Math.sin(clockTime * 3.8) * 0.25;

      ring1.rotation.z = clockTime * 0.08;
      ring2.rotation.z = -clockTime * 0.06;

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!mount) return;
      width = mount.clientWidth;
      height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isRotating]);

  return (
    <div className="relative w-full aspect-square sm:aspect-[4/3] flex items-center justify-center my-0 pointer-events-auto">
      {/* Three.js Canvas Hovering Seamlessly in Open Space */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Subsystem HUD in Open Space */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-[11px] font-mono text-zinc-300 pointer-events-none shadow-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>4nm Silicon BPU • Deterministic Causal Processor</span>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`p-2 rounded-full border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 backdrop-blur-xl shadow-xl ${
            isRotating
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-black/60 text-zinc-400 hover:text-white border-white/10'
          }`}
          title="Toggle Auto Rotation"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[10px]">Spin</span>
        </button>
      </div>

      {/* Subtle Floating Interaction Cue */}
      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-[10px] font-mono text-zinc-400 transition-opacity duration-500 pointer-events-none shadow-xl ${isInteracting ? 'opacity-20' : 'opacity-85'}`}>
        <span>Drag 360° to inspect 4nm micro-architecture &amp; nanometer die floorplan</span>
      </div>
    </div>
  );
};

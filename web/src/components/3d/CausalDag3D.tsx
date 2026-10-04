import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AlertOctagon, Split, Sparkles, RotateCw } from 'lucide-react';

interface NodeData {
  id: string;
  name: string;
  shortLabel: string;
  type: 'input' | 'tool' | 'anomaly' | 'counterfactual' | 'normal' | 'output';
  position: THREE.Vector3;
  status: 'passed' | 'failed' | 'repaired' | 'normal';
  details: string;
  shapley: string;
  tokenCost: string;
}

export const CausalDag3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [activeMode, setActiveMode] = useState<'anomaly' | 'counterfactual' | 'all'>('anomaly');

  // References for scene manipulation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesRef = useRef<{ group: THREE.Group; data: NodeData; pickMesh: THREE.Mesh }[]>([]);
  const targetRotation = useRef({ x: 0.10, y: -0.18 });
  const currentRotation = useRef({ x: 0.10, y: -0.18 });
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 700;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera elevated and pulled back to frame the entire elevated graph with generous padding
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 3.2, 31);
    camera.lookAt(0, 3.0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. High-Luxury Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x0f172a, 2.2);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    // Front Studio Softbox
    const frontSoftbox = new THREE.DirectionalLight(0xfffbeb, 3.5);
    frontSoftbox.position.set(0, 10, 28);
    scene.add(frontSoftbox);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 3.0);
    keyLight.position.set(16, 24, 18);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x38bdf8, 3.0);
    cyanRim.position.set(-20, 14, -12);
    scene.add(cyanRim);

    const goldFill = new THREE.DirectionalLight(0xf59e0b, 3.0);
    goldFill.position.set(18, -4, -10);
    scene.add(goldFill);

    const anomalyPoint = new THREE.PointLight(0xef4444, 4.5, 30);
    anomalyPoint.position.set(1, 4.5, 4);
    scene.add(anomalyPoint);

    // 3. Background Depth Astrolabe Grid & Coordinate Horizon
    const gridGroup = new THREE.Group();
    gridGroup.position.set(0, 2.5, -6);
    scene.add(gridGroup);

    // Concentric celestial range rings
    [8, 14, 20, 26].forEach((radius) => {
      const ringGeo = new THREE.RingGeometry(radius, radius + 0.03, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd4af37,
        transparent: true,
        opacity: 0.10,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      gridGroup.add(ring);
    });

    // Radial coordinate axes
    for (let a = 0; a < Math.PI; a += Math.PI / 6) {
      const linePts = [
        new THREE.Vector3(Math.cos(a) * 26, Math.sin(a) * 26, 0),
        new THREE.Vector3(-Math.cos(a) * 26, -Math.sin(a) * 26, 0),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08 });
      const line = new THREE.Line(lineGeo, lineMat);
      gridGroup.add(line);
    }

    // Floating Stardust Particles
    const particleCount = 480;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 80;
      particlePositions[i + 1] = (Math.random() - 0.5) * 50 + 3;
      particlePositions[i + 2] = (Math.random() - 0.5) * 50;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xd4af37,
      size: 0.13,
      transparent: true,
      opacity: 0.45,
    });
    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // 4. MASTER DAG GROUP (Shifted up by +3.2 so bottom nodes never overlap HUD!)
    const dagGroup = new THREE.Group();
    dagGroup.position.set(0, 3.2, 0);
    scene.add(dagGroup);

    // DAG Nodes Definition
    const rawNodes: NodeData[] = [
      // Layer 0: Inputs
      {
        id: 'node-0',
        name: 'User Prompt Dispatch',
        shortLabel: '00 / USER_INTENT',
        type: 'input',
        position: new THREE.Vector3(-14, 2.2, 0),
        status: 'passed',
        details: 'Parsed financial intent: EUR/USD Cross-Arbitrage execution with risk boundaries.',
        shapley: 'Φ = 0.000 (Nominal Input)',
        tokenCost: '$0.0004 (Input)',
      },
      {
        id: 'node-1',
        name: 'System Risk Policy',
        shortLabel: '01 / RISK_POLICY',
        type: 'input',
        position: new THREE.Vector3(-14, -2.0, 1.5),
        status: 'passed',
        details: 'Verified margin threshold ($50,000 max leverage) and compliance whitelist.',
        shapley: 'Φ = 0.000 (Policy Constraint)',
        tokenCost: '$0.0000 (Internal)',
      },

      // Layer 1: Ingestion & Embeddings
      {
        id: 'node-2',
        name: 'Market Gateway Tool',
        shortLabel: '02 / SPOT_FEED',
        type: 'tool',
        position: new THREE.Vector3(-9, 3.8, -1),
        status: 'passed',
        details: 'Queried Level-2 order book depth across 3 clearinghouses in 1.4ms.',
        shapley: 'Φ = +0.012 (Data Provider)',
        tokenCost: '$0.0000 (RPC Cache)',
      },
      {
        id: 'node-3',
        name: 'State Checkpoint Buffer',
        shortLabel: '03 / SHA256_STATE',
        type: 'normal',
        position: new THREE.Vector3(-9, 0, 1),
        status: 'passed',
        details: 'Generated immutable cryptographic state hash: e3b0c44298fc1c14.',
        shapley: 'Φ = +0.004 (Checkpoint)',
        tokenCost: '$0.0000 (Zero Token)',
      },
      {
        id: 'node-4',
        name: 'Spread Valuation Model',
        shortLabel: '04 / SPREAD_CALC',
        type: 'normal',
        position: new THREE.Vector3(-9, -3.6, -1.5),
        status: 'passed',
        details: 'Evaluated 4.2 bps triangular arbitrage opportunity between venues.',
        shapley: 'Φ = +0.035 (Evaluation)',
        tokenCost: '$0.0012 (Embeddings)',
      },

      // Layer 2: LLM Reasoning
      {
        id: 'node-5',
        name: 'Arbitrage Reasoning Step 1',
        shortLabel: '05 / REASONING_01',
        type: 'normal',
        position: new THREE.Vector3(-4, 2.8, 1),
        status: 'passed',
        details: 'Determined optimal routing sequence: USD -> EUR -> GBP -> USD.',
        shapley: 'Φ = +0.052 (Routing)',
        tokenCost: '$0.0042 (GPT-4o)',
      },
      {
        id: 'node-6',
        name: 'Collateral Assertion',
        shortLabel: '06 / COLLATERAL_CHK',
        type: 'normal',
        position: new THREE.Vector3(-4, -1.2, -1),
        status: 'passed',
        details: 'Computed required initial margin: $14,200 (well within $50,000 threshold).',
        shapley: 'Φ = +0.018 (Margin Valid)',
        tokenCost: '$0.0008 (Validator)',
      },

      // Layer 3: THE FAULT / ANOMALY ROOT CAUSE (Centerpiece)
      {
        id: 'node-7',
        name: 'Step 3: Decimal Parser (Anomaly)',
        shortLabel: '07 / ROOT_CAUSE [FAULT]',
        type: 'anomaly',
        position: new THREE.Vector3(1, 1.0, 0),
        status: 'failed',
        details: 'Causal Root Cause: Float-to-decimal truncation dropped 2 fractional zeroes, scaling trade size 100x nominal.',
        shapley: 'Φ = +0.892 (Guaranteed Fault Root)',
        tokenCost: '$0.0015 (Poison Mutation)',
      },

      // Layer 4A: Original Broken Downstream Path (Upper Branch)
      {
        id: 'node-8',
        name: 'Order Payload Synthesizer',
        shortLabel: '08 / OVER_LEVERAGE',
        type: 'normal',
        position: new THREE.Vector3(6.5, 4.0, -2),
        status: 'failed',
        details: 'Inherited corrupted 100x scale factor; synthesized order for $1,420,000.',
        shapley: 'Φ = +0.002 (Downstream Victim)',
        tokenCost: '$0.0021 (Poisoned Run)',
      },
      {
        id: 'node-9',
        name: 'Exchange Execution Firewall',
        shortLabel: '09 / TERMINAL_CRASH',
        type: 'output',
        position: new THREE.Vector3(13, 5.0, -2),
        status: 'failed',
        details: 'CRASH: Rejected by venue risk engine (Margin shortfall of $1,370,000).',
        shapley: 'Φ = +0.000 (Symptom Only)',
        tokenCost: '$0.0000 (Execution Blocked)',
      },

      // Layer 4B: Counterfactual Repaired Path (Green Branch - Now hovering high above bottom edge!)
      {
        id: 'node-10',
        name: 'Counterfactual Fork (Step 3 Repair)',
        shortLabel: '10 / REPAIR_FORK',
        type: 'counterfactual',
        position: new THREE.Vector3(5.5, -1.8, 1),
        status: 'repaired',
        details: 'Replaced float cast with Decimal(str(val)). Zero tokens burned — re-uses recorded cache.',
        shapley: 'Φ = -0.892 (Full Regress Proof)',
        tokenCost: '$0.0000 (Memory Replay)',
      },
      {
        id: 'node-11',
        name: 'Verified Order Payload',
        shortLabel: '11 / CLEAN_ORDER',
        type: 'counterfactual',
        position: new THREE.Vector3(10, -2.6, 2),
        status: 'repaired',
        details: 'Accurate $14,200 trade payload dispatched with cryptographic lineage signature.',
        shapley: 'Φ = +0.000 (Replay Pass)',
        tokenCost: '$0.0000 (Memory Replay)',
      },
      {
        id: 'node-12',
        name: 'Execution Verified (100% Pass)',
        shortLabel: '12 / PROVEN_PASS',
        type: 'output',
        position: new THREE.Vector3(15, -2.4, 1),
        status: 'passed',
        details: 'Exchange accepted fill at 1.0842. Deterministically proven: bug is 100% resolved.',
        shapley: 'Φ = +0.000 (Certified Clean)',
        tokenCost: '$0.0000 (PR Merged)',
      },
    ];

    // Master Materials for Nodes
    // 24k Gold Armature Gimbals
    const goldArmatureMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.99,
      roughness: 0.05,
    });

    const steelArmatureMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.98,
      roughness: 0.08,
    });

    const emeraldArmatureMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.96,
      roughness: 0.06,
    });

    // Geometries
    const facetedJewelGeo = new THREE.OctahedronGeometry(0.85, 0);
    const icosaGeo = new THREE.IcosahedronGeometry(0.95, 0);
    const coreSphereGeo = new THREE.SphereGeometry(0.48, 24, 24);
    const ringGeo1 = new THREE.TorusGeometry(1.22, 0.018, 16, 64);
    const ringGeo2 = new THREE.TorusGeometry(1.40, 0.012, 16, 64);
    const bracketGeo = new THREE.BoxGeometry(0.06, 0.28, 0.06);

    const nodeObjects: {
      group: THREE.Group;
      data: NodeData;
      pickMesh: THREE.Mesh;
      ringMesh1?: THREE.Mesh;
      ringMesh2?: THREE.Mesh;
      shockwaves?: THREE.Mesh[];
    }[] = [];
    const interactivePickMeshes: THREE.Mesh[] = [];

    // Helper: Create High-Resolution Text Sprite for In-Scene Spatial Labels
    const createTextSprite = (text: string, color: string, bgColor: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      // Glass pill background
      ctx.fillStyle = bgColor;
      ctx.roundRect(16, 20, 480, 88, 44);
      ctx.fill();

      // Hairline border
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.roundRect(16, 20, 480, 88, 44);
      ctx.stroke();

      // Text
      ctx.font = '600 30px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.92 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3.4, 0.85, 1);
      return sprite;
    };

    // Build Each Node in 3D Space inside dagGroup
    rawNodes.forEach((node) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(node.position);

      const isAnomaly = node.type === 'anomaly';
      const isRepaired = node.type === 'counterfactual' || node.id === 'node-12';

      // Colors tailored to website palette
      let outerColor = 0x1e2638;
      let outerEmissive = 0x0f172a;
      let innerColor = 0xfffbeb;
      let innerEmissive = 0xf59e0b;
      let armatureMat = goldArmatureMat;
      let wireColor = 0xd4af37;

      if (isAnomaly) {
        outerColor = 0x450a0a;
        outerEmissive = 0x2e0606;
        innerColor = 0xffedd5;
        innerEmissive = 0xef4444;
        armatureMat = goldArmatureMat;
        wireColor = 0xf59e0b;
      } else if (isRepaired) {
        outerColor = 0x064e3b;
        outerEmissive = 0x022c22;
        innerColor = 0xecfdf5;
        innerEmissive = 0x10b981;
        armatureMat = emeraldArmatureMat;
        wireColor = 0x10b981;
      } else if (node.type === 'input' || node.type === 'tool') {
        outerColor = 0x0f2744;
        outerEmissive = 0x081c33;
        innerColor = 0xe0f2fe;
        innerEmissive = 0x38bdf8;
        armatureMat = steelArmatureMat;
        wireColor = 0x38bdf8;
      }

      // 1. Faceted Outer Gem Shell with Translucency and Specular Glints
      const outerMat = new THREE.MeshStandardMaterial({
        color: outerColor,
        emissive: outerEmissive,
        emissiveIntensity: 0.8,
        metalness: 0.92,
        roughness: 0.12,
        transparent: true,
        opacity: 0.78,
      });

      const jewelGeo = isAnomaly ? icosaGeo : facetedJewelGeo;
      const jewelMesh = new THREE.Mesh(jewelGeo, outerMat);
      nodeGroup.add(jewelMesh);

      // Gold/Emerald hairline wireframe along the jewel facet edges
      const edgesGeo = new THREE.EdgesGeometry(jewelGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: wireColor,
        transparent: true,
        opacity: 0.65,
        linewidth: 1.5,
      });
      const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
      nodeGroup.add(edgesMesh);

      // Invisible pick sphere for accurate raycasting
      const pickGeo = new THREE.SphereGeometry(1.3, 16, 16);
      const pickMat = new THREE.MeshBasicMaterial({ visible: false });
      const pickMesh = new THREE.Mesh(pickGeo, pickMat);
      nodeGroup.add(pickMesh);
      interactivePickMeshes.push(pickMesh);

      // 2. High-Luminance Inner Glowing Energy Core
      const innerCoreMat = new THREE.MeshStandardMaterial({
        color: innerColor,
        emissive: innerEmissive,
        emissiveIntensity: isAnomaly ? 4.8 : 2.8,
        roughness: 0.05,
      });
      const coreMesh = new THREE.Mesh(coreSphereGeo, innerCoreMat);
      nodeGroup.add(coreMesh);

      // 3. Dual Gyroscopic Gimbal Armature Rings (Counter-Rotating)
      const ringMesh1 = new THREE.Mesh(ringGeo1, armatureMat);
      ringMesh1.rotation.x = Math.PI / 4;
      ringMesh1.rotation.y = (Math.random() - 0.5) * Math.PI;
      nodeGroup.add(ringMesh1);

      const ringMesh2 = new THREE.Mesh(ringGeo2, armatureMat);
      ringMesh2.rotation.y = Math.PI / 3;
      ringMesh2.rotation.z = Math.PI / 6;
      nodeGroup.add(ringMesh2);

      // 4. Aerospace Targeting Reticle for Anomaly
      const shockwaves: THREE.Mesh[] = [];
      if (isAnomaly) {
        // Double concentric gold reticle
        const reticleGeo = new THREE.RingGeometry(1.58, 1.62, 32);
        const reticleMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
        const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
        nodeGroup.add(reticleMesh);

        // Corner Gold Telemetry Brackets
        const bracketOffsets = [
          [-1.4, 1.4], [1.4, 1.4],
          [-1.4, -1.4], [1.4, -1.4],
        ];
        bracketOffsets.forEach(([bx, by]) => {
          const b1 = new THREE.Mesh(bracketGeo, goldArmatureMat);
          b1.position.set(bx, by, 0);
          nodeGroup.add(b1);
        });

        // Dual Pulsing Shockwave Radar Rings
        [0, 0.5].forEach((phaseOffset) => {
          const shockGeo = new THREE.RingGeometry(1.7, 1.82, 32);
          const shockMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
          });
          const shockwave = new THREE.Mesh(shockGeo, shockMat);
          shockwave.userData = { phaseOffset };
          nodeGroup.add(shockwave);
          shockwaves.push(shockwave);
        });
      }

      // 5. In-Scene Spatial Floating Billboard Badge
      if (['node-0', 'node-1', 'node-2', 'node-3', 'node-5', 'node-7', 'node-9', 'node-10', 'node-12'].includes(node.id)) {
        let labelColor = '#f59e0b';
        let labelBg = 'rgba(15, 17, 24, 0.88)';
        if (isAnomaly) {
          labelColor = '#ef4444';
          labelBg = 'rgba(38, 10, 14, 0.92)';
        } else if (isRepaired) {
          labelColor = '#10b981';
          labelBg = 'rgba(8, 28, 20, 0.92)';
        } else if (node.id === 'node-9') {
          labelColor = '#f87171';
          labelBg = 'rgba(28, 10, 10, 0.92)';
        }

        const sprite = createTextSprite(node.shortLabel, labelColor, labelBg);
        sprite.position.set(0, 2.05, 0);
        nodeGroup.add(sprite);
      }

      dagGroup.add(nodeGroup);
      nodeObjects.push({ group: nodeGroup, data: node, pickMesh, ringMesh1, ringMesh2, shockwaves });
    });

    nodesRef.current = nodeObjects;
    setSelectedNode(rawNodes[7]); // Focus Anomaly by default

    // 5. Connective Spline Arcs & Flowing Data Photons
    const connections = [
      [0, 2], [0, 3], [1, 3], [1, 4],
      [2, 5], [3, 5], [3, 6], [4, 6],
      [5, 7], [6, 7],
      // Broken path
      [7, 8], [8, 9],
      // Counterfactual branch
      [7, 10], [10, 11], [11, 12],
    ];

    interface SplinePath {
      curve: THREE.QuadraticBezierCurve3;
      tubeMesh: THREE.Mesh;
      isAnomalyBranch: boolean;
      isRepairedBranch: boolean;
      photons: THREE.Mesh[];
      photonProgresses: number[];
      speed: number;
    }

    const splinePaths: SplinePath[] = [];
    const linesGroup = new THREE.Group();
    dagGroup.add(linesGroup);

    // Glowing Photon Geometry
    const photonGeo = new THREE.SphereGeometry(0.14, 12, 12);

    connections.forEach(([fromIdx, toIdx]) => {
      const p1 = rawNodes[fromIdx].position;
      const p2 = rawNodes[toIdx].position;

      // Sculptural 3D curve with gentle organic arc
      const mid = p1.clone().lerp(p2, 0.5);
      mid.y += (Math.random() - 0.5) * 1.2;
      mid.z += (Math.random() - 0.5) * 1.5;

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.026, 8, false);

      const isRepairedBranch = fromIdx >= 7 && (toIdx === 10 || toIdx === 11 || toIdx === 12);
      const isAnomalyBranch = (fromIdx === 7 && toIdx === 8) || (fromIdx === 8 && toIdx === 9);

      let tubeColor = 0xd4af37;
      let tubeEmissive = 0x785514;
      let opacity = 0.55;

      if (isRepairedBranch) {
        tubeColor = 0x10b981;
        tubeEmissive = 0x059669;
        opacity = 0.85;
      } else if (isAnomalyBranch) {
        tubeColor = 0xef4444;
        tubeEmissive = 0xb91c1c;
        opacity = 0.75;
      }

      const tubeMat = new THREE.MeshStandardMaterial({
        color: tubeColor,
        emissive: tubeEmissive,
        emissiveIntensity: 1.6,
        roughness: 0.15,
        metalness: 0.9,
        transparent: true,
        opacity,
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      linesGroup.add(tubeMesh);

      // Flowing Light Photons (2 photons per path for continuous data pulse)
      const photonMat = new THREE.MeshBasicMaterial({
        color: isRepairedBranch ? 0x6ee7b7 : isAnomalyBranch ? 0xfca5a5 : 0xfde68a,
      });

      const photons: THREE.Mesh[] = [];
      const photonProgresses: number[] = [Math.random(), (Math.random() + 0.5) % 1.0];

      photonProgresses.forEach((_) => {
        const photon = new THREE.Mesh(photonGeo, photonMat);
        dagGroup.add(photon);
        photons.push(photon);
      });

      splinePaths.push({
        curve,
        tubeMesh,
        isAnomalyBranch,
        isRepairedBranch,
        photons,
        photonProgresses,
        speed: isRepairedBranch ? 0.0075 : 0.0045,
      });
    });

    // 6. Interactive Drag & Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;
        targetRotation.current.y += deltaX * 0.007;
        targetRotation.current.x += deltaY * 0.007;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactivePickMeshes);

      if (intersects.length > 0) {
        const hit = nodeObjects.find((n) => n.pickMesh === intersects[0].object);
        if (hit) {
          setSelectedNode(hit.data);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    dom.addEventListener('click', handleClick);

    // 7. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth damping rotation of DAG Group
      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.08;

      dagGroup.rotation.x = currentRotation.current.x;
      dagGroup.rotation.y = currentRotation.current.y + Math.sin(elapsedTime * 0.25) * 0.015;

      // Animate gimbal rings and jewel facets
      nodeObjects.forEach((n, idx) => {
        if (n.ringMesh1) {
          n.ringMesh1.rotation.z = elapsedTime * (idx % 2 === 0 ? 0.7 : -0.7);
        }
        if (n.ringMesh2) {
          n.ringMesh2.rotation.x = elapsedTime * (idx % 2 === 0 ? -0.5 : 0.5);
        }
        // Anomaly radar ping shockwaves
        if (n.shockwaves) {
          n.shockwaves.forEach((shockwave, sIdx) => {
            const phase = (elapsedTime * 1.3 + sIdx * 0.6) % 1.5;
            const waveScale = 1.0 + phase;
            shockwave.scale.set(waveScale, waveScale, waveScale);
            (shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.75 - phase / 1.5);
          });
        }
      });

      // Animate flowing photon data packets along curves
      splinePaths.forEach((path) => {
        path.photons.forEach((photon, pIdx) => {
          path.photonProgresses[pIdx] = (path.photonProgresses[pIdx] + path.speed) % 1.0;
          const pt = path.curve.getPointAt(path.photonProgresses[pIdx]);
          photon.position.copy(pt);
        });
      });

      // Slowly drift starfield and coordinate grid
      particlePoints.rotation.y = elapsedTime * 0.015;
      gridGroup.rotation.z = elapsedTime * 0.008;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Handler
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
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleResetCamera = () => {
    targetRotation.current = { x: 0.10, y: -0.18 };
  };

  const handleSelectMode = (mode: 'anomaly' | 'counterfactual' | 'all') => {
    setActiveMode(mode);
    if (!nodesRef.current) return;

    if (mode === 'anomaly') {
      const anom = nodesRef.current.find((n) => n.data.type === 'anomaly');
      if (anom) setSelectedNode(anom.data);
      targetRotation.current = { x: 0.06, y: -0.12 };
    } else if (mode === 'counterfactual') {
      const rep = nodesRef.current.find((n) => n.data.id === 'node-10');
      if (rep) setSelectedNode(rep.data);
      targetRotation.current = { x: 0.14, y: -0.38 };
    } else {
      targetRotation.current = { x: 0.18, y: 0.0 };
    }
  };

  return (
    <div className="relative w-full mb-16 pointer-events-auto">
      {/* Three.js Canvas with Extended Height Hovering Freely in Open Space */}
      <div
        ref={mountRef}
        className="w-full h-[600px] sm:h-[680px] lg:h-[740px] cursor-grab active:cursor-grabbing relative"
      />

      {/* TOP COMMAND BAR: Consolidated controls at top so bottom is 100% free of overlap! */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Telemetry Status Badge */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 text-[11px] font-mono text-zinc-300 shadow-xl pointer-events-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>3D Causal Constellation • Drag to rotate • Click node to inspect</span>
        </div>

        {/* Right: Integrated Mode Filter & Reset Bar (Elevated to top - ZERO overlap with bottom nodes!) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xl p-1.5 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() => handleSelectMode('anomaly')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'anomaly'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">Isolate Fault</span>
            </button>

            <button
              onClick={() => handleSelectMode('counterfactual')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'counterfactual'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">Counterfactual Fork</span>
            </button>

            <button
              onClick={() => handleSelectMode('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px]">Full Graph</span>
            </button>
          </div>

          <button
            onClick={handleResetCamera}
            className="px-3.5 py-2.5 rounded-full bg-black/60 hover:bg-white/[0.08] text-zinc-300 border border-white/10 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 backdrop-blur-xl shadow-xl"
            title="Reset Camera View"
          >
            <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline text-[11px]">Reset</span>
          </button>
        </div>
      </div>

      {/* BOTTOM LEFT: High-Luxury Inspector Drawer (Tucked safely with zero overlap) */}
      <div className="absolute bottom-6 left-4 sm:left-6 max-w-md p-5 rounded-2xl bg-[#090b10]/85 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col gap-3 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedNode?.status === 'failed'
                  ? 'bg-red-400 animate-pulse'
                  : selectedNode?.status === 'repaired'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              {selectedNode ? selectedNode.shortLabel : 'NODE INSPECTOR'}
            </span>
          </div>

          {selectedNode && (
            <span
              className={`text-[9px] font-mono px-2.5 py-0.5 rounded-full uppercase border font-semibold ${
                selectedNode.status === 'failed'
                  ? 'bg-red-500/10 text-red-400 border-red-500/40'
                  : selectedNode.status === 'repaired'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
              }`}
            >
              {selectedNode.status}
            </span>
          )}
        </div>

        <div>
          <h4 className="font-serif text-lg font-normal text-white">
            {selectedNode ? selectedNode.name : 'Click any node to inspect causal lineage'}
          </h4>
          <p className="text-xs text-zinc-400 font-light mt-1 leading-relaxed">
            {selectedNode
              ? selectedNode.details
              : 'Explore the 3D causal dependency graph. Rotate with mouse drag.'}
          </p>
        </div>

        {selectedNode && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08] text-[10px] font-mono">
            <div>
              <span className="text-zinc-500 block">SHAPLEY ATTRIBUTION</span>
              <span className={selectedNode.type === 'anomaly' ? 'text-amber-400 font-semibold' : 'text-zinc-300'}>
                {selectedNode.shapley}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">REPLAY TOKEN COST</span>
              <span className={selectedNode.type === 'counterfactual' ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                {selectedNode.tokenCost}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const HeroFlightCore3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 900;
    let height = mount.clientHeight || 620;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 1000);
    camera.position.set(0, 0.2, 23.5);
    camera.lookAt(0, 0.0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35; // Controlled, elegant, non-washed out exposure
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // 2. High-Luxury Studio Lighting Rig (Subtle, elegant, highlighting edges without washed-out glare)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    // Front Key Light (Gentle softbox highlighting faceplate controls)
    const frontSoftbox = new THREE.DirectionalLight(0xfffbeb, 3.2);
    frontSoftbox.position.set(2, 6, 20);
    scene.add(frontSoftbox);

    // Front-Left Fill Light
    const frontLeftFill = new THREE.DirectionalLight(0xf8fafc, 2.5);
    frontLeftFill.position.set(-10, 6, 16);
    scene.add(frontLeftFill);

    // Top Overhead Light (Illuminates CSMU memory capsule and handles)
    const topOverhead = new THREE.DirectionalLight(0xfff7ed, 3.0);
    topOverhead.position.set(0, 16, 6);
    scene.add(topOverhead);

    // Right Champagne Gold Specular Rim
    const rimGold = new THREE.DirectionalLight(0xf59e0b, 3.5);
    rimGold.position.set(16, 2, -8);
    scene.add(rimGold);

    // Left Ice-Cyan Specular Rim
    const rimCyan = new THREE.DirectionalLight(0x38bdf8, 3.0);
    rimCyan.position.set(-16, 2, -8);
    scene.add(rimCyan);

    // Amber Status Diode Point Light (Aviation strobe beacon)
    const beaconLight = new THREE.PointLight(0xf59e0b, 4.0, 10);
    beaconLight.position.set(1.4, 0.85, 2.2);
    scene.add(beaconLight);

    // Display Screen Backlight Glow (Subtle and localized)
    const screenLight = new THREE.PointLight(0x38bdf8, 1.0, 6);
    screenLight.position.set(-1.25, 0.65, 2.1);
    scene.add(screenLight);

    // 3. Central Hardware Unit Group
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);

    // Master Materials (Deep Space-Black Titanium & 24K Gold)
    // Deep Space-Black Brushed Titanium (Rich, stealthy, luxurious dark aerospace finish)
    const chassisTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x181f2c,
      metalness: 0.88,
      roughness: 0.28,
    });

    // Brushed Dark Tungsten Alloy
    const tungstenMat = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      metalness: 0.90,
      roughness: 0.24,
    });

    // 24k Polished Champagne Gold (Accents, bands, pins, chamfers)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.96,
      roughness: 0.08,
    });

    // Surgical Stainless Steel (Mirror finish on handles, endcaps)
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.98,
      roughness: 0.06,
    });

    // CSMU Cylinder Material (Dark sculpted aerospace memory capsule)
    const csmuCylinderMat = new THREE.MeshStandardMaterial({
      color: 0x252e3e,
      metalness: 0.88,
      roughness: 0.22,
    });

    // A. Main Titanium Monolithic Housing Body
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.5, 3.5), chassisTitaniumMat);
    boxGroup.add(mainBody);

    // Precision Polished Gold Perimeter Chamfers (Top & Bottom edge inlays)
    const goldFrameTop = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.06, 3.55), goldMat);
    goldFrameTop.position.y = 1.76;
    boxGroup.add(goldFrameTop);

    const goldFrameBottom = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.06, 3.55), goldMat);
    goldFrameBottom.position.y = -1.76;
    boxGroup.add(goldFrameBottom);

    // Top Brushed Tungsten Plate with Recessed Screws
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(5.85, 0.18, 3.15), tungstenMat);
    topPlate.position.set(0, 1.84, 0);
    boxGroup.add(topPlate);

    // Corner Gold Hex Screws on Top Plate
    [[-2.7, -1.35], [-2.7, 1.35], [2.7, -1.35], [2.7, 1.35]].forEach(([cx, cz]) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 6), goldMat);
      screw.position.set(cx, 1.94, cz);
      boxGroup.add(screw);
    });

    // Heat Exhaust Louvers (12 micro-milled ventilation slots)
    for (let i = -1.7; i <= 1.7; i += 0.31) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 2.2), new THREE.MeshStandardMaterial({
        color: 0x0f141f,
        metalness: 0.9,
        roughness: 0.35,
      }));
      slot.position.set(i, 1.94, 0);
      boxGroup.add(slot);
    }

    // Bottom Avionics Mounting Skids in Tungsten & Gold
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.35), tungstenMat);
    skidL.position.set(0, -1.86, 1.35);
    boxGroup.add(skidL);

    const skidR = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 0.35), tungstenMat);
    skidR.position.set(0, -1.86, -1.35);
    boxGroup.add(skidR);

    // Gold Hex Screws along Skids
    for (let x = -2.6; x <= 2.6; x += 1.3) {
      const screwL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 6), goldMat);
      screwL.position.set(x, -1.86, 1.35);
      boxGroup.add(screwL);

      const screwR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 6), goldMat);
      screwR.position.set(x, -1.86, -1.35);
      boxGroup.add(screwR);
    }

    // B. Cylindrical Crash Survivable Memory Unit (CSMU)
    const csmuGroup = new THREE.Group();
    csmuGroup.position.set(0, 2.5, -0.35);
    boxGroup.add(csmuGroup);

    // Armored Memory Cylinder in Sculpted Titanium
    const csmuCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.72, 4.8, 36),
      csmuCylinderMat
    );
    csmuCylinder.rotation.z = Math.PI / 2;
    csmuGroup.add(csmuCylinder);

    // Center Gold Accent Band around CSMU
    const csmuCenterGold = new THREE.Mesh(
      new THREE.CylinderGeometry(0.73, 0.73, 0.8, 36),
      goldMat
    );
    csmuCenterGold.rotation.z = Math.PI / 2;
    csmuGroup.add(csmuCenterGold);

    // CSMU Machined Stainless Steel Endcaps with Center Torx Bolt
    const endcapL = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.26, 36), steelMat);
    endcapL.rotation.z = Math.PI / 2;
    endcapL.position.set(-2.45, 0, 0);
    csmuGroup.add(endcapL);

    const endcapR = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.26, 36), steelMat);
    endcapR.rotation.z = Math.PI / 2;
    endcapR.position.set(2.45, 0, 0);
    csmuGroup.add(endcapR);

    // 24k Gold Retention Bands & Clamp Brackets
    [-1.25, 1.25].forEach((sx) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.32, 36), goldMat);
      band.rotation.z = Math.PI / 2;
      band.position.set(sx, 0, 0);
      csmuGroup.add(band);

      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 1.6), chassisTitaniumMat);
      clamp.position.set(sx, -0.48, 0);
      csmuGroup.add(clamp);

      // Steel tension bolts
      const bolt1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), steelMat);
      bolt1.position.set(sx, -0.48, 0.65);
      csmuGroup.add(bolt1);

      const bolt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), steelMat);
      bolt2.position.set(sx, -0.48, -0.65);
      csmuGroup.add(bolt2);
    });

    // C. Dual Knurled Grab Handles in Stainless Steel & Gold Mounts
    const createHandle = (xPos: number) => {
      const handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xPos, 1.85, 0.65),
        new THREE.Vector3(xPos, 2.7, 0.65),
        new THREE.Vector3(xPos, 2.7, -0.65),
        new THREE.Vector3(xPos, 1.85, -0.65),
      ]);
      const handleGeo = new THREE.TubeGeometry(handleCurve, 32, 0.11, 16, false);
      const mesh = new THREE.Mesh(handleGeo, steelMat);

      // Gold base collars
      const collar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), goldMat);
      collar1.position.set(xPos, 1.9, 0.65);
      mesh.add(collar1);

      const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), goldMat);
      collar2.position.set(xPos, 1.9, -0.65);
      mesh.add(collar2);

      return mesh;
    };
    boxGroup.add(createHandle(-2.1));
    boxGroup.add(createHandle(2.1));

    // D. Underwater Locator Beacon (ULB Acoustic Pinger) in Platinum & Gold
    const ulbGroup = new THREE.Group();
    ulbGroup.position.set(0, -1.2, 1.95);
    boxGroup.add(ulbGroup);

    const ulbBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 3.0, 32),
      steelMat
    );
    ulbBody.rotation.z = Math.PI / 2;
    ulbGroup.add(ulbBody);

    // Gold transducer ribs on ULB
    for (let rx = -0.9; rx <= 0.9; rx += 0.22) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 16, 32), goldMat);
      rib.position.set(rx, 0, 0);
      ulbGroup.add(rib);
    }

    // Gold water-switch contact pins at tip
    const waterPin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 16), goldMat);
    waterPin.rotation.z = Math.PI / 2;
    waterPin.position.set(1.6, 0, 0);
    ulbGroup.add(waterPin);

    // E. High-End Editorial Faceplate Markings Texture (Luminous Titanium Panel)
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024;
    labelCanvas.height = 512;
    const lCtx = labelCanvas.getContext('2d')!;

    // Deep space-black console faceplate (matching the exact aesthetic user loved)
    lCtx.fillStyle = '#0c101a';
    lCtx.fillRect(0, 0, 1024, 512);

    // Champagne Gold Perimeter Hairline
    lCtx.strokeStyle = '#f59e0b';
    lCtx.lineWidth = 3.0;
    lCtx.strokeRect(18, 18, 988, 476);

    // Inner subtle ice-cyan hairline
    lCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    lCtx.lineWidth = 1.5;
    lCtx.strokeRect(26, 26, 972, 460);

    // Top Right: Precision Gold Milled Vernier Scale & Calibration Ticks
    lCtx.strokeStyle = '#fbbf24';
    lCtx.lineWidth = 2;
    for (let i = 0; i <= 20; i++) {
      const x = 700 + i * 14;
      const h = i % 5 === 0 ? 28 : i % 2 === 0 ? 18 : 10;
      lCtx.beginPath();
      lCtx.moveTo(x, 40);
      lCtx.lineTo(x, 40 + h);
      lCtx.stroke();
    }
    lCtx.font = '600 12px "JetBrains Mono", monospace';
    lCtx.fillStyle = '#fbbf24';
    lCtx.fillText('CALIBRATED // ED-112A', 700, 85);
    lCtx.fillStyle = '#cbd5e1';
    lCtx.font = '11px "JetBrains Mono", monospace';
    lCtx.fillText('SAMPLING: 24,000 Hz', 700, 102);

    // Circular Monogram Seal "BB" in Upper Left Corner of Bottom Plate
    lCtx.strokeStyle = '#fbbf24';
    lCtx.lineWidth = 2.5;
    lCtx.beginPath();
    lCtx.arc(80, 390, 34, 0, Math.PI * 2);
    lCtx.stroke();
    lCtx.font = 'italic 700 28px "Cormorant Garamond", Georgia, serif';
    lCtx.fillStyle = '#fbbf24';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText('BB', 80, 390);

    // Bottom Typography: Editorial, Classical, Highly Legible
    lCtx.textAlign = 'left';
    lCtx.textBaseline = 'alphabetic';
    lCtx.fillStyle = '#ffffff';
    lCtx.font = '600 34px "Cormorant Garamond", Georgia, serif';
    lCtx.letterSpacing = '3px';
    lCtx.fillText('BLACK BOX  FLIGHT RECORDER', 136, 375);

    lCtx.fillStyle = '#fbbf24';
    lCtx.font = '600 18px "JetBrains Mono", monospace';
    lCtx.fillText('DETERMINISTIC CAUSALITY ENGINE • CRYPTOGRAPHIC MERKLE ROOT: 9E4F-A82B', 136, 408);

    lCtx.fillStyle = '#cbd5e1';
    lCtx.font = '14px "JetBrains Mono", monospace';
    lCtx.fillText('TSO-C124b AVIATION CORE • 3400G IMPACT TOLERANT • ZERO TOKEN REPLAY', 136, 436);
    lCtx.fillText('P/N: BB-8924-MK4   S/N: AF-00918-B9   SPEC: MIL-STD-810H', 136, 462);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 2.7),
      new THREE.MeshStandardMaterial({
        map: labelTexture,
        metalness: 0.0,
        roughness: 0.85,
      })
    );
    labelMesh.position.set(0, 0.1, 1.76);
    boxGroup.add(labelMesh);

    // F. Live Dynamic Diagnostic Screen (Upper-Left Smoked-Sapphire OLED Display)
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 256;
    const ctx = screenCanvas.getContext('2d')!;

    // Initial render
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 500, 244);

    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.needsUpdate = true;
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.15), screenMat);
    screenMesh.position.set(-1.25, 0.72, 1.83);
    boxGroup.add(screenMesh);

    // Bezel for screen in Gold & Titanium
    const screenBezel = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 1.28, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x141a27, metalness: 0.95, roughness: 0.1 })
    );
    screenBezel.position.set(-1.25, 0.72, 1.77);
    boxGroup.add(screenBezel);

    const screenRim = new THREE.Mesh(
      new THREE.BoxGeometry(2.46, 1.32, 0.02),
      goldMat
    );
    screenRim.position.set(-1.25, 0.72, 1.75);
    boxGroup.add(screenRim);

    // G. Glowing Amber Status Diode (Upper-Right Aviation Strobe)
    const diodeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x242d3d, metalness: 0.95, roughness: 0.1 })
    );
    diodeBody.rotation.x = Math.PI / 2;
    diodeBody.position.set(1.4, 0.85, 1.78);
    boxGroup.add(diodeBody);

    const diodeEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 5.5,
      roughness: 0.05,
    });
    const diodeEmitter = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), diodeEmissiveMat);
    diodeEmitter.position.set(1.4, 0.85, 1.84);
    boxGroup.add(diodeEmitter);

    // Knurled 24k Gold Rotary Encoder Dial (Between Screen and Diode)
    const dialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 32), goldMat);
    dialBase.rotation.x = Math.PI / 2;
    dialBase.position.set(0.35, 0.75, 1.84);
    boxGroup.add(dialBase);

    // Dial Knurl Ridges
    for (let d = 0; d < 24; d++) {
      const angle = (d / 24) * Math.PI * 2;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), tungstenMat);
      ridge.position.set(0.35 + Math.cos(angle) * 0.31, 0.75 + Math.sin(angle) * 0.31, 1.94);
      boxGroup.add(ridge);
    }

    // H. High-Density Military I/O Cluster (Lower-Right)
    // Amphenol 38999 Bayonet Connector with 19 recessed gold pins
    const milConnector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.35, 32),
      tungstenMat
    );
    milConnector.rotation.x = Math.PI / 2;
    milConnector.position.set(1.4, -0.3, 1.88);
    boxGroup.add(milConnector);

    const milGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 16, 32), goldMat);
    milGoldRing.position.set(1.4, -0.3, 1.98);
    boxGroup.add(milGoldRing);

    // 19 micro gold pins inside circular connector
    for (let p = 0; p < 19; p++) {
      const ringIdx = p < 7 ? 0 : 1;
      const totalInRing = ringIdx === 0 ? 6 : 12;
      const angle = ((p % totalInRing) / totalInRing) * Math.PI * 2;
      const r = ringIdx === 0 ? 0.16 : 0.30;
      const pinX = p === 0 ? 1.4 : 1.4 + Math.cos(angle) * r;
      const pinY = p === 0 ? -0.3 : -0.3 + Math.sin(angle) * r;

      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10), goldMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(pinX, pinY, 2.0);
      boxGroup.add(pin);
    }

    // Gold SMA Coaxial Port with Knurled Hex Nut
    const smaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 24), goldMat);
    smaBase.rotation.x = Math.PI / 2;
    smaBase.position.set(2.15, 0.85, 1.88);
    boxGroup.add(smaBase);

    const smaNut = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 6), goldMat);
    smaNut.rotation.x = Math.PI / 2;
    smaNut.position.set(2.15, 0.85, 1.92);
    boxGroup.add(smaNut);

    // Fiber Optic High-Speed Transceiver Port (Electric Cyan Core)
    const fiberBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 24), steelMat);
    fiberBase.rotation.x = Math.PI / 2;
    fiberBase.position.set(2.15, 0.25, 1.86);
    boxGroup.add(fiberBase);

    const fiberCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 4.0,
        roughness: 0.1,
      })
    );
    fiberCore.position.set(2.15, 0.25, 1.98);
    boxGroup.add(fiberCore);

    // I. Side Cooling Fins (14 milled slats per side with subtle gold shielding)
    for (let i = -1.4; i <= 1.4; i += 0.22) {
      const finL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.07), chassisTitaniumMat);
      finL.position.set(-3.14, 0, i);
      boxGroup.add(finL);

      const finR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.07), chassisTitaniumMat);
      finR.position.set(3.14, 0, i);
      boxGroup.add(finR);
    }

    // 4. Subtle Radial Contact Ground Shadow in Open Space
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
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.65 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -3.2;
    scene.add(shadowPlane);

    // 5. Orbital Telemetry Rings in Site Colors (Ice-Cyan & Warm 24K Gold)
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const ringMatCyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.014, 16, 140), ringMatCyan);
    ring1.rotation.x = Math.PI / 2.3;
    ringGroup.add(ring1);

    const ringMatGold = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.012, 16, 140), ringMatGold);
    ring2.rotation.y = Math.PI / 2.6;
    ringGroup.add(ring2);

    // Stardust floating particles
    const pCount = 200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 40;
      pPos[i + 1] = (Math.random() - 0.5) * 26;
      pPos[i + 2] = (Math.random() - 0.5) * 26;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xd4af37, size: 0.09, transparent: true, opacity: 0.55 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // 6. Interactive Mouse Parallax & Drag Orbit
    const targetRot = { x: 0.14, y: -0.38 };
    const currentRot = { x: 0.14, y: -0.38 };
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
        targetRot.y += dx * 0.007;
        targetRot.x += dy * 0.007;
        prevMouse = { x: e.clientX, y: e.clientY };
      } else {
        const nx = (e.clientX / window.innerWidth) - 0.5;
        const ny = (e.clientY / window.innerHeight) - 0.5;
        targetRot.y = -0.38 + nx * 0.45;
        targetRot.x = 0.14 + ny * 0.25;
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

    // 7. Animation Loop
    let animId: number;
    let frameCount = 0;
    let clockTime = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clockTime += 0.016;
      frameCount++;

      // Floating zero-gravity breathing oscillation
      boxGroup.position.y = Math.sin(clockTime * 1.1) * 0.10;
      boxGroup.position.x = Math.cos(clockTime * 0.75) * 0.04;

      // Smooth rotation damping
      currentRot.x += (targetRot.x - currentRot.x) * 0.08;
      currentRot.y += (targetRot.y - currentRot.y) * 0.08;
      boxGroup.rotation.x = currentRot.x;
      boxGroup.rotation.y = currentRot.y;

      // Aviation Strobe pulse rhythm matching website amber glow
      const strobe = Math.sin(clockTime * 5.0) > 0.65 ? 8.0 : 1.5;
      beaconLight.intensity = strobe;
      diodeEmissiveMat.emissiveIntensity = strobe * 0.9;

      // Rotate orbital data rings
      ring1.rotation.z = clockTime * 0.08;
      ring2.rotation.x = clockTime * 0.05;
      particles.rotation.y = clockTime * 0.012;

      // Update OLED screen texture every 3 frames with high-luxury vector telemetry
      if (frameCount % 3 === 0) {
        ctx.fillStyle = '#0c1424';
        ctx.fillRect(0, 0, 512, 256);

        // Screen border hairline in champagne gold
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(8, 8, 496, 240);

        // Screen Header
        ctx.font = '600 20px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('AVIONICS MK-IV', 24, 38);

        // Cyan status pill
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.roundRect(310, 18, 178, 28, 14);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.roundRect(310, 18, 178, 28, 14);
        ctx.stroke();

        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('• DETERMINISTIC REPLAY', 322, 36);

        // Telemetry readouts
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`UPTIME: ${clockTime.toFixed(1)}s  |  RATE: 1,000 STEPS/SEC`, 24, 66);
        ctx.fillText('MERKLE ROOT: 0x9E4F-A82B-7C01-FF18', 24, 88);

        // Draw Hairline Waveform 1: Causal Entropy (Champagne Gold)
        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        for (let x = 24; x < 488; x += 4) {
          const waveY = 145 + Math.sin((x * 0.06) + (clockTime * 6)) * 16 + Math.cos(x * 0.03) * 6;
          if (x === 24) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();

        // Draw Hairline Waveform 2: State Verification (Ice-Cyan)
        ctx.beginPath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        for (let x = 24; x < 488; x += 4) {
          const waveY = 195 + Math.sin((x * 0.08) - (clockTime * 4)) * 14 + (Math.random() - 0.5) * 3;
          if (x === 24) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();

        // Bottom Metrics in Monospace
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('ENTROPY: 0.0024 nats', 24, 232);
        ctx.fillText('ATTRIBUTION: 99.4%', 190, 232);
        ctx.fillText('REGRESSION: 0.00%', 360, 232);

        screenTexture.needsUpdate = true;
      }

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
  }, []);

  return (
    <div className="relative w-full h-[480px] sm:h-[580px] lg:h-[660px] flex items-center justify-center my-0 pointer-events-auto">
      {/* Three.js Canvas Hovering in Open Space */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Subtle Floating Interaction Cue in Frosted Glass */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-[11px] font-mono text-zinc-300 transition-opacity duration-500 pointer-events-none shadow-2xl ${isInteracting ? 'opacity-20' : 'opacity-85'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Drag 360° to inspect • Aerospace Titanium &amp; 24K Gold Shader</span>
      </div>
    </div>
  );
};

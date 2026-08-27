import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HologramState, HologramVisualTelemetry } from '../../lib/core/types';
import { hologramEngine } from '../../lib/core/hologram-engine';

interface JarvisHologramCanvasProps {
  state?: HologramState;
  audioLevel?: number; // 0 to 100
  intensity?: number; // 0.1 to 2.5
  ecoMode?: boolean;
  width?: number;
  height?: number;
  interactive?: boolean;
  className?: string;
  onCoreClick?: () => void;
}

// 3D Particle Model in Polar / Cartesian Coordinates
interface HologramParticle {
  // Base spherical coordinates
  theta: number; // Longitude [0, 2PI]
  phi: number;   // Latitude [-PI/2, PI/2]
  radius: number;// Distance from core center
  baseRadius: number;
  speedTheta: number;
  speedPhi: number;
  size: number;
  alpha: number;
  pulsePhase: number;
  // Dynamic offset during apparition / thinking / speaking
  liftY: number; // for beam launch
  colorType: 'cyan' | 'blue' | 'bright' | 'white';
}

export const JarvisHologramCanvas: React.FC<JarvisHologramCanvasProps> = ({
  state,
  audioLevel = 0,
  intensity = 1.0,
  ecoMode = false,
  width,
  height,
  interactive = true,
  className = '',
  onCoreClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Engine telemetry state
  const [telemetry, setTelemetry] = useState<HologramVisualTelemetry>(() => hologramEngine.telemetry);

  // Sync with engine
  useEffect(() => {
    const unsub = hologramEngine.subscribe((newTelem) => {
      setTelemetry(newTelem);
    });
    return unsub;
  }, []);

  // Update engine properties when props change
  useEffect(() => {
    if (state && state !== hologramEngine.state) {
      hologramEngine.setState(state);
    }
  }, [state]);

  useEffect(() => {
    hologramEngine.setAudioLevel(audioLevel);
  }, [audioLevel]);

  useEffect(() => {
    hologramEngine.setIntensity(intensity);
  }, [intensity]);

  useEffect(() => {
    hologramEngine.setEcoMode(ecoMode);
  }, [ecoMode]);

  // Main Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdateTime = performance.now();

    // 3D Matrix & Rotation angles
    let angleY = 0;
    let angleX = 0.22; // slight downward viewing pitch for 3D depth
    let angleZ = 0;

    // Pulse & Wave clock
    let globalTime = 0;

    // Initialize 3D particle cloud
    const particles: HologramParticle[] = [];
    const MAX_PARTICLES = 260;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      // Golden spiral distribution on sphere for uniform aesthetic coverage
      const phi = Math.acos(1 - (2 * (i + 0.5)) / MAX_PARTICLES) - Math.PI / 2;
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const baseRadius = 85 + (Math.random() * 25 - 12);

      const colorTypes: ('cyan' | 'blue' | 'bright' | 'white')[] = ['cyan', 'cyan', 'blue', 'bright', 'white'];
      const colorType = colorTypes[Math.floor(Math.random() * colorTypes.length)];

      particles.push({
        theta,
        phi,
        radius: baseRadius,
        baseRadius,
        speedTheta: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
        speedPhi: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.4 + 1.2,
        alpha: Math.random() * 0.6 + 0.35,
        pulsePhase: Math.random() * Math.PI * 2,
        liftY: Math.random() * 200,
        colorType,
      });
    }

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for Android performance
      const w = width || rect.width || 340;
      const h = height || rect.height || 420;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // ----------------------------------------------------
    // ANIMATION RENDER LOOP (60 FPS OPTIMIZED)
    // ----------------------------------------------------
    const render = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      globalTime += delta;

      // Calculate Real-time FPS & report to engine for mobile auto-degradation
      frameCount++;
      if (currentTime - lastFpsUpdateTime > 800) {
        const currentFps = (frameCount * 1000) / (currentTime - lastFpsUpdateTime);
        hologramEngine.reportFps(currentFps);
        frameCount = 0;
        lastFpsUpdateTime = currentTime;
      }

      // Telemetry readings
      const curTelem = hologramEngine.telemetry;
      const curState = curTelem.state;
      const curAudio = curTelem.audioLevel;
      const curIntensity = curTelem.intensity;
      const beamHeight = curTelem.beamHeight;
      const condensation = curTelem.coreCondensation;
      const isDegraded = curTelem.autoDegraded || ecoMode;

      // Active particle count (adjusted by performance mode)
      const activeCount = isDegraded ? 80 : curTelem.particleDensity;

      // Virtual dimensions
      const w = canvas.width / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1);
      const h = canvas.height / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1);
      const centerX = w / 2;
      const centerY = h * 0.44; // Position sphere slightly above center
      const baseY = h * 0.88;    // Position projector base near bottom

      // Clear Canvas Frame
      ctx.clearRect(0, 0, w, h);

      if (curState === 'hidden') {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Dynamic rotation speed based on state & audio
      const bass = curTelem.bassEnergy || 0;
      const mid = curTelem.midEnergy || 0;
      const treble = curTelem.trebleEnergy || 0;
      const energyLevel = curTelem.energyLevel || 'SILENCE';

      let rotSpeed = curTelem.rotationSpeed;
      if (curState === 'thinking') {
        rotSpeed = 4.8;
      } else if (curState === 'listening') {
        rotSpeed = 1.6 + (curAudio / 100) * 1.8;
      } else if (curState === 'speaking') {
        // Voice-reactive modulation: speed increases with vocal energy and formant intensity
        rotSpeed = 1.5 + mid * 2.2 + (curAudio / 100) * 2.5;
      }
      angleY += rotSpeed * delta * 0.6;
      angleZ = Math.sin(globalTime * 0.8) * 0.08;

      // ----------------------------------------------------
      // 1. CERCLE ÉNERGÉTIQUE À LA BASE (Projecteur Holographique)
      // ----------------------------------------------------
      const baseRadiusX = (110 + (curState === 'speaking' ? bass * 25 : 0)) * condensation;
      const baseRadiusY = (32 + (curState === 'speaking' ? bass * 8 : 0)) * condensation;
      const baseGlow = curTelem.glowIntensity * curIntensity;

      if (condensation > 0.05) {
        ctx.save();
        ctx.translate(centerX, baseY);

        // Ground Glow Aura
        const groundGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadiusX * 1.4);
        groundGrad.addColorStop(0, `rgba(6, 182, 212, ${0.45 * baseGlow})`);
        groundGrad.addColorStop(0.5, `rgba(2, 132, 199, ${0.2 * baseGlow})`);
        groundGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = groundGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadiusX * 1.4, baseRadiusY * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base Outer Ring (Rotating Dashes)
        ctx.save();
        ctx.rotate(-globalTime * (0.4 + (curState === 'speaking' ? mid * 0.8 : 0)));
        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadiusX, baseRadiusY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.75 * curIntensity})`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([14, 8, 4, 8]);
        ctx.stroke();
        ctx.restore();

        // Base Intermediate Concentric Ring (Counter-Rotating)
        ctx.save();
        ctx.rotate(globalTime * (0.7 + (curState === 'speaking' ? treble * 1.2 : 0)));
        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadiusX * 0.72, baseRadiusY * 0.72, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.85 * curIntensity})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.restore();

        // Base Emitter Core Lens
        ctx.beginPath();
        ctx.ellipse(0, 0, baseRadiusX * 0.35, baseRadiusY * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${0.4 * curIntensity})`;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();

        // Base Hologram Tech Crosshairs / Quadrant Markers
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + globalTime * 0.2;
          const px = Math.cos(a) * (baseRadiusX + 12);
          const py = Math.sin(a) * (baseRadiusY + 4);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // ----------------------------------------------------
      // 2. FAISCEAU VERTICAL (PROJECTION HOLOGRAPHIQUE)
      // ----------------------------------------------------
      if (beamHeight > 0.02) {
        ctx.save();
        const curBeamTop = baseY - (baseY - (centerY - 90)) * beamHeight;

        // Volumetric Cone Light Gradient (Modulated by vocal energy)
        const beamAlphaMod = curState === 'speaking' ? 0.35 + mid * 0.35 + (curAudio / 100) * 0.3 : 0.45;
        const beamGrad = ctx.createLinearGradient(centerX, baseY, centerX, curBeamTop);
        beamGrad.addColorStop(0, `rgba(6, 182, 212, ${beamAlphaMod * curIntensity})`);
        beamGrad.addColorStop(0.4, `rgba(59, 130, 246, ${0.25 * curIntensity})`);
        beamGrad.addColorStop(0.8, `rgba(6, 182, 212, ${0.12 * curIntensity})`);
        beamGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        const coneSpread = (100 + (curState === 'speaking' ? (curAudio / 100) * 20 : 0)) * condensation;
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(centerX - baseRadiusX * 0.75, baseY);
        ctx.lineTo(centerX - coneSpread, curBeamTop);
        ctx.lineTo(centerX + coneSpread, curBeamTop);
        ctx.lineTo(centerX + baseRadiusX * 0.75, baseY);
        ctx.closePath();
        ctx.fill();

        // Vertical Holographic Scanlines / Beam Strands
        const strandCount = isDegraded ? 4 : 8;
        for (let s = 0; s < strandCount; s++) {
          const xOffset = ((s - strandCount / 2) / (strandCount / 2)) * (baseRadiusX * 0.6);
          const topXOffset = xOffset * 0.9;
          const strandAlpha = (0.25 + 0.2 * Math.sin(globalTime * 4 + s) + (curState === 'speaking' ? treble * 0.25 : 0)) * curIntensity * condensation;

          ctx.strokeStyle = `rgba(56, 189, 248, ${strandAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerX + xOffset, baseY);
          ctx.lineTo(centerX + topXOffset, curBeamTop);
          ctx.stroke();
        }

        // Ascending Light Pulses along beam (Data Packets speed up with voice)
        const pulseSpeed = curState === 'speaking' ? 260 + (curAudio / 100) * 200 : 180;
        const pulseY = baseY - ((globalTime * pulseSpeed) % (baseY - curBeamTop));
        if (pulseY > curBeamTop && pulseY < baseY) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * curIntensity})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(centerX - 60, pulseY);
          ctx.lineTo(centerX + 60, pulseY);
          ctx.stroke();
        }

        ctx.restore();
      }

      // ----------------------------------------------------
      // 3. SPHÈRE ÉNERGÉTIQUE 3D & NUAGE DE PARTICULES
      // ----------------------------------------------------
      const CAMERA_DIST = 320;
      const project3D = (x: number, y: number, z: number) => {
        // Rotate around Y axis
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // Rotate around X axis (pitch)
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Rotate around Z axis
        const cosZ = Math.cos(angleZ);
        const sinZ = Math.sin(angleZ);
        const x3 = x1 * cosZ - y2 * sinZ;
        const y3 = x1 * sinZ + y2 * cosZ;

        // Perspective scale factor
        const scale = CAMERA_DIST / (CAMERA_DIST + z2);
        return {
          px: centerX + x3 * scale,
          py: centerY + y3 * scale,
          pz: z2,
          scale,
        };
      };

      // Calculate dynamic sphere radius from vocal acoustics
      let sphereBaseRadius = 88 * condensation;
      if (curState === 'listening') {
        sphereBaseRadius += (curAudio / 100) * 18;
      } else if (curState === 'speaking') {
        // Multi-frequency spectral expansion
        sphereBaseRadius += bass * 20 + mid * 12 + (curAudio / 100) * 16;
      } else if (curState === 'thinking') {
        sphereBaseRadius = 80 + Math.sin(globalTime * 12) * 5;
      }

      // Projected particle cache for sorting and line drawing
      interface ProjectedPt {
        px: number;
        py: number;
        pz: number;
        scale: number;
        size: number;
        alpha: number;
        color: string;
      }
      const projectedList: ProjectedPt[] = [];

      // Update particle physics
      for (let i = 0; i < activeCount; i++) {
        const p = particles[i];

        // State-specific particle behavior
        if (curState === 'appearing') {
          p.liftY = Math.max(0, p.liftY - delta * 220);
        } else if (curState === 'thinking') {
          p.theta += p.speedTheta * 5;
          p.phi += p.speedPhi * 3;
          p.radius = p.baseRadius * (0.75 + 0.25 * Math.sin(globalTime * 4 + i));
        } else if (curState === 'listening') {
          p.theta += p.speedTheta * (1.5 + (curAudio / 100) * 2.0);
          p.radius = p.baseRadius + Math.sin(globalTime * 6 + i) * ((curAudio / 100) * 16);
        } else if (curState === 'speaking') {
          // Dynamic voice-driven harmonic oscillation
          const speedMultiplier = 1.6 + (curAudio / 100) * 2.5 + treble * 1.5;
          p.theta += p.speedTheta * speedMultiplier;
          p.phi += p.speedPhi * (1.2 + mid * 1.5);
          
          // Organic breathing & acoustic expansion
          const vocalVibration = Math.sin(globalTime * 12 + p.phi * 5) * (bass * 16 + (curAudio / 100) * 10);
          p.radius = p.baseRadius + vocalVibration;
        } else {
          // Idle: gentle floating
          p.theta += p.speedTheta * 1.0;
          p.phi += p.speedPhi * 1.0;
          p.radius = p.baseRadius + Math.sin(globalTime * 1.5 + p.pulsePhase) * 4;
        }

        // Compute 3D Cartesian coordinates on sphere
        const r = p.radius * (sphereBaseRadius / 88);
        const x3d = r * Math.cos(p.phi) * Math.sin(p.theta);
        const y3d = r * Math.sin(p.phi);
        const z3d = r * Math.cos(p.phi) * Math.cos(p.theta);

        const proj = project3D(x3d, y3d, z3d);

        // Alpha calculation based on depth and state
        const depthAlpha = Math.max(0.15, (proj.pz + 100) / 200);
        let colorStr = 'rgba(6, 182, 212, ';
        if (p.colorType === 'white' || (curState === 'speaking' && energyLevel === 'PEAK' && i % 3 === 0)) {
          colorStr = 'rgba(255, 255, 255, ';
        } else if (p.colorType === 'bright') {
          colorStr = 'rgba(56, 189, 248, ';
        } else if (p.colorType === 'blue') {
          colorStr = 'rgba(59, 130, 246, ';
        }

        const voiceAlphaBoost = curState === 'speaking' ? 0.2 * (curAudio / 100) : 0;
        const finalAlpha = Math.min(1.0, (p.alpha + voiceAlphaBoost) * depthAlpha * curIntensity * condensation);

        projectedList.push({
          px: proj.px,
          py: proj.py,
          pz: proj.pz,
          scale: proj.scale,
          size: (p.size + (curState === 'speaking' && energyLevel === 'PEAK' ? 0.8 : 0)) * proj.scale,
          alpha: finalAlpha,
          color: `${colorStr}${finalAlpha})`,
        });
      }

      // Sort particles back-to-front for accurate holographic depth
      projectedList.sort((a, b) => a.pz - b.pz);

      // ----------------------------------------------------
      // 4. RÉSEAU DE LIGNES LUMINEUSES & ANNEAUX ORBITAUX
      // ----------------------------------------------------
      if (condensation > 0.3) {
        // A. Equatorial Orbital Ring (Deforms with voice frequency formants)
        ctx.save();
        ctx.lineWidth = curState === 'speaking' ? 1.5 + mid * 0.8 : 1.2;
        ctx.strokeStyle = `rgba(6, 182, 212, ${(0.5 + (curState === 'speaking' ? mid * 0.35 : 0)) * curIntensity * condensation})`;
        ctx.beginPath();
        const ringSegments = isDegraded ? 24 : 48;
        for (let s = 0; s <= ringSegments; s++) {
          const rad = (s / ringSegments) * Math.PI * 2;
          const rx = (sphereBaseRadius + 14) * Math.cos(rad);
          const rz = (sphereBaseRadius + 14) * Math.sin(rad);
          
          // Formant harmonic wave modulation
          const formantWave = curState === 'speaking'
            ? Math.sin(rad * 4 + globalTime * 8) * (4 + mid * 18 + (curAudio / 100) * 12)
            : Math.sin(rad * 3 + globalTime * 4) * 2;
          
          const ry = formantWave;
          const rp = project3D(rx, ry, rz);
          if (s === 0) ctx.moveTo(rp.px, rp.py);
          else ctx.lineTo(rp.px, rp.py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // B. Polar Meridian Arc (3D Rotational Gyro Ring)
        ctx.save();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.45 * curIntensity * condensation})`;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        for (let s = 0; s <= ringSegments; s++) {
          const rad = (s / ringSegments) * Math.PI * 2;
          const rx = (sphereBaseRadius + 8) * Math.sin(rad) * Math.cos(globalTime * 0.6);
          const ry = (sphereBaseRadius + 8) * Math.cos(rad);
          const rz = (sphereBaseRadius + 8) * Math.sin(rad) * Math.sin(globalTime * 0.6);
          const rp = project3D(rx, ry, rz);
          if (s === 0) ctx.moveTo(rp.px, rp.py);
          else ctx.lineTo(rp.px, rp.py);
        }
        ctx.stroke();
        ctx.restore();

        // C. Dynamic Particle Constellation Lines (Inter-particle links)
        if (!isDegraded && condensation > 0.5) {
          const maxDist = curState === 'thinking' ? 44 : (curState === 'speaking' ? 38 + (curAudio / 100) * 10 : 32);
          const maxDistSq = maxDist * maxDist;
          ctx.lineWidth = 0.7;

          const step = curState === 'thinking' ? 1 : 2;
          for (let i = 0; i < projectedList.length; i += step) {
            const p1 = projectedList[i];
            for (let j = i + 1; j < Math.min(i + 8, projectedList.length); j++) {
              const p2 = projectedList[j];
              const dx = p1.px - p2.px;
              const dy = p1.py - p2.py;
              const distSq = dx * dx + dy * dy;
              if (distSq < maxDistSq) {
                const linkAlpha = (1 - Math.sqrt(distSq) / maxDist) * 0.35 * curIntensity * condensation;
                ctx.strokeStyle = `rgba(6, 182, 212, ${linkAlpha})`;
                ctx.beginPath();
                ctx.moveTo(p1.px, p1.py);
                ctx.lineTo(p2.px, p2.py);
                ctx.stroke();
              }
            }
          }
        }
      }

      // ----------------------------------------------------
      // 5. NOYAU LUMINEUX (QUANTUM / ARC FUSION CORE)
      // ----------------------------------------------------
      if (condensation > 0.1) {
        ctx.save();
        const coreProj = project3D(0, 0, 0);

        // Core dynamic radius with Bass, Formants & Energy Levels
        let coreRadius = 24 * condensation * curIntensity;
        if (curState === 'idle') {
          coreRadius += Math.sin(globalTime * 2.0) * 3;
        } else if (curState === 'listening') {
          coreRadius += 4 + (curAudio / 100) * 12;
        } else if (curState === 'thinking') {
          coreRadius += 6 + Math.sin(globalTime * 14) * 5;
        } else if (curState === 'speaking') {
          // Granular voice dynamics: Bass expands core, Mid pulses core, Peak bursts core
          const speechPulse = Math.sin(globalTime * (8 + mid * 10)) * (4 + mid * 6);
          coreRadius += 6 + speechPulse + bass * 18 + (curAudio / 100) * 14;
          if (energyLevel === 'PEAK') coreRadius += 8;
        }

        // Layer 1: Outermost Soft Glow Halo (Expands broadly with acoustic energy)
        const outerAuraRad = coreRadius * (2.8 + (curState === 'speaking' ? mid * 1.2 + (curAudio / 100) * 0.8 : 0.4));
        const outerGrad = ctx.createRadialGradient(
          coreProj.px, coreProj.py, coreRadius * 0.4,
          coreProj.px, coreProj.py, outerAuraRad
        );
        const glowBoost = curState === 'speaking' ? 0.65 + (curAudio / 100) * 0.35 : 0.65;
        outerGrad.addColorStop(0, `rgba(6, 182, 212, ${glowBoost * curIntensity})`);
        outerGrad.addColorStop(0.4, `rgba(59, 130, 246, ${0.35 * curIntensity})`);
        outerGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.arc(coreProj.px, coreProj.py, outerAuraRad, 0, Math.PI * 2);
        ctx.fill();

        // Layer 2: Intermediate High-Energy Plasma Sphere
        const coreGrad = ctx.createRadialGradient(
          coreProj.px - coreRadius * 0.2, coreProj.py - coreRadius * 0.2, 0,
          coreProj.px, coreProj.py, coreRadius
        );
        if (curState === 'speaking' && energyLevel === 'PEAK') {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.4, '#e0f2fe');
          coreGrad.addColorStop(0.8, '#38bdf8');
          coreGrad.addColorStop(1, 'rgba(6, 182, 212, 0.4)');
        } else {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.3, '#38bdf8');
          coreGrad.addColorStop(0.7, '#0284c7');
          coreGrad.addColorStop(1, 'rgba(6, 182, 212, 0.2)');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(coreProj.px, coreProj.py, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: Concentric Core Orbit Ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = curState === 'speaking' && energyLevel === 'PEAK' ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.arc(coreProj.px, coreProj.py, coreRadius * 1.18, 0, Math.PI * 2);
        ctx.stroke();

        // Layer 4: Acoustic Shockwave Ripples (Expanding outward on vocal surges)
        if ((curState === 'speaking' || curState === 'listening') && curAudio > 8) {
          const rippleCount = energyLevel === 'PEAK' ? 2 : 1;
          for (let r = 0; r < rippleCount; r++) {
            const speed = energyLevel === 'PEAK' ? 95 : 65;
            const rippleOffset = (r * 32);
            const rippleRad = coreRadius + ((globalTime * speed + rippleOffset) % 80);
            const rippleAlpha = Math.max(0, 1 - (rippleRad - coreRadius) / 80) * (energyLevel === 'PEAK' ? 0.85 : 0.6);
            ctx.strokeStyle = energyLevel === 'PEAK' ? `rgba(255, 255, 255, ${rippleAlpha})` : `rgba(56, 189, 248, ${rippleAlpha})`;
            ctx.lineWidth = energyLevel === 'PEAK' ? 2.0 : 1.5;
            ctx.beginPath();
            ctx.arc(coreProj.px, coreProj.py, rippleRad, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // ----------------------------------------------------
      // 6. DRAW 3D PARTICLES
      // ----------------------------------------------------
      for (let i = 0; i < projectedList.length; i++) {
        const pt = projectedList[i];
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, Math.max(0.6, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }

      // Request next frame if page is visible
      if (!document.hidden) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
    };
  }, [width, height, ecoMode]);

  return (
    <div
      ref={containerRef}
      onClick={interactive ? onCoreClick : undefined}
      className={`relative flex items-center justify-center select-none overflow-hidden ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '400px',
      }}
    >
      {/* Real-time WebGL/2D Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Futuristic Sci-Fi State Badge */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-2 pointer-events-none z-10 whitespace-nowrap">
        <div className="px-3 py-1 rounded-full bg-slate-950/80 border border-cyan-500/40 backdrop-blur-md flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
          <span
            className={`w-2 h-2 rounded-full ${
              telemetry.state === 'appearing'
                ? 'bg-amber-400 animate-ping'
                : telemetry.state === 'listening'
                ? 'bg-cyan-400 animate-pulse'
                : telemetry.state === 'thinking'
                ? 'bg-amber-400 animate-spin'
                : telemetry.state === 'speaking'
                ? 'bg-blue-400 animate-bounce'
                : telemetry.state === 'disappearing'
                ? 'bg-rose-400 animate-pulse'
                : 'bg-emerald-400'
            }`}
          />
          <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            {telemetry.state === 'appearing' && 'ÉTAT 1 : APPARITION'}
            {telemetry.state === 'idle' && 'ÉTAT 2 : VEILLE HOLOGRAPHIQUE'}
            {telemetry.state === 'listening' && 'ÉTAT 3 : ÉCOUTE ACTIVE'}
            {telemetry.state === 'thinking' && 'ÉTAT 4 : RÉFLEXION NEURONALE'}
            {telemetry.state === 'speaking' && 'ÉTAT 5 : PAROLE AUDIO-RÉACTIVE'}
            {telemetry.state === 'disappearing' && 'ÉTAT 6 : FIN / DÉSACTIVATION'}
            {telemetry.state === 'hidden' && 'HOLOGRAPHIC OFFLINE'}
          </span>
          {telemetry.state === 'speaking' && telemetry.energyLevel && telemetry.energyLevel !== 'SILENCE' && (
            <span
              className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                telemetry.energyLevel === 'PEAK'
                  ? 'bg-red-950/80 text-red-300 border-red-500 animate-pulse'
                  : telemetry.energyLevel === 'HIGH'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                  : telemetry.energyLevel === 'MEDIUM'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700'
              }`}
            >
              LEVEL: {telemetry.energyLevel}
            </span>
          )}
          {telemetry.autoDegraded && (
            <span className="text-[8px] font-mono text-amber-400 bg-amber-950/60 px-1 rounded border border-amber-500/40">
              OPTIMISATION ANDROID
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

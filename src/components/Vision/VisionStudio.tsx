import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  FileText,
  Scan,
  CheckCircle2,
  AlertCircle,
  Square,
  Copy,
  Sliders,
  Image as ImageIcon,
  Zap,
  Eye,
  Layers,
  Shield,
  ShieldCheck,
  HelpCircle,
  Smartphone,
  Bug,
  Check,
  BookmarkPlus,
  Send,
} from 'lucide-react';
import { analyzeVisionImage, testVisionFormats, storeMemory } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useJarvisVoice } from '../../hooks/useJarvisVoice';
import type { VisionAnalysisResult, VisionTaskType } from '../../types';

interface VisionStudioProps {
  onInsertIntoChat?: (image: string, analysis: string) => void;
  className?: string;
}

export const VisionStudio: React.FC<VisionStudioProps> = ({ onInsertIntoChat, className = '' }) => {
  const [activeTab, setActiveTab] = useState<VisionTaskType>('photo');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [copied, setCopied] = useState(false);
  const [copiedOcr, setCopiedOcr] = useState(false);
  const [savedToMemory, setSavedToMemory] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [continuousDetections, setContinuousDetections] = useState<string[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [formatTestResults, setFormatTestResults] = useState<Record<string, { valid: boolean; mimeType: string }> | null>(null);
  const [isTestingFormats, setIsTestingFormats] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const continuousIntervalRef = useRef<any>(null);

  const settings = useAppStore((state) => state.settings);
  const activeConversationId = useAppStore((state) => state.activeId);
  const addMessage = useAppStore((state) => state.addMessage);

  const { speak, stopSpeaking, isSpeaking } = useJarvisVoice();

  // Continuous Analysis loop
  useEffect(() => {
    if (isCameraActive && continuousMode) {
      continuousIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0) return;
        canvas.width = 480;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

        try {
          const res = await analyzeVisionImage({
            image: dataUrl,
            prompt: 'Identifie brièvement en 3 mots-clés les objets et le texte visibles.',
            task: 'general',
            language: 'fr-FR',
            privacyMode,
          });
          if (res?.analysis) {
            const words = res.analysis.split('\n').filter(Boolean).slice(0, 4);
            setContinuousDetections(words.length ? words : [res.analysis.slice(0, 60)]);
            setLastScanTime(new Date().toLocaleTimeString('fr-FR', { second: '2-digit' }));
          }
        } catch {
          // ignore background frame failures
        }
      }, 3000);
    } else {
      if (continuousIntervalRef.current) {
        clearInterval(continuousIntervalRef.current);
      }
    }

    return () => {
      if (continuousIntervalRef.current) {
        clearInterval(continuousIntervalRef.current);
      }
    };
  }, [isCameraActive, continuousMode, privacyMode]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.");
      setIsCameraActive(false);
    }
  }, [cameraFacing]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Switch between front/back cameras
  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
  }, [cameraFacing, isCameraActive, startCamera]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Capture Snapshot from Camera
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImageSrc(dataUrl);
    stopCamera();
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Run Vision Analysis
  const handleAnalyze = async (overridePrompt?: string, overrideTask?: VisionTaskType) => {
    if (!imageSrc) {
      setError('Veuillez d’abord prendre une photo ou charger une image.');
      return;
    }

    const taskToRun = overrideTask || activeTab;
    const promptToRun = overridePrompt || customPrompt.trim() || undefined;

    setIsAnalyzing(true);
    setError(null);
    setSavedToMemory(false);
    stopSpeaking();

    try {
      const result = await analyzeVisionImage({
        image: imageSrc,
        prompt: promptToRun,
        commandIntent: overridePrompt,
        task: taskToRun,
        language: settings.voiceLanguage || 'fr-FR',
        privacyMode,
        allowExternalCloud: !privacyMode,
      });
      setAnalysisResult(result);

      // Auto-vocalize response summary if enabled
      if (settings.autoVocalize && result.vocalSummary) {
        speak(result.vocalSummary);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'analyse visuelle.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger a standard Command
  const handleTriggerCommand = (command: string, task: VisionTaskType) => {
    setActiveTab(task);
    setCustomPrompt(command);
    if (imageSrc) {
      handleAnalyze(command, task);
    }
  };

  // Multi-format test runner
  const handleTestFormats = async () => {
    setIsTestingFormats(true);
    try {
      const res = await testVisionFormats();
      setFormatTestResults(res.formats);
    } catch (err: any) {
      setError(err?.message || 'Échec du test multi-formats');
    } finally {
      setIsTestingFormats(false);
    }
  };

  // Vocalize summary
  const handleVocalize = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else if (analysisResult?.vocalSummary) {
      speak(analysisResult.vocalSummary);
    } else if (analysisResult?.analysis) {
      speak(analysisResult.analysis.slice(0, 300));
    }
  };

  // Copy Analysis to Clipboard
  const handleCopy = () => {
    if (analysisResult?.analysis) {
      navigator.clipboard.writeText(analysisResult.analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyOcr = () => {
    if (analysisResult?.ocrText) {
      navigator.clipboard.writeText(analysisResult.ocrText);
      setCopiedOcr(true);
      setTimeout(() => setCopiedOcr(false), 2000);
    }
  };

  // Save to Memory
  const handleSaveToMemory = async () => {
    if (!analysisResult) return;
    try {
      await storeMemory(
        `[Vision Insights ${new Date().toLocaleDateString()}] Tâche: ${analysisResult.task}\n${analysisResult.analysis}`,
        {
          source: 'vision_studio',
          task: analysisResult.task,
          timestamp: Date.now(),
        },
      );
      setSavedToMemory(true);
      setTimeout(() => setSavedToMemory(false), 3000);
    } catch (err) {
      console.warn('Failed to save to memory:', err);
    }
  };

  // Inject into Chat
  const handleInjectChat = () => {
    if (!analysisResult || !imageSrc) return;

    if (onInsertIntoChat) {
      onInsertIntoChat(imageSrc, analysisResult.analysis);
      return;
    }

    if (activeConversationId) {
      addMessage(activeConversationId, {
        id: Date.now().toString(36),
        role: 'user',
        content: customPrompt ? `[Vision] ${customPrompt}` : `[Vision] Analyse d'image (${activeTab})`,
        timestamp: Date.now(),
        images: [imageSrc],
      });

      addMessage(activeConversationId, {
        id: (Date.now() + 1).toString(36),
        role: 'assistant',
        content: analysisResult.analysis,
        vocalSummary: analysisResult.vocalSummary,
        timestamp: Date.now(),
      });
    }
  };

  // Sample presets for quick testing
  const loadSampleImage = (type: string) => {
    stopCamera();
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (type === 'receipt') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('FACTURE PROFORMA - OPENJARVIS', 50, 60);
      ctx.font = '16px monospace';
      ctx.fillText('------------------------------------------', 50, 90);
      ctx.fillText('1x Module Vision Multimodal      249.00 EUR', 50, 130);
      ctx.fillText('1x OCR & Pipeline Haute Fidelite  99.00 EUR', 50, 160);
      ctx.fillText('------------------------------------------', 50, 200);
      ctx.fillText('TOTAL TTC:                         348.00 EUR', 50, 230);
      ctx.fillText('Date: 2026-08-24 | Statut: ACQUITTÉ', 50, 270);
      setActiveTab('document');
      setCustomPrompt('Lis ce document.');
    } else if (type === 'error') {
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = '#f38ba8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('🔴 CRITICAL SYSTEM EXCEPTION', 40, 50);
      ctx.fillStyle = '#cdd6f4';
      ctx.font = '14px monospace';
      ctx.fillText('Error: ECONNREFUSED 127.0.0.1:5432 (Postgres)', 40, 90);
      ctx.fillStyle = '#a6adc8';
      ctx.fillText('  at DatabasePool.connect (/src/db/pool.ts:42:15)', 40, 130);
      ctx.fillText('  at async HealthCheck.run (/src/server.ts:108:7)', 40, 160);
      ctx.fillText('  Cause: Port is closed or service is not running', 40, 200);
      ctx.fillStyle = '#a6e3a1';
      ctx.fillText('Remedy: Execute systemctl start postgresql', 40, 260);
      setActiveTab('error_diagnosis');
      setCustomPrompt('Explique cette erreur.');
    } else if (type === 'android_ui') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Paramètres Android 15 — Autorisations', 40, 50);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 80, 560, 60);
      ctx.fillRect(40, 160, 560, 60);
      ctx.fillRect(40, 240, 560, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Microphone : Autorisé en arrière-plan', 60, 115);
      ctx.fillText('Caméra & Vision : Accès requis', 60, 195);
      ctx.fillText('Optimisation Batterie : Non restreinte', 60, 275);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(440, 320, 160, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Confirmer', 485, 350);
      setActiveTab('ui_guidance');
      setCustomPrompt('Que dois-je faire sur cet écran ?');
    } else {
      ctx.fillStyle = '#0b132b';
      ctx.fillRect(0, 0, 640, 400);
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.arc(320, 200, 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('OBJET : CAPTEUR HAUTE DÉFINITION JARVIS', 110, 340);
      setActiveTab('photo');
      setCustomPrompt("Qu'est-ce que c'est ?");
    }
    setImageSrc(canvas.toDataURL('image/jpeg'));
  };

  return (
    <div id="vision-studio-container" className={`flex flex-col h-full bg-slate-900 text-slate-100 p-4 md:p-6 overflow-y-auto ${className}`}>
      {/* Header Banner */}
      <div id="vision-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Vision Agent JARVIS
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  Phase 5 Multimodal
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Analyse de photo, capture d'écran, OCR de document, diagnostic d'erreur et guidage UI.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Top */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Privacy Mode Toggle */}
          <button
            id="btn-privacy-toggle"
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              privacyMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Active le respect strict de la confidentialité (aucun envoi externe non nécessaire, EXIF purgé)"
          >
            {privacyMode ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Shield className="w-4 h-4" />}
            <span>{privacyMode ? 'Confidentialité STRICTE' : 'Confidentialité'}</span>
          </button>

          {!isCameraActive ? (
            <button
              id="btn-open-camera"
              onClick={startCamera}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-all shadow-lg shadow-cyan-900/30 active:scale-95"
            >
              <Camera className="w-4 h-4" />
              Activer Caméra
            </button>
          ) : (
            <button
              id="btn-stop-camera"
              onClick={stopCamera}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-sm font-medium transition-all active:scale-95"
            >
              <Square className="w-4 h-4" />
              Fermer Caméra
            </button>
          )}

          <button
            id="btn-upload-file"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Importer Fichier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Voice Commands Trigger Chips */}
      <div id="vision-commands-bar" className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Commandes vocales & textuelles supportées :
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            id="cmd-analyse-image"
            onClick={() => handleTriggerCommand('JARVIS, analyse cette image.', 'photo')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>"JARVIS, analyse cette image."</span>
          </button>

          <button
            id="cmd-quest-ce-que-cest"
            onClick={() => handleTriggerCommand("Qu'est-ce que c'est ?", 'photo')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>"Qu'est-ce que c'est ?"</span>
          </button>

          <button
            id="cmd-lis-document"
            onClick={() => handleTriggerCommand('Lis ce document.', 'document')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>"Lis ce document."</span>
          </button>

          <button
            id="cmd-explique-erreur"
            onClick={() => handleTriggerCommand('Explique cette erreur.', 'error_diagnosis')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <Bug className="w-3.5 h-3.5 text-rose-400" />
            <span>"Explique cette erreur."</span>
          </button>

          <button
            id="cmd-que-faire-ecran"
            onClick={() => handleTriggerCommand('Que dois-je faire sur cet écran ?', 'ui_guidance')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>"Que dois-je faire sur cet écran ?"</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div id="vision-error-alert" className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Left Column: Visual Capture & Preview (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl min-h-[360px] flex items-center justify-center">
            {/* Live Camera Feed */}
            {isCameraActive ? (
              <div className="relative w-full h-full min-h-[380px] flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-2xl max-h-[460px]"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Camera HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none border-2 border-cyan-500/30 rounded-2xl flex flex-col justify-between p-4">
                  <div className="flex justify-between items-center pointer-events-auto">
                    <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-cyan-400 text-xs font-mono flex items-center gap-1.5 border border-cyan-500/20">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      FLUX LIVE {continuousMode ? 'CONTINU' : '1080P'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setContinuousMode(!continuousMode)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all ${
                          continuousMode
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md shadow-cyan-500/30'
                            : 'bg-black/60 text-slate-300 border-slate-700 hover:text-white'
                        }`}
                      >
                        {continuousMode ? '● Scan Continu ACTIF' : 'Activer Scan Continu'}
                      </button>
                    </div>
                  </div>

                  {/* Continuous AI Tags */}
                  {continuousMode && continuousDetections.length > 0 && (
                    <div className="self-start max-w-xs p-2.5 rounded-xl bg-black/75 border border-cyan-500/40 backdrop-blur-md space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400">
                        <span>DETECTIONS IA TEMPS REEL</span>
                        <span>{lastScanTime}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {continuousDetections.map((det, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-mono border border-cyan-500/30"
                          >
                            {det}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crosshairs */}
                  <div className="self-center w-36 h-36 border border-dashed border-cyan-400/40 rounded-xl flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-400/80" />
                  </div>

                  {/* Capture Button Bar */}
                  <div className="flex items-center justify-center gap-4 pointer-events-auto pb-2">
                    <button
                      id="btn-switch-camera"
                      onClick={toggleCameraFacing}
                      title="Changer de caméra"
                      className="p-3 rounded-full bg-black/70 hover:bg-black text-white border border-slate-700 backdrop-blur-md transition-all active:scale-95"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>

                    <button
                      id="btn-capture-snapshot"
                      onClick={captureSnapshot}
                      className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/30 transition-all active:scale-90"
                    >
                      <Camera className="w-5 h-5" />
                      Capturer Photo
                    </button>
                  </div>
                </div>
              </div>
            ) : imageSrc ? (
              /* Image Preview Mode */
              <div className="relative w-full h-full min-h-[380px] flex items-center justify-center p-2 bg-slate-950">
                <img
                  src={imageSrc}
                  alt="Aperçu Vision"
                  className="max-h-[440px] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
                />
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    id="btn-clear-image"
                    onClick={() => {
                      setImageSrc(null);
                      setAnalysisResult(null);
                    }}
                    className="p-2 rounded-lg bg-black/60 backdrop-blur-md hover:bg-black text-slate-300 hover:text-white border border-slate-700 transition-all text-xs"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            ) : (
              /* Placeholder / Dropzone */
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">Aucune image sélectionnée</h3>
                <p className="text-sm text-slate-400 max-w-sm mb-6">
                  Prenez une photo en direct, capturez votre écran ou chargez un fichier.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    id="btn-start-camera-cta"
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center gap-2 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    Lancer la Caméra
                  </button>
                  <button
                    id="btn-upload-file-cta"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium flex items-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Charger Image
                  </button>
                </div>

                {/* Sample Presets */}
                <div className="mt-8 pt-6 border-t border-slate-800/80 w-full flex flex-col items-center">
                  <span className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">
                    Ou tester avec un échantillon de démonstration
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => loadSampleImage('photo')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Photo / Objet</span>
                    </button>
                    <button
                      onClick={() => loadSampleImage('receipt')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Document Facture OCR</span>
                    </button>
                    <button
                      onClick={() => loadSampleImage('error')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 flex items-center gap-1.5"
                    >
                      <Bug className="w-3.5 h-3.5 text-rose-400" />
                      <span>Écran d'Erreur / Crash</span>
                    </button>
                    <button
                      onClick={() => loadSampleImage('android_ui')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700/60 flex items-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Capture Écran Android</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task Presets Selection */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Mode d'analyse spécialisé (Pipeline Phase 5)
              </label>

              {/* Format Test Runner Button */}
              <button
                id="btn-test-formats"
                onClick={handleTestFormats}
                disabled={isTestingFormats}
                className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-all flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingFormats ? 'animate-spin' : ''}`} />
                <span>Tester multi-formats (JPEG, PNG, WebP, SVG, GIF, BMP)</span>
              </button>
            </div>

            {/* Format test outcome report if available */}
            {formatTestResults && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-cyan-500/20 text-xs font-mono flex flex-wrap gap-2">
                <span className="text-cyan-400 font-semibold">Formats Validés:</span>
                {Object.entries(formatTestResults).map(([fmt, data]) => (
                  <span key={fmt} className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                    {fmt.toUpperCase()} {data.valid ? '✓' : '✗'}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              <button
                id="task-tab-photo"
                onClick={() => setActiveTab('photo')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  activeTab === 'photo'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Photo & Scène</span>
              </button>

              <button
                id="task-tab-document"
                onClick={() => setActiveTab('document')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  activeTab === 'document' || activeTab === 'ocr'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Document / OCR</span>
              </button>

              <button
                id="task-tab-error"
                onClick={() => setActiveTab('error_diagnosis')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  activeTab === 'error_diagnosis'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bug className="w-4 h-4 text-rose-400" />
                <span>Expliquer Erreur</span>
              </button>

              <button
                id="task-tab-ui"
                onClick={() => setActiveTab('ui_guidance')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  activeTab === 'ui_guidance' || activeTab === 'screenshot'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Guidage Écran UI</span>
              </button>

              <button
                id="task-tab-general"
                onClick={() => setActiveTab('general')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                  activeTab === 'general'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Général / Libre</span>
              </button>
            </div>

            {/* Custom Instruction Input */}
            <div className="mt-1 flex flex-col gap-2">
              <label htmlFor="custom-vision-prompt" className="text-xs text-slate-400">
                Question ou instruction sur l'image :
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-vision-prompt"
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ex: Que dois-je faire sur cet écran ? Explique cette erreur..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && imageSrc && !isAnalyzing) {
                      handleAnalyze();
                    }
                  }}
                />
                <button
                  id="btn-start-analysis"
                  onClick={() => handleAnalyze()}
                  disabled={!imageSrc || isAnalyzing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Traitement...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Analyser</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Intelligent Insights & Vocal Output (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 flex flex-col h-full min-h-[460px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Résultats & Insights JARVIS</h2>
              </div>
              {analysisResult && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {analysisResult.privacyStatus?.providerUsed || 'Gemini Vision'}
                  </span>
                  {analysisResult.privacyStatus?.sanitized && (
                    <span className="text-xs text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Protégé
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 py-4 overflow-y-auto max-h-[500px] text-sm text-slate-300 leading-relaxed font-sans">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="relative mb-3">
                    <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                    <Eye className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto" />
                  </div>
                  <p className="text-slate-300 font-medium">Pipeline Vision en cours d'exécution...</p>
                  <span className="text-xs text-slate-500 mt-1">ImageProcessor → VisionModel → AI Router</span>
                </div>
              ) : analysisResult ? (
                <div className="space-y-4">
                  {/* Vocal Summary Banner */}
                  {analysisResult.vocalSummary && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 flex items-start gap-3 shadow-md">
                      <button
                        id="btn-vocal-summary-play"
                        onClick={handleVocalize}
                        className={`p-2 rounded-lg ${
                          isSpeaking
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                        } transition-all flex-shrink-0`}
                        title={isSpeaking ? 'Arrêter la lecture' : 'Lire la synthèse'}
                      >
                        {isSpeaking ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider block mb-1">
                          Synthèse Vocale JARVIS
                        </span>
                        <p className="text-xs text-cyan-100/90 italic">
                          "{analysisResult.vocalSummary}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Structured OCR text block if available */}
                  {analysisResult.ocrText && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Texte Extrait (OCR)
                        </span>
                        <button
                          onClick={handleCopyOcr}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                        >
                          {copiedOcr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedOcr ? 'Copié' : 'Copier'}</span>
                        </button>
                      </div>
                      <div className="text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto p-2 bg-slate-950 rounded">
                        {analysisResult.ocrText}
                      </div>
                    </div>
                  )}

                  {/* Full Markdown Analysis Output */}
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed">
                    {analysisResult.analysis}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                  <Scan className="w-10 h-10 stroke-1 mb-2 text-slate-600" />
                  <p className="text-sm">En attente d'une capture ou d'une image.</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Choisissez une commande ou mode pour démarrer l'analyse.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions for results */}
            {analysisResult && (
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    id="btn-vocalize-analysis"
                    onClick={handleVocalize}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      isSpeaking
                        ? 'bg-rose-600/20 border-rose-500/40 text-rose-300'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeaking ? 'Arrêter Voix' : 'Vocaliser'}</span>
                  </button>

                  <button
                    id="btn-copy-analysis"
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs flex items-center gap-1.5 transition-all"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copié' : 'Copier'}</span>
                  </button>

                  <button
                    id="btn-save-memory"
                    onClick={handleSaveToMemory}
                    className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                      savedToMemory
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>{savedToMemory ? 'Mémorisé' : 'Mémoriser'}</span>
                  </button>
                </div>

                <button
                  id="btn-inject-chat"
                  onClick={handleInjectChat}
                  className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-900/30 transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Insérer dans le Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

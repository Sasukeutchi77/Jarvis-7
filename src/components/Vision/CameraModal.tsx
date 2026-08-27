import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, Eye } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startStream = useCallback(async () => {
    setError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setError("Accès caméra refusé ou non supporté.");
    }
  }, [cameraFacing]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen && !capturedPreview) {
      startStream();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, capturedPreview, startStream, stopStream]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPreview(data);
    stopStream();
  };

  const handleConfirm = () => {
    if (capturedPreview) {
      onCapture(capturedPreview);
      setCapturedPreview(null);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
  };

  return (
    <div id="camera-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div id="camera-modal-content" className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span>Capture Photo Rapide</span>
          </div>
          <button
            onClick={() => {
              setCapturedPreview(null);
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-rose-400 text-sm flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span>{error}</span>
            </div>
          ) : capturedPreview ? (
            <img
              src={capturedPreview}
              alt="Capture"
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              {/* Target finder */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-32 border border-cyan-400/50 rounded-xl" />
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-t border-slate-800">
          {!capturedPreview ? (
            <>
              <button
                type="button"
                onClick={() => setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'))}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-colors"
                title="Changer de caméra"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCapture}
                className="px-6 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Prendre la photo
              </button>

              <div className="w-9" />
            </>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Reprendre
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                Valider l'image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

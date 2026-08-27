import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { executeVoiceAction, synthesizeSpeech } from '../lib/api';
import { sanitizeSpeechText } from '../lib/tts-sanitizer';
import { AndroidBridge } from '../lib/android-bridge';
import { wakeWordEngine, AndroidBackgroundCapabilityReport } from '../lib/core/wakeword-engine';
import { hologramEngine } from '../lib/core/hologram-engine';
import { audioVisualizer } from '../lib/core/audio-visualizer';
import {
  createAudioElementFromBase64,
  playWebSpeechUtterance,
  playJarvisSoundEffect,
  unlockAudioPlayback,
} from '../lib/audio-player';
import type { VoiceActionResponse, DialogueContext, VoiceAgentState, JarvisVoiceState } from '../types';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export type { VoiceAgentState, JarvisVoiceState };

export interface UseJarvisVoiceOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onCommand?: (command: string, actionResponse: VoiceActionResponse) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceAgentState) => void;
  onAutoDismiss?: () => void;
  autoExecuteWakeCommands?: boolean;
}

export interface WakeWordMatch {
  isWake: boolean;
  command: string;
  matchedPhrase: string;
}

export function isStopCommand(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().trim()
    .replace(/[,\.:!?]+/g, ' ')
    .replace(/\bj\.a\.r\.v\.i\.s\.?\b/g, 'jarvis')
    .trim();

  const stopPhrases = [
    'arrête',
    'arrête toi',
    'arrête-toi',
    'jarvis arrête',
    'jarvis arrête toi',
    'jarvis arrête-toi',
    'stop',
    'jarvis stop',
    'tais toi',
    'tais-toi',
    'jarvis tais toi',
    'silence',
    'jarvis silence',
    'annule',
    'jarvis annule',
    'interromps',
    'interromps toi',
    'pause',
    'chut',
    'c\'est bon jarvis',
    'c\'est tout jarvis',
  ];

  return stopPhrases.some((p) => clean === p || clean.startsWith(p + ' ') || clean.endsWith(' ' + p));
}

export function parseWakeAndCommand(text: string, customWakeWord: string = 'Hey JARVIS'): WakeWordMatch {
  return wakeWordEngine.testPhrase(text);
}

export function useJarvisVoice(options: UseJarvisVoiceOptions = {}) {
  const { onTranscript, onCommand, onError, onStateChange } = options;
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  // Core 7-state machine: IDLE | LISTENING_FOR_WAKE_WORD | WAKE_WORD_DETECTED | LISTENING_COMMAND | PROCESSING | EXECUTING | SPEAKING | STOPPED | ERROR
  const [state, setState] = useState<VoiceAgentState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastAction, setLastAction] = useState<VoiceActionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [activeRoutedAgent, setActiveRoutedAgent] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(!navigator.onLine);
  const [dialogueContext, setDialogueContext] = useState<DialogueContext>({
    recentTurns: [],
  });
  const [autoDismissCountdown, setAutoDismissCountdown] = useState<number | null>(null);
  const autoDismissIntervalRef = useRef<any>(null);

  // Auto-dismiss countdown ticker when in IDLE
  const resetAutoDismissTimer = useCallback(() => {
    if (autoDismissIntervalRef.current) {
      clearInterval(autoDismissIntervalRef.current);
      autoDismissIntervalRef.current = null;
    }
    const delay = settings.autoDismissDelaySeconds ?? 5;
    if (delay <= 0) {
      setAutoDismissCountdown(null);
      return;
    }
    setAutoDismissCountdown(delay);
  }, [settings.autoDismissDelaySeconds]);

  useEffect(() => {
    if (state === 'IDLE' && (settings.autoDismissDelaySeconds ?? 5) > 0) {
      let remaining = settings.autoDismissDelaySeconds ?? 5;
      setAutoDismissCountdown(remaining);
      if (autoDismissIntervalRef.current) clearInterval(autoDismissIntervalRef.current);
      autoDismissIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(autoDismissIntervalRef.current);
          autoDismissIntervalRef.current = null;
          setAutoDismissCountdown(0);
          if (options.onAutoDismiss) {
            options.onAutoDismiss();
          }
        } else {
          setAutoDismissCountdown(remaining);
        }
      }, 1000);
    } else {
      if (autoDismissIntervalRef.current) {
        clearInterval(autoDismissIntervalRef.current);
        autoDismissIntervalRef.current = null;
      }
      setAutoDismissCountdown(null);
    }
    return () => {
      if (autoDismissIntervalRef.current) {
        clearInterval(autoDismissIntervalRef.current);
        autoDismissIntervalRef.current = null;
      }
    };
  }, [state, settings.autoDismissDelaySeconds, options.onAutoDismiss]);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const webSpeechCancelRef = useRef<(() => void) | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const restartTimerRef = useRef<any>(null);
  const silenceTimeoutTimerRef = useRef<any>(null);
  const isSpeakingInternalRef = useRef<boolean>(false);
  const activeConversationUntilRef = useRef<number>(0);
  const dialogueContextRef = useRef<DialogueContext>({
    recentTurns: [],
  });

  // State Transition Helper with Android Service Synchronization & Event Broadcast
  const transitionTo = useCallback(
    (newState: VoiceAgentState) => {
      setState(newState);
      if (onStateChange) onStateChange(newState);
      AndroidBridge.syncVoiceServiceState(newState);

      // Sync Hologram Engine state with voice lifecycle
      switch (newState) {
        case 'SPEAKING':
          hologramEngine.setSpeaking();
          break;
        case 'LISTENING_COMMAND':
        case 'LISTENING_FOR_WAKE_WORD':
        case 'WAKE_WORD_DETECTED':
          hologramEngine.setListening();
          break;
        case 'PROCESSING':
        case 'EXECUTING':
          hologramEngine.setThinking();
          break;
        case 'IDLE':
        case 'STOPPED':
          hologramEngine.setIdle();
          break;
        case 'ERROR':
          hologramEngine.triggerAlertPulse();
          break;
        default:
          break;
      }
    },
    [onStateChange]
  );

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Audio visualizer & Noise Gate / VAD setup
  const setupAudioVisualizer = useCallback((stream: MediaStream) => {
    try {
      audioVisualizer.attachMediaStream(stream);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 255) * 100 * 1.5));
        setAudioLevel(normalized);

        // Barge-In Voice Activity Detection (VAD) during TTS playback
        if (
          isSpeakingInternalRef.current &&
          normalized > 35 &&
          (settings.interruptionEnabled !== false && settings.bargeInEnabled !== false)
        ) {
          // Significant user voice energy detected while speaking -> cut speech immediately
          stopSpeaking();
        }

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      console.warn('Audio visualizer init error:', e);
    }
  }, [settings.interruptionEnabled, settings.bargeInEnabled]);

  const cleanupAudioVisualizer = useCallback(() => {
    audioVisualizer.detachMediaStream();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Text-To-Speech (TTS) with instant interruption & multi-provider playback
  const stopSpeaking = useCallback(() => {
    isSpeakingInternalRef.current = false;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = '';
      activeAudioRef.current = null;
    }
    if (webSpeechCancelRef.current) {
      webSpeechCancelRef.current();
      webSpeechCancelRef.current = null;
    }
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {}
    }
    if (state === 'SPEAKING') {
      const nextState = shouldKeepListeningRef.current
        ? (settings.wakeWordEnabled !== false ? 'LISTENING_FOR_WAKE_WORD' : 'LISTENING_COMMAND')
        : 'IDLE';
      transitionTo(nextState);
    }
  }, [state, settings.wakeWordEnabled, transitionTo]);

  // Restart speech recognition after speech finishes
  const resumeListeningAfterSpeech = useCallback(() => {
    isSpeakingInternalRef.current = false;
    activeAudioRef.current = null;
    webSpeechCancelRef.current = null;

    if (shouldKeepListeningRef.current) {
      setTimeout(() => {
        if (shouldKeepListeningRef.current && !isSpeakingInternalRef.current) {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
              const nextState = settings.wakeWordEnabled !== false
                ? 'LISTENING_FOR_WAKE_WORD'
                : 'LISTENING_COMMAND';
              transitionTo(nextState);
            } catch {
              // Already started or restarting
            }
          }
        }
      }, 250);
    } else {
      transitionTo('IDLE');
    }
  }, [settings.wakeWordEnabled, transitionTo]);

  const speakWithWebSpeech = useCallback(
    (cleanText: string): Promise<void> => {
      return new Promise((resolve) => {
        transitionTo('SPEAKING');
        isSpeakingInternalRef.current = true;

        const cancel = playWebSpeechUtterance(cleanText, {
          language: settings.voiceLanguage || 'fr-FR',
          rate: settings.voiceRate || 1.0,
          pitch: settings.voicePitch || 1.0,
          volume: 1.0,
          voiceURI: settings.voiceURI,
          onStart: () => {
            transitionTo('SPEAKING');
          },
          onEnd: () => {
            resumeListeningAfterSpeech();
            resolve();
          },
          onError: () => {
            resumeListeningAfterSpeech();
            resolve();
          },
        });

        webSpeechCancelRef.current = cancel;
      });
    },
    [settings, resumeListeningAfterSpeech, transitionTo]
  );

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text) return;

      // Unlock audio context on speech request
      unlockAudioPlayback();
      stopSpeaking();

      const cleanSpoken = sanitizeSpeechText(text);
      if (!cleanSpoken) return;

      // Check if user disabled voice response in settings
      if (settings.voiceResponseEnabled === false && settings.autoVocalize === false) {
        resumeListeningAfterSpeech();
        return;
      }

      // Stop active SpeechRecognition on Android so Android releases mic hardware for speakers
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }

      transitionTo('SPEAKING');
      isSpeakingInternalRef.current = true;

      // 1. Attempt Server-Side High-Definition Neural TTS (Deepgram / Gemini) unless offline
      if (navigator.onLine && settings.ttsProvider !== 'browser') {
        try {
          const response = await synthesizeSpeech({
            text: cleanSpoken,
            voice: settings.voiceURI,
            language: settings.voiceLanguage || 'fr-FR',
            speed: settings.voiceRate || 1.0,
          });

          if (response.status === 'success' && response.audioBase64) {
            return new Promise((resolve) => {
              const audio = createAudioElementFromBase64(
                response.audioBase64!,
                response.mimeType || 'audio/wav',
                response.sampleRate || 24000
              );
              activeAudioRef.current = audio;
              audio.playbackRate = Math.max(0.7, Math.min(1.8, settings.voiceRate || 1.0));
              audio.volume = 1.0;

              const onFinished = () => {
                resumeListeningAfterSpeech();
                resolve();
              };

              audio.onended = onFinished;
              audio.onerror = (e) => {
                console.warn('[TTS] Audio element error, using Web Speech fallback:', e);
                activeAudioRef.current = null;
                speakWithWebSpeech(cleanSpoken).then(resolve);
              };

              audio.play().catch((playErr) => {
                console.warn('[TTS] Audio play blocked, using Web Speech fallback:', playErr);
                activeAudioRef.current = null;
                speakWithWebSpeech(cleanSpoken).then(resolve);
              });
            });
          }
        } catch (synthErr) {
          console.warn('[TTS] Server TTS synthesis failed, fallback to native WebSpeech:', synthErr);
        }
      }

      // 2. Fallback: Browser Web SpeechSynthesis / Android Native TTS Engine
      return speakWithWebSpeech(cleanSpoken);
    },
    [settings, stopSpeaking, speakWithWebSpeech, resumeListeningAfterSpeech, transitionTo]
  );

  // Command & Intent parsing with Strict Wake-Word Gating & Supervisor Router
  const handleFinalSpeech = useCallback(
    async (finalText: string) => {
      const cleanText = finalText.trim();
      if (!cleanText) return;

      // Clear silence timeout if user spoke
      if (silenceTimeoutTimerRef.current) {
        clearTimeout(silenceTimeoutTimerRef.current);
        silenceTimeoutTimerRef.current = null;
      }

      // Ignore our own voice echo if currently speaking
      if (isSpeakingInternalRef.current) return;

      const configuredWakeWord = settings.wakeWord || 'Hey JARVIS';
      const { isWake, command } = parseWakeAndCommand(cleanText, configuredWakeWord);
      const isInsideActiveConversation = Date.now() < activeConversationUntilRef.current;

      // Gating: If not calling Jarvis AND not in an active conversation turn -> IGNORE COMPLETELY!
      if (!isWake && !isInsideActiveConversation && settings.wakeWordEnabled !== false) {
        setInterimTranscript('');
        return;
      }

      // Check for noise / poor transcription (single characters or pure punctuation)
      if (cleanText.length < 2 || /^[\.\,\?\!\-\s]+$/.test(cleanText)) {
        setInterimTranscript('');
        return;
      }

      setTranscript(cleanText);
      setInterimTranscript('');

      // Step 1: Wake phrase detection & feedback
      if (isWake) {
        setWakeWordDetected(true);
        transitionTo('WAKE_WORD_DETECTED');
        if (settings.soundEffectsEnabled) {
          playJarvisSoundEffect('wake');
        }
        AndroidBridge.vibrate('light');
      }

      // Emergency Stop Intercept ("JARVIS arrête", "Arrête", "Stop", "Tais-toi", "Annule")
      if (isStopCommand(cleanText)) {
        stopSpeaking();
        transitionTo('STOPPED');
        if (settings.soundEffectsEnabled) {
          playJarvisSoundEffect('alert');
        }
        const stopResponse: VoiceActionResponse = {
          status: 'success',
          command: cleanText,
          intent: 'ABORT',
          message: "Bien Monsieur, j'interromps l'opération.",
          timestamp: Date.now(),
        };
        setLastAction(stopResponse);
        if (onCommand) onCommand(cleanText, stopResponse);
        activeConversationUntilRef.current = 0;
        setTimeout(() => {
          transitionTo('IDLE');
        }, 500);
        return;
      }

      // Open / refresh active conversation follow-up window (15 seconds)
      activeConversationUntilRef.current = Date.now() + 15000;

      // Step 2 & 3: Case A — User only said "Hey Jarvis" / "Jarvis" (Wake word only)
      if (isWake && !command) {
        const greetingText = settings.voiceGreetingText || 'Oui, je vous écoute.';
        const greetingResponse: VoiceActionResponse = {
          status: 'success',
          command: cleanText,
          intent: 'WAKE_WORD',
          message: greetingText,
          timestamp: Date.now(),
        };

        setLastAction(greetingResponse);
        if (onCommand) onCommand(cleanText, greetingResponse);

        // Transition to LISTENING_COMMAND to wait for follow-up
        transitionTo('LISTENING_COMMAND');

        // Start silence timeout: if user doesn't say anything within 6 seconds, gently revert
        const timeoutSeconds = settings.silenceTimeoutSeconds || 6;
        silenceTimeoutTimerRef.current = setTimeout(() => {
          if (Date.now() >= activeConversationUntilRef.current - 9000) {
            transitionTo(settings.wakeWordEnabled !== false ? 'LISTENING_FOR_WAKE_WORD' : 'IDLE');
          }
        }, timeoutSeconds * 1000);

        // JARVIS SPEAKS GREETING ALOUD: "Oui, je vous écoute."
        await speak(greetingResponse.message);
        return;
      }

      // Case B: User gave a command (e.g. "Hey Jarvis quelle est la météo aujourd'hui ?")
      const commandToExecute = isWake ? command : cleanText;

      try {
        transitionTo('PROCESSING');

        const existingTurns = dialogueContextRef.current.recentTurns || [];
        const currentCtx = {
          ...dialogueContextRef.current,
          history: existingTurns.slice(-6),
        };

        // Transition to EXECUTING
        transitionTo('EXECUTING');
        const actionResult = await executeVoiceAction(commandToExecute, currentCtx);
        setLastAction(actionResult);

        if (actionResult.routedAgent) {
          setActiveRoutedAgent(actionResult.routedAgent);
        }

        // Update dialogue context
        const updatedTurns = [
          ...existingTurns,
          { role: 'user' as const, text: cleanText, timestamp: Date.now() },
          { role: 'assistant' as const, text: actionResult.message, timestamp: Date.now() },
        ];
        if (updatedTurns.length > 12) updatedTurns.shift();

        const updatedCtx: DialogueContext = {
          ...dialogueContextRef.current,
          recentTurns: updatedTurns,
          lastAction: actionResult.intent,
        };

        if (actionResult.payload?.app) {
          updatedCtx.lastApp = String(actionResult.payload.app);
        }
        if (actionResult.payload?.query) {
          updatedCtx.lastMedia = String(actionResult.payload.query);
        }

        dialogueContextRef.current = updatedCtx;
        setDialogueContext(updatedCtx);

        if (onCommand) {
          onCommand(cleanText, actionResult);
        }

        // JARVIS SPEAKS THE RESULT ALOUD
        if (actionResult.message) {
          transitionTo('SPEAKING');
          await speak(actionResult.message);
        } else {
          transitionTo(
            shouldKeepListeningRef.current
              ? (settings.wakeWordEnabled !== false ? 'LISTENING_FOR_WAKE_WORD' : 'LISTENING_COMMAND')
              : 'IDLE'
          );
        }
      } catch (err: any) {
        const msg = err?.message || 'Erreur lors du traitement vocal par le Superviseur.';
        setErrorMessage(msg);
        if (onError) onError(msg);
        transitionTo('ERROR');
        setTimeout(() => {
          transitionTo(
            shouldKeepListeningRef.current
              ? (settings.wakeWordEnabled !== false ? 'LISTENING_FOR_WAKE_WORD' : 'LISTENING_COMMAND')
              : 'IDLE'
          );
        }, 2000);
      }
    },
    [settings, onCommand, onError, speak, transitionTo]
  );

  const executeVoiceCommand = useCallback(
    async (commandText: string) => {
      // Manual command execution always forces conversation window
      activeConversationUntilRef.current = Date.now() + 15000;
      return handleFinalSpeech(commandText);
    },
    [handleFinalSpeech]
  );

  // Manual trigger for wake button / assist gesture
  const triggerManualWake = useCallback(() => {
    activeConversationUntilRef.current = Date.now() + 15000;
    unlockAudioPlayback();
    if (settings.soundEffectsEnabled) {
      playJarvisSoundEffect('wake');
    }
    AndroidBridge.vibrate('light');
    transitionTo('WAKE_WORD_DETECTED');
    setTimeout(() => {
      transitionTo('LISTENING_COMMAND');
    }, 400);
  }, [settings, transitionTo]);

  // Start continuous / always-on listening
  const startListening = useCallback(async () => {
    setErrorMessage(null);
    setWakeWordDetected(false);
    shouldKeepListeningRef.current = true;
    unlockAudioPlayback();
    stopSpeaking();

    if (settings.soundEffectsEnabled) {
      playJarvisSoundEffect('listening');
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Check Microphone Stream & Audio Visualizer with noiseSuppression
    if (navigator.mediaDevices?.getUserMedia && !mediaStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: settings.noiseSuppressionEnabled !== false,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
        setPermissionGranted(true);
        setupAudioVisualizer(stream);
      } catch (err) {
        setPermissionGranted(false);
        const msg = 'Accès au microphone requis pour la reconnaissance vocale.';
        setErrorMessage(msg);
        if (onError) onError(msg);
        transitionTo('ERROR');
        shouldKeepListeningRef.current = false;
        return;
      }
    }

    if (SpeechRec) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = settings.voiceLanguage || 'fr-FR';

        const initialState: VoiceAgentState = settings.wakeWordEnabled !== false
          ? 'LISTENING_FOR_WAKE_WORD'
          : 'LISTENING_COMMAND';

        recognition.onstart = () => {
          transitionTo(initialState);
        };

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let currentFinal = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              currentFinal += transcriptChunk;
            } else {
              currentInterim += transcriptChunk;
            }
          }

          if (currentInterim) {
            setInterimTranscript(currentInterim);
            if (onTranscript) onTranscript(currentInterim, false);

            // User starts speaking while Jarvis is speaking -> Barge-in interruption
            if (
              (isSpeakingInternalRef.current || activeAudioRef.current) &&
              (settings.interruptionEnabled !== false && settings.bargeInEnabled !== false)
            ) {
              stopSpeaking();
            }
          }

          if (currentFinal) {
            if (onTranscript) onTranscript(currentFinal, true);
            handleFinalSpeech(currentFinal);
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') return; // Normal conversational pause
          if (event.error !== 'aborted') {
            console.warn('[SpeechRec] Error:', event.error);
            if (onError) onError(event.error);
          }
        };

        recognition.onend = () => {
          // If still in continuous mode and not currently playing speech output, restart recognition
          if (shouldKeepListeningRef.current && !isSpeakingInternalRef.current) {
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
              if (shouldKeepListeningRef.current && !isSpeakingInternalRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch {
                  // Already started or busy
                }
              }
            }, 80);
          } else if (!shouldKeepListeningRef.current) {
            transitionTo('IDLE');
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        transitionTo(initialState);
      } catch (err: any) {
        console.warn('Failed to start speech recognition:', err);
        transitionTo('IDLE');
        shouldKeepListeningRef.current = false;
      }
    } else {
      transitionTo(settings.wakeWordEnabled !== false ? 'LISTENING_FOR_WAKE_WORD' : 'LISTENING_COMMAND');
    }
  }, [settings, stopSpeaking, setupAudioVisualizer, onError, onTranscript, handleFinalSpeech, transitionTo]);

  // Stop listening
  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (silenceTimeoutTimerRef.current) {
      clearTimeout(silenceTimeoutTimerRef.current);
      silenceTimeoutTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    cleanupAudioVisualizer();
    setInterimTranscript('');
    transitionTo('STOPPED');
    setTimeout(() => {
      transitionTo('IDLE');
    }, 400);
  }, [cleanupAudioVisualizer, transitionTo]);

  /**
   * Simulation testing tool for Étape 9: 15-Step Complete Vocal Scenario
   * 1. Wake word -> 2. Apparition -> 3. Listening -> 4. "Oui, je vous écoute." ->
   * 5. Voice Reactivity -> 6. Command -> 7. Transcription -> 8. Intent ->
   * 9. Thinking -> 10. Executing -> 11. Speaking -> 12. TTS visualizer ->
   * 13. Vocal reply -> 14. Idle -> 15. Auto-dismiss
   */
  const simulate15StepScenario = useCallback(
    async (options?: {
      command?: string;
      appContext?: string;
      onStepChange?: (step: number, title: string) => void;
    }) => {
      const cmd = options?.command || 'Ouvre YouTube et cherche les dernières actualités IA';
      const notify = (s: number, t: string) => options?.onStepChange?.(s, t);

      unlockAudioPlayback();

      // 1. Wake word detected
      notify(1, 'Wake word détecté ("Hey JARVIS")');
      transitionTo('WAKE_WORD_DETECTED');
      playJarvisSoundEffect('wake');
      AndroidBridge.vibrate('medium');
      setTranscript('Hey JARVIS');

      await new Promise((r) => setTimeout(r, 600));

      // 2. JARVIS apparaît
      notify(2, 'JARVIS apparaît (Projection Holographique active)');
      hologramEngine.show({ autoAppear: true, state: 'listening' });
      await new Promise((r) => setTimeout(r, 400));

      // 3. Hologramme en état LISTENING
      notify(3, 'Hologramme en état LISTENING');
      transitionTo('LISTENING_COMMAND');
      hologramEngine.setListening();
      await new Promise((r) => setTimeout(r, 400));

      // 4. JARVIS dit : "Oui, je vous écoute."
      const greeting = settings.voiceGreetingText || 'Oui, je vous écoute.';
      notify(4, `JARVIS dit : "${greeting}"`);
      setInterimTranscript(greeting);
      await speak(greeting);

      // 5. Hologramme réagit à la voix
      notify(5, 'Hologramme réagit à la voix de l\'utilisateur');
      transitionTo('LISTENING_COMMAND');
      setAudioLevel(65);
      await new Promise((r) => setTimeout(r, 600));
      setAudioLevel(0);

      // 6. Utilisateur donne une commande
      notify(6, `Utilisateur : "${cmd}"`);
      setTranscript(cmd);

      // 7. JARVIS transcrit
      notify(7, 'JARVIS transcrit le flux audio en temps réel');
      setInterimTranscript(cmd);
      await new Promise((r) => setTimeout(r, 600));
      setInterimTranscript('');

      // 8. JARVIS comprend
      notify(8, 'JARVIS comprend l\'intention et sélectionne l\'Agent');

      // 9. Hologramme passe en THINKING
      notify(9, 'Hologramme passe en THINKING (Mode calcul)');
      transitionTo('PROCESSING');
      hologramEngine.setThinking();
      await new Promise((r) => setTimeout(r, 700));

      // 10. JARVIS exécute l'action
      notify(10, 'JARVIS exécute l\'action via Action Planner & Android Control');
      transitionTo('EXECUTING');
      const actionRes = await executeVoiceAction(cmd);
      setLastAction(actionRes);
      if (actionRes.routedAgent) {
        setActiveRoutedAgent(actionRes.routedAgent);
      }
      await new Promise((r) => setTimeout(r, 500));

      // 11. Hologramme passe en SPEAKING
      notify(11, 'Hologramme passe en SPEAKING');
      transitionTo('SPEAKING');
      hologramEngine.setSpeaking();

      // 12. La visualisation réagit au TTS
      notify(12, 'La visualisation holographique réagit aux fréquences audio du TTS');

      // 13. JARVIS répond
      const replyMsg = actionRes.message || 'Action exécutée avec succès, Monsieur.';
      notify(13, `JARVIS répond : "${replyMsg}"`);
      await speak(replyMsg);

      // 14. Hologramme retourne en IDLE
      notify(14, 'Hologramme retourne en IDLE');
      transitionTo('IDLE');
      hologramEngine.setIdle();

      // 15. Après un délai configurable, JARVIS disparaît
      notify(15, `Compte à rebours avant fermeture automatique (${settings.autoDismissDelaySeconds ?? 5}s)`);
    },
    [settings, speak, transitionTo]
  );

  /**
   * Simulation testing tool for Etape 3: "Hey JARVIS" -> Listen -> Transcribe -> AI -> Speak
   */
  const simulateWakeWordCycle = useCallback(
    async (customPrompt?: string) => {
      unlockAudioPlayback();
      const promptToRun = customPrompt || 'Quelle est la météo aujourd\'hui ?';

      // 1. Wake word detected
      transitionTo('WAKE_WORD_DETECTED');
      playJarvisSoundEffect('wake');
      AndroidBridge.vibrate('medium');
      setTranscript('Hey JARVIS');

      await new Promise((r) => setTimeout(r, 600));

      // 2. Listening for command
      transitionTo('LISTENING_COMMAND');
      setInterimTranscript(promptToRun);

      await new Promise((r) => setTimeout(r, 900));

      // 3. Final speech handle
      setTranscript(`Hey JARVIS ${promptToRun}`);
      await handleFinalSpeech(`Hey JARVIS ${promptToRun}`);
    },
    [handleFinalSpeech, transitionTo]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimeoutTimerRef.current) clearTimeout(silenceTimeoutTimerRef.current);
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  const backgroundReport: AndroidBackgroundCapabilityReport = wakeWordEngine.getBackgroundCapabilityReport();

  return {
    // 7-state machine representation
    state,
    voiceState: (state.toLowerCase() as JarvisVoiceState),
    isIdle: state === 'IDLE',
    isListeningForWakeWord: state === 'LISTENING_FOR_WAKE_WORD',
    isWakeWordDetected: state === 'WAKE_WORD_DETECTED',
    isListeningCommand: state === 'LISTENING_COMMAND' || state === 'LISTENING',
    isListening: state === 'LISTENING' || state === 'LISTENING_FOR_WAKE_WORD' || state === 'LISTENING_COMMAND',
    isProcessing: state === 'PROCESSING',
    isExecuting: state === 'EXECUTING',
    isSpeaking: state === 'SPEAKING',
    isStopped: state === 'STOPPED',
    isError: state === 'ERROR',

    // Transcripts & Audio Levels
    transcript,
    interimTranscript,
    audioLevel,
    wakeWordDetected,
    permissionGranted,
    errorMessage,
    availableVoices,
    lastAction,
    activeRoutedAgent,
    isOfflineMode,
    dialogueContext,
    setDialogueContext,
    backgroundReport,
    autoDismissCountdown,
    resetAutoDismissTimer,

    // Actions & Controls
    executeVoiceCommand,
    triggerManualWake,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    simulateWakeWordCycle,
    simulate15StepScenario,
    setWakeWordEnabled: (enabled: boolean) => updateSettings({ wakeWordEnabled: enabled }),
    setLanguage: (lang: string) => updateSettings({ voiceLanguage: lang }),
  };
}

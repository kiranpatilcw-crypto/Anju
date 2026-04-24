import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Power, Globe, Sparkles, X, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createLiveSession } from '../lib/gemini';
import { AudioStreamer } from '../lib/audio-streamer';

type AppState = 'DISCONNECTED' | 'CONNECTING' | 'LISTENING' | 'SPEAKING';

export const VoiceAssistant: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('DISCONNECTED');
  const [isAnjuVisible, setIsAnjuVisible] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const sessionRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    sessionRef.current?.close();
    audioStreamerRef.current?.stop();
    sessionRef.current = null;
    audioStreamerRef.current = null;
    setAppState('DISCONNECTED');
    setIsAnjuVisible(false);
    setTranscript('');
  }, []);

  const startSession = async () => {
    if (appState !== 'DISCONNECTED') return;

    setAppState('CONNECTING');
    setIsAnjuVisible(true);

    try {
      audioStreamerRef.current = new AudioStreamer(16000);
      
      sessionRef.current = await createLiveSession(
        // onAudioData
        (base64) => {
          audioStreamerRef.current?.playAudioChunk(base64);
          setAppState('SPEAKING');
        },
        // onInterrupted
        () => {
          audioStreamerRef.current?.clearQueue();
          setAppState('LISTENING');
        },
        // onTranscription
        (text, isModel) => {
          if (!isModel) setTranscript(text);
          else setAppState('SPEAKING');
        },
        // onWebsiteRequest
        (url) => {
          window.open(url, '_blank');
        }
      );

      await audioStreamerRef.current.start((base64) => {
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
        });
        setAppState('LISTENING');
      });

      setAppState('LISTENING');
    } catch (error) {
      console.error("Failed to start session:", error);
      cleanup();
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <div className="relative min-h-screen bg-[#050510] text-slate-100 overflow-hidden font-sans select-none">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]"></div>
        <GridPattern />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          <h1 className="text-sm font-bold tracking-[0.3em] uppercase opacity-50">Anju Live</h1>
        </div>
        <div className="flex items-center gap-4">
          <AppStateIndicator state={appState} />
          {appState !== 'DISCONNECTED' && (
            <button 
              onClick={cleanup}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6">
        <AnimatePresence mode="wait">
          {appState === 'DISCONNECTED' ? (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center"
            >
              <div className="mb-12">
                <h2 className="text-6xl font-black mb-4 tracking-tighter bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent italic">
                  Anju
                </h2>
                <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">
                  The sassiest AI from Mumbai. Confident, witty, and ready to talk.
                </p>
              </div>

              <button
                onClick={startSession}
                className="group relative p-1 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 active:scale-95 transition-transform"
              >
                <div className="bg-[#050510] rounded-full p-8 transition-colors group-hover:bg-transparent">
                  <Power className="w-12 h-12 text-white group-hover:scale-110 transition-transform" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition-opacity"></div>
              </button>
              
              <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                Tap to wake her up
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
                <AnjuVisualizer state={appState} />
              </div>

              <div className="text-center max-w-sm">
                <h2 className="text-2xl font-medium mb-2">
                  {appState === 'SPEAKING' ? "Anju is talking..." : "I'm listening..."}
                </h2>
                <div className="h-6 overflow-hidden">
                  <AnimatePresence mode="wait">
                    {transcript && (
                      <motion.p 
                        key={transcript}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="text-cyan-400 text-sm font-medium italic truncate"
                      >
                        "{transcript}"
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="mt-12 flex gap-3 text-[10px] uppercase tracking-widest font-bold">
                <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-400 flex items-center gap-1">
                  <Globe size={10} /> Search
                </div>
                <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-400 flex items-center gap-1">
                  <Sparkles size={10} /> Voice
                </div>
                <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-400 flex items-center gap-1">
                  <Activity size={10} /> Live
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="absolute bottom-10 left-0 w-full px-12 flex justify-between items-end z-10">
        <div className="max-w-[200px]">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Personality Matrix</p>
          <div className="flex gap-1 h-1">
            <div className="flex-1 bg-cyan-500 shadow-[0_0_5px_#06b6d4]"></div>
            <div className="flex-1 bg-purple-500 shadow-[0_0_5px_#a855f7]"></div>
            <div className="flex-1 bg-white/20"></div>
            <div className="flex-1 bg-white/20"></div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Version</p>
          <p className="text-xs font-mono">3.1.LIVE</p>
        </div>
      </footer>
    </div>
  );
};

const GridPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-10" width="100%" height="100%">
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
    </pattern>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

const AppStateIndicator = ({ state }: { state: AppState }) => {
  const colors = {
    DISCONNECTED: 'bg-slate-500',
    CONNECTING: 'bg-yellow-500 animate-pulse',
    LISTENING: 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]',
    SPEAKING: 'bg-green-500 shadow-[0_0_10px_#22c55e]'
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
      <div className={`w-2 h-2 rounded-full ${colors[state]}`}></div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{state}</span>
    </div>
  );
};

const AnjuVisualizer = ({ state }: { state: AppState }) => {
  const isSpeaking = state === 'SPEAKING';
  const isListening = state === 'LISTENING';

  return (
    <div className="relative">
      <motion.div 
        animate={{ 
          scale: isSpeaking ? [1, 1.2, 1] : 1,
          opacity: isSpeaking ? [0.2, 0.4, 0.2] : 0.2
        }}
        transition={{ duration: 1, repeat: Infinity }}
        className="absolute inset-[-40px] bg-cyan-500/20 rounded-full blur-2xl"
      />
      
      <motion.div 
        animate={{ 
          scale: isSpeaking ? [1, 1.1, 1] : isListening ? [1, 1.05, 1] : 1,
          borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "30% 60% 70% 40% / 50% 60% 30% 40%", "40% 60% 70% 30% / 40% 50% 60% 50%"]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-48 h-48 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 relative overflow-hidden"
      >
        <motion.div 
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
        />
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50"></div>
        </div>
      </motion.div>

      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[-20px] border border-white/5 rounded-full"
      >
        <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 -left-0.5 shadow-[0_0_5px_#fff]"></div>
      </motion.div>

      {isSpeaking && (
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 h-8">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [4, 24, 8, 30, 4] }}
              transition={{ duration: 0.5 + i * 0.1, repeat: Infinity }}
              className="w-1 bg-cyan-400 rounded-full shadow-[0_0_5px_#06b6d4]"
            />
          ))}
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Player, SportImage, GameState, HistoryItem } from './types';
import { WINTER_SPORTS_LIST } from './constants';
import PlayerSetup from './components/PlayerSetup';
import HistoryGallery from './components/HistoryGallery';
import ImageDisplay from './components/ImageDisplay';
import { verifySportAnswer, getGameIntroMessage, generateSportImage } from './services/geminiService';

// Audio Helpers for Live API
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [currentRound, setCurrentRound] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentSport, setCurrentSport] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [timer, setTimer] = useState(30);
  const [guess, setGuess] = useState('');
  const [typedFeedback, setTypedFeedback] = useState('');
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const [introMessage, setIntroMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [activeMicLabel, setActiveMicLabel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const typingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } catch (e) {
      console.error("Failed to check API key status", e);
    }
  };

  const handleSelectKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      // Per instructions, assume success after opening to avoid race conditions
      setHasKey(true);
    } catch (e) {
      console.error("Failed to open key selection dialog", e);
    }
  };

  const animateTyping = (text: string) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    let i = 0;
    setTypedFeedback('');
    typingIntervalRef.current = window.setInterval(() => {
      if (i < text.length) {
        setTypedFeedback(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingIntervalRef.current!);
      }
    }, 30);
  };

  const startNewGame = (p: Player[]) => {
    setPlayers(p);
    setGameState(GameState.ROUND_START);
    getGameIntroMessage(p.map(pl => pl.name)).then(setIntroMessage);
  };

  const toggleVoice = async () => {
    if (sessionRef.current) {
      disconnectVoice();
      return;
    }

    setIsVoiceConnecting(true);
    setError(null);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      let stream: MediaStream | null = null;
      
      const internalMic = audioDevices.find(d => 
        d.label.toLowerCase().includes('internal') || 
        d.label.toLowerCase().includes('built-in')
      );

      try {
        const constraints = internalMic 
          ? { audio: { deviceId: { exact: internalMic.deviceId } } } 
          : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (!stream) throw new Error("No usable microphone found.");

      const audioTrack = stream.getAudioTracks()[0];
      setActiveMicLabel(audioTrack.label);
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioContext.resume();
      audioContextRef.current = audioContext;

      const analyzer = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      const updateVolume = () => {
        if (!isVoiceActive && !isVoiceConnecting) return;
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMicLevel(avg);
        requestAnimationFrame(updateVolume);
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsVoiceActive(true);
            setIsVoiceConnecting(false);
            updateVolume();
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              const text = msg.serverContent.inputTranscription.text;
              if (!text) return;
              animateTyping(text);
              const lower = text.toLowerCase();
              if (lower.includes("submit") || lower.includes("check")) {
                setLastVoiceCommand("JUDGING...");
                setTimeout(handleVerify, 800);
              } else {
                setGuess(text);
              }
            }
          },
          onclose: () => disconnectVoice(),
          onerror: () => disconnectVoice(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (e: any) {
      setIsVoiceConnecting(false);
      setError(`Hardware Error: ${e.message || "Mic access failed"}. Ensure 'Internal Microphone' is selected in Mac Settings.`);
    }
  };

  const disconnectVoice = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsVoiceActive(false);
    setIsVoiceConnecting(false);
    setMicLevel(0);
  };

  const startTurn = async () => {
    setIsGenerating(true);
    setError(null);
    setGuess('');
    setTypedFeedback('');
    setImageUrl(null);
    const sport = WINTER_SPORTS_LIST[Math.floor(Math.random() * WINTER_SPORTS_LIST.length)];
    setCurrentSport(sport);
    
    try {
      const url = await generateSportImage(sport);
      setImageUrl(url);
      setGameState(GameState.PLAYING);
      setTimer(30);
    } catch (err: any) {
      if (err.message?.includes("429") || err.message?.includes("quota")) {
        setError("Personal Quota Exceeded. Please ensure your project has billing enabled.");
      } else if (err.message?.includes("not found")) {
        setHasKey(false);
        setError("API key no longer valid. Please re-select your credentials.");
      } else {
        setError("Challenge Load Failed: The stadium is temporarily closed. Try again.");
      }
      setGameState(GameState.ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (isVerifying || gameState !== GameState.PLAYING) return;
    setIsVerifying(true);
    setGameState(GameState.VERIFYING);
    disconnectVoice();

    try {
      const finalGuess = guess || typedFeedback;
      const result = await verifySportAnswer(finalGuess, currentSport);
      setFeedback({ isCorrect: result.isCorrect, text: result.feedback });
      
      setHistory(prev => [...prev, {
        sport: currentSport,
        imageUrl: imageUrl || '',
        playerName: players[currentPlayerIndex].name,
        playerGuess: finalGuess,
        isCorrect: result.isCorrect
      }]);

      if (result.isCorrect) setPlayers(prev => {
        const up = [...prev];
        up[currentPlayerIndex].score += 10;
        return up;
      });
      setGameState(GameState.ROUND_RESULTS);
    } catch (err) {
      setGameState(GameState.ERROR);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING && timer > 0) {
      const id = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(id);
    } else if (timer === 0 && gameState === GameState.PLAYING) {
      handleVerify();
    }
  }, [gameState, timer]);

  const nextTurn = () => {
    const isLast = currentPlayerIndex === players.length - 1;
    if (isLast) {
      if (currentRound >= 3) setGameState(GameState.GAME_OVER);
      else { 
        setCurrentRound(r => r + 1); 
        setCurrentPlayerIndex(0); 
        setGameState(GameState.ROUND_START); 
      }
    } else {
      setCurrentPlayerIndex(idx => idx + 1);
      setGameState(GameState.ROUND_START);
    }
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel p-10 rounded-3xl text-center space-y-8 animate-frost border-white/5 shadow-2xl">
          <div className="text-6xl animate-bounce">🎿</div>
          <h1 className="text-4xl font-heading tracking-widest text-blue-400">CONNECT PROJECT</h1>
          <div className="space-y-4">
            <p className="text-slate-400 leading-relaxed text-sm">
              To use your new <strong className="text-blue-300">winter-olympics</strong> project and avoid shared quota errors, we need to link your credentials.
            </p>
            <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl text-[11px] text-slate-300 text-left space-y-2">
              <p>1. Click the button below.</p>
              <p>2. Select the key associated with your project.</p>
              <p>3. Start generating high-pro Olympic action!</p>
            </div>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95"
            >
              SELECT API KEY
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[10px] text-blue-400/60 hover:text-blue-300 underline underline-offset-4 tracking-[0.2em] font-bold uppercase"
            >
              Billing Documentation
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center py-6">
        <h1 className="text-3xl font-heading tracking-widest text-blue-400">WINTER GAMES</h1>
        <div className="flex gap-2">
          {players.map((p, i) => (
            <div key={p.id} className={`px-4 py-2 rounded-xl border transition-all ${i === currentPlayerIndex ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-slate-800 opacity-60'}`}>
              <span className="text-[10px] block font-bold opacity-50 uppercase tracking-widest">{p.name}</span>
              <span className="text-xl font-heading leading-tight">{p.score} <span className="text-[10px] opacity-40">PTS</span></span>
            </div>
          ))}
        </div>
      </div>

      <main className="w-full max-w-3xl flex-1 flex flex-col justify-center">
        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded-2xl mb-6 animate-pulse text-center text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        {gameState === GameState.LOBBY && <PlayerSetup onStart={startNewGame} />}

        {gameState === GameState.ROUND_START && (
          <div className="text-center glass-panel p-12 rounded-3xl animate-frost border-white/5 shadow-2xl">
            {isGenerating ? (
              <div className="space-y-6 py-8">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-blue-300 font-heading text-2xl tracking-wide">Developing 1K Pro Action Shot...</p>
              </div>
            ) : (
              <>
                <div className="text-blue-400 text-xs font-bold uppercase tracking-[0.3em] mb-4">Round {currentRound} / 3</div>
                <h2 className="text-5xl md:text-6xl font-heading mb-4 text-white uppercase tracking-tight">{currentPlayer?.name}'s Event</h2>
                <p className="text-slate-400 mb-10 italic max-w-md mx-auto">"{introMessage}"</p>
                <button 
                  onClick={startTurn} 
                  className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                >
                  START CHALLENGE
                </button>
              </>
            )}
          </div>
        )}

        {gameState === GameState.PLAYING && imageUrl && (
          <div className="space-y-6 animate-frost">
            <div className="relative">
              <ImageDisplay imageUrl={imageUrl} />
              <div className="absolute top-4 right-4 text-4xl font-heading text-white bg-blue-600/80 px-5 py-2 rounded-2xl backdrop-blur-md shadow-xl border border-blue-400/30">
                {timer}S
              </div>
            </div>

            <div className="relative space-y-4">
              {lastVoiceCommand && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-blue-400 font-bold text-xs animate-bounce tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  {lastVoiceCommand}
                </div>
              )}
              
              <div className="flex gap-4 items-start">
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={toggleVoice}
                    disabled={isVoiceConnecting}
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isVoiceActive ? 'bg-red-500 animate-pulse shadow-red-500/30' : 'bg-slate-800 hover:bg-slate-700'} ${isVoiceConnecting ? 'opacity-50 grayscale' : ''}`}
                  >
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                  </button>
                  {isVoiceActive && (
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div className="h-full bg-blue-400 transition-all duration-75" style={{ width: `${Math.min(100, (micLevel / 128) * 100)}%` }}></div>
                    </div>
                  )}
                </div>

                <div className="flex-1 relative">
                  <input 
                    type="text"
                    autoFocus
                    value={typedFeedback || guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder={isVoiceActive ? "Transcribing..." : "Click mic to speak answer"}
                    className={`w-full h-16 bg-slate-900 border-2 rounded-2xl px-6 text-xl transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${isVoiceActive ? 'border-blue-500 italic' : 'border-slate-800 focus:border-blue-500/50'}`}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  />
                  {isVoiceActive && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  )}
                  {activeMicLabel && isVoiceActive && (
                    <div className="absolute -bottom-5 left-1 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                      <span className="text-blue-500/60">SOURCE:</span> {activeMicLabel}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleVerify} 
                  className="px-8 h-16 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 active:scale-95 transition-all shadow-xl shadow-blue-600/20"
                >
                  SUBMIT
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-500 tracking-[0.2em] font-bold uppercase pt-2">SAY "SUBMIT" TO JUDGE YOUR ANSWER AUTOMATICALLY</p>
            </div>
          </div>
        )}

        {gameState === GameState.VERIFYING && (
          <div className="text-center p-20 glass-panel rounded-3xl animate-frost shadow-2xl border-white/5">
             <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
             <h2 className="text-2xl font-bold text-blue-300 tracking-widest uppercase">Consulting the Judges...</h2>
          </div>
        )}

        {gameState === GameState.ROUND_RESULTS && feedback && (
          <div className="text-center glass-panel p-12 rounded-3xl animate-frost shadow-2xl border-white/5">
            <div className="text-8xl mb-6">{feedback.isCorrect ? '🥇' : '❄️'}</div>
            <h2 className={`text-5xl font-heading mb-2 ${feedback.isCorrect ? 'text-green-400' : 'text-slate-300'}`}>
              {feedback.isCorrect ? 'POINT SECURED!' : 'ICE COLD!'}
            </h2>
            <p className="text-2xl font-bold mb-6 text-white tracking-wide">It was {currentSport}</p>
            <p className="bg-slate-900/80 p-8 rounded-2xl border border-slate-800 text-slate-300 italic mb-10 leading-relaxed shadow-inner">
              {feedback.text}
            </p>
            <button 
              onClick={nextTurn} 
              className="px-14 py-5 bg-blue-600 rounded-2xl font-bold text-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30"
            >
              CONTINUE COMPETITION
            </button>
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="text-center glass-panel p-12 rounded-3xl animate-frost shadow-2xl border-white/5">
            <h2 className="text-6xl font-heading mb-10 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">PODIUM RESULTS</h2>
            <div className="space-y-4 mb-12">
              {[...players].sort((a,b) => b.score - a.score).map((p,i) => (
                <div key={p.id} className={`flex justify-between items-center p-6 rounded-2xl border ${i === 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-heading ${i === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>#{i+1}</span>
                    <span className="font-bold text-xl tracking-wide">{p.name}</span>
                  </div>
                  <span className="font-heading text-3xl">{p.score} <span className="text-xs opacity-40">PTS</span></span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <button onClick={() => window.location.reload()} className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-xl">
                 NEW MATCH
               </button>
            </div>
            <div className="mt-16 text-left">
              <HistoryGallery history={history} />
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-[9px] tracking-[0.4em] text-slate-600 uppercase font-bold text-center">
        Pro Image Engine (Gemini 3) • Personal Project Credentialed • Smart Mic Fallback ON
      </footer>
    </div>
  );
};

export default App;


import React from 'react';
import { HistoryItem } from '../types';

interface HistoryGalleryProps {
  history: HistoryItem[];
}

const HistoryGallery: React.FC<HistoryGalleryProps> = ({ history }) => {
  if (history.length === 0) return null;

  return (
    <div className="mt-12 w-full">
      <h3 className="text-2xl font-heading text-blue-300 mb-6 text-center">Match Highlights</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((item, idx) => (
          <div key={idx} className="glass-panel p-3 rounded-2xl border border-white/10 group hover:scale-[1.02] transition-transform flex flex-col">
            <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
              <img src={item.imageUrl} alt={item.sport} className="w-full h-full object-cover" />
              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.isCorrect ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                {item.isCorrect ? 'Correct' : 'Missed'}
              </div>
            </div>
            <div className="px-1 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{item.playerName}</span>
                <span className="text-[10px] text-slate-500">Rnd {idx + 1}</span>
              </div>
              <div className="text-lg font-bold truncate leading-tight">{item.sport}</div>
              <div className="text-[10px] text-slate-400 italic truncate mb-4">Guess: "{item.playerGuess || 'No guess'}"</div>
              
              {item.videoUrl && (
                <a 
                  href={item.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-auto block py-2 text-center bg-slate-800 hover:bg-red-600/30 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-100 rounded-lg transition-all border border-transparent hover:border-red-600/20"
                >
                  Watch Video
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryGallery;


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
              <div className="text-lg font-bold truncate leading-tight mb-1">{item.sport}</div>
              <div className="text-[10px] text-slate-400 italic truncate mb-4">Guess: "{item.playerGuess || 'No guess'}"</div>
              
              {item.videoUrl && (
                <a 
                  href={item.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 py-3 bg-[#FF0000] hover:bg-[#CC0000] text-white rounded-xl transition-all shadow-lg shadow-red-600/10 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">Watch Highlights</span>
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

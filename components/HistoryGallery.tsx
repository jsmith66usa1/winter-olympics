
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
          <div key={idx} className="glass-panel p-3 rounded-2xl border border-white/10 group hover:scale-[1.02] transition-transform">
            <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
              <img src={item.imageUrl} alt={item.sport} className="w-full h-full object-cover" />
              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.isCorrect ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                {item.isCorrect ? 'Correct' : 'Missed'}
              </div>
            </div>
            <div className="px-1">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{item.playerName}</span>
                <span className="text-xs text-slate-500">Round {idx + 1}</span>
              </div>
              <div className="text-lg font-bold truncate">{item.sport}</div>
              <div className="text-xs text-slate-400 italic truncate">Guess: "{item.playerGuess || 'No guess'}"</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryGallery;

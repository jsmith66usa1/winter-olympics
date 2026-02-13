
import React, { useState } from 'react';
import { Player } from '../types';

interface PlayerSetupProps {
  onStart: (players: Player[]) => void;
}

const PlayerSetup: React.FC<PlayerSetupProps> = ({ onStart }) => {
  const [names, setNames] = useState<string[]>(['', '']);

  const addPlayer = () => setNames([...names, '']);
  const removePlayer = (index: number) => setNames(names.filter((_, i) => i !== index));
  
  const handleNameChange = (index: number, val: string) => {
    const newNames = [...names];
    newNames[index] = val;
    setNames(newNames);
  };

  const handleStart = () => {
    const validNames = names.filter(n => n.trim().length > 0);
    if (validNames.length < 1) return;
    
    const players: Player[] = validNames.map((name, idx) => ({
      id: `p-${idx}`,
      name,
      score: 0
    }));
    onStart(players);
  };

  return (
    <div className="max-w-md w-full mx-auto p-8 glass-panel rounded-3xl animate-frost">
      <h2 className="text-4xl font-heading mb-6 text-center text-blue-300">Assemble the Athletes</h2>
      <p className="text-slate-300 mb-8 text-center">Who will represent the nations today?</p>
      
      <div className="space-y-4 mb-8">
        {names.map((name, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(idx, e.target.value)}
              placeholder={`Player ${idx + 1}`}
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-white"
            />
            {names.length > 1 && (
              <button 
                onClick={() => removePlayer(idx)}
                className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={addPlayer}
          className="w-full py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-all"
        >
          + Add Competitor
        </button>
        <button 
          onClick={handleStart}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transform hover:-translate-y-0.5 transition-all"
        >
          Enter the Stadium
        </button>
      </div>
    </div>
  );
};

export default PlayerSetup;


import React from 'react';

interface ImageDisplayProps {
  imageUrl: string;
  sportName?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageUrl }) => {
  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800/50 group">
      <img
        src={imageUrl}
        alt="Olympic Sport"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] uppercase tracking-tighter text-slate-300 border border-white/10">
        AI Generated Scene
      </div>
    </div>
  );
};

export default ImageDisplay;

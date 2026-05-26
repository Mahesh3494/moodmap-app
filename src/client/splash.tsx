import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 gap-6">
      <div className="text-4xl">🗺️</div>
      <h1 className="text-3xl font-bold text-white">MoodMap</h1>
      <p className="text-gray-400 text-center px-8">
        Real-time community health monitoring for Reddit moderators
      </p>
      <button
        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors cursor-pointer"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Open Dashboard →
      </button>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
import React, { useMemo } from 'react';
import { createFrequencyBars, createWaveformPoints } from '../hooks/useAudioAnalysis';

interface AudioVisualizerProps {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  audioLevel: number;
  isActive: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  frequencyData,
  waveformData,
  audioLevel,
  isActive,
}) => {
  const frequencyBars = useMemo(
    () => createFrequencyBars(frequencyData, 32),
    [frequencyData]
  );

  const waveformPoints = useMemo(
    () => createWaveformPoints(waveformData, 100),
    [waveformData]
  );

  const renderFrequencyBars = () => {
    if (!isActive || frequencyBars.length === 0) {
      return Array.from({ length: 32 }, (_, i) => (
        <div
          key={i}
          className="w-2 bg-gray-600 rounded-t"
          style={{ height: '4px' }}
        />
      ));
    }

    return frequencyBars.map((height, index) => (
      <div
        key={index}
        className="w-2 bg-blue-500 rounded-t transition-all duration-75 ease-out"
        style={{
          height: `${Math.max(4, height)}px`,
          opacity: 0.6 + (height / 100) * 0.4,
        }}
      />
    ));
  };

  const renderWaveform = () => {
    if (!isActive || waveformPoints.length === 0) {
      return (
        <div className="w-full h-16 flex items-center justify-center">
          <div className="text-gray-500 text-sm">No audio input</div>
        </div>
      );
    }

    const width = 400;
    const height = 64;
    const centerY = height / 2;

    const points = waveformPoints.map((point, index) => {
      const x = (index / (waveformPoints.length - 1)) * width;
      const y = centerY + (point / 100) * (height / 2 - 4);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="w-full h-16">
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={points}
          className="transition-all duration-75 ease-out"
        />
        <line
          x1="0"
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke="#6b7280"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.5"
        />
      </svg>
    );
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      <div className="text-center">
        <div className="text-sm font-medium text-gray-300 mb-2">Audio Level</div>
        <div className="flex items-center justify-center space-x-2">
          <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-100 ease-out ${
                audioLevel > 80 ? 'bg-red-500' : audioLevel > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <span className="text-sm font-mono text-gray-300 w-8 text-right">
            {Math.round(audioLevel)}%
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-300 mb-3">Frequency Spectrum</div>
          <div className="flex items-end justify-center space-x-1 h-20 bg-gray-800 rounded p-2">
            {renderFrequencyBars()}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-300 mb-3">Waveform</div>
          <div className="flex items-center justify-center h-20 bg-gray-800 rounded p-2">
            {renderWaveform()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isActive ? (audioLevel > 5 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-600'
          }`}
        />
        <span className="text-sm text-gray-300">
          {isActive ? (audioLevel > 5 ? 'Active' : 'Low Signal') : 'Inactive'}
        </span>
      </div>
    </div>
  );
};
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioAnalysisData } from '../types/audio.types';

export const useAudioAnalysis = (analyserNode: AnalyserNode | null) => {
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData>({
    frequencyData: new Uint8Array(0),
    waveformData: new Uint8Array(0),
    audioLevel: 0,
  });

  const animationFrameRef = useRef<number | null>(null);
  const frequencyDataRef = useRef<Uint8Array>(new Uint8Array(0));
  const waveformDataRef = useRef<Uint8Array>(new Uint8Array(0));

  const updateAnalysis = useCallback(() => {
    if (!analyserNode) return;

    const bufferLength = analyserNode.frequencyBinCount;
    
    if (frequencyDataRef.current.length !== bufferLength) {
      frequencyDataRef.current = new Uint8Array(bufferLength);
      waveformDataRef.current = new Uint8Array(bufferLength);
    }

    analyserNode.getByteFrequencyData(frequencyDataRef.current);
    analyserNode.getByteTimeDomainData(waveformDataRef.current);

    const frequencyData = new Uint8Array(frequencyDataRef.current);
    const waveformData = new Uint8Array(waveformDataRef.current);

    const averageLevel = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    const audioLevel = Math.min(100, (averageLevel / 255) * 100);

    setAnalysisData({
      frequencyData,
      waveformData,
      audioLevel,
    });

    animationFrameRef.current = requestAnimationFrame(updateAnalysis);
  }, [analyserNode]);

  useEffect(() => {
    if (analyserNode) {
      updateAnalysis();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      setAnalysisData({
        frequencyData: new Uint8Array(0),
        waveformData: new Uint8Array(0),
        audioLevel: 0,
      });
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analyserNode, updateAnalysis]);

  return analysisData;
};

export const createFrequencyBars = (frequencyData: Uint8Array, barCount: number = 32): number[] => {
  if (frequencyData.length === 0) return new Array(barCount).fill(0);

  const bars: number[] = [];
  const samplesPerBar = Math.floor(frequencyData.length / barCount);

  for (let i = 0; i < barCount; i++) {
    const startIndex = i * samplesPerBar;
    const endIndex = Math.min(startIndex + samplesPerBar, frequencyData.length);
    
    let sum = 0;
    for (let j = startIndex; j < endIndex; j++) {
      sum += frequencyData[j];
    }
    
    const average = sum / (endIndex - startIndex);
    bars.push(Math.min(100, (average / 255) * 100));
  }

  return bars;
};

export const createWaveformPoints = (waveformData: Uint8Array, pointCount: number = 100): number[] => {
  if (waveformData.length === 0) return new Array(pointCount).fill(0);

  const points: number[] = [];
  const samplesPerPoint = Math.floor(waveformData.length / pointCount);

  for (let i = 0; i < pointCount; i++) {
    const startIndex = i * samplesPerPoint;
    const endIndex = Math.min(startIndex + samplesPerPoint, waveformData.length);
    
    let sum = 0;
    for (let j = startIndex; j < endIndex; j++) {
      sum += waveformData[j];
    }
    
    const average = sum / (endIndex - startIndex);
    const normalizedValue = ((average - 128) / 128) * 100;
    points.push(Math.max(-100, Math.min(100, normalizedValue)));
  }

  return points;
};
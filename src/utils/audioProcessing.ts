const TARGET_SAMPLE_RATE = 16000;

const textEncoder = new TextEncoder();

const writeString = (view: DataView, offset: number, str: string) => {
  const bytes = textEncoder.encode(str);
  bytes.forEach((byte, index) => view.setUint8(offset + index, byte));
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
};

const encodeWavBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
  const channelData = audioBuffer.getChannelData(0);
  const byteLength = channelData.length * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, byteLength, true);
  floatTo16BitPCM(view, 44, channelData);

  return buffer;
};

const mixToMono = (buffer: AudioBuffer): AudioBuffer => {
  if (buffer.numberOfChannels === 1) {
    return buffer;
  }

  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const monoBuffer = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  const output = monoBuffer.getChannelData(0);

  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel),
  );

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < channelData.length; channel++) {
      sum += channelData[channel][i];
    }
    output[i] = sum / channelData.length;
  }

  return monoBuffer;
};

const resampleBuffer = async (buffer: AudioBuffer, sampleRate = TARGET_SAMPLE_RATE): Promise<AudioBuffer> => {
  const duration = buffer.duration;
  const offline = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();

  const monoSourceBuffer = mixToMono(buffer);
  source.buffer = monoSourceBuffer;
  source.connect(offline.destination);
  source.start(0);

  return offline.startRendering();
};

export const ensureWavBlob = async (blob: Blob, sampleRate = TARGET_SAMPLE_RATE): Promise<Blob> => {
  if (blob.type && blob.type.includes('wav')) {
    return blob;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const resampled = await resampleBuffer(decoded, sampleRate);
    const wavArrayBuffer = encodeWavBuffer(resampled);
    return new Blob([wavArrayBuffer], { type: 'audio/wav' });
  } finally {
    await audioContext.close();
  }
};

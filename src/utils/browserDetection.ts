import { BrowserInfo } from '../types/audio.types';

export const detectBrowser = (): BrowserInfo => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  const isWindows = platform.toLowerCase().includes('win');
  const isMac = platform.toLowerCase().includes('mac');
  
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
  const edgeMatch = userAgent.match(/Edg\/(\d+)/);
  
  const isChrome = !!chromeMatch && !edgeMatch;
  const isEdge = !!edgeMatch;
  
  const chromeVersion = chromeMatch ? chromeMatch[1] : '';
  const edgeVersion = edgeMatch ? edgeMatch[1] : '';
  const version = isEdge ? edgeVersion : chromeVersion;
  
  const supportsSystemAudio = (() => {
    if (!isWindows) return false;
    if (!isChrome && !isEdge) return false;
    
    const majorVersion = parseInt(version, 10);
    if (isChrome && majorVersion >= 74) return true;
    if (isEdge && majorVersion >= 79) return true;
    
    return false;
  })();

  // Tab audio via getDisplayMedia is supported in modern Chrome/Edge on Windows and macOS
  const supportsTabAudio = (() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return false;
    if (!isChrome && !isEdge) return false;
    const majorVersion = parseInt(version, 10);
    if (isChrome && majorVersion >= 74) return true;
    if (isEdge && majorVersion >= 79) return true;
    return false;
  })();

  return {
    isChrome,
    isEdge,
    isWindows,
    version,
    supportsSystemAudio,
    isMac,
    supportsTabAudio,
  };
};

export const checkBrowserCompatibility = (): { compatible: boolean; message: string } => {
  const browser = detectBrowser();
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return {
      compatible: false,
      message: 'Your browser does not support screen capture APIs.',
    };
  }

  if (browser.supportsSystemAudio) {
    return {
      compatible: true,
      message: 'Browser supports system audio capture on Windows.',
    };
  }

  if (browser.supportsTabAudio) {
    return {
      compatible: true,
      message: 'Browser supports tab audio capture. Select the Teams tab and enable audio.',
    };
  }
  
  return {
    compatible: false,
    message: 'Chrome or Edge required for audio capture. Update to the latest version.',
  };
};

export const getBrowserInfoString = (): string => {
  const browser = detectBrowser();
  
  if (!browser.isWindows) {
    return 'Non-Windows OS';
  }
  
  if (browser.isEdge) {
    return `Edge ${browser.version} on Windows`;
  }
  
  if (browser.isChrome) {
    return `Chrome ${browser.version} on Windows`;
  }
  
  return 'Unknown browser';
};
import { BrowserInfo } from '../types/audio.types';

export const detectBrowser = (): BrowserInfo => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  const isWindows = platform.toLowerCase().includes('win');
  
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

  return {
    isChrome,
    isEdge,
    isWindows,
    supportsSystemAudio,
    version,
  };
};

export const checkBrowserCompatibility = (): { compatible: boolean; message: string } => {
  const browser = detectBrowser();
  
  if (!browser.isWindows) {
    return {
      compatible: false,
      message: 'This prototype only works on Windows operating systems.',
    };
  }
  
  if (!browser.isChrome && !browser.isEdge) {
    return {
      compatible: false,
      message: 'This prototype requires Chrome or Edge browser.',
    };
  }
  
  if (!browser.supportsSystemAudio) {
    const browserName = browser.isEdge ? 'Edge' : 'Chrome';
    return {
      compatible: false,
      message: `${browserName} version ${browser.version} may not support system audio capture. Please update to the latest version.`,
    };
  }
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return {
      compatible: false,
      message: 'Your browser does not support screen capture APIs.',
    };
  }
  
  return {
    compatible: true,
    message: 'Browser is compatible with system audio capture.',
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
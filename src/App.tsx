import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { AudioCapture } from './components/AudioCapture';
import { checkBrowserCompatibility, getBrowserInfoString } from './utils/browserDetection';

function App() {
  const [compatibility, setCompatibility] = useState<{ compatible: boolean; message: string } | null>(null);
  const [browserInfo, setBrowserInfo] = useState<string>('');

  useEffect(() => {
    const compat = checkBrowserCompatibility();
    const info = getBrowserInfoString();
    setCompatibility(compat);
    setBrowserInfo(info);
  }, []);

  if (!compatibility) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Audio Capture Prototype
          </h1>
          <p className="text-gray-400 text-sm">
            Browser: {browserInfo}
          </p>
        </div>

        {!compatibility.compatible ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-900 border border-red-700 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <h2 className="text-xl font-semibold text-red-200">Compatibility Issue</h2>
              </div>
              <p className="text-red-300 mb-4">{compatibility.message}</p>
              <div className="bg-red-800 rounded p-4">
                <h3 className="text-red-200 font-medium mb-2">Requirements:</h3>
                <ul className="text-red-300 text-sm space-y-1">
                  <li>• Chrome 74+ or Edge 79+</li>
                  <li>• Screen sharing permissions enabled</li>
                  <li>• HTTPS connection (for production)</li>
                  <li>• System audio capture: Windows only (Chrome/Edge)</li>
                  <li>• Tab audio capture: Windows or macOS (Chrome/Edge)</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <AudioCapture />
        )}
      </div>
    </div>
  );
}

export default App;

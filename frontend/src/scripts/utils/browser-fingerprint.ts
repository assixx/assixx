/**
 * Browser Fingerprinting for Session Security
 * Creates a unique identifier for the browser/device
 */

export class BrowserFingerprint {
  /**
   * Generate a fingerprint based on browser characteristics
   */
  static async generate(): Promise<string> {
    const fingerprint = {
      // User Agent
      userAgent: navigator.userAgent,
      
      // Language
      language: navigator.language,
      languages: navigator.languages?.join(','),
      
      // Screen properties
      screenResolution: `${screen.width}x${screen.height}`,
      screenColorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      
      // Timezone
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      
      // Hardware
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      
      // Platform
      platform: navigator.platform,
      
      // Plugins (deprecated but still useful for fingerprinting)
      plugins: this.getPlugins(),
      
      // Canvas fingerprint
      canvas: await this.getCanvasFingerprint(),
      
      // WebGL
      webgl: this.getWebGLFingerprint(),
      
      // Audio (mit Error Handling)
      audio: await this.getAudioFingerprint().catch(err => {
        console.debug('[Fingerprint] Audio fingerprint error:', err);
        return 'audio-error';
      }),
      
      // Fonts
      fonts: await this.getFontFingerprint(),
    };

    // Create hash from fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    return this.hashString(fingerprintString);
  }

  /**
   * Get installed plugins
   */
  private static getPlugins(): string {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      return 'none';
    }
    
    const plugins = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      plugins.push(navigator.plugins[i].name);
    }
    return plugins.sort().join(',');
  }

  /**
   * Canvas fingerprinting
   */
  private static async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      // Text with special characters
      const txt = 'Assixx@2025!🔒';
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText(txt, 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText(txt, 4, 17);

      return canvas.toDataURL();
    } catch (e) {
      return 'canvas-blocked';
    }
  }

  /**
   * WebGL fingerprinting
   */
  private static getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl || !(gl instanceof WebGLRenderingContext)) return 'no-webgl';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as any;
      if (!debugInfo) return 'no-debug-info';

      return JSON.stringify({
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      });
    } catch (e) {
      return 'webgl-blocked';
    }
  }

  /**
   * Audio fingerprinting
   */
  private static async getAudioFingerprint(): Promise<string> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0; // Mute
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(0);
      
      return new Promise((resolve) => {
        let isResolved = false;
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          
          try {
            oscillator.disconnect();
            analyser.disconnect();
            scriptProcessor.disconnect();
            gain.disconnect();
            if (audioContext.state !== 'closed') {
              audioContext.close().catch(() => {});
            }
          } catch (err) {
            // Ignore cleanup errors
          }
          resolve('audio-timeout');
        }, 100); // 100ms timeout

        scriptProcessor.onaudioprocess = function(e) {
          if (isResolved) return;
          isResolved = true;
          
          clearTimeout(timeout);
          const output = e.outputBuffer.getChannelData(0);
          const fingerprint = output.slice(0, 100).toString();
          
          try {
            oscillator.disconnect();
            analyser.disconnect();
            scriptProcessor.disconnect();
            gain.disconnect();
            if (audioContext.state !== 'closed') {
              audioContext.close().catch(() => {});
            }
          } catch (err) {
            // Ignore cleanup errors
          }
          
          resolve(fingerprint);
        };
      });
    } catch (e) {
      return 'audio-blocked';
    }
  }

  /**
   * Font fingerprinting
   */
  private static async getFontFingerprint(): Promise<string> {
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New',
      'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS',
      'Impact', 'Lucida Console', 'Tahoma', 'Trebuchet MS',
      'Arial Black', 'Arial Narrow', 'Lucida Sans Unicode'
    ];

    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';

    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = testSize;
    span.innerHTML = testString;
    document.body.appendChild(span);

    const baseFontWidths: Record<string, number> = {};
    for (const baseFont of baseFonts) {
      span.style.fontFamily = baseFont;
      baseFontWidths[baseFont] = span.offsetWidth;
    }

    const detectedFonts = [];
    for (const font of testFonts) {
      let detected = false;
      for (const baseFont of baseFonts) {
        span.style.fontFamily = `'${font}', ${baseFont}`;
        if (span.offsetWidth !== baseFontWidths[baseFont]) {
          detected = true;
          break;
        }
      }
      if (detected) {
        detectedFonts.push(font);
      }
    }

    document.body.removeChild(span);
    return detectedFonts.join(',');
  }

  /**
   * Simple hash function
   */
  private static async hashString(str: string): Promise<string> {
    // Use crypto API if available
    if (crypto.subtle && crypto.subtle.digest) {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback to simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get stored fingerprint
   */
  static getStored(): string | null {
    return localStorage.getItem('browserFingerprint');
  }

  /**
   * Store fingerprint
   */
  static store(fingerprint: string): void {
    localStorage.setItem('browserFingerprint', fingerprint);
    localStorage.setItem('fingerprintTimestamp', Date.now().toString());
  }

  /**
   * Validate if current browser matches stored fingerprint
   */
  static async validate(): Promise<boolean> {
    const stored = this.getStored();
    if (!stored) return true; // No stored fingerprint yet

    const current = await this.generate();
    return stored === current;
  }

  /**
   * Check if fingerprint is expired (older than 30 days)
   */
  static isExpired(): boolean {
    const timestamp = localStorage.getItem('fingerprintTimestamp');
    if (!timestamp) return true;

    const age = Date.now() - parseInt(timestamp, 10);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return age > thirtyDays;
  }
}
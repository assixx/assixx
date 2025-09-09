/**
 * Browser Fingerprinting for Session Security
 * Creates a unique identifier for the browser/device
 */

export class BrowserFingerprint {
  // Instance variable to satisfy no-extraneous-class rule
  // Intentionally unused but needed for TypeScript
  private readonly brand = 'BrowserFingerprint' as const;

  // Private constructor to prevent instantiation
  private constructor() {
    // This class is only used for static methods
    // Use the brand to avoid unused variable warning
    void this.brand;
  }

  /**
   * Generate a fingerprint based on browser characteristics
   */
  static async generate(): Promise<string> {
    const fingerprint = {
      // User Agent
      userAgent: navigator.userAgent,

      // Language
      language: navigator.language,
      languages: navigator.languages.join(','),

      // Screen properties
      screenResolution: `${screen.width}x${screen.height}`,
      screenColorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,

      // Timezone
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),

      // Hardware
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,

      // Platform - using userAgent as alternative since platform is deprecated
      platform: navigator.userAgent.includes('Win')
        ? 'Win32'
        : navigator.userAgent.includes('Mac')
          ? 'MacIntel'
          : navigator.userAgent.includes('Linux')
            ? 'Linux'
            : 'Unknown',

      // Plugins (deprecated but still useful for fingerprinting)
      plugins: this.getPlugins(),

      // Canvas fingerprint
      canvas: this.getCanvasFingerprint(),

      // WebGL
      webgl: this.getWebGLFingerprint(),

      // Audio (mit Error Handling)
      audio: await this.getAudioFingerprint().catch(() => {
        console.info('[Fingerprint] Audio fingerprint error');
        return 'audio-error';
      }),

      // Fonts
      fonts: this.getFontFingerprint(),
    };

    // Create hash from fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    return await this.hashString(fingerprintString);
  }

  /**
   * Get installed plugins - returns 'none' as plugins API is deprecated
   */
  private static getPlugins(): string {
    // Plugins API is deprecated, return static value for consistency
    return 'none';
  }

  /**
   * Canvas fingerprinting
   */
  private static getCanvasFingerprint(): string {
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
    } catch {
      return 'canvas-blocked';
    }
  }

  /**
   * WebGL fingerprinting
   */
  private static getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
      if (!gl || !(gl instanceof WebGLRenderingContext)) return 'no-webgl';

      // Try modern approach first (standard WebGL parameters)
      const vendor = gl.getParameter(gl.VENDOR) as string;
      const renderer = gl.getParameter(gl.RENDERER) as string;

      // If standard parameters don't give enough info, try debug extension as fallback
      if (vendor === 'WebKit' && renderer === 'WebKit WebGL') {
        interface WebGLDebugRendererInfo {
          UNMASKED_VENDOR_WEBGL: number;
          UNMASKED_RENDERER_WEBGL: number;
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as WebGLDebugRendererInfo | null;
        if (debugInfo) {
          return JSON.stringify({
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string,
            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string,
          });
        }
      }

      return JSON.stringify({ vendor, renderer });
    } catch {
      return 'webgl-blocked';
    }
  }

  /**
   * Audio fingerprinting
   */
  private static async getAudioFingerprint(): Promise<string> {
    try {
      // AudioContext might not be available in some browsers
      interface AudioWindow extends Window {
        webkitAudioContext?: typeof AudioContext;
        AudioContext?: typeof AudioContext;
      }
      const win = window as AudioWindow;
      const AudioContextClass = win.AudioContext ?? win.webkitAudioContext;
      if (AudioContextClass === undefined) {
        return 'audio-not-supported';
      }
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      // Create a simple audio fingerprint using non-deprecated APIs
      const audioSignature = `${audioContext.sampleRate}-${audioContext.destination.maxChannelCount}`;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);

      gain.gain.value = 0; // Mute
      oscillator.connect(analyser);
      analyser.connect(gain);
      gain.connect(audioContext.destination);

      // Get frequency data for fingerprinting
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);

      // Create fingerprint from audio context properties
      const fingerprint = [
        audioSignature,
        analyser.frequencyBinCount,
        analyser.minDecibels,
        analyser.maxDecibels,
        frequencyData.slice(0, 10).join(','),
      ].join('-');

      // Cleanup
      try {
        oscillator.stop();
        oscillator.disconnect();
        analyser.disconnect();
        gain.disconnect();
        if (audioContext.state !== 'closed') {
          await audioContext.close();
        }
      } catch {
        // Ignore cleanup errors
      }

      return fingerprint;
    } catch {
      return 'audio-blocked';
    }
  }

  /**
   * Font fingerprinting
   */
  private static getFontFingerprint(): string {
    const testFonts = [
      'Arial',
      'Verdana',
      'Times New Roman',
      'Courier New',
      'Georgia',
      'Palatino',
      'Garamond',
      'Comic Sans MS',
      'Impact',
      'Lucida Console',
      'Tahoma',
      'Trebuchet MS',
      'Arial Black',
      'Arial Narrow',
      'Lucida Sans Unicode',
    ];

    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';

    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = testSize;
    span.textContent = testString;
    document.body.append(span);

    const baseFontWidths = new Map<string, number>();
    for (const baseFont of baseFonts) {
      span.style.fontFamily = baseFont;
      baseFontWidths.set(baseFont, span.offsetWidth);
    }

    const detectedFonts = [];
    for (const font of testFonts) {
      let detected = false;
      for (const baseFont of baseFonts) {
        span.style.fontFamily = `'${font}', ${baseFont}`;
        if (span.offsetWidth !== baseFontWidths.get(baseFont)) {
          detected = true;
          break;
        }
      }
      if (detected) {
        detectedFonts.push(font);
      }
    }

    span.remove();
    return detectedFonts.join(',');
  }

  /**
   * Simple hash function
   */
  private static async hashString(str: string): Promise<string> {
    // Use crypto API (always available in modern browsers)
    try {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = [...new Uint8Array(hashBuffer)];
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to simple hash if crypto API fails
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(36);
    }
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
    if (stored === null || stored === '') return true; // No stored fingerprint yet

    const current = await this.generate();
    return stored === current;
  }

  /**
   * Check if fingerprint is expired (older than 30 days)
   */
  static isExpired(): boolean {
    const timestamp = localStorage.getItem('fingerprintTimestamp');
    if (timestamp === null || timestamp === '') return true;

    const age = Date.now() - Number.parseInt(timestamp, 10);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return age > thirtyDays;
  }
}

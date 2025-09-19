/* eslint-env browser */

/**
 * Browser Fingerprinting Utility
 * Generates a unique fingerprint based on browser characteristics
 */

export class BrowserFingerprint {
  /**
   * Get screen-related components
   * @returns {string[]} Screen components
   */
  static getScreenComponents() {
    return [`${screen.width}x${screen.height}`, `${screen.colorDepth}`];
  }

  /**
   * Get timezone and language components
   * @returns {string[]} Locale components
   */
  static getLocaleComponents() {
    return [
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      new Date().getTimezoneOffset(),
      navigator.language || navigator.userLanguage,
      navigator.platform,
    ];
  }

  /**
   * Get canvas fingerprint
   * @returns {string} Canvas fingerprint
   */
  static getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 200;
      canvas.height = 50;

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.font = '11pt Arial';
      ctx.fillText('Browser Fingerprint Canvas', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.font = '18pt Arial';
      ctx.fillText('BrowserLeaks.com', 4, 45);

      return canvas.toDataURL();
    } catch {
      return 'canvas-blocked';
    }
  }

  /**
   * Get WebGL parameters
   * @param {WebGLRenderingContext} gl WebGL context
   * @returns {string[]} WebGL parameters
   */
  static getWebGLParams(gl) {
    const vendor = gl.getParameter(gl.VENDOR);
    const renderer = gl.getParameter(gl.RENDERER);

    const isWebKit = vendor === 'WebKit' && renderer === 'WebKit WebGL';
    if (!isWebKit) {
      return [vendor, renderer];
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return [vendor, renderer];
    }

    return [gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL), gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)];
  }

  /**
   * Get WebGL fingerprint
   * @returns {string[]} WebGL fingerprint
   */
  static getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) {
        return ['webgl-not-supported'];
      }

      return this.getWebGLParams(gl);
    } catch {
      return ['webgl-blocked'];
    }
  }

  /**
   * Get audio fingerprint
   * @returns {Promise<string>} Audio fingerprint
   */
  static async getAudioFingerprint() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0;
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(0);
      let audioData = '';

      await new Promise((resolve) => {
        scriptProcessor.onaudioprocess = function (event) {
          const output = event.inputBuffer.getChannelData(0);
          audioData = output.slice(0, 100).toString();
          resolve();
        };
        setTimeout(resolve, 100);
      });

      oscillator.stop();
      audioContext.close();

      return audioData;
    } catch {
      return 'audio-blocked';
    }
  }

  /**
   * Get hardware components
   * @returns {(string|number|boolean)[]} Hardware components
   */
  static getHardwareComponents() {
    const components = [];

    components.push(navigator.hardwareConcurrency || 'unknown');

    if (navigator.deviceMemory) {
      components.push(navigator.deviceMemory);
    }

    components.push('ontouchstart' in window);

    if (navigator.plugins && navigator.plugins.length > 0) {
      const plugins = [...navigator.plugins].map((plugin) => plugin.name);
      components.push(plugins.join(','));
    }

    return components;
  }

  /**
   * Generate a browser fingerprint
   * @returns {Promise<string>} The generated fingerprint
   */
  static async generate() {
    const components = [];

    components.push(...this.getScreenComponents());
    components.push(...this.getLocaleComponents());
    components.push(this.getCanvasFingerprint());
    components.push(...this.getWebGLFingerprint());
    components.push(await this.getAudioFingerprint());
    components.push(...this.getHardwareComponents());

    return this.hashComponents(components.join('|||'));
  }

  /**
   * Hash the components to create a fingerprint
   * @param {string} components - The components string
   * @returns {Promise<string>} The hashed fingerprint
   */
  static async hashComponents(components) {
    // Use Web Crypto API if available
    if (crypto.subtle && crypto.subtle.digest) {
      const msgBuffer = new TextEncoder().encode(components);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = [...new Uint8Array(hashBuffer)];
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback to simple hash
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      const char = components.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get stored fingerprint from localStorage
   * @returns {string|null} The stored fingerprint or null
   */
  static getStored() {
    try {
      return localStorage.getItem('browser_fingerprint');
    } catch {
      return null;
    }
  }

  /**
   * Store fingerprint in localStorage
   * @param {string} fingerprint - The fingerprint to store
   */
  static store(fingerprint) {
    try {
      localStorage.setItem('browser_fingerprint', fingerprint);
    } catch {
      console.warn('Could not store fingerprint in localStorage');
    }
  }

  /**
   * Get or generate fingerprint
   * @returns {Promise<string>} The fingerprint
   */
  static async getOrGenerate() {
    let fingerprint = this.getStored();

    if (!fingerprint) {
      fingerprint = await this.generate();
      this.store(fingerprint);
    }

    return fingerprint;
  }
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BrowserFingerprint };
}

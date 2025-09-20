/**
 * Type-Safe DOM Utilities
 * Modern, enterprise-grade DOM manipulation helpers with full TypeScript support
 * Best Practice 2025 - Zero runtime errors, maximum type safety
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
import DOMPurify from 'dompurify';

/**
 * Escape HTML special characters to prevent XSS
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Type-safe querySelector that throws if element not found
 * Use this when element MUST exist (critical UI elements)
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 * @throws Error if element not found
 */
export function $(selector: string, parent: Document | HTMLElement = document): HTMLElement {
  const element = parent.querySelector(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element as HTMLElement;
}

/**
 * Type-safe querySelector that returns null if not found
 * Use this for optional elements
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 */
export function $$(selector: string, parent: Document | HTMLElement = document): HTMLElement | null {
  return parent.querySelector(selector);
}

/**
 * Type-safe querySelectorAll
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 */
export function $all(selector: string, parent: Document | HTMLElement = document): NodeListOf<HTMLElement> {
  return parent.querySelectorAll(selector);
}

/**
 * Type-safe querySelector
 * @param id - Element ID (without #)
 * @throws Error if element not found
 */
export function $id(id: string): HTMLElement {
  const element = document.querySelector(`#${id}`);
  if (!element) {
    throw new Error(`Required element with ID not found: ${id}`);
  }
  return element as HTMLElement;
}

/**
 * Type-safe querySelector that returns null if not found
 * @param id - Element ID (without #)
 */
export function $$id(id: string): HTMLElement | null {
  return document.querySelector(`#${id}`);
}

/**
 * Type-safe element creation with attributes
 * @param tag - HTML tag name
 * @param attributes - Element attributes
 * @param children - Child elements or text content
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Partial<HTMLElementTagNameMap[K]>,
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attributes) {
    Object.assign(element, attributes);
  }

  children.forEach((child) => {
    if (typeof child === 'string') {
      element.append(document.createTextNode(child));
    } else {
      element.append(child);
    }
  });

  return element;
}

/**
 * Check if element exists and is visible
 * @param selector - CSS selector
 */
export function isVisible(selector: string): boolean {
  const element = $$(selector);
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Wait for element to appear in DOM
 * @param selector - CSS selector
 * @param timeout - Maximum wait time in ms (default: 5000)
 */
export async function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  timeout = 5000,
): Promise<T> {
  return await new Promise((resolve, reject) => {
    const element = $$(selector) as T | null;
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = $$(selector) as T | null;
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found after ${timeout}ms: ${selector}`));
    }, timeout);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Type guard to check if element is an HTMLInputElement
 */
export function isInputElement(element: Element | null): element is HTMLInputElement {
  return element?.tagName === 'INPUT';
}

/**
 * Type guard to check if element is an HTMLTextAreaElement
 */
export function isTextAreaElement(element: Element | null): element is HTMLTextAreaElement {
  return element?.tagName === 'TEXTAREA';
}

/**
 * Type guard to check if element is an HTMLSelectElement
 */
export function isSelectElement(element: Element | null): element is HTMLSelectElement {
  return element?.tagName === 'SELECT';
}

/**
 * Type guard to check if element is an HTMLButtonElement
 */
export function isButtonElement(element: Element | null): element is HTMLButtonElement {
  return element?.tagName === 'BUTTON';
}

/**
 * Safe element show
 */
export function show(element: HTMLElement | null): void {
  if (element) {
    element.style.display = '';
  }
}

/**
 * Safe element hide
 */
export function hide(element: HTMLElement | null): void {
  if (element) {
    element.style.display = 'none';
  }
}

/**
 * Safe element toggle
 */
export function toggle(element: HTMLElement | null, force?: boolean): void {
  if (!element) return;

  if (force !== undefined) {
    element.style.display = force ? '' : 'none';
  } else {
    const isHidden = element.style.display === 'none' || window.getComputedStyle(element).display === 'none';
    element.style.display = isHidden ? '' : 'none';
  }
}

/**
 * Safe class toggle
 */
export function toggleClass(element: HTMLElement | null, className: string, force?: boolean): void {
  element?.classList.toggle(className, force);
}

/**
 * Safe text content setter
 */
export function setText(element: HTMLElement | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

/**
 * DOMPurify configuration for safe HTML sanitization
 */
const DOMPURIFY_CONFIG = {
  FORCE_BODY: false,
  IN_PLACE: false,
  ALLOWED_TAGS: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'br',
    'p',
    'div',
    'span',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'button',
    'input',
    'select',
    'option',
    'label',
    'small',
    'code',
    'pre',
    // Navigation-specific tags
    'header',
    'nav',
    'aside',
    'main',
    'footer',
    'section',
    'article',
    // SVG tags for icons
    'svg',
    'path',
    'circle',
    'rect',
    'line',
    'polygon',
    'polyline',
    'g',
    'defs',
    'use',
    'symbol',
    // Style tag for inline styles
    'style',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'class',
    'id',
    'data-*',
    'src',
    'alt',
    'width',
    'height',
    'type',
    'value',
    'name',
    'for',
    // 'onclick', // REMOVED for security - use Event Delegation instead!
    'style',
    // Accessibility attributes
    'role',
    'aria-*',
    'tabindex',
    // SVG attributes
    'viewBox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'd',
    'xmlns',
    'transform',
    'cx',
    'cy',
    'r',
    'x',
    'y',
    'rx',
    'ry',
    'points',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
  ],
  ALLOW_DATA_ATTR: true,
};

/**
 * Safe HTML content setter using DOMPurify
 * Sanitizes HTML to prevent XSS attacks
 */
export function setHTML(element: HTMLElement | null, html: string): void {
  if (element) {
    const sanitized = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    // Safe: Content is sanitized by DOMPurify
    // eslint-disable-next-line no-unsanitized/property
    element.innerHTML = sanitized;
  }
}

/**
 * Safe HTML content setter for trusted content (internal HTML generation)
 * Use this when HTML is generated internally and not from user input
 */
export function setSafeHTML(element: HTMLElement | null, html: string): void {
  if (element) {
    // Sanitize with more permissive settings for internal content
    const sanitized = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: true,
    });

    // Safe: Content is sanitized by DOMPurify
    // eslint-disable-next-line no-unsanitized/property
    element.innerHTML = sanitized;
  }
}

/**
 * Safe attribute setter
 */
export function setAttr(element: HTMLElement | null, name: string, value: string): void {
  element?.setAttribute(name, value);
}

/**
 * Safe attribute getter
 */
export function getAttr(element: HTMLElement | null, name: string): string | null {
  return element?.getAttribute(name) ?? null;
}

/**
 * Safe dataset setter
 */
export function setData(element: HTMLElement | null, key: string, value: string): void {
  if (element) {
    // eslint-disable-next-line security/detect-object-injection
    element.dataset[key] = value; // Safe: dataset is a controlled API
  }
}

/**
 * Safe dataset getter
 */
export function getData(element: HTMLElement | null, key: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection
  return element?.dataset[key]; // Safe: dataset is a controlled API
}

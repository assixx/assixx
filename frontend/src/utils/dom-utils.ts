/**
 * Type-Safe DOM Utilities
 * Modern, enterprise-grade DOM manipulation helpers with full TypeScript support
 * Best Practice 2025 - Zero runtime errors, maximum type safety
 */

/**
 * Type-safe querySelector that throws if element not found
 * Use this when element MUST exist (critical UI elements)
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 * @throws Error if element not found
 */
export function $<T extends HTMLElement = HTMLElement>(selector: string, parent: Document | HTMLElement = document): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

/**
 * Type-safe querySelector that returns null if not found
 * Use this for optional elements
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 */
export function $$<T extends HTMLElement = HTMLElement>(
  selector: string,
  parent: Document | HTMLElement = document,
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Type-safe querySelectorAll
 * @param selector - CSS selector
 * @param parent - Parent element to search in (default: document)
 */
export function $all<T extends HTMLElement = HTMLElement>(
  selector: string,
  parent: Document | HTMLElement = document,
): NodeListOf<T> {
  return parent.querySelectorAll<T>(selector);
}

/**
 * Type-safe getElementById
 * @param id - Element ID (without #)
 * @throws Error if element not found
 */
export function $id<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;
  if (!element) {
    throw new Error(`Required element with ID not found: ${id}`);
  }
  return element;
}

/**
 * Type-safe getElementById that returns null if not found
 * @param id - Element ID (without #)
 */
export function $$id<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
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
    const element = $$<T>(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = $$<T>(selector);
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
 * Safe HTML content setter (use with caution!)
 * Uses template element for parsing to avoid direct innerHTML assignment
 */
export function setHTML(element: HTMLElement | null, html: string): void {
  if (element) {
    // Clear existing content
    while (element.firstChild) {
      element.firstChild.remove();
    }

    // Use template element for safe parsing
    const template = document.createElement('template');
    template.innerHTML = html;
    element.append(template.content);
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
    element.dataset[key] = value;
  }
}

/**
 * Safe dataset getter
 */
export function getData(element: HTMLElement | null, key: string): string | undefined {
  return element?.dataset[key];
}

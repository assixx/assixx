/**
 * Signup Dropdown Controller
 *
 * Reusable dropdown component for custom select inputs
 * Used for: Country selection, Plan selection
 * Best Practice 2025: Component-based architecture
 */

/**
 * Dropdown option interface
 */
export interface DropdownOption {
  value: string;
  label: string;
  icon?: string; // For country flags or plan icons
  metadata?: string; // For country codes or plan prices
}

/**
 * Dropdown Controller
 * Manages state and behavior for custom dropdown components
 */
export class DropdownController {
  private trigger: HTMLElement;
  private menu: HTMLElement;
  private options: NodeListOf<HTMLElement>;
  private hiddenInput: HTMLInputElement;
  private displayElement: HTMLElement;
  private isOpen = false;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Initialize dropdown
   * @param triggerSelector - CSS selector for trigger element
   * @param menuSelector - CSS selector for menu element
   * @param hiddenInputSelector - CSS selector for hidden input
   * @param displaySelector - CSS selector for display element
   */
  constructor(triggerSelector: string, menuSelector: string, hiddenInputSelector: string, displaySelector: string) {
    const trigger = document.querySelector<HTMLElement>(triggerSelector);
    const menu = document.querySelector<HTMLElement>(menuSelector);
    const hiddenInput = document.querySelector<HTMLInputElement>(hiddenInputSelector);
    const displayElement = document.querySelector<HTMLElement>(displaySelector);

    if (trigger === null || menu === null || hiddenInput === null || displayElement === null) {
      throw new Error('Dropdown elements not found');
    }

    this.trigger = trigger;
    this.menu = menu;
    this.hiddenInput = hiddenInput;
    this.displayElement = displayElement;
    this.options = menu.querySelectorAll<HTMLElement>('[data-action*="select-"]');

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Trigger click
    this.trigger.addEventListener('click', () => {
      this.toggle();
    });

    // Option clicks
    this.options.forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectOption(option);
      });
    });
  }

  /**
   * Toggle dropdown open/close
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open dropdown
   */
  public open(): void {
    this.menu.classList.add('active');
    this.trigger.classList.add('active');
    this.isOpen = true;

    // Setup outside click listener
    this.outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!this.trigger.contains(target) && !this.menu.contains(target)) {
        this.close();
      }
    };

    // Add listener after current event loop to prevent immediate closure
    const handler = this.outsideClickHandler;
    setTimeout(() => {
      document.addEventListener('click', handler);
    }, 0);
  }

  /**
   * Close dropdown
   */
  public close(): void {
    this.menu.classList.remove('active');
    this.trigger.classList.remove('active');
    this.isOpen = false;

    // Remove outside click listener
    if (this.outsideClickHandler !== null) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  /**
   * Select option
   */
  private selectOption(option: HTMLElement): void {
    const value = option.dataset['value'];
    // TypeScript guarantees textContent is string (not null) in this context
    const name = option.dataset['name'] ?? option.textContent.trim();
    const icon = option.dataset['icon'] ?? option.dataset['flag'];
    const code = option.dataset['code'];

    // Update hidden input
    if (value !== undefined && value !== '') {
      this.hiddenInput.value = value;
    }

    // Update display element
    if (icon !== undefined && icon !== '') {
      // For country dropdowns with flags
      const flagElement = this.displayElement.querySelector('[id*="Flag"]');
      const codeElement = this.displayElement.querySelector('[id*="Code"]');

      if (flagElement !== null && codeElement !== null) {
        flagElement.textContent = icon;
        codeElement.textContent = code ?? '';
      } else {
        this.displayElement.textContent = `${icon} ${name}`;
      }
    } else {
      // For plan dropdowns
      this.displayElement.textContent = name;
    }

    this.close();
  }

  /**
   * Get current value
   */
  public getValue(): string {
    return this.hiddenInput.value;
  }

  /**
   * Set value programmatically
   */
  public setValue(value: string): void {
    const option = Array.from(this.options).find((opt) => opt.dataset['value'] === value);

    if (option !== undefined) {
      this.selectOption(option);
    }
  }

  /**
   * Destroy dropdown (cleanup)
   */
  public destroy(): void {
    if (this.outsideClickHandler !== null) {
      document.removeEventListener('click', this.outsideClickHandler);
    }
  }
}

/**
 * Helper function to initialize dropdown
 */
export function initDropdown(
  triggerSelector: string,
  menuSelector: string,
  hiddenInputSelector: string,
  displaySelector: string,
): DropdownController {
  return new DropdownController(triggerSelector, menuSelector, hiddenInputSelector, displaySelector);
}

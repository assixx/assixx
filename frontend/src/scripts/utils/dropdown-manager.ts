class DropdownManager {
  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Toggle dropdown
      if (target.classList.contains('dropdown-display')) {
        e.stopPropagation();
        this.toggle(target);
      }

      // Close on outside click
      if (!target.closest('.custom-dropdown')) {
        this.closeAll();
      }
    });
  }

  private toggle(trigger: HTMLElement): void {
    const dropdown = trigger.nextElementSibling;
    const isActive = trigger.classList.contains('active');

    this.closeAll();

    if (!isActive && dropdown) {
      trigger.classList.add('active');
      dropdown.classList.add('active');
    }
  }

  private closeAll(): void {
    document.querySelectorAll('.dropdown-display.active').forEach((el) => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-options.active').forEach((el) => {
      el.classList.remove('active');
    });
  }
}

// Auto-initialize
new DropdownManager();

export { DropdownManager };

/**
 * Storage Upgrade Controller
 * Handles storage info display and plan upgrades
 */

import { apiClient } from '../../utils/api-client.js';
import { showSuccessAlert, showErrorAlert } from '../utils/alerts.js';
import { $$id } from '../../utils/dom-utils.js';

interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  plan: string;
}

interface PlanUpgradeRequest {
  planId: number;
}

interface CurrentPlanResponse {
  plan?: {
    code?: string;
  };
}

interface AddonsResponse {
  storageGb?: number;
}

export class StorageUpgradeController {
  /**
   * Initialize controller
   */
  public init(): void {
    this.setupEventListeners();
    void this.loadStorageInfo();
  }

  /**
   * Setup event delegation for storage actions
   */
  private setupEventListeners(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]');

      if (button === null) {
        return;
      }

      const buttonEl = button as HTMLElement;
      const action = buttonEl.dataset['action'];

      if (action === 'upgrade-storage') {
        const plan = buttonEl.dataset['plan'];
        if (plan !== undefined) {
          void this.upgradeStorage(plan);
        }
      } else if (action === 'contact-sales') {
        this.contactSales();
      }
    });
  }

  /**
   * Load current storage info from API
   */
  private async loadStorageInfo(): Promise<void> {
    try {
      // V2 API: Get current plan and addons for storage info
      const currentPlan = await apiClient.get('/plans/current');
      const addons = await apiClient.get('/plans/addons');

      // Calculate storage info
      const storageInfo: StorageInfo = {
        used: 0, // TODO: Get actual used storage from backend
        total: ((addons as AddonsResponse).storageGb ?? 5) * 1024 * 1024 * 1024,
        percentage: 0,
        plan: (currentPlan as CurrentPlanResponse).plan?.code ?? 'basic',
      };

      // TODO: Replace with actual storage usage endpoint when available
      // For now showing 0 usage

      this.updateStorageDisplay(storageInfo);
      this.highlightCurrentPlan(storageInfo.plan);
    } catch (error) {
      console.error('Error loading storage info:', error);
      showErrorAlert('Fehler beim Laden der Speicherinformationen');
    }
  }

  /**
   * Update storage display in UI
   */
  private updateStorageDisplay(data: StorageInfo): void {
    const { used, total, percentage } = data;

    // Update text
    const usedElement = $$id('used-storage');
    const totalElement = $$id('total-storage');
    const percentageElement = $$id('storage-percentage');

    if (usedElement !== null) {
      usedElement.textContent = this.formatBytes(used);
    }

    if (totalElement !== null) {
      totalElement.textContent = this.formatBytes(total);
    }

    if (percentageElement !== null) {
      percentageElement.textContent = `${percentage}%`;
    }

    // Update progress bar
    const progressBar = $$id('storage-progress');
    if (progressBar !== null) {
      progressBar.style.width = `${percentage}%`;

      // Update color based on usage
      if (percentage >= 90) {
        progressBar.style.backgroundColor = 'var(--error-color)';
      } else if (percentage >= 70) {
        progressBar.style.backgroundColor = 'var(--warning-color)';
      } else {
        progressBar.style.backgroundColor = 'var(--success-color)';
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 GB';
    }

    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Use switch statement to avoid object injection warning
    let sizeUnit: string;
    switch (i) {
      case 0:
        sizeUnit = 'B';
        break;
      case 1:
        sizeUnit = 'KB';
        break;
      case 2:
        sizeUnit = 'MB';
        break;
      case 3:
        sizeUnit = 'GB';
        break;
      case 4:
        sizeUnit = 'TB';
        break;
      default:
        sizeUnit = i < 0 ? 'B' : 'TB';
    }

    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizeUnit}`;
  }

  /**
   * Highlight current plan card
   */
  private highlightCurrentPlan(plan: string): void {
    // Remove current class from all cards
    document.querySelectorAll('.storage-plan-card').forEach((card) => {
      card.classList.remove('current');
    });

    // Add current class to active plan
    const currentPlanCard = $$id(`plan-${plan}`);
    if (currentPlanCard !== null) {
      currentPlanCard.classList.add('current');

      const button = currentPlanCard.querySelector('button');
      if (button !== null) {
        button.textContent = 'Aktueller Plan';
        button.disabled = true;
        button.classList.remove('btn-primary');
        button.classList.add('btn-secondary');
      }
    }
  }

  /**
   * Get plan ID from plan code
   */
  private getPlanId(plan: string): number | null {
    switch (plan) {
      case 'basic':
        return 1;
      case 'professional':
        return 2;
      case 'enterprise':
        return 3;
      default:
        return null;
    }
  }

  /**
   * Format plan name for display
   */
  private formatPlanName(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  /**
   * Show upgrade confirmation modal
   */
  private showUpgradeConfirmation(planName: string): boolean {
    // Simple confirm for now - can be replaced with Design System modal later
    return confirm(`Möchten Sie wirklich auf den ${planName} Plan upgraden?`);
  }

  /**
   * Upgrade storage plan
   */
  private async upgradeStorage(plan: string): Promise<void> {
    const formattedPlan = this.formatPlanName(plan);

    // Show confirmation
    const confirmed = this.showUpgradeConfirmation(formattedPlan);
    if (!confirmed) {
      return;
    }

    const planId = this.getPlanId(plan);
    if (planId === null) {
      showErrorAlert('Ungültiger Plan ausgewählt');
      return;
    }

    try {
      const request: PlanUpgradeRequest = { planId };
      await apiClient.put('/plans/upgrade', request);

      showSuccessAlert('Plan erfolgreich aktualisiert! Die Änderungen werden in Kürze wirksam.');
      await this.loadStorageInfo();
    } catch (error) {
      console.error('Error upgrading plan:', error);
      showErrorAlert('Fehler beim Plan-Upgrade. Bitte kontaktieren Sie unseren Support.');
    }
  }

  /**
   * Open email to contact sales
   */
  private contactSales(): void {
    window.location.href = 'mailto:sales@assixx.com?subject=Individueller Speicherplatz Anfrage';
  }
}

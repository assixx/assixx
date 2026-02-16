<!--
  SidebarStorageWidget.svelte
  Storage usage widget in the sidebar (Root only)
  Extracted from AppSidebar.svelte for max-lines compliance
-->
<div class="storage-widget">
  <div class="storage-header">
    <i class="fas fa-database"></i>
    <span>Speicherplatz</span>
  </div>
  <div class="storage-info">
    <div class="storage-usage-text">
      <span>-- GB</span> von <span>-- GB</span>
    </div>
    <div class="storage-progress">
      <div
        class="storage-progress-bar"
        style="width: 0%"
      ></div>
    </div>
    <div class="storage-percentage">0% belegt</div>
  </div>
</div>

<style>
  .storage-widget {
    margin-top: 50px;
    width: 95%;
  }

  .storage-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
    color: var(--primary-color);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .storage-info {
    margin-bottom: var(--spacing-4);
  }

  .storage-usage-text {
    margin-bottom: var(--spacing-2);
    color: var(--text-secondary);
    font-size: 13px;
  }

  .storage-usage-text span {
    color: var(--text-primary);
    font-weight: 600;
  }

  .storage-progress {
    margin-bottom: var(--spacing-1);
    box-shadow: inset 0 1px 3px rgb(0 0 0 / 30%);
    border-radius: 4px;
    background: var(--accent-color);
    width: 100%;
    height: 8px;
    overflow: hidden;
  }

  .storage-progress-bar {
    position: relative;
    border-radius: 4px;
    background: var(--success-color);
    height: 100%;
    overflow: hidden;
  }

  .storage-progress-bar::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      45deg,
      transparent 25%,
      rgb(255 255 255 / 20%) 25%,
      rgb(255 255 255 / 20%) 50%,
      transparent 50%,
      transparent 75%,
      rgb(255 255 255 / 20%) 75%,
      rgb(255 255 255 / 20%)
    );
    background-size: 20px 20px;
    content: '';
  }

  .storage-percentage {
    color: var(--text-secondary);
    font-size: 12px;
    text-align: right;
  }
</style>

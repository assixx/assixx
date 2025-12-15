/**
 * Survey Results Module
 * Orchestrates the survey results page functionality
 */

import { showAlert, showErrorAlert, showSuccessAlert } from '../../utils/alerts';
import {
  loadSurveyDetails,
  loadSurveyQuestions,
  loadSurveyStatistics,
  loadSurveyResponses,
  exportToExcel,
} from './data';
import { renderResults, showError, showLoading } from './ui';

// ============================================
// State
// ============================================

let surveyId: string | null = null;

// ============================================
// Initialization
// ============================================

/**
 * Initializes the survey results page
 */
function initialize(): void {
  console.info('[Survey Results] Page initialized');

  // Get survey ID from URL (can be UUID or numeric ID)
  const urlParams = new URLSearchParams(window.location.search);
  surveyId = urlParams.get('surveyId');

  const contentArea = document.querySelector<HTMLElement>('#content-area');
  if (!contentArea) {
    console.error('[Survey Results] Content area not found');
    return;
  }

  if (surveyId === null || surveyId === '') {
    showError(contentArea, 'Keine Umfrage-ID angegeben');
    return;
  }

  // Load survey results
  loadAllData().catch((error: unknown) => {
    console.error('[Survey Results] Unhandled error in loadAllData:', error);
  });
}

/**
 * Loads all survey data (details, statistics, responses)
 */
async function loadAllData(): Promise<void> {
  if (surveyId === null || surveyId === '') return;

  const contentArea = document.querySelector<HTMLElement>('#content-area');
  if (!contentArea) return;

  showLoading(contentArea);

  try {
    console.info('[Survey Results] Loading survey:', surveyId);

    // Load survey details
    const survey = await loadSurveyDetails(surveyId);

    // Add questions if not included
    if (!survey.questions) {
      console.info('[Survey Results] Loading questions separately...');
      const questions = await loadSurveyQuestions(surveyId);
      survey.questions = questions;
    }

    // Check if survey is draft
    if (survey.status === 'draft') {
      showError(contentArea, 'Diese Umfrage ist noch ein Entwurf und hat keine Ergebnisse.');
      setTimeout(() => {
        window.location.href = '/survey-admin';
      }, 2000);
      return;
    }

    // Load statistics
    console.info('[Survey Results] Loading statistics...');
    const stats = await loadSurveyStatistics(surveyId);

    // Load individual responses (admin only - might fail)
    console.info('[Survey Results] Loading individual responses...');
    const responses = await loadSurveyResponses(surveyId);

    if (responses !== null) {
      console.info('[Survey Results] Responses loaded:', responses);
    }

    // Render results (all data successfully loaded at this point)
    renderResults(contentArea, survey, stats, responses);
    attachEventHandlers();
  } catch (error) {
    console.error('[Survey Results] Error loading data:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden der Umfrage-Ergebnisse';
    showError(contentArea, message);
  }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Attaches all event handlers
 */
function attachEventHandlers(): void {
  // Excel export
  const exportExcelBtn = document.querySelector('#export-excel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      handleExportExcel().catch((error: unknown) => {
        console.error('[Survey Results] Excel export failed:', error);
      });
    });
  }

  // PDF export
  const exportPdfBtn = document.querySelector('#export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', handleExportPDF);
  }

  // Event delegation for dynamic buttons
  document.addEventListener('click', handleButtonClick);

  // Accordion toggle for individual responses
  document.addEventListener('click', handleAccordionToggle);
}

/**
 * Handles button clicks via event delegation
 * @param event - Click event
 */
function handleButtonClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  // Handle print button
  const printBtn = target.closest<HTMLElement>('[data-action="print"]');
  if (printBtn) {
    window.print();
    return;
  }

  // Handle navigate back button
  const navigateBtn = target.closest<HTMLElement>('[data-action="navigate-back"]');
  if (navigateBtn) {
    window.location.href = '/survey-admin';
  }
}

/**
 * Handles accordion toggle clicks
 * @param event - Click event
 */
function handleAccordionToggle(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  // Check if click is on accordion header
  const accordionHeader = target.closest<HTMLElement>('.accordion__header');
  if (!accordionHeader) return;

  // Find parent accordion item
  const accordionItem = accordionHeader.closest<HTMLElement>('.accordion__item');
  if (!accordionItem) return;

  // Toggle active class
  accordionItem.classList.toggle('accordion__item--active');
}

/**
 * Handles Excel export
 */
async function handleExportExcel(): Promise<void> {
  if (surveyId === null || surveyId === '') {
    showErrorAlert('Keine Umfrage-ID verfügbar');
    return;
  }

  try {
    await exportToExcel(surveyId);
    showSuccessAlert('Export erfolgreich!');
  } catch (error) {
    console.error('[Survey Results] Export error:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    showErrorAlert(`Fehler beim Exportieren: ${message}`);
  }
}

/**
 * Handles PDF export (placeholder)
 */
function handleExportPDF(): void {
  if (surveyId === null || surveyId === '') {
    showErrorAlert('Keine Umfrage-ID verfügbar');
    return;
  }

  // TODO: Implement PDF export
  showAlert('PDF-Export wird implementiert...');
}

// ============================================
// Initialize on DOMContentLoaded
// ============================================

document.addEventListener('DOMContentLoaded', initialize);

/**
 * Survey Employee - Main Module
 * Orchestration and event handling for employee survey functionality
 */

import { showErrorAlert } from '../../utils/alerts';
import type { WindowWithExtensions } from './types';
import { loadSurveys, fetchSurveyDetails, fetchUserResponse } from './data';
import { displaySurveys, closeModal, closeResponseModal, showResponseModal } from './ui';
import { startSurvey, updateAnswer, updateMultipleChoice, selectRating, handleSubmit } from './forms';

// ============================================
// Survey Employee Manager Class
// ============================================

export class SurveyEmployeeManager {
  constructor() {
    this.initializeEventListeners();
  }

  // ============================================
  // Initialization
  // ============================================

  private initializeEventListeners(): void {
    // Document ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        void this.init();
      });
    } else {
      void this.init();
    }

    // Event delegation for all survey employee actions
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      this.handleDocumentClick(e, target);
    });

    // Event delegation for form inputs
    document.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLElement;
      this.handleInputChange(e, target);
    });

    // Form submit handler
    const form = document.getElementById('surveyForm');
    if (form !== null) {
      form.addEventListener('submit', (e: Event) => {
        void handleSubmit(e);
      });
    }
  }

  private async init(): Promise<void> {
    try {
      console.log('[SurveyEmployee] Initializing...');
      const surveys = await loadSurveys();
      await displaySurveys(surveys);
    } catch (error) {
      console.error('[SurveyEmployee] Initialization error:', error);
      showErrorAlert('Fehler beim Laden der Umfragen');
    }
  }

  // ============================================
  // Event Handling
  // ============================================

  private handleDocumentClick(e: MouseEvent, target: HTMLElement): void {
    // Handle data-action clicks
    const actionElement = target.closest<HTMLElement>('[data-action]');
    if (actionElement !== null) {
      this.handleActionClick(e, actionElement);
      return;
    }

    // Handle survey card clicks
    const surveyCard = target.closest<HTMLElement>('.survey-card');
    if (surveyCard !== null) {
      this.handleSurveyCardClick(e, surveyCard);
      return;
    }

    // Handle rating clicks (rating buttons have data-rating-value attribute)
    const ratingButton = target.closest<HTMLElement>('[data-rating-value]');
    if (ratingButton?.dataset.ratingValue !== undefined) {
      this.handleRatingClick(ratingButton);
    }
  }

  private handleActionClick(e: MouseEvent, actionElement: HTMLElement): void {
    const action = actionElement.dataset.action ?? '';

    // Prevent default for buttons
    if (actionElement.tagName === 'BUTTON') {
      e.preventDefault();
      e.stopPropagation();
    }

    this.executeAction(action, actionElement);
  }

  private handleSurveyCardClick(e: MouseEvent, card: HTMLElement): void {
    const surveyId = card.dataset.surveyId;
    const action = card.dataset.action;

    if (surveyId == null) return;

    e.preventDefault();
    e.stopPropagation();

    if (action === 'view-response') {
      void this.handleViewResponse(Number(surveyId));
    } else if (action === 'start-survey') {
      void this.handleStartSurvey(Number(surveyId));
    }
  }

  private handleRatingClick(ratingOption: HTMLElement): void {
    const questionId = ratingOption.dataset.questionId;
    const ratingValue = ratingOption.dataset.ratingValue;

    if (questionId != null && ratingValue != null) {
      selectRating(Number(questionId), Number(ratingValue));
    }
  }

  private handleInputChange(_e: Event, target: HTMLElement): void {
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }

    const questionId = target.dataset.questionId;
    const type = target.dataset.type;

    if (questionId == null) return;

    const qId = Number(questionId);

    // Use target.type (HTML input type) for radio/checkbox instead of data-type attribute
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      // Multiple choice (data-type="multiple")
      updateMultipleChoice(qId, Number(target.value), target.checked);
    } else if (target instanceof HTMLInputElement && target.type === 'radio') {
      // Single choice or yes/no (data-type="single")
      updateAnswer(qId, target.value, 'single');
    } else if (type === 'text') {
      // Text area or text input
      updateAnswer(qId, target.value, 'text');
    } else if (type === 'number') {
      // Number input
      updateAnswer(qId, target.value, 'number');
    } else if (type === 'date') {
      // Date input
      updateAnswer(qId, target.value, 'date');
    }
  }

  private executeAction(action: string, target: HTMLElement): void {
    console.log('[SurveyEmployee] Executing action:', action);

    const surveyId = target.dataset.surveyId ?? '';

    switch (action) {
      case 'start-survey':
        if (surveyId !== '') {
          void this.handleStartSurvey(Number(surveyId));
        }
        break;

      case 'view-response':
        if (surveyId !== '') {
          void this.handleViewResponse(Number(surveyId));
        }
        break;

      case 'close':
        closeModal();
        break;

      case 'close-response':
        closeResponseModal();
        break;

      default:
        console.warn('[SurveyEmployee] Unknown action:', action);
    }
  }

  // ============================================
  // Action Handlers
  // ============================================

  private async handleStartSurvey(surveyId: number): Promise<void> {
    await startSurvey(surveyId);
  }

  private async handleViewResponse(surveyId: number): Promise<void> {
    try {
      const survey = await fetchSurveyDetails(surveyId);
      const responseData = await fetchUserResponse(surveyId);

      if (responseData == null || !responseData.responded || responseData.response == null) {
        showErrorAlert('Keine Antworten für diese Umfrage gefunden.');
        return;
      }

      showResponseModal(survey, responseData.response);
    } catch (error) {
      console.error('[SurveyEmployee] Error viewing response:', error);
      showErrorAlert('Fehler beim Abrufen Ihrer Antworten');
    }
  }
}

// ============================================
// Initialize
// ============================================

// Initialize on module load
const extWindow = window as unknown as WindowWithExtensions;
if (extWindow.__surveyEmployeeManager === undefined) {
  console.log('[SurveyEmployee] Initializing SurveyEmployeeManager');
  extWindow.__surveyEmployeeManager = new SurveyEmployeeManager();
}

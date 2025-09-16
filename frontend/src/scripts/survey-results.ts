/**
 * Survey Results Page
 * Displays survey statistics and individual responses
 */

import domPurify from 'dompurify';
import { ApiClient } from '../utils/api-client';
import { showAlert, showErrorAlert, showSuccessAlert } from './utils/alerts';

// Use DOMPurify for secure HTML escaping - best practice for security
const escapeHtml = (text: string): string => {
  return domPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};

interface SurveyData {
  id: number;
  title: string;
  description?: string;
  status: string;
  isAnonymous: boolean | number | string;
  createdAt: string;
  endDate: string;
  questions?: SurveyQuestion[];
}

interface SurveyQuestion {
  id: number;
  questionText: string;
  question_text?: string;
  questionType: string;
  question_type?: string;
  options?: QuestionOption[];
  statistics?: QuestionStatistics;
  responses?: TextResponse[];
}

interface QuestionOption {
  option_text: string;
  count?: number; // Optional because API might not always provide it
}

interface QuestionStatistics {
  average?: number;
  min?: number;
  max?: number;
  count?: number;
}

interface TextResponse {
  answerText: string;
  userId?: number;
  firstName?: string;
  lastName?: string;
}

interface SurveyStatistics {
  total_responses?: number;
  totalResponses?: number;
  completed_responses?: number;
  completedResponses?: number;
  completion_rate?: number;
  completionRate?: number;
  questions?: SurveyQuestion[];
  firstResponse?: string;
  lastResponse?: string;
}

interface SurveyResponse {
  id: number;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  status: string;
  completed_at?: string;
  completedAt?: string;
  answers?: ResponseAnswer[];
}

interface ResponseAnswer {
  question_id?: number;
  questionId?: number;
  answer_text?: string;
  answerText?: string;
  answer_number?: number;
  answerNumber?: string;
  answer_options?: number[];
  question_text?: string;
}

interface ResponsesData {
  responses: SurveyResponse[];
  total: number;
}

class SurveyResultsPage {
  private apiClient: ApiClient;
  private surveyId: string | null = null;
  private surveyData: SurveyData | null = null;
  private statistics: SurveyStatistics | null = null;
  private responsesData: ResponsesData | null = null;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.init();
  }

  private init(): void {
    document.addEventListener('DOMContentLoaded', () => {
      console.info('[Survey Results] Page initialized');

      // Get survey ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.surveyId = urlParams.get('id');

      if (this.surveyId === null || this.surveyId === '') {
        this.showError('Keine Umfrage-ID angegeben');
        return;
      }

      // Load survey data
      void this.loadSurveyResults();
    });
  }

  private async loadSurveyResults(): Promise<void> {
    try {
      if (this.surveyId === null || this.surveyId === '') {
        throw new Error('Keine Umfrage-ID');
      }

      // Load survey details
      console.info('[Survey Results] Loading survey:', this.surveyId);
      this.surveyData = await this.apiClient.get<SurveyData>(`/surveys/${this.surveyId}`);

      // Add questions if not included
      if (!this.surveyData.questions) {
        const questions = await this.apiClient.get<SurveyQuestion[]>(`/surveys/${this.surveyId}/questions`);
        this.surveyData.questions = questions;
      }

      // Check if survey is draft
      if (this.surveyData.status === 'draft') {
        this.showError('Diese Umfrage ist noch ein Entwurf und hat keine Ergebnisse.');
        setTimeout(() => {
          window.location.href = '/survey-admin';
        }, 2000);
        return;
      }

      // Load statistics
      console.info('[Survey Results] Loading statistics...');
      this.statistics = await this.apiClient.get<SurveyStatistics>(`/surveys/${this.surveyId}/statistics`);

      // Load individual responses (admin only)
      console.info('[Survey Results] Loading individual responses...');
      try {
        this.responsesData = await this.apiClient.get<ResponsesData>(`/surveys/${this.surveyId}/responses`);
        console.info('[Survey Results] Responses loaded:', this.responsesData);
      } catch (error) {
        console.warn('[Survey Results] Could not load individual responses:', error);
        this.responsesData = null;
      }

      // Render results
      this.renderResults();
    } catch (error) {
      console.error('[Survey Results] Error loading data:', error);
      this.showError(error instanceof Error ? error.message : 'Fehler beim Laden der Umfrage-Ergebnisse');
    }
  }

  private renderResults(): void {
    const contentArea = document.querySelector('#content-area');
    if (!contentArea || !this.surveyData || !this.statistics) {
      this.showError('Keine Daten verfügbar');
      return;
    }

    // TypeScript assertion after null check
    const surveyData = this.surveyData;
    const statistics = this.statistics;

    const isAnonymous = this.isAnonymousSurvey();
    const totalResponses = statistics.total_responses ?? statistics.totalResponses ?? 0;
    const completedResponses = statistics.completed_responses ?? statistics.completedResponses ?? 0;
    const completionRate = statistics.completion_rate ?? statistics.completionRate ?? 0;

    const htmlContent = `
      <div class="glass-card results-header">
        <h2 class="survey-title">${escapeHtml(surveyData.title)}</h2>
        <div class="survey-meta">
          <span><i class="fas fa-calendar"></i> Erstellt: ${this.formatDate(surveyData.createdAt)}</span>
          <span><i class="fas fa-calendar-check"></i> Endet: ${this.formatDate(surveyData.endDate)}</span>
          <span><i class="fas fa-user-shield"></i> ${isAnonymous ? 'Anonym' : 'Nicht anonym'}</span>
        </div>
      </div>

      <div class="export-actions">
        <button class="btn btn-primary" id="export-excel">
          <i class="fas fa-file-excel"></i> Excel Export
        </button>
        <button class="btn btn-secondary" id="export-pdf">
          <i class="fas fa-file-pdf"></i> PDF Export
        </button>
        <button class="btn btn-secondary" data-action="print">
          <i class="fas fa-print"></i> Drucken
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h3 class="stat-value">${totalResponses}</h3>
          <p class="stat-label">Antworten</p>
        </div>
        <div class="stat-card">
          <h3 class="stat-value">${completedResponses}</h3>
          <p class="stat-label">Abgeschlossen</p>
        </div>
        <div class="stat-card">
          <h3 class="stat-value">${completionRate}%</h3>
          <p class="stat-label">Abschlussrate</p>
        </div>
        <div class="stat-card">
          <h3 class="stat-value">${surveyData.status === 'active' ? 'Aktiv' : 'Beendet'}</h3>
          <p class="stat-label">Status</p>
        </div>
      </div>

      <div id="questions-results">
        ${this.renderQuestionResults()}
      </div>

      <div id="individual-responses">
        ${this.renderIndividualResponses()}
      </div>
    `;

    // Sanitize and set HTML content safely with DOMPurify
    // eslint-disable-next-line no-unsanitized/property -- Content is sanitized with DOMPurify
    contentArea.innerHTML = domPurify.sanitize(htmlContent);

    // Attach event handlers
    this.attachEventHandlers();
  }

  private renderQuestionResults(): string {
    if (!this.statistics?.questions || this.statistics.questions.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">📊</div><p>Noch keine Antworten vorhanden</p></div>';
    }

    return this.statistics.questions
      .map((question) => {
        const questionText = question.questionText;
        const questionType = question.questionType;
        let resultContent = '';

        switch (questionType) {
          case 'single_choice':
          case 'multiple_choice':
          case 'yes_no':
            resultContent = this.renderChoiceResults(question);
            break;
          case 'rating':
            resultContent = this.renderRatingResults(question);
            break;
          case 'text':
            resultContent = this.renderTextResults(question);
            break;
          case 'number':
            resultContent = this.renderNumberResults(question);
            break;
          case 'date':
            resultContent = '<p>Datums-Auswertung wird noch implementiert</p>';
            break;
          default:
            resultContent = '<p>Unbekannter Fragetyp</p>';
        }

        return `
          <div class="question-card">
            <div class="question-header">
              <h3 class="question-text">${escapeHtml(questionText)}</h3>
              <p class="question-type">Typ: ${this.getQuestionTypeLabel(questionType)}</p>
            </div>
            <div class="question-body">
              ${resultContent}
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderChoiceResults(question: SurveyQuestion): string {
    if (!question.options || question.options.length === 0) {
      return '<p>Keine Optionen verfügbar</p>';
    }

    const totalResponses = question.options.reduce((sum, opt) => sum + (opt.count ?? 0), 0);

    return question.options
      .map((option) => {
        const count = option.count ?? 0;
        const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;

        return `
          <div class="option-result">
            <div class="option-header">
              <span class="option-text">${escapeHtml(option.option_text)}</span>
              <span class="option-count">${count} Stimmen</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%">
                <span class="progress-percentage">${percentage}%</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderRatingResults(question: SurveyQuestion): string {
    const stats = question.statistics ?? {};
    const average = stats.average ?? 0;
    const maxRating = 5;
    const count = stats.count ?? 0;

    return `
      <div class="u-text-center">
        <h4 style="font-size: 3rem; color: var(--primary-color); margin: 0;">
          ${average.toFixed(1)}
        </h4>
        <p style="color: var(--text-secondary);">von ${maxRating} Sternen (${count} Bewertungen)</p>
        <div style="font-size: 2rem; color: #ffc107; margin: 20px 0;">
          ${this.renderStars(average, maxRating)}
        </div>
        <div style="margin-top: 20px; font-size: 0.9rem; color: var(--text-secondary);">
          Min: ${stats.min ?? 0} | Max: ${stats.max ?? 0}
        </div>
      </div>
    `;
  }

  private renderTextResults(question: SurveyQuestion): string {
    // For text questions, don't show individual responses here
    // They are already shown in the "Individual Responses" section below
    const responseCount = question.responses?.filter((r) => r.answerText.trim() !== '').length ?? 0;

    return `
      <div class="text-info">
        <p style="color: var(--text-secondary); font-style: italic;">
          <i class="fas fa-info-circle"></i>
          ${
            responseCount > 0
              ? `${responseCount} Textantwort${responseCount > 1 ? 'en' : ''} - siehe unten bei "Individuelle Antworten"`
              : 'Keine Textantworten vorhanden'
          }
        </p>
      </div>
    `;
  }

  private renderNumberResults(question: SurveyQuestion): string {
    const stats = question.statistics ?? {};
    const average = stats.average ?? 0;
    const count = stats.count ?? 0;

    return `
      <div class="u-text-center">
        <h4 style="font-size: 2rem; color: var(--primary-color); margin: 0;">
          ${average.toFixed(2)}
        </h4>
        <p style="color: var(--text-secondary);">Durchschnittswert (${count} Antworten)</p>
        <div style="margin-top: 20px; font-size: 0.9rem; color: var(--text-secondary);">
          <strong>Min:</strong> ${stats.min ?? 0} | <strong>Max:</strong> ${stats.max ?? 0}
        </div>
      </div>
    `;
  }

  private renderIndividualResponses(): string {
    if (!this.responsesData?.responses || this.responsesData.responses.length === 0) {
      console.info('[Survey Results] No individual responses to display');
      return '';
    }

    const isAnonymous = this.isAnonymousSurvey();
    console.info('[Survey Results] Survey is anonymous:', isAnonymous);
    console.info('[Survey Results] Total responses:', this.responsesData.responses.length);

    let html = `
      <div class="glass-card responses-section">
        <h3><i class="fas fa-users"></i> Individuelle Antworten (${this.responsesData.responses.length})</h3>
        <div class="responses-list">
    `;

    this.responsesData.responses.forEach((response, index) => {
      console.info(`[Survey Results] Processing response ${index + 1}:`, response);

      // Show user name only if not anonymous and we have user data
      const respondentName = isAnonymous
        ? `Anonym #${index + 1}`
        : (() => {
            const fullName = `${response.first_name ?? ''} ${response.last_name ?? ''}`.trim();
            if (fullName !== '') return fullName;
            if (response.username !== undefined && response.username !== '') return response.username;
            return `Teilnehmer #${index + 1}`;
          })();

      const completedDate = (() => {
        const dateValue = response.completed_at ?? response.completedAt;
        if (dateValue !== undefined && dateValue !== '') {
          return this.formatDate(dateValue);
        }
        return 'In Bearbeitung';
      })();

      html += `
        <div class="response-card">
          <div class="response-header">
            <h4>${escapeHtml(respondentName)}</h4>
            <span class="response-meta">
              <i class="fas fa-clock"></i> ${completedDate}
              ${
                response.status === 'completed'
                  ? '<span class="status-badge completed">Abgeschlossen</span>'
                  : '<span class="status-badge pending">In Bearbeitung</span>'
              }
            </span>
          </div>
          <div class="response-answers">
      `;

      // Display answers for each question
      if (this.surveyData?.questions && response.answers) {
        this.surveyData.questions.forEach((question) => {
          const answer = response.answers?.find((a) => a.question_id === question.id || a.questionId === question.id);

          const questionText = question.questionText;
          const answerText = answer
            ? (answer.answer_text ??
              answer.answerText ??
              answer.answer_number ??
              answer.answerNumber ??
              'Keine Antwort')
            : 'Keine Antwort';

          html += `
            <div class="answer-item">
              <strong>${escapeHtml(questionText)}:</strong>
              <span>${escapeHtml(String(answerText))}</span>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  private attachEventHandlers(): void {
    // Excel export
    const exportExcelBtn = document.querySelector('#export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => void this.exportToExcel());
    }

    // PDF export
    const exportPdfBtn = document.querySelector('#export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        this.exportToPDF();
      });
    }

    // Event delegation for dynamic buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle print button
      const printBtn = target.closest<HTMLElement>('[data-action="print"]');
      if (printBtn) {
        window.print();
      }

      // Handle navigate back button
      const navigateBtn = target.closest<HTMLElement>('[data-action="navigate-back"]');
      if (navigateBtn) {
        window.location.href = '/survey-admin';
      }
    });
  }

  private async exportToExcel(): Promise<void> {
    try {
      if (this.surveyId === null || this.surveyId === '') {
        throw new Error('Keine Umfrage-ID');
      }

      // For now, use regular fetch for blob download
      const response = await fetch(`/api/v2/surveys/${this.surveyId}/export?format=excel`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
        },
      });
      if (!response.ok) {
        throw new Error('Export fehlgeschlagen');
      }
      const blob = await response.blob();

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `umfrage_${this.surveyId}_export.xlsx`;
      document.body.append(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      showSuccessAlert('Export erfolgreich!');
    } catch (error) {
      console.error('[Survey Results] Export error:', error);
      showErrorAlert('Fehler beim Exportieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
  }

  private exportToPDF(): void {
    try {
      if (this.surveyId === null || this.surveyId === '') {
        throw new Error('Keine Umfrage-ID');
      }

      // TODO: Implement PDF export
      showAlert('PDF-Export wird implementiert...');
    } catch (error) {
      console.error('[Survey Results] PDF export error:', error);
      showErrorAlert('Fehler beim PDF-Export: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    }
  }

  private isAnonymousSurvey(): boolean {
    if (!this.surveyData) return false;
    return (
      this.surveyData.isAnonymous === '1' || this.surveyData.isAnonymous === 1 || this.surveyData.isAnonymous === true
    );
  }

  private formatDate(dateStr: string): string {
    if (dateStr === '') return 'N/A';

    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  private renderStars(rating: number, maxRating: number): string {
    let stars = '';
    for (let i = 1; i <= maxRating; i++) {
      stars += i <= rating ? '★' : '☆';
    }
    return stars;
  }

  private getQuestionTypeLabel(type: string): string {
    switch (type) {
      case 'text':
        return 'Textantwort';
      case 'single_choice':
        return 'Einzelauswahl';
      case 'multiple_choice':
        return 'Mehrfachauswahl';
      case 'rating':
        return 'Bewertung';
      case 'yes_no':
        return 'Ja/Nein';
      case 'number':
        return 'Zahl';
      case 'date':
        return 'Datum';
      default:
        return type;
    }
  }

  private showError(message: string): void {
    const contentArea = document.querySelector('#content-area');
    if (!contentArea) return;

    const errorHtml = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p>${escapeHtml(message)}</p>
        <button class="btn btn-secondary" data-action="navigate-back">
          Zurück zur Übersicht
        </button>
      </div>
    `;

    // eslint-disable-next-line no-unsanitized/property -- Content is sanitized with DOMPurify
    contentArea.innerHTML = domPurify.sanitize(errorHtml);
  }
}

// Initialize page
new SurveyResultsPage();

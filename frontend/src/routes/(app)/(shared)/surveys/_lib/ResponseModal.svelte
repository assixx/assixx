<script lang="ts">
  /**
   * ResponseModal — Displays a user's completed survey response (read-only).
   */
  import { getTextFromBuffer, formatDateTimeGerman, formatSurveyDate } from './utils';

  import type { Survey, SurveyResponse } from './types';

  interface Props {
    survey: Survey;
    response: SurveyResponse;
    onclose: () => void;
  }

  const { survey, response, onclose }: Props = $props();
</script>

<div
  id="survey-response-modal"
  class="modal-overlay modal-overlay--active"
>
  <div class="ds-modal ds-modal--lg">
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        Ihre Antworten - {getTextFromBuffer(survey.title)}
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="response-info">
        <p>
          <i class="fas fa-clock"></i>
          Abgeschlossen am: {formatDateTimeGerman(response.completedAt)}
        </p>
      </div>
      <div class="response-answers">
        {#each response.answers as answer (answer.questionId)}
          <div class="response-question">
            <h4>{answer.questionText}</h4>
            <div class="response-answer">
              {#if answer.answerText !== undefined && answer.answerText !== ''}
                <p>{answer.answerText}</p>
              {:else if answer.answerNumber !== undefined}
                {#if answer.questionType === 'rating'}
                  <p>Bewertung: {answer.answerNumber}</p>
                {:else}
                  <p>{answer.answerNumber}</p>
                {/if}
              {:else if answer.answerDate !== undefined}
                <p>
                  <i class="fas fa-calendar"></i>
                  {formatSurveyDate(answer.answerDate)}
                </p>
              {:else if answer.answerOptions !== undefined && answer.answerOptions.length > 0}
                {#each answer.answerOptions as optionText, idx (idx)}
                  <p><i class="fas fa-check-square"></i> {optionText}</p>
                {/each}
              {:else}
                <p><em>Keine Antwort</em></p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
    <div class="ds-modal__footer ds-modal__footer--right">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Schließen
      </button>
    </div>
  </div>
</div>

<style>
  .response-info {
    margin-bottom: var(--spacing-6);
    border: 1px solid color-mix(in oklch, var(--color-primary) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-primary) 10%, transparent);
    padding: var(--spacing-3);
  }

  .response-info p {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin: 0;
    color: var(--text-primary);
  }

  .response-answers {
    padding-right: var(--spacing-2);
    max-height: 400px;
    overflow-y: auto;
  }

  .response-question {
    margin-bottom: var(--spacing-6);
    border-bottom: 1px solid var(--color-glass-border);
    padding-bottom: var(--spacing-6);
  }

  .response-question:last-child {
    border-bottom: none;
  }

  .response-question h4 {
    margin-bottom: var(--spacing-4);
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .response-answer {
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    padding: var(--spacing-3);
  }

  .response-answer p {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin: 0;
    color: var(--text-secondary);
  }

  .response-answer em {
    color: var(--text-muted);
    font-style: italic;
  }

  .response-answer .fa-check-square {
    color: var(--success-color);
  }
</style>

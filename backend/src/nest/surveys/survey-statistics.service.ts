/**
 * Survey Statistics Service
 *
 * Computes analytics and statistics for survey responses.
 * Injected into the SurveysService facade.
 *
 * The facade handles survey resolution and access control
 * before delegating computation to this service.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { parseDbCount } from './surveys.helpers.js';
import type { DbSurveyQuestion, SurveyStatisticsResponse } from './surveys.types.js';

@Injectable()
export class SurveyStatisticsService {
  private readonly logger = new Logger(SurveyStatisticsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Computes full statistics for a survey.
   * Called by the facade after access control is verified.
   */
  async computeStatistics(
    surveyId: number,
    tenantId: number,
    questions: DbSurveyQuestion[],
  ): Promise<SurveyStatisticsResponse> {
    this.logger.debug(`Computing statistics for survey ${surveyId}`);

    const statsRows = await this.db.tenantQuery<{
      total_responses: number | string;
      completed_responses: number | string;
      first_response: Date | null;
      last_response: Date | null;
    }>(
      `SELECT COUNT(DISTINCT sr.id) as total_responses,
       COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_responses,
       MIN(sr.started_at) as first_response, MAX(sr.completed_at) as last_response
       FROM surveys s LEFT JOIN survey_responses sr ON s.id = sr.survey_id WHERE s.id = $1 AND s.tenant_id = $2`,
      [surveyId, tenantId],
    );

    const statsRow = statsRows[0];
    const totalResponses = parseDbCount(statsRow?.total_responses);
    const completedResponses = parseDbCount(statsRow?.completed_responses);

    const response: SurveyStatisticsResponse = {
      surveyId,
      totalResponses,
      completedResponses,
      completionRate:
        totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0,
      questions: await this.buildQuestionStats(questions),
    };
    if (statsRow?.first_response !== null && statsRow?.first_response !== undefined) {
      response.firstResponse = statsRow.first_response;
    }
    if (statsRow?.last_response !== null && statsRow?.last_response !== undefined) {
      response.lastResponse = statsRow.last_response;
    }
    return response;
  }

  // ==========================================================================
  // PRIVATE: PER-QUESTION STATS
  // ==========================================================================

  /** Builds statistics for all questions in a survey */
  private async buildQuestionStats(
    questions: DbSurveyQuestion[],
  ): Promise<SurveyStatisticsResponse['questions']> {
    const stats: SurveyStatisticsResponse['questions'] = [];
    for (const question of questions) {
      const stat = await this.buildSingleQuestionStat(question);
      stats.push(stat);
    }
    return stats;
  }

  /** Builds statistics for a single question based on its type */
  private async buildSingleQuestionStat(
    question: DbSurveyQuestion,
  ): Promise<SurveyStatisticsResponse['questions'][number]> {
    const stat: SurveyStatisticsResponse['questions'][number] = {
      id: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
    };
    const qType = question.question_type as string;
    if (qType === 'single_choice' || qType === 'multiple_choice' || qType === 'yes_no') {
      stat.options = await this.getChoiceQuestionStats(question);
    } else if (qType === 'text') {
      stat.responses = await this.getTextQuestionResponses(question.id);
    } else if (qType === 'rating' || qType === 'number') {
      stat.statistics = await this.getRatingQuestionStats(question.id);
    } else if (qType === 'date') {
      stat.options = await this.getDateQuestionStats(question.id);
    }
    return stat;
  }

  /** Gets choice-type question stats (option counts) */
  private async getChoiceQuestionStats(
    question: DbSurveyQuestion,
  ): Promise<{ optionId: number; optionText: string; count: number }[]> {
    let options: { id: number; option_text: string }[];
    if ((question.question_type as string) === 'yes_no') {
      options = [
        { id: 1, option_text: 'Ja' },
        { id: 2, option_text: 'Nein' },
      ];
    } else {
      options = question.options ?? [];
    }
    const answerRows = await this.db.tenantQuery<{
      answer_options: string | number[];
    }>(
      `SELECT sa.answer_options FROM survey_answers sa WHERE sa.question_id = $1 AND sa.answer_options IS NOT NULL`,
      [question.id],
    );
    const optionCounts = new Map<number, number>();
    for (const answer of answerRows) {
      const selectedOptions =
        typeof answer.answer_options === 'string' ?
          (JSON.parse(answer.answer_options) as number[])
        : answer.answer_options;
      if (Array.isArray(selectedOptions)) {
        for (const optionId of selectedOptions) {
          optionCounts.set(optionId, (optionCounts.get(optionId) ?? 0) + 1);
        }
      }
    }
    return options.map((option: { id: number; option_text: string }) => ({
      optionId: option.id,
      optionText: option.option_text,
      count: optionCounts.get(option.id) ?? 0,
    }));
  }

  /** Gets text question responses with user info */
  private async getTextQuestionResponses(questionId: number): Promise<
    {
      answerText?: string;
      userId?: number | null;
      firstName?: string | null;
      lastName?: string | null;
    }[]
  > {
    const rows = await this.db.tenantQuery<{
      answer_text: string | null;
      user_id: number | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT sa.answer_text, sr.user_id, u.first_name, u.last_name
       FROM survey_answers sa JOIN survey_responses sr ON sa.response_id = sr.id
       LEFT JOIN users u ON sr.user_id = u.id WHERE sa.question_id = $1 AND sa.answer_text IS NOT NULL`,
      [questionId],
    );
    return rows.map(
      (row: {
        answer_text: string | null;
        user_id: number | null;
        first_name: string | null;
        last_name: string | null;
      }) => ({
        answerText: row.answer_text ?? '',
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
      }),
    );
  }

  /** Gets rating/number question statistics (avg, min, max) */
  private async getRatingQuestionStats(questionId: number): Promise<{
    average: number | null;
    min: number | null;
    max: number | null;
    totalResponses: number;
  }> {
    const statsRows = await this.db.tenantQuery<{
      average: number | null;
      min: number | null;
      max: number | null;
      total_responses: number | string;
    }>(
      `SELECT AVG(sa.answer_number) as average, MIN(sa.answer_number) as min, MAX(sa.answer_number) as max,
       COUNT(sa.answer_number) as total_responses FROM survey_answers sa
       WHERE sa.question_id = $1 AND sa.answer_number IS NOT NULL`,
      [questionId],
    );
    const stats = statsRows[0];
    return {
      average: stats?.average ?? null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
      totalResponses:
        typeof stats?.total_responses === 'string' ?
          Number.parseInt(stats.total_responses, 10)
        : (stats?.total_responses ?? 0),
    };
  }

  /** Gets date question statistics (grouped counts per date) */
  private async getDateQuestionStats(
    questionId: number,
  ): Promise<{ optionId: number; optionText: string; count: number }[]> {
    const dateRows = await this.db.tenantQuery<{
      answer_date: Date | string;
      count: number | string;
    }>(
      `SELECT sa.answer_date, COUNT(*) as count FROM survey_answers sa
       WHERE sa.question_id = $1 AND sa.answer_date IS NOT NULL
       GROUP BY sa.answer_date ORDER BY count DESC, sa.answer_date DESC`,
      [questionId],
    );
    return dateRows.map(
      (row: { answer_date: Date | string; count: number | string }, index: number) => {
        const dateText =
          row.answer_date instanceof Date ?
            row.answer_date.toISOString().split('T')[0]
          : row.answer_date.split('T')[0];
        return {
          optionId: index + 1,
          optionText: dateText ?? '',
          count: typeof row.count === 'string' ? Number.parseInt(row.count, 10) : row.count,
        };
      },
    );
  }
}

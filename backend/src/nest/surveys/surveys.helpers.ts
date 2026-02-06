/**
 * Survey Helpers
 *
 * Pure functions for survey data transformation.
 * No DI, no DB calls, no side effects.
 */
import { dbToApi } from '../../utils/fieldMapper.js';
import type {
  AssignmentDbPayload,
  AssignmentInput,
  DbSurvey,
  NormalizedAnswer,
  QuestionDbPayload,
  QuestionInput,
  SurveyAnswer,
} from './surveys.types.js';

/** Builds a question payload for DB insertion from camelCase input */
export function buildQuestionData(
  q: QuestionInput,
  index: number,
): QuestionDbPayload {
  const question: QuestionDbPayload = {
    question_text: q.questionText,
    question_type: q.questionType,
    is_required: q.isRequired !== 0 && q.isRequired !== false,
    order_position: q.orderPosition ?? index + 1,
  };
  if (q.options !== undefined) {
    question.options = q.options.map((opt: string | { optionText: string }) =>
      typeof opt === 'string' ? opt : opt.optionText,
    );
  }
  return question;
}

/** Builds an assignment payload for DB insertion from camelCase input */
export function buildAssignmentData(a: AssignmentInput): AssignmentDbPayload {
  return {
    type: a.type,
    area_id: a.areaId ?? null,
    department_id: a.departmentId ?? null,
    team_id: a.teamId ?? null,
    user_id: a.userId ?? null,
  };
}

/** Normalizes answers from mixed camelCase/snake_case input to snake_case */
export function normalizeAnswers(answers: SurveyAnswer[]): NormalizedAnswer[] {
  return answers.map((answer: SurveyAnswer) => ({
    question_id: answer.questionId ?? answer.question_id,
    answer_text: answer.answerText ?? answer.answer_text,
    answer_number: answer.answerNumber ?? answer.answer_number,
    answer_date: answer.answerDate ?? answer.answer_date,
    answer_options: answer.answerOptions ?? answer.answer_options,
  }));
}

/** Transforms a DB survey row to camelCase API response, including nested questions and assignments */
export function transformSurveyToApi(
  survey: Record<string, unknown>,
): Record<string, unknown> {
  const apiSurvey = dbToApi(survey);
  const questions = survey['questions'];
  if (
    questions !== undefined &&
    questions !== null &&
    Array.isArray(questions)
  ) {
    apiSurvey['questions'] = (questions as Record<string, unknown>[]).map(
      (q: Record<string, unknown>) => {
        const transformedQuestion = dbToApi(q);
        const options = q['options'];
        if (
          options !== null &&
          options !== undefined &&
          Array.isArray(options)
        ) {
          transformedQuestion['options'] = (options as unknown[]).map(
            (opt: unknown) => {
              if (typeof opt === 'string') return opt;
              if (typeof opt === 'object' && opt !== null) {
                return dbToApi(opt as Record<string, unknown>);
              }
              return opt;
            },
          );
        }
        return {
          ...transformedQuestion,
          orderPosition: q['order_position'] ?? q['order_index'],
        };
      },
    );
  }
  const assignments = survey['assignments'];
  if (
    assignments !== undefined &&
    assignments !== null &&
    Array.isArray(assignments)
  ) {
    apiSurvey['assignments'] = (assignments as Record<string, unknown>[]).map(
      (a: Record<string, unknown>) => dbToApi(a),
    );
  }
  return apiSurvey;
}

/** Transforms a DB survey with aggregated metadata (counts, creator name) to API format */
export function transformSurveyWithMetadata(
  survey: DbSurvey,
): Record<string, unknown> {
  const transformed = transformSurveyToApi(
    survey as unknown as Record<string, unknown>,
  );
  return {
    ...transformed,
    responseCount:
      typeof survey.response_count === 'string' ?
        Number.parseInt(survey.response_count, 10)
      : (survey.response_count ?? 0),
    completedCount:
      typeof survey.completed_count === 'string' ?
        Number.parseInt(survey.completed_count, 10)
      : (survey.completed_count ?? 0),
    creatorFirstName: survey.creator_first_name,
    creatorLastName: survey.creator_last_name,
  };
}

/** Parses count value from DB (handles string or number) */
export function parseDbCount(value: number | string | undefined): number {
  if (typeof value === 'string') return Number.parseInt(value, 10);
  return value ?? 0;
}

import type { DiscoveryQuestion } from "../contracts.ts";

export interface DiscoveryAnswer {
  questionId: string;
  answer: string;
}

export type AskDiscoveryQuestions = (
  applicationName: string,
  questions: DiscoveryQuestion[],
) => Promise<DiscoveryAnswer[] | null>;

import { Injectable } from '@nestjs/common';

export type QuestionResponsePolicyDecision =
  { action: 'ALLOW' } | { action: 'DO_NOT_REPLY'; reason: 'ABUSIVE_CONTENT' };

const SEVERE_ABUSE_PATTERNS = [
  /\borospu(?:nun)?\s+(?:cocugu|evladi)\b/,
  /\b(?:anani|anneni|avradini|bacini)\s+(?:sikeyim|sikerim|sikiyim)\b/,
  /\bamina\s+(?:koyayim|koyim|koyiyim|koyarim)\b/,
  /\b(?:sikeyim|sikerim|sikiyim|sikecegim|sikicem)\b/,
  /\bsiktir(?:\s+git)?\b/,
  /\b(?:orospu|pic|pezevenk|gavat|kahpe|ibne|serefsiz|haysiyetsiz|yarrak|sikik|amk)\b/,
  /\b(?:motherfucker|fuck\s+you|son\s+of\s+a\s+bitch)\b/,
] as const;

const DIRECT_TARGET_PATTERN =
  '(?:sen|siz|sizin|defacto|magaza|marka|satici|calisan|musteri hizmetleri)';
const DIRECT_INSULT_PATTERN =
  '(?:orospu|pic|pezevenk|gavat|kahpe|ibne|serefsiz|haysiyetsiz|gerizekali|aptal|salak)';
const TARGETED_ABUSE_PATTERNS = [
  new RegExp(
    `\\b${DIRECT_TARGET_PATTERN}\\b.{0,40}\\b${DIRECT_INSULT_PATTERN}(?:dir|siniz|sin)?\\b`,
  ),
  new RegExp(
    `\\b${DIRECT_INSULT_PATTERN}(?:dir|siniz|sin)?\\b.{0,40}\\b${DIRECT_TARGET_PATTERN}\\b`,
  ),
] as const;

@Injectable()
export class QuestionResponsePolicyService {
  evaluate(question: string): QuestionResponsePolicyDecision {
    return evaluateQuestionResponsePolicy(question);
  }
}

export function evaluateQuestionResponsePolicy(
  question: string,
): QuestionResponsePolicyDecision {
  const normalized = normalizePolicyText(question);
  const containsSevereAbuse = SEVERE_ABUSE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
  const containsTargetedAbuse = TARGETED_ABUSE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  return containsSevereAbuse || containsTargetedAbuse
    ? { action: 'DO_NOT_REPLY', reason: 'ABUSIVE_CONTENT' }
    : { action: 'ALLOW' };
}

function normalizePolicyText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

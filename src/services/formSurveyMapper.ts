import type {FormItem} from '../types/project';
import type {SurveyDefinition, SurveyQuestion} from '../types/session';
import {isVoiceWidget, isGenericQuestionLabel} from '../utils/formWidgetUtils';

export function formItemToSurveyDefinition(form: FormItem): SurveyDefinition {
  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];

  for (const section of form.structure.sections) {
    for (const widget of section.widgets) {
      const id = widget.id;
      if (!id || seen.has(id)) continue;
      const main =
        (widget.text && widget.text.trim()) ||
        (widget.label && widget.label.trim());
      if (!main) continue;

      seen.add(id);
      questions.push({
        questionId: id,
        mainQuestion: main,
        targetOutcome: widget.hint,
        // Do not use probe_bank from backend; follow-ups are generated purely from answers.
        probeBank: [],
      });
    }
  }

  return {
    id: form.id,
    name: form.title,
    // Backend forms are currently single-language; default to English.
    language: 'en',
    questions,
  };
}

/** Survey with only voice/open_ended widgets for use in Interview when opened from FormFill. */
export function formItemToVoiceSurveyDefinition(form: FormItem): SurveyDefinition {
  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];

  for (const section of form.structure.sections) {
    for (const widget of section.widgets) {
      if (!isVoiceWidget(widget)) continue;
      const id = widget.id;
      if (!id || seen.has(id)) continue;
      const hasCustomText =
        widget.text != null &&
        widget.text.trim() !== '' &&
        !isGenericQuestionLabel(widget.text);
      const hasCustomLabel = !isGenericQuestionLabel(widget.label || '');
      const mainQuestion =
        hasCustomText
          ? widget.text!.trim()
          : section.title?.trim()
            ? section.title.trim()
            : hasCustomLabel
              ? (widget.label || '').trim()
              : 'Question';
      if (!mainQuestion) continue;
      seen.add(id);
      questions.push({
        questionId: id,
        mainQuestion,
        targetOutcome: widget.hint,
        probeBank: [],
      });
    }
  }

  return {
    id: form.id,
    name: form.title,
    language: 'en',
    questions,
  };
}


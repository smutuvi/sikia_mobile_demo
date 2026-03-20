import type {FormItem, InterviewConfig, WidgetInterviewConfig} from '../types/project';
import type {SurveyDefinition, SurveyQuestion} from '../types/session';
import {isVoiceWidget, isGenericQuestionLabel} from '../utils/formWidgetUtils';

export function formItemToSurveyDefinition(form: FormItem): SurveyDefinition {
  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];
  const cfg: InterviewConfig | undefined = (form as any).interview_config;

  for (const section of form.structure.sections) {
    for (const widget of section.widgets) {
      const id = widget.id;
      if (!id || seen.has(id)) continue;
      const main =
        (widget.text && widget.text.trim()) ||
        (widget.label && widget.label.trim());
      if (!main) continue;

      seen.add(id);
      const wcfg: WidgetInterviewConfig | undefined = cfg?.widget_configs?.[id];
      questions.push({
        questionId: id,
        mainQuestion: main,
        targetOutcome: widget.hint,
        // Do not use probe_bank from backend; follow-ups are generated purely from answers.
        probeBank: [],
        maxFollowUps: wcfg?.max_follow_ups ?? undefined,
        allowExtendedCapture: wcfg?.allow_extended_capture ?? undefined,
        dynamicPromptGoal: wcfg?.dynamic_prompt_goal ?? undefined,
        dynamicPromptInstructions: wcfg?.dynamic_prompt_instructions ?? undefined,
        conversationTone: wcfg?.conversation_tone ?? undefined,
        aiNotes: wcfg?.ai_notes ?? undefined,
        autoFillSource: wcfg?.auto_fill_source ?? undefined,
        autoFillInstructions: wcfg?.auto_fill_instructions ?? undefined,
      });
    }
  }

  return {
    id: form.id,
    name: form.title,
    // Backend forms are currently single-language; default to English.
    language: cfg?.language || 'en',
    globalInstructions: cfg?.global_instructions || undefined,
    languageInstructions: cfg?.language_instructions || undefined,
    questions,
  };
}

/** Survey with only voice/open_ended widgets for use in Interview when opened from FormFill. */
export function formItemToVoiceSurveyDefinition(form: FormItem): SurveyDefinition {
  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];
  const cfg: InterviewConfig | undefined = (form as any).interview_config;

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
      const wcfg: WidgetInterviewConfig | undefined = cfg?.widget_configs?.[id];
      questions.push({
        questionId: id,
        mainQuestion,
        targetOutcome: widget.hint,
        probeBank: [],
        maxFollowUps: wcfg?.max_follow_ups ?? undefined,
        allowExtendedCapture: wcfg?.allow_extended_capture ?? undefined,
        dynamicPromptGoal: wcfg?.dynamic_prompt_goal ?? undefined,
        dynamicPromptInstructions: wcfg?.dynamic_prompt_instructions ?? undefined,
        conversationTone: wcfg?.conversation_tone ?? undefined,
        aiNotes: wcfg?.ai_notes ?? undefined,
        autoFillSource: wcfg?.auto_fill_source ?? undefined,
        autoFillInstructions: wcfg?.auto_fill_instructions ?? undefined,
      });
    }
  }

  return {
    id: form.id,
    name: form.title,
    language: cfg?.language || 'en',
    globalInstructions: cfg?.global_instructions || undefined,
    languageInstructions: cfg?.language_instructions || undefined,
    questions,
  };
}


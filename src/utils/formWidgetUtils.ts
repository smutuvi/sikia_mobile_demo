import type {FormItem, FormSection, FormWidget} from '../types/project';

/** Whether the widget label/text is generic and should be replaced by section title. */
export function isGenericQuestionLabel(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t === '' ||
    t === 'voice recording' ||
    t === 'written response' ||
    t === 'record your response here...'
  );
}

/** True when widget type is voice/audio/open_ended/conversation. */
export function isVoiceWidget(w: FormWidget): boolean {
  const t = (w.type || '').toLowerCase();
  return (
    t === 'audio' ||
    t === 'voice' ||
    t === 'open_ended' ||
    t === 'conversation'
  );
}

/** In [section], the Written Response widget for [voiceWidget]: first text/string after voice, or generic "Written Response". */
export function getWrittenResponseWidgetInSection(
  section: FormSection,
  voiceWidget: FormWidget,
): FormWidget | null {
  const list = section.widgets;
  let found = false;
  for (const w of list) {
    if (w.id === voiceWidget.id) {
      found = true;
      continue;
    }
    if (found) {
      const t = (w.type || '').toLowerCase();
      if (t === 'text' || t === 'string') return w;
    }
  }
  for (const w of list) {
    const t = (w.type || '').toLowerCase();
    if ((t === 'text' || t === 'string') && isGenericQuestionLabel(w.label || ''))
      return w;
  }
  return null;
}

/** Target field id for storing transcript for a voice widget (written response in same section, or voice id). */
export function getTargetFieldIdForVoiceWidget(
  form: FormItem,
  voiceWidgetId: string,
): string {
  for (const section of form.structure.sections) {
    const voiceW = section.widgets.find(w => w.id === voiceWidgetId);
    if (voiceW) {
      const written = getWrittenResponseWidgetInSection(section, voiceW);
      return written?.id ?? voiceWidgetId;
    }
  }
  return voiceWidgetId;
}

import type { ConversionJobState, ConversionState } from './components.types'

const STATE_MESSAGES: Record<ConversionJobState, string> = {
  loading_source: 'Resolving Fusion design source…',
  ready_to_convert: 'Select an output format and click Convert.',
  submitting: 'Submitting translation job…',
  polling: 'Checking translation status…',
  success: 'Conversion completed.',
  error: 'Conversion failed.'
}

export function toConversionState(state: ConversionJobState, overrideMessage?: string): ConversionState {
  return {
    state,
    message: overrideMessage && overrideMessage.trim() ? overrideMessage.trim() : STATE_MESSAGES[state]
  }
}

import {
  stepCountIs,
  ToolLoopAgent,
  type LanguageModel,
  type StreamTextResult,
  type ToolLoopAgentSettings,
} from 'ai'
import type { NetraKnowledge, NetraTurnInput } from '@/lib/netra/contracts'
import { resolveNetraPageContext } from '@/lib/netra/page-context'
import { createNetraSystemPrompt } from '@/lib/netra/prompts/system'
import { createNetraTools, type NetraTools } from '@/lib/netra/tools'

export const NETRA_MAX_CONTEXT_MESSAGES = 10
export const NETRA_MAX_MODEL_STEPS = 3
export const NETRA_MAX_OUTPUT_TOKENS = 600

export type NetraTurnDependencies = {
  model: LanguageModel
  knowledge: NetraKnowledge
  providerOptions?: ToolLoopAgentSettings<never, NetraTools>['providerOptions']
  onFinish?: () => void | PromiseLike<void>
}

export type NetraTurnResult = StreamTextResult<NetraTools, never>

/**
 * Runs one bounded NETRA turn without knowing the HTTP framework, provider,
 * session store, or knowledge implementation.
 */
export async function runNetraTurn(
  input: NetraTurnInput,
  dependencies: NetraTurnDependencies,
): Promise<NetraTurnResult> {
  const page = resolveNetraPageContext(input.page.pathname, input.servedLang)
  const tools = createNetraTools(dependencies.knowledge, page)
  const agent = new ToolLoopAgent({
    model: dependencies.model,
    instructions: createNetraSystemPrompt(input.servedLang, page),
    tools,
    stopWhen: stepCountIs(NETRA_MAX_MODEL_STEPS),
    maxOutputTokens: NETRA_MAX_OUTPUT_TOKENS,
    ...(dependencies.providerOptions
      ? { providerOptions: dependencies.providerOptions }
      : {}),
    ...(dependencies.onFinish
      ? { onFinish: async () => dependencies.onFinish?.() }
      : {}),
  })

  return agent.stream({
    messages: input.messages.slice(-NETRA_MAX_CONTEXT_MESSAGES),
    abortSignal: input.abortSignal,
  })
}

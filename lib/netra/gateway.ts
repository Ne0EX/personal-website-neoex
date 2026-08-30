import { gateway } from 'ai'

export const NETRA_FREE_GATEWAY_MODELS = [
  'minimax/minimax-m3-free',
  'minimax/minimax-m2.7-free',
] as const

export type NetraFreeGatewayModel =
  (typeof NETRA_FREE_GATEWAY_MODELS)[number]

export const NETRA_DEFAULT_FREE_GATEWAY_MODEL: NetraFreeGatewayModel =
  'minimax/minimax-m3-free'

function isNetraFreeGatewayModel(
  value: string,
): value is NetraFreeGatewayModel {
  return NETRA_FREE_GATEWAY_MODELS.some((model) => model === value)
}

export function createNetraGatewayRuntime(input: {
  configuredModel: string | undefined
  sessionId: string
}) {
  // NETRA_MODEL is a deployment-policy guard, not a primary-model selector.
  // Either vetted free ID is accepted for backwards-compatible envs, but the
  // runtime order is always M3 primary → M2.7 fallback.
  if (
    input.configuredModel !== undefined
    && !isNetraFreeGatewayModel(input.configuredModel)
  ) return null

  const modelId = NETRA_DEFAULT_FREE_GATEWAY_MODEL
  const fallbackModels = NETRA_FREE_GATEWAY_MODELS.slice(1)

  return {
    modelId,
    model: gateway(modelId),
    providerOptions: {
      gateway: {
        models: fallbackModels,
        user: input.sessionId,
        tags: ['feature:netra', 'tier:free-only'],
      },
    },
  }
}

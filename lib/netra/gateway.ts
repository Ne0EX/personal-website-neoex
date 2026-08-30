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
  const modelId = input.configuredModel ?? NETRA_DEFAULT_FREE_GATEWAY_MODEL
  if (!isNetraFreeGatewayModel(modelId)) return null

  const fallbackModels = NETRA_FREE_GATEWAY_MODELS.filter(
    (candidate) => candidate !== modelId,
  )

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

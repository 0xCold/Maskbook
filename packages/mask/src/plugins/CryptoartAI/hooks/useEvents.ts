import { useAsyncRetry } from 'react-use'
import { NetworkPluginID, useChainId } from '@masknet/plugin-infra'
import type { Token } from '../types'
import { toTokenIdentifier } from '../utils'
import { getEvents } from '../apis'

export function useEvents(token?: Token) {
    const chainId = useChainId(NetworkPluginID.PLUGIN_EVM)
    return useAsyncRetry(async () => {
        if (!token) {
            return {
                data: [],
            }
        }

        const assetEvents = await getEvents(token.tokenId, chainId)

        return {
            data: assetEvents.map((event: any) => {
                return {
                    avatorPath: event.avatorPath,
                    award: event.award,
                    createTime: event.createTime,
                    operatorAddress: event.operatorAddress,
                    operatorName: event.operatorName,
                    operatorNikeName: event.operatorNikeName,
                    priceInEth: event.priceInEth,
                    priceInUsd: event.priceInUsd,
                    transactionType: event.transactionType,
                    transactionTypeName: event.transactionTypeName,
                    transactionUrl: event.transactionUrl,
                }
            }),
        }
    }, [chainId, toTokenIdentifier(token)])
}

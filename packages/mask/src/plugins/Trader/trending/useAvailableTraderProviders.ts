import { useAsync } from 'react-use'
import type { ChainId } from '@masknet/web3-shared-evm'
import { NetworkPluginID, useChainId } from '@masknet/plugin-infra'
import type { TradeProvider } from '@masknet/public-api'
import type { AsyncState } from 'react-use/lib/useAsyncFn'
import { PluginTraderRPC } from '../messages'
import type { TagType } from '../types'

export function useAvailableTraderProviders(
    type?: TagType,
    keyword?: string,
    targetChainId?: ChainId,
): AsyncState<TradeProvider[]> {
    const currentChainId = useChainId(NetworkPluginID.PLUGIN_EVM)
    const chainId = targetChainId ?? currentChainId
    return useAsync(async () => {
        return PluginTraderRPC.getAvailableTraderProviders(chainId)
    }, [chainId, type, keyword])
}

import type { FC } from 'react'
import { isEIP1559Supported } from '@masknet/web3-shared-evm'
import { NetworkPluginID, useChainId } from '@masknet/plugin-infra'
import { GasSetting1559 } from './GasSetting1559'
import { Prior1559GasSetting } from './Prior1559GasSetting'
import type { GasSettingProps } from './types'

export const GasSetting: FC<GasSettingProps> = (props) => {
    const chainId = useChainId(NetworkPluginID.PLUGIN_EVM)
    const is1559Supported = isEIP1559Supported(chainId)
    return is1559Supported ? <GasSetting1559 {...props} /> : <Prior1559GasSetting {...props} />
}

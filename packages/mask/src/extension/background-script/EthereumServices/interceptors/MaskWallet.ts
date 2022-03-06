import { toBuffer } from 'ethereumjs-util'
import { signTypedData, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { ChainId, EthereumMethodType } from '@masknet/web3-shared-evm'
import type { Context, Middleware } from '../types'
import { WalletRPC } from '../../../../plugins/Wallet/messages'
import { MaskWalletProvider } from '../providers/MaskWallet'
import { hasNativeAPI, nativeAPI } from '../../../../../shared/native-rpc'
import { sendRawTransaction } from '../network'

export class MaskWallet implements Middleware<Context> {
    private provider = new MaskWalletProvider()

    private async getPrivateKey(address: string) {
        const key = await WalletRPC.exportPrivateKey(address)
        if (!key) throw new Error('Not a valid account.')
        return key
    }

    private async createWeb3(chainId: ChainId, key: string) {
        return this.provider.createWeb3({
            options: {
                chainId,
            },
            keys: [key],
        })
    }

    async fn(context: Context, next: () => Promise<void>) {
        // redirect to native app
        if (hasNativeAPI && nativeAPI) {
            try {
                const response =
                    nativeAPI.type === 'Android'
                        ? JSON.parse(await nativeAPI.api.sendJsonString(JSON.stringify(context.request)))
                        : await nativeAPI.api.send(context.request)

                context.end(new Error(response.error), response.result)
            } catch (error) {
                context.abort(error, 'Failed to send request.')
            } finally {
                await next()
            }
            return
        }

        switch (context.request.method) {
            case EthereumMethodType.ETH_SEND_TRANSACTION:
                const config = context.config

                if (!config?.from || !config?.to) {
                    context.abort(new Error('Invalid JSON payload.'))
                    break
                }

                try {
                    const key = await this.getPrivateKey(config.from as string)
                    const web3 = await this.createWeb3(context.chainId, key)
                    const signed = await web3.eth.accounts.signTransaction(config, key)

                    if (!signed.rawTransaction) {
                        context.abort(new Error('Failed to sign transaction.'))
                        break
                    }

                    context.write(
                        await sendRawTransaction(signed.rawTransaction, context.sendOverrides, context.requestOptions),
                    )
                } catch (error) {
                    context.abort(error, 'Failed to send transaction.')
                }
                break
            case EthereumMethodType.PERSONAL_SIGN:
                try {
                    const [data, address] = context.request.params as [string, string]
                    const key = await this.getPrivateKey(address)
                    const web3 = await this.createWeb3(context.chainId, key)
                    context.write(await web3.eth.sign(data, address))
                } catch (error) {
                    context.abort(error, 'Failed to sign data.')
                }
                break
            case EthereumMethodType.ETH_SIGN_TYPED_DATA:
                try {
                    const [address, data] = context.request.params as [string, string]
                    context.write(
                        signTypedData({
                            privateKey: toBuffer('0x' + (await this.getPrivateKey(address))),
                            data: JSON.parse(data),
                            version: SignTypedDataVersion.V4,
                        }),
                    )
                } catch (error) {
                    context.abort(error, 'Failed to sign typed data.')
                }
                break
            default:
                break
        }
        await next()
    }
}

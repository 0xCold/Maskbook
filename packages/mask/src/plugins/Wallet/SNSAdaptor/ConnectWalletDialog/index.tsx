import { useCallback, useState } from 'react'
import { useAsyncRetry } from 'react-use'
import { Box, DialogContent, Link, Typography } from '@mui/material'
import { makeStyles, useStylesExtends } from '@masknet/theme'
import { safeUnreachable } from '@dimensiondev/kit'
import {
    ChainId,
    getChainDetailedCAIP,
    getChainIdFromNetworkType,
    NetworkType,
    ProviderType,
    resolveNetworkName,
    resolveProviderDownloadLink,
    resolveProviderHostName,
    resolveProviderName,
} from '@masknet/web3-shared-evm'
import { delay } from '@masknet/shared-base'
import { InjectedDialog } from '../../../../components/shared/InjectedDialog'
import { WalletMessages, WalletRPC } from '../../messages'
import { ConnectionProgress } from './ConnectionProgress'
import Services from '../../../../extension/service'
import { useInjectedProviderType } from '../../../EVM/hooks'
import { useRemoteControlledDialog } from '@masknet/shared'
import { useI18N } from '../../../../utils'
import { CramIcon } from '@masknet/icons'

const useStyles = makeStyles()((theme) => ({
    content: {
        padding: theme.spacing(5),
    },
    message: {
        marginTop: theme.spacing(2),
        borderRadius: theme.spacing(1),
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing(3),
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 95, 95, 0.1)' : 'rgba(255, 95, 95, 0.1)',
        fontSize: 12,
        color: 'rgba(255, 95, 95, 1)',
        '&>:first-child': {
            marginRight: theme.spacing(1),
        },
    },
    link: {
        color: 'rgba(255, 95, 95, 1)',
        textDecoration: 'underline',
    },
}))

export interface ConnectWalletDialogProps {}

export function ConnectWalletDialog(props: ConnectWalletDialogProps) {
    const classes = useStylesExtends(useStyles(), props)
    const injectedProviderType = useInjectedProviderType()
    const { t } = useI18N()

    const [providerType, setProviderType] = useState<ProviderType | undefined>()
    const [networkType, setNetworkType] = useState<NetworkType | undefined>()

    //#region remote controlled dialog
    const { open, setDialog: setConnectWalletDialog } = useRemoteControlledDialog(
        WalletMessages.events.connectWalletDialogUpdated,
        (ev) => {
            if (!ev.open) return
            setProviderType(ev.providerType)
            setNetworkType(ev.networkType)
        },
    )
    //#endregion

    //#region walletconnect
    const { setDialog: setWalletConnectDialog } = useRemoteControlledDialog(
        WalletMessages.events.walletConnectQRCodeDialogUpdated,
    )
    //#endregion

    const connectTo = useCallback(async () => {
        if (!networkType) throw new Error('Unknown network type.')
        if (!providerType) throw new Error('Unknown provider type.')

        // read the chain detailed from the built-in chain list
        const expectedChainId = getChainIdFromNetworkType(networkType)
        const chainDetailedCAIP = getChainDetailedCAIP(expectedChainId)
        if (!chainDetailedCAIP) throw new Error('Unknown network type.')

        // a short time loading makes the user fells better
        await delay(1000)
        let account: string | undefined
        let chainId: ChainId | undefined

        switch (providerType) {
            case ProviderType.MaskWallet:
                ;({ account, chainId } = await Services.Ethereum.connectMaskWallet(networkType))
                break
            case ProviderType.MetaMask:
                ;({ account, chainId } = await Services.Ethereum.connectMetaMask())
                break
            case ProviderType.WalletConnect:
                // create wallet connect QR code URI
                const uri = await Services.Ethereum.createConnectionURI()
                if (!uri) throw new Error('Failed to create connection URI.')

                // open the QR code dialog
                setWalletConnectDialog({
                    open: true,
                    uri,
                })

                // wait for walletconnect to be connected
                ;({ account, chainId } = await Services.Ethereum.connectWalletConnect())
                break
            case ProviderType.Coin98:
            case ProviderType.WalletLink:
            case ProviderType.MathWallet:
                ;({ account, chainId } = await Services.Ethereum.connectInjected())
                break
            case ProviderType.Fortmatic:
                ;({ account, chainId } = await Services.Ethereum.connectFortmatic(expectedChainId))
                break
            case ProviderType.CustomNetwork:
                throw new Error('To be implemented.')
            default:
                safeUnreachable(providerType)
                break
        }

        // connection failed
        if (!account || !networkType) throw new Error(`Failed to connect to ${resolveProviderName(providerType)}.`)

        // need to switch chain
        if (chainId !== expectedChainId) {
            try {
                const overrides = {
                    chainId: expectedChainId,
                    providerType,
                }
                await Promise.race([
                    (async () => {
                        await delay(30 /* seconds */ * 1000 /* milliseconds */)
                        throw new Error('Timeout!')
                    })(),
                    networkType === NetworkType.Ethereum
                        ? Services.Ethereum.switchEthereumChain(ChainId.Mainnet, overrides)
                        : Services.Ethereum.addEthereumChain(chainDetailedCAIP, account, overrides),
                ])

                // recheck
                const chainIdHex = await Services.Ethereum.getChainId(overrides)
                if (Number.parseInt(chainIdHex, 16) !== expectedChainId) throw new Error('Failed to switch chain.')
            } catch {
                throw new Error(`Make sure your wallet is on the ${resolveNetworkName(networkType)} network.`)
            }
        }

        // update account
        await WalletRPC.updateAccount({
            account,
            chainId: expectedChainId,
            networkType,
            providerType,
        })
        return true as const
    }, [networkType, providerType, injectedProviderType])

    const connection = useAsyncRetry<true>(async () => {
        if (!open) return true

        await connectTo()
        // sync settings
        await delay(1000)
        setConnectWalletDialog({
            open: false,
            result: true,
        })

        return true
    }, [open, connectTo, setConnectWalletDialog])

    if (!providerType) return null

    return (
        <InjectedDialog
            title={`Connect to ${resolveProviderName(providerType)}`}
            open={open}
            onClose={() => setConnectWalletDialog({ open: false, result: false })}>
            <DialogContent className={classes.content}>
                <ConnectionProgress providerType={providerType} connection={connection} />
                {resolveProviderDownloadLink(providerType) ? (
                    <Box className={classes.message}>
                        <CramIcon />
                        <Typography>
                            {t('plugin_wallet_connect_message', {
                                name: resolveProviderName(providerType),
                            })}
                            {` `}
                            <Link
                                href={resolveProviderDownloadLink(providerType)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={classes.link}>
                                {resolveProviderHostName(providerType)}
                            </Link>
                            .
                        </Typography>
                    </Box>
                ) : null}
            </DialogContent>
        </InjectedDialog>
    )
}

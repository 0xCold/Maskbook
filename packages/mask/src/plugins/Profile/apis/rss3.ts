import RSS3 from 'rss3-next'
import { fetch } from './middleware'
import type { GeneralAsset } from './types'
import config from './config'
import { EthereumAddress } from 'wallet.ts'

const EMPTY_RSS3_DP: RSS3DetailPersona = {
    persona: null,
    address: '',
    isReady: false,
}

const RSS3PageOwner: RSS3DetailPersona = Object.create(EMPTY_RSS3_DP)
const RSS3LoginUser: RSS3DetailPersona = Object.create(EMPTY_RSS3_DP)
const assetsProfileCache: Map<string, IAssetProfile> = new Map()

export interface IAssetProfile {
    assets: GeneralAsset[]
    status?: boolean
}

export interface RSS3DetailPersona {
    persona: RSS3 | null
    address: string
    isReady: boolean
}

async function initUser(user: RSS3DetailPersona, skipSignSync: boolean = false) {
    if (user.persona) {
        if (!user.address) {
            user.address = user.persona.account.address
        }
        user.persona.files.set(await user.persona.files.get(user.address))
        if (!skipSignSync) {
            await user.persona.files.sync()
        }
    }
    user.isReady = true
}

function apiPersona(): RSS3 {
    return (
        RSS3LoginUser.persona ||
        new RSS3({
            endpoint: config.hubEndpoint,
        })
    )
}

export async function getAPIUser(): Promise<RSS3DetailPersona> {
    const user = Object.create(EMPTY_RSS3_DP)
    user.persona = apiPersona()
    return user
}

export async function setPageOwner(addrOrName: string) {
    let isReloadRequired = false
    if (EthereumAddress.isValid(addrOrName)) {
        if (RSS3PageOwner.address !== addrOrName) {
            isReloadRequired = true
            RSS3PageOwner.address = addrOrName
        }
    }
    if (isReloadRequired) {
        await initUser(RSS3PageOwner)
    }
    return RSS3PageOwner
}

export async function getPageOwner() {
    return RSS3PageOwner
}

export async function getAssetProfile(
    address: string,
    type: string,
    refresh: boolean = false,
): Promise<IAssetProfile | null> {
    if (assetsProfileCache.has(address + type) && !refresh) {
        return assetsProfileCache.get(address + type) ?? null
    }
    try {
        const res = await fetch(`/assets/list`, {
            baseURL: config.hubEndpoint,
            params: {
                personaID: address,
                type: type,
            },
        })
        const data = res?.data
        if (data) assetsProfileCache.set(address + type, data)
        return data
    } catch {
        return null
    }
}

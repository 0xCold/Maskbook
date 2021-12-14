import { formatFileSize } from '@dimensiondev/kit'
import { Plugin, ApplicationEntryConduct } from '@masknet/plugin-infra'
import { truncate } from 'lodash-unified'
import { ToolIconURLs } from '../../../resources/tool-icon'
import { base } from '../base'
import { META_KEY_1, META_KEY_2, FileServicePluginID } from '../constants'
import { FileInfoMetadataReader } from '../helpers'
import type { FileInfo } from '../types'
import FileServiceDialog from './MainDialog'
import { Preview } from './Preview'

const definition: Plugin.SNSAdaptor.Definition = {
    ...base,
    init(signal) {},
    DecryptedInspector(props) {
        const metadata = FileInfoMetadataReader(props.message.meta)
        if (!metadata.ok) return null
        return <Preview info={metadata.val} />
    },
    CompositionDialogMetadataBadgeRender: new Map([
        [META_KEY_1, onAttachedFile],
        [META_KEY_2, onAttachedFile],
    ]),
    CompositionDialogEntry: {
        label: '📃 File Service',
        dialog: FileServiceDialog,
    },
    ToolbarEntry: {
        ...ToolIconURLs.files,
        onClick: 'openCompositionEntry',
    },
    ApplicationEntries: [
        {
            icon: new URL('./assets/files.png', import.meta.url),
            label: 'File Service',
            priority: 2,
            conduct: { type: ApplicationEntryConduct.EncryptedMessage, id: FileServicePluginID },
            walletRequired: false,
        },
    ],
}

export default definition

function onAttachedFile(payload: FileInfo) {
    const name = truncate(payload.name, { length: 10 })
    return `Attached File: ${name} (${formatFileSize(payload.size)})`
}

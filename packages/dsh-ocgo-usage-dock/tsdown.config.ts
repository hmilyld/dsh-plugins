import { pluginConfig } from '../../tooling/tsdown.preset.mjs'

export default pluginConfig(import.meta.dirname, process.env.DSH_BUILD_FACE)

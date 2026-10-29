#!/usr/bin/env node
/**
 * Refuse a publish that the npm client would corrupt.
 *
 * `npm publish` does not understand pnpm's workspace protocols: it copies
 * `catalog:` and `workspace:*` into the published manifest verbatim, which
 * makes the package uninstallable (`ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`).
 * `pnpm publish` resolves both first, so the only safe client is pnpm.
 *
 * Wired into `prepublishOnly`, which runs before the tarball is built, so a
 * mistaken client fails here instead of shipping a broken version.
 */
const agent = process.env.npm_config_user_agent ?? ''

if (!agent.startsWith('pnpm/')) {
  const client = agent.split(' ')[0] || 'an unknown client'
  console.error(
    [
      `refusing to publish with ${client}: it does not resolve pnpm workspace protocols.`,
      '`catalog:` and `workspace:*` would be copied into the published manifest and the',
      'package would fail to install with ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER.',
      '',
      'Publish with pnpm instead:',
      '  pnpm publish --registry=https://registry.npmjs.org/ --access public',
    ].join('\n'),
  )
  process.exit(1)
}

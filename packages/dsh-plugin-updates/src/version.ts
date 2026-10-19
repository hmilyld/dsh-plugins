/** One parsed SemVer version. */
export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: readonly (string | number)[]
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Parse a SemVer string, tolerating a leading `v` and ignoring build metadata.
 * @param input - version text.
 * @returns the parsed parts, or undefined when the input is not a version.
 */
export function parseVersion(input: string): ParsedVersion | undefined {
  const match = VERSION_PATTERN.exec(input.trim())
  if (match === null) return undefined
  const prerelease =
    match[4] === undefined
      ? []
      : match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

/** SemVer: numeric identifiers compare numerically, alphanumerics lexically, and a release outranks any prerelease. */
function comparePrerelease(
  left: readonly (string | number)[],
  right: readonly (string | number)[],
): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (a === b) continue
    const aNumeric = typeof a === 'number'
    const bNumeric = typeof b === 'number'
    if (aNumeric && bNumeric) return a < b ? -1 : 1
    if (aNumeric) return -1
    if (bNumeric) return 1
    return String(a) < String(b) ? -1 : 1
  }
  return 0
}

/**
 * Compare two versions.
 * @param left - first version.
 * @param right - second version.
 * @returns -1, 0, or 1; unparseable inputs compare equal.
 */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === undefined || b === undefined) return 0
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return comparePrerelease(a.prerelease, b.prerelease)
}

/**
 * Whether `candidate` is strictly newer than `current`.
 * @param candidate - version offered by the registry.
 * @param current - running version.
 * @returns true for a real upgrade.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}

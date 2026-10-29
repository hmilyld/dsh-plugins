/**
 * Build-time Typert protocol facade.
 *
 * The generator recognises `@Remote` and `TypertRemoteService` only when their
 * declarations live inside a workspace package registered as
 * `@deepseek-ai/dsh-typert-protocol` (or inside an ambient module block with
 * that exact name). This repository consumes the published protocol from
 * node_modules, so the real declarations sit outside the workspace and the
 * generator would silently find no Remote methods.
 *
 * `tsconfig.json` maps the specifier to this file for type analysis only; the
 * emitted JavaScript keeps the bare import, so the runtime always uses the
 * DSH-provided protocol instance. Keep the surface in sync with the protocol
 * version pinned in package.json.
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
  /** Failure branch of a generated Remote call. */
  export interface RemoteFailure {
    readonly code: string
    readonly message: string
  }

  /** What every generated Remote method resolves to. */
  export type RemoteResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: RemoteFailure }

  /** Generated Host-for-Client contribution mounted by `ctx.remote.$mount`. */
  export interface TypertRemoteContribution {
    readonly id: string
    readonly namespace: string
  }

  /** Registry of per-namespace method shapes, augmented by generated code. */
  export interface TypertRemoteNamespaceMap {}

  /** Registry of flat endpoint shapes, augmented by generated code. */
  export interface TypertRemoteMap {}

  /** Mark one public instance method as a direct Remote invocation. */
  export function Remote<This extends object, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ): void

  /** Mark one public instance method under an exported name or as a stream. */
  export function Remote(
    option: string | { readonly mode: 'stream' },
  ): (method: (...args: never[]) => unknown, context: ClassMethodDecoratorContext) => void

  /** Service base that binds one Cordis key to a Typert Remote namespace. */
  export abstract class TypertRemoteService<T = never> {
    protected constructor(
      ctx: import('@deepseek-ai/cordis').Context,
      serviceKey: string,
      options?: { readonly namespace?: string },
    )
    protected readonly ctx: import('@deepseek-ai/cordis').Context
    readonly typertRemote: unknown
  }
}

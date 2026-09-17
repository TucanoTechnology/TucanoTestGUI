/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * What a probe of the store could learn. Every field is non-sensitive — no path, no filesystem error and no stored content — so a deployment that is failing can be diagnosed from a response that is safe to hand to an operator.
 */
export type StorageDiagnostics = {
  /**
   * Which backend the process was started with.
   */
  storage: 'filesystem';
  /**
   * The single answer `/ready` gives: `exists && writable && lockable`. It is reported here too so the two endpoints cannot disagree about the same store.
   */
  ready: boolean;
  /**
   * The data directory exists and is a directory.
   */
  exists: boolean;
  /**
   * A scratch file could be created, written and removed in the data directory, which is the whole of what persisting a document requires. The file follows the atomic-write temporary convention, so a probe interrupted part-way is never mistaken for a document.
   */
  writable: boolean;
  /**
   * The advisory lock writes serialise on could be taken. A lock another replica holds right now counts as lockable: the store is serialising writers as designed rather than failing.
   */
  lockable: boolean;
  /**
   * Another process holds the lock at this moment, so a write would wait for it. Always `false` when `lockable` is `false`.
   */
  lockHeld: boolean;
  /**
   * The newest modification time seen on the data directory itself or one of its immediate entries, in seconds since the Unix epoch, or `null` when it cannot be read. One level only, so a probe stays cheaper than the work it precedes, and it is a liveness hint about the volume rather than a per-document watermark.
   */
  lastWriteUnix: number | null;
};


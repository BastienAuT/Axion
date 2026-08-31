/* eslint-disable @typescript-eslint/no-explicit-any */
declare type D1Database = any;
declare interface Fetcher { fetch(request: Request): Promise<Response>; }
declare module "cloudflare:workers" {
  export const env: { DB: D1Database; FILES?: unknown; [key: string]: unknown };
}

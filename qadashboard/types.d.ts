// Ambient declarations for modules whose @types packages cannot be installed
// in this environment (npm fails to materialize them). The packages ship
// their own type stubs elsewhere; these shims keep tsc happy.

declare module "react-dom" {
  import * as React from "react";
  export function createPortal(
    children: React.ReactNode,
    container: Element | DocumentFragment
  ): React.ReactPortal;
  export function flushSync(fn: () => void): void;
}

declare module "nodemailer" {
  type SendMailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    [key: string]: unknown;
  };
  type SentMessageInfo = Record<string, unknown>;
  type Transporter = {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
  };
  type TransportOptions = {
    service?: string;
    auth?: { user?: string; pass?: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    [key: string]: unknown;
  };
  export function createTransport(options: TransportOptions): Transporter;
}

declare module "pdf-parse" {
  type PDFParseResult = { text: string; numpages: number; info?: unknown };
  function pdfParse(data: Buffer | Uint8Array): Promise<PDFParseResult>;
  export = pdfParse;
}

declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;
  export type QueryResult<T = QueryResultRow> = { rows: T[]; rowCount: number };
  export class Pool {
    constructor(options?: {
      connectionString?: string;
      max?: number;
      idleTimeoutMillis?: number;
      connectionTimeoutMillis?: number;
      ssl?: unknown;
    });
    query<T = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}

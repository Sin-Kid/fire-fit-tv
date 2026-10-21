// AWS Lambda entry point (Function URL / API Gateway HTTP API payload v2).
// Deployed by ../template.yaml with AWS SAM.

import { handle } from './handler.js';

interface FunctionUrlEvent {
  rawPath?: string;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
}

export const handler = async (event: FunctionUrlEvent) => {
  const method = event.requestContext?.http?.method ?? 'GET';
  const body = event.body && event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const out = await handle(method, event.rawPath ?? '/', body);
  return {
    statusCode: out.status,
    headers: { 'Content-Type': out.contentType ?? 'application/json' },
    body: out.contentType ? String(out.body) : JSON.stringify(out.body),
  };
};

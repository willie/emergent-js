import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

/**
 * Safely parses JSON from a Request body, enforcing a maximum payload size.
 * Prevents DoS attacks via oversized payloads.
 */
export async function parseSafeJson<T = any>(
  req: Request,
  maxSize: number = DEFAULT_MAX_PAYLOAD_SIZE
): Promise<T> {
  const contentLength = req.headers.get('content-length');

  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new ApiError(413, 'Payload Too Large', 'PAYLOAD_TOO_LARGE');
  }

  // If no content-length, we still need to stream and check size
  const reader = req.body?.getReader();
  if (!reader) {
    return {} as T; // Empty body
  }

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (value) {
      receivedLength += value.length;
      if (receivedLength > maxSize) {
        // Cancel the stream to prevent further reading
        await reader.cancel('Payload Too Large');
        throw new ApiError(413, 'Payload Too Large', 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  }

  const chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  const bodyText = new TextDecoder('utf-8').decode(chunksAll);

  if (!bodyText.trim()) {
      return {} as T;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new ApiError(400, 'Invalid JSON payload', 'INVALID_JSON');
  }
}

/**
 * Standardizes API error responses.
 */
export function handleApiError(error: unknown, context: string = 'API'): NextResponse {
  if (error instanceof ApiError) {
    console.warn(`[${context}] ${error.message}`);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error(`[${context}] Unexpected error:`, error);
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  );
}

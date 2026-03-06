import { NextResponse } from 'next/server';

export class PayloadTooLargeError extends Error {
    constructor(message: string = 'Payload Too Large') {
        super(message);
        this.name = 'PayloadTooLargeError';
    }
}

export class InvalidJsonError extends Error {
    constructor(message: string = 'Invalid JSON payload') {
        super(message);
        this.name = 'InvalidJsonError';
    }
}

/**
 * Safely parses JSON from a Request stream, enforcing a maximum size limit to prevent DoS attacks.
 * Reads the stream chunk by chunk and aborts if it exceeds the limit.
 */
export async function parseSafeJson<T = any>(req: Request, maxSize: number = 1024 * 1024): Promise<T> {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
        throw new PayloadTooLargeError(`Payload exceeds maximum size of ${maxSize} bytes`);
    }

    if (!req.body) {
        throw new InvalidJsonError('Empty request body');
    }

    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let bodyText = '';
    let bytesRead = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            bytesRead += value.length;
            if (bytesRead > maxSize) {
                // Important: Release the lock on the stream before throwing
                reader.releaseLock();
                req.body.cancel('Payload too large');
                throw new PayloadTooLargeError(`Payload exceeds maximum size of ${maxSize} bytes`);
            }

            bodyText += decoder.decode(value, { stream: true });
        }

        // Final flush
        bodyText += decoder.decode();

        if (!bodyText.trim()) {
            throw new InvalidJsonError('Empty request body');
        }

        return JSON.parse(bodyText);
    } catch (error) {
        if (error instanceof PayloadTooLargeError) {
            throw error;
        }
        throw new InvalidJsonError(error instanceof Error ? error.message : 'Failed to parse JSON');
    } finally {
        // Ensure reader is released if error occurred before the loop finished normally
        try {
            reader.releaseLock();
        } catch {
            // Ignore if already released
        }
    }
}

/**
 * Standardized API error handling for request parsing errors.
 */
export function handleApiError(error: unknown, context: string = 'API'): NextResponse {
    console.error(`[${context}] Error:`, error instanceof Error ? error.message : error);

    if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: error.message }, { status: 413 });
    }

    if (error instanceof InvalidJsonError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

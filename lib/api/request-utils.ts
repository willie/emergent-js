export async function parseSafeJson<T = any>(
  req: Request,
  options?: { maxSizeMB?: number },
): Promise<T> {
  const maxSizeMB = options?.maxSizeMB ?? 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (contentLength > maxBytes) {
      throw new Error("Payload Too Large");
    }
  }

  // Read the stream chunk by chunk to enforce the limit even if content-length is missing or spoofed
  const reader = req.body?.getReader();
  if (!reader) {
    // Fallback if no body
    try {
      const text = await req.text();
      if (text.length > maxBytes) throw new Error("Payload Too Large");
      return JSON.parse(text) as T;
    } catch (e: any) {
      if (e.message === "Payload Too Large") throw e;
      throw new Error("Invalid JSON");
    }
  }

  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        bytesRead += value.length;
        if (bytesRead > maxBytes) {
          throw new Error("Payload Too Large");
        }
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode(); // flush remaining

    return JSON.parse(text) as T;
  } catch (error: any) {
    if (error.message === "Payload Too Large") {
      throw error;
    }
    throw new Error("Invalid JSON");
  } finally {
    reader.releaseLock();
  }
}

export function handleApiError(error: any) {
  if (error.message === "Payload Too Large") {
    console.error("[API Error] Payload Too Large");
    return Response.json({ error: "Payload Too Large" }, { status: 413 });
  }
  if (error.message === "Invalid JSON") {
    console.error("[API Error] Invalid JSON");
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  console.error("[API Error]", error);
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}

export function track(event: string, properties: Record<string, any> = {}) {
  // Safe analytics event logger
  if (process.env.NODE_ENV !== 'production') {
    // console.log(`[Analytics] ${event}`, properties);
  }
}

export async function hashId(id: string): Promise<string> {
  if (!id) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(id);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  } catch {
    return id.slice(0, 8);
  }
}

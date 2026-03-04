/**
 * Generate a unique ID using the browser's native crypto API
 * Returns a UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateId(): string {
  return crypto.randomUUID();
}

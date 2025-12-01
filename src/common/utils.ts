import { randomUUID } from "crypto";

export function generateId(): string {
  return randomUUID();
}

export function timestamp(): string {
  return new Date().toISOString();
}

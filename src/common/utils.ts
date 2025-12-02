import { randomUUID } from "crypto";

export function generateId(): string {
  return randomUUID();
}

export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Checks if an item exists in a collection (Set or Array).
 * @param collection - The Set or Array to search in
 * @param item - The item to find
 * @returns True if the item exists in the collection
 */
export function hasItem<T>(collection: Set<T> | T[] | undefined, item: T): boolean {
  if (!collection) return false;
  if (collection instanceof Set) return collection.has(item);
  return collection.includes(item);
}

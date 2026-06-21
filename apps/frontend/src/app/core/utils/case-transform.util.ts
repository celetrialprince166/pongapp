/**
 * Case Transformation Utilities
 *
 * Utilities for converting between snake_case (Python/Backend)
 * and camelCase (TypeScript/Frontend) conventions.
 */

/**
 * Convert snake_case string to camelCase
 * @param str snake_case string
 * @returns camelCase string
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 * @param str camelCase string
 * @returns snake_case string
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transform object keys from snake_case to camelCase recursively
 * @param obj Object with snake_case keys
 * @returns Object with camelCase keys
 */
export function snakeToCamelObject<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamelObject(item)) as any;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const camelObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = snakeToCamel(key);
        camelObj[camelKey] = snakeToCamelObject(obj[key]);
      }
    }
    return camelObj;
  }

  return obj;
}

/**
 * Transform object keys from camelCase to snake_case recursively
 * @param obj Object with camelCase keys
 * @returns Object with snake_case keys
 */
export function camelToSnakeObject<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnakeObject(item)) as any;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const snakeObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = camelToSnake(key);
        snakeObj[snakeKey] = camelToSnakeObject(obj[key]);
      }
    }
    return snakeObj;
  }

  return obj;
}

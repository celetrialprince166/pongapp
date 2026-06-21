/**
 * Theme Testing Utilities
 *
 * Utilities for testing component appearance in different themes.
 * Used in component tests to verify dark/light mode compatibility.
 */

/**
 * Set the theme for testing
 */
export function setTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Get computed CSS variable value
 */
export function getCSSVariable(element: HTMLElement, variable: string): string {
  return getComputedStyle(element).getPropertyValue(variable).trim();
}

/**
 * Check if a color meets WCAG contrast ratio requirements
 * @param foreground Foreground color (hex or rgb)
 * @param background Background color (hex or rgb)
 * @param level 'AA' or 'AAA'
 * @param size 'normal' or 'large'
 * @returns true if contrast ratio is sufficient
 */
export function meetsContrastRatio(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  const ratio = getContrastRatio(foreground, background);

  const requirements = {
    'AA': { normal: 4.5, large: 3.0 },
    'AAA': { normal: 7.0, large: 4.5 }
  };

  const required = requirements[level][size];
  return ratio >= required;
}

/**
 * Calculate contrast ratio between two colors
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get relative luminance of a color (WCAG formula)
 */
export function getRelativeLuminance(color: string): number {
  const rgb = parseColor(color);

  // Convert to 0-1 range
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // Apply gamma correction
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Parse color string to RGB values
 */
export function parseColor(color: string): { r: number; g: number; b: number } {
  // Remove whitespace
  color = color.trim();

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // Handle rgb/rgba colors
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2])
      };
    }
  }

  // Default to black if parsing fails
  console.warn(`Could not parse color: ${color}`);
  return { r: 0, g: 0, b: 0 };
}

/**
 * Get computed color of an element
 */
export function getElementColor(element: HTMLElement, property: 'color' | 'background-color' | 'border-color'): string {
  return getComputedStyle(element).getPropertyValue(property);
}

/**
 * Test helper: Check if element uses design token
 */
export function usesDesignToken(element: HTMLElement, property: string, expectedToken: string): boolean {
  const computed = getComputedStyle(element).getPropertyValue(property);
  const tokenValue = getCSSVariable(element, expectedToken);

  return computed === tokenValue;
}

/**
 * Test helper: Verify theme switching
 */
export async function verifyThemeSwitch(
  element: HTMLElement,
  property: string,
  darkValue: string,
  lightValue: string
): Promise<boolean> {
  // Test dark mode
  setTheme('dark');
  await new Promise(resolve => setTimeout(resolve, 0)); // Allow CSS to apply
  const darkResult = getComputedStyle(element).getPropertyValue(property);

  // Test light mode
  setTheme('light');
  await new Promise(resolve => setTimeout(resolve, 0));
  const lightResult = getComputedStyle(element).getPropertyValue(property);

  return darkResult === darkValue && lightResult === lightValue;
}

/**
 * Snapshot helper: Get all color properties of an element
 */
export function getColorSnapshot(element: HTMLElement): Record<string, string> {
  const styles = getComputedStyle(element);

  return {
    color: styles.color,
    backgroundColor: styles.backgroundColor,
    borderColor: styles.borderColor,
    borderTopColor: styles.borderTopColor,
    borderRightColor: styles.borderRightColor,
    borderBottomColor: styles.borderBottomColor,
    borderLeftColor: styles.borderLeftColor
  };
}

/**
 * Compare two color snapshots for differences
 */
export function compareColorSnapshots(
  snapshot1: Record<string, string>,
  snapshot2: Record<string, string>
): string[] {
  const differences: string[] = [];

  for (const key in snapshot1) {
    if (snapshot1[key] !== snapshot2[key]) {
      differences.push(`${key}: ${snapshot1[key]} → ${snapshot2[key]}`);
    }
  }

  return differences;
}

import { clsx, type ClassValue } from 'clsx';
import { createHash } from 'crypto';
import { twMerge } from 'tailwind-merge';

/**
 * Calculate our entity ID which is a hash from the user agent plus the IP address:
 * sha256(`${userAgent}-${ip}`)
 * 
 */
export async function getEntityId() {
  // retrieve IP from https://api.ipify.org?format=json
  const userAgent = navigator.userAgent;
  const ip = await fetch('https://api.ipify.org?format=json')
    .then((response) => response.json())
    .then((data) => data.ip)
    .catch(() => 'Unknown');
  return createHash('sha256').update(`${userAgent}-${ip}`).digest('hex');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<F extends (...args: any[]) => void>(func: F, wait: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFunction = (...args: any[]) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), wait);
  };

  debouncedFunction.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };

  return debouncedFunction;
}

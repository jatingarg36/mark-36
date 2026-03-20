export function debounce<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number
) {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => callback(...args), delayMs);
  };
}

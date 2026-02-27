export function ensure<T>(argument: T | undefined | null, message?: string): T {
  if (argument === undefined || argument === null) {
    throw new TypeError(message || "This value was promised to be there.");
  }

  return argument;
}
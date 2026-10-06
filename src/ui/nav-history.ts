/**
 * Same-document screens, oldest first. The back control pops when the screen it names is the one underneath,
 * so the browser restores that page instead of opening it as a new visit (which paints the Loading screen).
 */
const stack: string[] = [];

/** Drops the stack. Tests call this between cases; a full page load starts empty on its own. */
export function clearNavHistory(): void {
  stack.splice(0, stack.length);
}

export function noteNavigation(href: string, popped: boolean): void {
  const key = locationKey(href);
  if (popped) {
    const index = stack.lastIndexOf(key);
    // Browser back or forward to a screen we still have: drop whatever was above it. An entry we never
    // recorded (forward after we had already trimmed, or a restored document) becomes the whole stack,
    // so a later back control does not pretend to know the page under it.
    if (index >= 0) stack.splice(index + 1);
    else stack.splice(0, stack.length, key);
    return;
  }
  if (stack[stack.length - 1] !== key) stack.push(key);
}

/** True when `backHref` is the screen under the current one. A link with no query still matches that screen. */
export function returnsToPrevious(backHref: string): boolean {
  const under = stack[stack.length - 2];
  if (under === undefined) return false;
  const previous = parts(under);
  const target = parts(backHref);
  if (previous.pathname !== target.pathname) return false;
  if (target.search === "") return true;
  return previous.search === target.search;
}

function locationKey(href: string): string {
  const { pathname, search } = parts(href);
  return pathname + search;
}

function parts(href: string): { pathname: string; search: string } {
  const url = new URL(href, "http://localhost");
  return { pathname: url.pathname, search: url.search };
}

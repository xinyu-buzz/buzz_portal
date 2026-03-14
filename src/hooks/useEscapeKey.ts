import { useEffect } from "react";

/**
 * Calls `onEscape` when the Escape key is pressed, as long as the hook is mounted.
 * Designed for modals — mount it when the modal is open.
 */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEscape]);
}

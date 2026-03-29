/**
 * Save a Blob as a file download in a normal browser (no chrome.downloads API).
 */
export function triggerBrowserFileDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8_000);
}

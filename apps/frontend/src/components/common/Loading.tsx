/**
 * Loading indicator.
 * Preconditions: used during async operations.
 * Postconditions: renders spinner and accessible text.
 */
function Loading() {
  return (
    <div className="flex items-center gap-3 text-sm text-mutedForeground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-mutedForeground border-t-transparent" />
      <span>Chargement...</span>
    </div>
  );
}

export default Loading;

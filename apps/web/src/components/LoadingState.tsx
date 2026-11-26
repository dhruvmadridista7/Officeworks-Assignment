export function LoadingState({
  label = 'Loading products…',
}: {
  label?: string;
}) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <span className="loading-indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

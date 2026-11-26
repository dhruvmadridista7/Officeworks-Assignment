export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="state-card state-card-error" role="alert">
      <div>
        <strong>We couldn’t load this page.</strong>
        <p>{message}</p>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

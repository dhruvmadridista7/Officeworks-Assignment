export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <span className="empty-state-mark" aria-hidden="true">
        ◎
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

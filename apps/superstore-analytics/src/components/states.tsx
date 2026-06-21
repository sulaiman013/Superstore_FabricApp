export function ChartSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 items-end gap-s p-l" aria-hidden>
      {[58, 84, 46, 72, 36, 62, 50].map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-md bg-muted"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  message = 'No data for the current filters',
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-l text-center text-200 text-muted-foreground">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="m-l rounded-lg border border-destructive/40 bg-destructive/10 px-m py-s text-200 text-destructive">
      {message}
    </div>
  );
}

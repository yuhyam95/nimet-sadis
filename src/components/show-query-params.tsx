'use client';
import { useSearchParams } from 'next/navigation';

export function ShowQueryParams() {
  const searchParams = useSearchParams();
  const entries = Array.from(searchParams.entries());
  if (entries.length === 0) return null;
  return (
    <div className="p-2 mb-2 bg-muted/30 rounded text-xs">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span className="font-semibold">{key}:</span> {value}
        </div>
      ))}
    </div>
  );
} 
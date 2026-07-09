'use client';

/**
 * Renders a requestor's per-line remarks under an item description. Clamped
 * to 2 lines with a native tooltip for the full text so long remarks can't
 * stretch the parent table's column width.
 */
export default function RequestorRemarks({
  text,
  label = 'Requestor remarks',
}: {
  text: string;
  label?: string | null;
}) {
  return (
    <p
      className="text-xs text-pq-neutral-400 italic mt-0.5 font-normal line-clamp-2 max-w-xs break-words"
      title={text}
    >
      {label ? `${label}: ` : ''}
      {text}
    </p>
  );
}

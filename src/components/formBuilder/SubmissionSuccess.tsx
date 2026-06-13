// Animated success state shown after a form is submitted: a popping check ring
// with the form's custom submission message (or a friendly default) below it.
export default function SubmissionSuccess({ message }: { message?: string }) {
  const text = message?.trim() || "Thank you! Your response has been recorded.";
  return (
    <div className="flex flex-col items-center py-10 text-center" role="status">
      <span className="lk-success-pop flex size-16 items-center justify-center rounded-full bg-success-50 dark:bg-success-500/15">
        <svg viewBox="0 0 24 24" className="size-9 text-success-600 dark:text-success-500" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path className="lk-success-check" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <p className="lk-success-msg mt-4 max-w-md whitespace-pre-line text-base font-medium text-gray-800 dark:text-white/90">
        {text}
      </p>
    </div>
  );
}

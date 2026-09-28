import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-[10px] border bg-paper px-3.5 text-sm text-ink placeholder:text-faint transition-colors outline-none focus-visible:outline-none focus:border-forest focus:ring-3 focus:ring-forest/12 disabled:opacity-60";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "h-11",
        invalid ? "border-danger focus:border-danger focus:ring-danger/12" : "border-line-strong",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-24 resize-y border-line-strong py-3 leading-relaxed", className)}
        {...props}
      />
    );
  },
);

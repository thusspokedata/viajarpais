import { cva, type VariantProps } from "class-variance-authority";

/*
  `buttonVariants` lives in this non-client file so it can be invoked
  from Server Components (e.g., a styled `<Link>` that mimics a button).
  The `Button` component re-exports it for backwards compatibility.
*/
export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-sans font-medium select-none",
    "rounded-[var(--radius-md)]",
    "transition-[transform,background-color,color,box-shadow,border-color]",
    "duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.985]",
    "focus-visible:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]",
          "shadow-[var(--shadow-subtle)]",
          "hover:bg-[var(--brand-primary-hover)] hover:shadow-[var(--shadow-default)] hover:-translate-y-[1px]",
          "active:bg-[var(--brand-primary-active)] active:translate-y-0",
        ].join(" "),
        secondary: [
          "bg-[var(--surface-base)] text-[var(--text-primary)]",
          "border border-[var(--border-default)]",
          "hover:bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]",
          "active:bg-[var(--neutral-150)]",
        ].join(" "),
        ghost: [
          "bg-transparent text-[var(--text-secondary)]",
          "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
          "active:bg-[var(--neutral-150)]",
        ].join(" "),
        destructive: [
          "bg-[var(--danger-fg)] text-[var(--neutral-0)]",
          "hover:opacity-90 hover:-translate-y-[1px]",
          "active:translate-y-0",
        ].join(" "),
        link: [
          "bg-transparent text-[var(--text-link)] px-0 h-auto",
          "hover:text-[var(--text-link-hover)] hover:underline underline-offset-4",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-[var(--text-sm)]",
        md: "h-10 px-4 text-[var(--text-base)]",
        lg: "h-12 px-6 text-[var(--text-md)]",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

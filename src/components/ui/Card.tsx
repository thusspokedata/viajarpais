"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Card — contenedor de superficie elevada.
 *
 * Variantes:
 * - `default`     → card estándar.
 * - `interactive` → card que es link/clickable. Hover lift + shadow.
 * - `tier-free` / `tier-paid` / `tier-featured` → para listings.
 *
 * La distinción de tiers se logra por composición (no por color saturado):
 * - free: borde sutil, fondo plano.
 * - paid: borde un poco más fuerte + strip lateral cream cálido.
 * - featured: borde con tinte gold + accent strip top.
 */
type CardVariant = "default" | "interactive" | "tier-free" | "tier-paid" | "tier-featured";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  asChild?: boolean;
}

const cardBase =
  "relative bg-[var(--surface-base)] rounded-[var(--radius-lg)] " +
  "transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-standard)]";

const cardVariantClass: Record<CardVariant, string> = {
  default: "border border-[var(--border-subtle)] shadow-[var(--shadow-subtle)]",
  interactive:
    "border border-[var(--border-subtle)] shadow-[var(--shadow-subtle)] cursor-pointer " +
    "hover:-translate-y-[2px] hover:shadow-[var(--shadow-elevated)] hover:border-[var(--border-default)]",
  "tier-free":
    "border border-[var(--tier-free-border)] shadow-[var(--shadow-subtle)] " +
    "hover:-translate-y-[1px] hover:shadow-[var(--shadow-default)]",
  "tier-paid":
    "border border-[var(--tier-paid-border)] shadow-[var(--shadow-subtle)] " +
    "hover:-translate-y-[2px] hover:shadow-[var(--shadow-default)] " +
    "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-[var(--radius-pill)] " +
    "before:bg-[var(--tier-paid-accent)]",
  "tier-featured":
    "border border-[var(--tier-featured-border)] shadow-[var(--shadow-default)] " +
    "hover:-translate-y-[2px] hover:shadow-[var(--shadow-elevated)]",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      data-tier={variant.startsWith("tier-") ? variant.replace("tier-", "") : undefined}
      className={cn(cardBase, cardVariantClass[variant], className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pb-2", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-[var(--text-lg)] font-semibold text-[var(--text-primary)]",
      "tracking-[var(--tracking-tight)]",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[var(--text-sm)] text-[var(--text-secondary)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-2", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-5 pt-2 flex items-center gap-2", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

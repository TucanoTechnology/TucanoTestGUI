import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "sm" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * Standardized button component (#200).
 *
 * Variant semantics:
 * - primary: Main/expected action (Edit, Save, Create, Confirm)
 * - secondary: Important but not primary (Add to run, Link)
 * - ghost: Secondary actions (Duplicate, Cancel, Export, Move/Copy)
 * - danger: Destructive actions only (Delete, Remove)
 *
 * Size rules:
 * - default: Standalone buttons
 * - sm: Inline actions (table rows, compact toolbars)
 * - icon: Icon-only buttons (nav rail, tree headers)
 */
export function Button({
  variant = "ghost",
  size = "default",
  children,
  className,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
  }[variant];

  const sizeClass = {
    default: "",
    sm: "btn-sm",
    icon: "btn-icon",
  }[size];

  const classes = ["btn", variantClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

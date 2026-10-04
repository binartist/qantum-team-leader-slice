import type { ButtonHTMLAttributes } from "react";
import styles from "./primitives.module.css";

export function Button({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = className ? `${styles.button} ${className}` : styles.button;
  return <button className={classes} type={type} {...props} />;
}

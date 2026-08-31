export default function ChromaticText({ as: Component = "span", className = "", children, ...props }) {
  const classes = ["chromatic-text", className].filter(Boolean).join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

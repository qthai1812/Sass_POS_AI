import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";

const Toaster = ({
  duration = 3000,
  visibleToasts = 2,
  toastOptions,
  ...props
}) => {
  const { theme = "system" } = useTheme()
  const numericDuration = Number(duration)
  const effectiveDuration =
    Number.isFinite(numericDuration) && numericDuration > 0
      ? Math.min(3000, numericDuration)
      : 3000

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      duration={effectiveDuration}
      visibleToasts={Math.min(2, Number(visibleToasts) || 2)}
      toastOptions={{
        ...toastOptions,
        duration: effectiveDuration,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }
      }
      {...props} />
  );
}

export { Toaster }

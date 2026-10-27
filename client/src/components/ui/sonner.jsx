import { Toaster as Sonner } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Sonner doesn't expose the toast id to custom icons, so this triggers the toast's own close button.
function DismissIcon({ children }) {
  return (
    <button
      type="button"
      aria-label="Dismiss notification"
      className="flex cursor-pointer rounded-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring"
      onClick={(event) =>
        event.currentTarget.closest("[data-sonner-toast]")?.querySelector("[data-close-button]")?.click()
      }
    >
      {children}
    </button>
  )
}

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <DismissIcon>
            <OctagonXIcon className="size-4" />
          </DismissIcon>
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)"
        }
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast group/toast",
          closeButton: "group-data-[type=error]/toast:hidden!",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }

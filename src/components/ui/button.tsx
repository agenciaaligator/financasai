import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary to-primary-dark text-primary-foreground rounded-[16px] shadow-[0_4px_20px_hsl(var(--primary)/0.3)] hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground rounded-[16px] hover:bg-destructive/90",
        outline:
          "border-2 border-primary bg-transparent text-primary rounded-[16px] hover:bg-primary hover:text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground rounded-[16px] hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-[16px]",
        link: "text-primary underline-offset-4 hover:underline",
        whatsapp: "bg-gradient-to-br from-[#25D366] to-[#1da851] text-white rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:-translate-y-0.5",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-9 rounded-md px-3",
        lg: "h-14 rounded-md px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

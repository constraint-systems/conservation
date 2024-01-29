import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, bgCustom, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none h-full",
      className
    )}
    {...props}
  >
    <div className="absolute flex items-center inset-0 w-full h-full">
      <div className="w-full h-full bg-neutral-900" />
    </div>
    <SliderPrimitive.Track className="relative h-full w-full grow">
      {bgCustom &&
      <SliderPrimitive.Range className="absolute h-full" style={{
          background: bgCustom
      }}/>
      }
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-6 w-2 bg-white focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

/**
 * Barrel exports de los primitivos del Design System.
 *
 * Importar siempre desde `@/components/ui` (no desde el archivo individual)
 * para que el día de mañana podamos reorganizar la estructura interna
 * sin romper imports en patterns o páginas.
 */
export { cn } from "./cn";
export * from "./icons";

export { Button, type ButtonProps } from "./Button";
export { buttonVariants, type ButtonVariantProps } from "./button-variants";
export { Input, type InputProps } from "./Input";
export { Label, type LabelProps } from "./Label";
export { Textarea, type TextareaProps } from "./Textarea";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "./Card";
export {
  Badge,
  FeaturedBadge,
  VerifiedBadge,
  type BadgeProps,
  type VerifiedBadgeProps,
  type VerifiedStatus,
} from "./Badge";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "./Select";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./DropdownMenu";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export { Separator } from "./Separator";
export { Avatar, AvatarImage, AvatarFallback, initialsOf } from "./Avatar";
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./Tooltip";
export { EmptyState, EmptyStateAction, type EmptyStateProps } from "./EmptyState";

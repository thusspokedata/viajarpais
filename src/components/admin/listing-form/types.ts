import type { ListingFormInput } from "@/lib/listings/validation";

export type ProvinceOption = { id: string; name: string; slug: string };
export type DepartmentOption = { id: string; name: string; slug: string };
export type LocalityOption = { id: string; name: string; slug: string };
export type CategoryOption = {
  id: string;
  slug: string;
  nameEs: string;
  nameSingularEs: string;
  icon: string | null;
};

export type ListingFormMode = "create" | "edit";

export type ListingFormShellProps = {
  mode: ListingFormMode;
  defaultValues: ListingFormInput;
  provinces: ProvinceOption[];
  initialDepartments: DepartmentOption[];
  initialLocalities: LocalityOption[];
  categories: CategoryOption[];
  /** Solo en mode="edit". */
  listingId?: string;
  listingStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  listingTier?: "FREE" | "PAID" | "FEATURED";
  listingUpdatedAt?: string;
  listingVerifiedAt?: string | null;
  listingVerifiedUntil?: string | null;
  listingArchivedAt?: string | null;
  /** Para banner: cambios criticos pendientes de re-verificar. */
  needsReverify?: boolean;
  /** Recién creado: muestra toast/indicador. */
  justCreated?: boolean;
};

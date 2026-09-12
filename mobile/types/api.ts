/**
 * Типы ответов SAVEAT API.
 *
 * Зеркалят Pydantic-схемы backend (app/schemas/*.py).
 * Менять их можно только вместе с backend.
 */

/**
 * Numeric(12, 2) из Postgres приходит строкой или числом
 * в зависимости от сериализации — приводим через toNumber().
 */
export type Money = string | number;

export type BusinessRole = "owner" | "manager" | "staff";

export type OrderStatus =
  | "reserved"
  | "paid"
  | "ready"
  | "picked_up"
  | "cancelled";

export type OfferStatus = "active" | "paused" | "sold_out";

export type PaymentMethod = "pay_on_pickup";

// --------------------------------
// AUTH
// --------------------------------

export type User = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type RegisterPayload = {
  full_name: string;
  phone: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

// --------------------------------
// BUSINESS
// --------------------------------

export type Business = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
};

export type BusinessMembership = {
  id: string;
  role: BusinessRole;
  status: string;
  business: Business;
};

export type BusinessAuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
  memberships: BusinessMembership[];
};

export type BusinessMeResponse = {
  user: User;
  memberships: BusinessMembership[];
};

export type BusinessRegisterPayload = {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  business_name: string;
  business_description?: string | null;
  business_logo_url?: string | null;
};

// --------------------------------
// BRANCH
// --------------------------------

export type Branch = {
  id: string;
  business_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** "HH:MM:SS" */
  opening_time: string | null;
  closing_time: string | null;
  created_at: string;
};

export type BranchCreatePayload = {
  business_id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
};

export type BranchUpdatePayload = {
  name?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
};

// --------------------------------
// PRODUCT
// --------------------------------

export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  base_price: Money;
  is_active: boolean;
  created_at: string;
};

export type ProductCreatePayload = {
  business_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  base_price: string;
};

export type ProductUpdatePayload = {
  name?: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  base_price?: string;
  is_active?: boolean;
};

// --------------------------------
// OFFER
// --------------------------------

/** Приватный ответ бизнеса: app/schemas/offer.py → OfferResponse. */
export type Offer = {
  id: string;
  branch_id: string;
  product_id: string | null;
  type: string;
  title: string;
  description: string | null;
  original_price: Money;
  sale_price: Money;
  quantity_total: number;
  quantity_remaining: number;
  pickup_start: string;
  pickup_end: string;
  status: OfferStatus | string;
  created_at: string;
};

/** Публичная витрина: app/schemas/offer.py → OfferPublicResponse. */
export type PublicOffer = {
  id: string;
  title: string;
  description: string | null;
  original_price: Money;
  sale_price: Money;
  quantity_remaining: number;
  pickup_start: string;
  pickup_end: string;
  type: string;
  status: string;
  product_id: string | null;
  product_name: string | null;
  product_image_url: string | null;
  category: string | null;
  branch_id: string;
  branch_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  business_id: string;
  business_name: string;
};

export type OfferCreatePayload = {
  branch_id: string;
  product_id: string | null;
  type: string;
  title: string;
  description?: string | null;
  original_price: string;
  sale_price: string;
  quantity_total: number;
  pickup_start: string;
  pickup_end: string;
};

export type OfferUpdatePayload = {
  title?: string;
  description?: string | null;
  original_price?: string;
  sale_price?: string;
  quantity_total?: number;
  pickup_start?: string;
  pickup_end?: string;
  status?: "active" | "paused";
};

// --------------------------------
// ORDER
// --------------------------------

export type OrderItem = {
  id: string;
  offer_id: string | null;
  offer_title: string;
  product_name: string | null;
  product_image_url: string | null;
  quantity: number;
  unit_price: Money;
  total_price: Money;
};

export type Order = {
  id: string;
  user_id: string;
  branch_id: string;
  business_name: string;
  branch_name: string;
  address: string;
  pickup_start: string;
  pickup_end: string;
  total_price: Money;
  payment_method: PaymentMethod | string;
  status: OrderStatus | string;
  pickup_code: string;
  created_at: string;
  picked_up_at: string | null;
  items: OrderItem[];
};

export type CheckoutItem = {
  offer_id: string;
  quantity: number;
};

export type CheckoutPayload = {
  items: CheckoutItem[];
  payment_method: PaymentMethod;
};

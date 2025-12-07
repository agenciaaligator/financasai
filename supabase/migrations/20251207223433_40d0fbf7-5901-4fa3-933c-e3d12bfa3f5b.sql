-- Remove coupon tables (coupons now managed via Stripe)
DROP TABLE IF EXISTS public.user_coupons;
DROP TABLE IF EXISTS public.discount_coupons;
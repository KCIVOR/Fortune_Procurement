-- Add item_type to supplier_products
-- DEFAULT 'goods' ensures all existing products are backward-compatible
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'goods'
    CHECK (item_type IN ('goods', 'services'));

-- Index for filtering in canvassing supplier assignment
CREATE INDEX IF NOT EXISTS idx_supplier_products_item_type
  ON public.supplier_products (item_type);

-- Backfill: explicit (redundant with DEFAULT but documents intent)
UPDATE public.supplier_products
  SET item_type = 'goods'
  WHERE item_type IS NULL;

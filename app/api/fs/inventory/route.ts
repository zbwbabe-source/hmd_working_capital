import { NextRequest, NextResponse } from 'next/server';
import { getInventoryMatrix, type InventoryBrandGroup } from '@/lib/inventory';

const VALID_BRANDS: InventoryBrandGroup[] = ['ALL', 'MLB', 'Discovery'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const brandParam = request.nextUrl.searchParams.get('brand') as InventoryBrandGroup | null;
    const brand = brandParam && VALID_BRANDS.includes(brandParam) ? brandParam : 'ALL';

    const data = await getInventoryMatrix(brand);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Inventory route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load inventory data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

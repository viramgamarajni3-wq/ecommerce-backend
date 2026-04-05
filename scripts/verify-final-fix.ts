import { db } from '../src/db';
import { ProductService } from '../src/services/product.service';

const data = {
  "status":"active",
  "is_featured":true,
  "is_digital":true,
  "name":"Perry Owens",
  "subtitle":"Sit velit et ut cum",
  "handle": "Endsadadas-sdsd-" + Date.now(),
  "description":"Voluptas et et paria",
  "price":823,
  "compare_at_price":595,
  "cost_price":571,
  "stock_quantity":935,
  "sku": "Sint22-" + Date.now(),
  "weight_grams":22,
  "length_mm":72,
  "width_mm":84,
  "height_mm":6,
  "origin_country":"dsds",
  "material":"dsd",
  "hs_code":"dsdsd",
  "category_id":"104e9e0a-f970-4af4-9a46-b48f92bf7783",
  "collection_id":"e5f9c099-0ecb-4d63-a4d8-4d8bd7ca0220",
  "vendor_id": "0b8264d6-1e10-402d-9486-75f634d0333e" // Valid Admin Vendor
};

async function test() {
  try {
    console.log("Testing createProduct with user curl data AND valid vendor_id...");
    const product = await ProductService.createProduct(data);
    console.log("SUCCESS! Product created with ID:", product.id);
    
    // Check if inventory item was created
    const invRes = await db.query(
      "SELECT ii.* FROM inventory_items ii JOIN product_variant_inventory_items pvii ON ii.id = pvii.inventory_item_id JOIN product_variants pv ON pv.id = pvii.variant_id WHERE pv.product_id = $1",
      [product.id]
    );
    if (invRes.rows[0]) {
      console.log("Success: Inventory item created automatically with correct dimensions:", {
        weight: invRes.rows[0].weight,
        length: invRes.rows[0].length,
        height: invRes.rows[0].height,
        width: invRes.rows[0].width
      });
    } else {
      console.log("Error: Inventory item was NOT created.");
    }
  } catch (err: any) {
    console.error("Test failed:", err.message);
  }
  process.exit(0);
}

test();

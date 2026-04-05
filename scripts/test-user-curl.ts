import { db } from '../src/db';
import { ProductService } from '../src/services/product.service';

const data = {
  "status":"active",
  "is_featured":true,
  "is_digital":true,
  "name":"Perry Owens",
  "subtitle":"Sit velit et ut cum",
  "handle":"Endsadadas-sdsd",
  "description":"Voluptas et et paria",
  "price":823,
  "compare_at_price":595,
  "cost_price":571,
  "stock_quantity":935,
  "sku":"Sint22",
  "weight_grams":22,
  "length_mm":72,
  "width_mm":84,
  "height_mm":6,
  "origin_country":"dsds",
  "material":"dsd",
  "hs_code":"dsdsd",
  "category_id":"104e9e0a-f970-4af4-9a46-b48f92bf7783",
  "collection_id":"e5f9c099-0ecb-4d63-a4d8-4d8bd7ca0220"
};

async function test() {
  try {
    console.log("Testing createProduct with user curl data but MISSING vendor_id...");
    const product = await ProductService.createProduct(data);
    console.log("Success:", product.id);
  } catch (err: any) {
    console.error("Error Message:", err.message);
    if (err.message.includes('null value in column "vendor_id" violates not-null constraint')) {
      console.log("\nFound the issue: vendor_id is NOT NULL in the database but was not provided in the request.");
    }
  }
  process.exit(0);
}

test();

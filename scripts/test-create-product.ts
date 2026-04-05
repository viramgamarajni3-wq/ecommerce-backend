import { db } from '../src/db';
import { ProductService } from '../src/services/product.service';

const data = {
  "name": "test final",
  "description": "test",
  "short_description": "test",
  "price": 2,
  "stock_quantity": 2,
  "weight_grams": 2,
  "length_mm": 2,
  "height_mm": 2,
  "width_mm": 2,
  "hs_code": "test",
  "material": "test",
  "origin_country": "test",
  "mid_code": "test",
  "category_id": "104e9e0a-f970-4af4-9a46-b48f92bf7783",
  "collection_id": "c1613eb4-78dd-4f81-8857-81498b3c9451",
  "vendor_id": "a7c2cce3-dabf-47de-9e76-fad70612cfef"
};

async function test() {
  try {
    console.log("Testing ProductService.createProduct...");
    const product = await ProductService.createProduct(data);
    console.log("Success:", product.id);
  } catch (err: any) {
    console.error("Error Message:", err.message);
    console.error("Error Detail:", err.detail);
    console.error("Error Table:", err.table);
    console.error("Error Stack:", err.stack);
  }
  process.exit(0);
}

test();

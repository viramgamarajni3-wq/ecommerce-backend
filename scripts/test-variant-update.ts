import { db } from "../src/db";
import { ProductService } from "../src/services/product.service";

async function test() {
  try {
    const vid = "c089913a-7c43-4f19-8d43-07b164b8460d"; // Default Variant
    const updated = await ProductService.updateVariant(vid, { thumbnail_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg" });
    console.log("Updated:", updated);
    
    const res = await db.query("SELECT id, title, thumbnail_url, image_url FROM product_variants WHERE id = $1", [vid]);
    console.log("Final DB value:", res.rows[0]);
  } catch (e: any) {
    console.error(e);
  } finally {
    await db.end();
  }
}

test();

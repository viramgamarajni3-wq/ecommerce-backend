import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(__dirname, "../.env") })

console.log("[ENV] Environment variables loaded from .env")

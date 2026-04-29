import type { Recipe } from "../../core/index.js";

const MAX_DECODED_BYTES = 16 * 1024;

type Bytes = Uint8Array<ArrayBuffer>;

function bytesToBase64Url(bytes: Bytes): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlToBytes(s: string): Bytes {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function gzip(bytes: Bytes): Promise<Bytes> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Bytes): Promise<Bytes> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeRecipeHash(recipe: Recipe): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(recipe));
  const gz = await gzip(json);
  return bytesToBase64Url(gz);
}

export async function decodeRecipeHash(s: string): Promise<Recipe> {
  const gz = base64UrlToBytes(s);
  const json = await gunzip(gz);
  if (json.byteLength > MAX_DECODED_BYTES) throw new Error(`URL-hash payload exceeds 16 KB cap (${json.byteLength} bytes)`);
  const recipe = JSON.parse(new TextDecoder().decode(json)) as Recipe;
  if (recipe.schema_version !== "2.0") {
    throw new Error(`URL-hash recipe is schema_version "${recipe.schema_version}", expected "2.0".`);
  }
  return recipe;
}

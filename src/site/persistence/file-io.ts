import type { Recipe } from "../../core/index.js";

export function saveRecipeAsFile(recipe: Recipe, filename: string): void {
  const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".bread.json") ? filename : `${filename}.bread.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readRecipeFile(file: File): Promise<Recipe> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result as string) as Recipe); }
      catch (e) { reject(e as Error); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

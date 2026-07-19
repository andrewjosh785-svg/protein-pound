import { ImageResponse } from "@vercel/og";
import { fetchMealBySlug } from "./_shared";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const meal = slug ? await fetchMealBySlug(slug) : null;

  const name = meal?.name ?? "Protein/Pound";
  const sub = meal
    ? `${meal.protein_g}g protein / serving · ${meal.kcal} kcal · serves ${meal.servings}`
    : "High-protein UK meals ranked by what they actually cost at the till";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#F7F6F1",
          color: "#1C2331",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
          <span>PROTEIN</span>
          <span style={{ color: "#D62828" }}>/</span>
          <span>POUND</span>
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, marginTop: 32, lineHeight: 1.1 }}>{name}</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 24, color: "#555b66" }}>{sub}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

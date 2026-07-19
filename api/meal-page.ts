import { BOT_UA, escapeHtml, fetchMealBySlug, type ShareMeal } from "./_shared";

export const config = { runtime: "edge" };

function renderShareHtml(meal: ShareMeal, pageUrl: string, imageUrl: string): string {
  const title = `${meal.name} — Protein/Pound`;
  const description = `${meal.protein_g}g protein / serving · serves ${meal.servings} · ${meal.description}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imageUrl}">
</head>
<body></body>
</html>`;
}

// Vercel rewrites /meals/:slug here for every request. Bots get a pre-rendered share
// shell; everything else (real browsers) gets the normal SPA shell so client-side
// routing takes over exactly as it does for any other path.
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";

  if (slug && BOT_UA.test(userAgent)) {
    const meal = await fetchMealBySlug(slug);
    if (meal) {
      const imageUrl = `${url.origin}/api/og?slug=${encodeURIComponent(slug)}`;
      const pageUrl = `${url.origin}/meals/${encodeURIComponent(slug)}`;
      return new Response(renderShareHtml(meal, pageUrl, imageUrl), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  const indexRes = await fetch(new URL("/index.html", url.origin));
  const body = await indexRes.text();
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

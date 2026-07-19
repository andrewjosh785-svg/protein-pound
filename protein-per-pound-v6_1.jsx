import { useState, useMemo } from "react";

// ---------------------------------------------------------------
// PROTEIN / POUND — prototype v6
// New: ✨ AI recipe generator. Describe what you fancy and the
// app calls the Claude API to invent a recipe using only the
// priced ingredient database — so it arrives already costed at
// all four supermarkets, with macros and a method. Save it and
// it joins the meal rankings with an AI badge.
// Prices are illustrative sample data.
// Store order: [Tesco, Aldi, Asda, Sainsbury's]
// ---------------------------------------------------------------

const STORES = ["Tesco", "Aldi", "Asda", "Sainsbury's"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const INGREDIENTS = {
  chickenThigh: { name: "Chicken thigh fillets", pack: "1kg", prices: [4.9, 4.29, 4.75, 5.25] },
  chickenBreast: { name: "Chicken breast fillets", pack: "1kg", prices: [6.5, 5.79, 6.25, 6.75] },
  turkeyMince: { name: "2% fat turkey mince", pack: "500g", prices: [3.25, 2.89, 3.0, 3.5] },
  mince: { name: "5% fat beef mince", pack: "500g", prices: [3.5, 2.99, 3.25, 3.75] },
  fish: { name: "Frozen white fish fillets", pack: "520g", prices: [3.75, 3.29, 3.5, 4.0] },
  tuna: { name: "Tuna chunks in brine", pack: "4 × 145g", prices: [3.4, 2.99, 3.2, 3.6] },
  sardines: { name: "Sardines in tomato sauce", pack: "120g tin", prices: [0.85, 0.69, 0.75, 0.9] },
  eggs: { name: "Eggs", pack: "12 pack", prices: [2.65, 2.29, 2.45, 2.8] },
  tofu: { name: "Firm tofu", pack: "396g", prices: [1.85, 1.59, 1.75, 2.0] },
  greekYog: { name: "Fat-free Greek yoghurt", pack: "1kg", prices: [2.85, 2.19, 2.5, 2.95] },
  cottage: { name: "Cottage cheese", pack: "300g", prices: [1.2, 0.95, 1.1, 1.25] },
  milk: { name: "Semi-skimmed milk", pack: "2 pints", prices: [1.2, 1.15, 1.2, 1.25] },
  lentils: { name: "Red split lentils", pack: "1kg", prices: [1.85, 1.45, 1.65, 1.9] },
  chickpeas: { name: "Chickpeas", pack: "400g tin", prices: [0.65, 0.49, 0.55, 0.7] },
  kidneyBeans: { name: "Kidney beans", pack: "400g tin", prices: [0.6, 0.45, 0.5, 0.65] },
  pb: { name: "Peanut butter", pack: "340g", prices: [1.6, 1.19, 1.4, 1.75] },
  oats: { name: "Porridge oats", pack: "1kg", prices: [1.1, 0.9, 1.0, 1.2] },
  rice: { name: "Long grain rice", pack: "1kg", prices: [1.55, 1.29, 1.45, 1.65] },
  pasta: { name: "Wholewheat pasta", pack: "500g", prices: [0.75, 0.59, 0.69, 0.85] },
  noodles: { name: "Egg noodles", pack: "250g", prices: [0.9, 0.75, 0.85, 1.0] },
  wraps: { name: "Tortilla wraps", pack: "8 pack", prices: [1.05, 0.89, 0.95, 1.15] },
  bread: { name: "Wholemeal bread", pack: "800g loaf", prices: [0.95, 0.75, 0.85, 1.05] },
  potatoes: { name: "White potatoes", pack: "2.5kg", prices: [1.5, 1.29, 1.4, 1.6] },
  frozenVeg: { name: "Frozen mixed vegetables", pack: "1kg", prices: [1.3, 1.09, 1.2, 1.4] },
  toms: { name: "Chopped tomatoes", pack: "400g tin", prices: [0.55, 0.41, 0.47, 0.6] },
  onions: { name: "Onions", pack: "1kg", prices: [0.95, 0.79, 0.85, 1.0] },
  banana: { name: "Bananas", pack: "1kg", prices: [0.9, 0.82, 0.87, 0.95] },
  pantry: { name: "Oil, spices & sauces", pack: "store cupboard", prices: [2.0, 2.0, 2.0, 2.0] },
};

const SNACKS = [
  { name: "Bowl of cereal & milk", kcal: 260, protein: 9, cost: 0.4 },
  { name: "Meal deal (sandwich, snack, drink)", kcal: 650, protein: 24, cost: 3.6 },
  { name: "Toast with butter (2 slices)", kcal: 240, protein: 7, cost: 0.2 },
  { name: "Protein bar", kcal: 210, protein: 20, cost: 1.5 },
  { name: "Protein shake (whey + water)", kcal: 120, protein: 24, cost: 0.7 },
  { name: "Banana", kcal: 95, protein: 1, cost: 0.15 },
  { name: "Apple", kcal: 80, protein: 0, cost: 0.3 },
  { name: "Yoghurt pot", kcal: 130, protein: 12, cost: 0.6 },
  { name: "Packet of crisps", kcal: 165, protein: 2, cost: 0.75 },
  { name: "Chocolate bar", kcal: 230, protein: 3, cost: 0.85 },
  { name: "Biscuits (2)", kcal: 150, protein: 2, cost: 0.15 },
  { name: "Sausage roll", kcal: 330, protein: 10, cost: 1.3 },
  { name: "Latte (medium)", kcal: 190, protein: 10, cost: 3.4 },
  { name: "Can of fizzy drink", kcal: 140, protein: 0, cost: 1.0 },
  { name: "Pint of lager", kcal: 200, protein: 1, cost: 5.2 },
  { name: "Takeaway (average portion)", kcal: 1000, protein: 35, cost: 9.5 },
];

const AMOUNTS = [
  [0.1, "1/10 pack"], [0.15, "0.15 pack"], [0.2, "1/5 pack"], [0.25, "¼ pack"],
  [0.33, "⅓ pack"], [0.5, "½ pack"], [0.6, "0.6 pack"], [0.75, "¾ pack"],
  [1, "1 pack"], [1.5, "1½ packs"], [2, "2 packs"], [3, "3 packs"],
];

const qtyLabel = (frac) => {
  const found = AMOUNTS.find(([v]) => v === frac);
  return found ? found[1] : `${frac} pack`;
};

// uses: [ingredientKey, fraction of pack, human quantity]
const MEALS = [
  {
    id: "traybake", name: "Chicken thigh & veg traybake", servings: 4,
    protein: 38, kcal: 520, veggie: false, time: "50 min",
    desc: "Thighs roasted over rice and frozen veg. One tray, minimal washing up.",
    uses: [["chickenThigh", 0.6, "600g"], ["rice", 0.3, "300g"], ["frozenVeg", 0.5, "500g"], ["onions", 0.2, "2 onions"], ["pantry", 0.08, "oil & seasoning"]],
    method: [
      "Heat the oven to 200°C fan. Season the thighs well with oil, salt, pepper and any spices you like.",
      "Tip the rice into a deep roasting tray with 600ml boiling water and a pinch of salt. Scatter over the frozen veg and sliced onions.",
      "Sit the thighs on top, cover tightly with foil and roast for 30 minutes.",
      "Remove the foil and roast 15 more minutes until the chicken is browned and the rice has absorbed the water.",
      "Rest 5 minutes, fluff the rice and serve. Portions freeze well.",
    ],
  },
  {
    id: "lentilCurry", name: "Lentil & chickpea curry", servings: 4,
    protein: 24, kcal: 460, veggie: true, time: "35 min",
    desc: "Storecupboard curry with rice. Freezes brilliantly, costs pennies.",
    uses: [["lentils", 0.3, "300g"], ["chickpeas", 2, "2 tins"], ["toms", 1, "1 tin"], ["onions", 0.25, "2 onions"], ["rice", 0.3, "300g"], ["pantry", 0.1, "curry spices & oil"]],
    method: [
      "Soften the chopped onions in oil for 5 minutes, then add 2 tbsp curry powder and cook 1 minute.",
      "Add the lentils, tomatoes and 700ml water. Simmer 20 minutes, stirring now and then, until the lentils are soft.",
      "Stir in the drained chickpeas and simmer 5 more minutes. Season to taste.",
      "Meanwhile cook the rice in boiling salted water for 12 minutes and drain.",
      "Serve the curry over rice. Freezes in portions for up to 3 months.",
    ],
  },
  {
    id: "tunaBake", name: "Tuna pasta bake", servings: 3,
    protein: 34, kcal: 490, veggie: false, time: "35 min",
    desc: "Three tins of tuna, tomato sauce, wholewheat pasta.",
    uses: [["tuna", 0.75, "3 tins"], ["pasta", 0.6, "300g"], ["toms", 1, "1 tin"], ["onions", 0.15, "1 onion"], ["pantry", 0.06, "oil & herbs"]],
    method: [
      "Cook the pasta 2 minutes short of the packet time and drain, keeping a mug of pasta water.",
      "Fry the chopped onion in oil until soft, add the tomatoes and a splash of pasta water, and simmer 5 minutes.",
      "Stir in the drained tuna and the pasta. Season with salt, pepper and dried herbs.",
      "Tip into a baking dish and bake at 200°C fan for 12–15 minutes until bubbling at the edges.",
    ],
  },
  {
    id: "yogBowl", name: "Greek yoghurt power bowl", servings: 1,
    protein: 28, kcal: 420, veggie: true, time: "5 min",
    desc: "Yoghurt, oats, peanut butter and banana. 5-minute breakfast.",
    uses: [["greekYog", 0.25, "250g"], ["oats", 0.06, "60g"], ["pb", 0.06, "20g"], ["banana", 0.15, "1 banana"]],
    method: [
      "Spoon the yoghurt into a bowl and stir through the oats.",
      "Slice the banana over the top.",
      "Finish with a spoonful of peanut butter. Add a drizzle of honey if you have it.",
    ],
  },
  {
    id: "friedRice", name: "Egg & veg fried rice", servings: 2,
    protein: 22, kcal: 480, veggie: true, time: "15 min",
    desc: "Four eggs scrambled through rice and veg with soy sauce.",
    uses: [["eggs", 0.34, "4 eggs"], ["rice", 0.25, "250g"], ["frozenVeg", 0.4, "400g"], ["pantry", 0.06, "soy sauce & oil"]],
    method: [
      "Cook the rice (or use leftover cold rice — even better).",
      "Get a large frying pan or wok very hot with a little oil and stir-fry the frozen veg for 3 minutes.",
      "Push the veg aside, crack in the eggs and scramble them in the pan.",
      "Add the rice and 2 tbsp soy sauce, and stir-fry everything together for 3–4 minutes.",
    ],
  },
  {
    id: "chilli", name: "Lean beef chilli", servings: 4,
    protein: 30, kcal: 510, veggie: false, time: "45 min",
    desc: "5% mince bulked with beans — more protein, lower cost per serving.",
    uses: [["mince", 1, "500g"], ["kidneyBeans", 1.5, "1½ tins"], ["toms", 2, "2 tins"], ["onions", 0.25, "2 onions"], ["rice", 0.35, "350g"], ["pantry", 0.1, "chilli spices"]],
    method: [
      "Brown the mince in a large pan over high heat, breaking it up. Add the chopped onions and cook 5 minutes.",
      "Stir in 1 tbsp each of cumin, paprika and chilli powder and cook 1 minute.",
      "Add the tomatoes and drained beans, and simmer gently for 25–30 minutes.",
      "Cook the rice for the last 12 minutes.",
      "Season the chilli and serve over rice. Even better the next day.",
    ],
  },
  {
    id: "cottageToast", name: "Cottage cheese & eggs on toast", servings: 1,
    protein: 32, kcal: 430, veggie: true, time: "10 min",
    desc: "Two slices, two eggs, half a tub of cottage cheese.",
    uses: [["cottage", 0.5, "150g"], ["bread", 0.15, "2 slices"], ["eggs", 0.17, "2 eggs"]],
    method: [
      "Toast the bread.",
      "Soft-boil or fry the eggs — about 6 minutes for jammy boiled eggs.",
      "Spread the cottage cheese thickly on the toast, top with the eggs and plenty of black pepper.",
    ],
  },
  {
    id: "fishRice", name: "Baked fish, rice & greens", servings: 2,
    protein: 30, kcal: 440, veggie: false, time: "25 min",
    desc: "Frozen white fish is one of the cheapest lean proteins going.",
    uses: [["fish", 0.9, "2 large fillets"], ["rice", 0.25, "250g"], ["frozenVeg", 0.4, "400g"], ["pantry", 0.06, "oil, lemon & pepper"]],
    method: [
      "Heat the oven to 200°C fan. Put the fish (straight from frozen is fine) on a lined tray, rub with oil, salt and pepper.",
      "Bake for 18–20 minutes until the fish flakes easily.",
      "Meanwhile cook the rice, adding the frozen veg to the pan for the last 4 minutes.",
      "Drain, plate up and serve the fish on top with a squeeze of lemon if you have one.",
    ],
  },
  {
    id: "tofuStir", name: "Crispy tofu stir-fry", servings: 2,
    protein: 22, kcal: 430, veggie: true, time: "25 min",
    desc: "Whole block of tofu, pan-fried until golden, over rice.",
    uses: [["tofu", 1, "1 block"], ["rice", 0.25, "250g"], ["frozenVeg", 0.5, "500g"], ["pantry", 0.08, "soy, cornflour & oil"]],
    method: [
      "Press the tofu between kitchen paper for 10 minutes, then cut into cubes and toss in 1 tbsp cornflour.",
      "Start the rice cooking.",
      "Fry the tofu in a hot pan with oil for 8–10 minutes, turning until golden on all sides. Set aside.",
      "Stir-fry the veg 3 minutes, return the tofu, add 2 tbsp soy sauce and toss. Serve over the rice.",
    ],
  },
  {
    id: "onOats", name: "Peanut butter overnight oats", servings: 1,
    protein: 20, kcal: 410, veggie: true, time: "5 min + overnight",
    desc: "Made the night before with milk, yoghurt and peanut butter.",
    uses: [["oats", 0.08, "80g"], ["milk", 0.18, "200ml"], ["pb", 0.08, "25g"], ["greekYog", 0.1, "100g"]],
    method: [
      "Stir the oats, milk, yoghurt and peanut butter together in a jar or tub.",
      "Cover and refrigerate overnight (or at least 4 hours).",
      "Loosen with a splash of milk in the morning. Keeps 2–3 days, so make a few at once.",
    ],
  },
  {
    id: "turkeyRagu", name: "Turkey mince ragu & pasta", servings: 4,
    protein: 32, kcal: 500, veggie: false, time: "35 min",
    desc: "2% turkey mince is leaner and cheaper per gram of protein than beef.",
    uses: [["turkeyMince", 1, "500g"], ["pasta", 0.6, "300g"], ["toms", 2, "2 tins"], ["onions", 0.25, "2 onions"], ["pantry", 0.1, "herbs, garlic & oil"]],
    method: [
      "Soften the chopped onions in oil, then add the turkey mince and brown it, breaking it up.",
      "Add the tomatoes, a tin of water, dried herbs and seasoning. Simmer 20 minutes until thick.",
      "Cook the pasta for the last 10 minutes and drain.",
      "Toss the pasta through the ragu with a splash of pasta water.",
    ],
  },
  {
    id: "sardinesToast", name: "Sardines on toast", servings: 1,
    protein: 22, kcal: 380, veggie: false, time: "5 min",
    desc: "The classic budget protein hit — plus omega-3 and calcium.",
    uses: [["sardines", 1, "1 tin"], ["bread", 0.15, "2 slices"], ["pantry", 0.02, "black pepper"]],
    method: [
      "Toast the bread.",
      "Warm the sardines in their sauce for a minute in a small pan or the microwave.",
      "Pile onto the toast, mash lightly with a fork and add plenty of black pepper.",
    ],
  },
  {
    id: "jacketTuna", name: "Jacket potato, tuna & cottage cheese", servings: 2,
    protein: 30, kcal: 450, veggie: false, time: "15 min (microwave)",
    desc: "Microwave the spuds if you're short on time. Huge and filling.",
    uses: [["potatoes", 0.25, "2 large potatoes"], ["tuna", 0.5, "2 tins"], ["cottage", 0.5, "150g"], ["pantry", 0.03, "pepper & vinegar"]],
    method: [
      "Prick the potatoes and microwave on high for 8–10 minutes until soft (or bake 1 hour at 200°C for crispy skins).",
      "Mix the drained tuna with the cottage cheese, black pepper and a dash of vinegar or lemon.",
      "Split the potatoes, fluff the insides and pile the tuna mix on top.",
    ],
  },
  {
    id: "chickenCurry", name: "Chicken & chickpea curry", servings: 4,
    protein: 35, kcal: 520, veggie: false, time: "40 min",
    desc: "Thighs stretched further with chickpeas. Better than a takeaway.",
    uses: [["chickenThigh", 0.5, "500g"], ["chickpeas", 1.5, "1½ tins"], ["toms", 1, "1 tin"], ["onions", 0.25, "2 onions"], ["rice", 0.35, "350g"], ["pantry", 0.1, "curry spices & oil"]],
    method: [
      "Brown the diced chicken thighs in oil over high heat, then remove.",
      "Soften the chopped onions in the same pan, add 2 tbsp curry powder and cook 1 minute.",
      "Return the chicken with the tomatoes, drained chickpeas and half a tin of water. Simmer 20 minutes.",
      "Cook the rice for the last 12 minutes, then serve.",
    ],
  },
  {
    id: "beanChilli", name: "Three-bean chilli", servings: 4,
    protein: 20, kcal: 430, veggie: true, time: "35 min",
    desc: "Vegan, freezer-friendly and about as cheap as dinner gets.",
    uses: [["kidneyBeans", 2, "2 tins"], ["chickpeas", 1, "1 tin"], ["toms", 2, "2 tins"], ["onions", 0.25, "2 onions"], ["rice", 0.35, "350g"], ["pantry", 0.1, "chilli spices"]],
    method: [
      "Soften the chopped onions in oil, then add 1 tbsp each of cumin, paprika and chilli powder.",
      "Add the tomatoes and all the drained beans, and simmer 20–25 minutes until rich and thick.",
      "Cook the rice for the last 12 minutes.",
      "Season generously and serve. Freezes brilliantly in portions.",
    ],
  },
  {
    id: "pancakes", name: "Banana protein pancakes", servings: 2,
    protein: 24, kcal: 440, veggie: true, time: "20 min",
    desc: "Oats, eggs and banana blitzed into a batter, topped with yoghurt.",
    uses: [["oats", 0.12, "120g"], ["eggs", 0.25, "3 eggs"], ["banana", 0.25, "2 bananas"], ["greekYog", 0.15, "150g"]],
    method: [
      "Blitz the oats, eggs and bananas into a smooth batter (a blender or stick blender works).",
      "Heat a non-stick pan with a little oil and fry small pancakes 2 minutes per side.",
      "Stack and top with the Greek yoghurt and any fruit you have.",
    ],
  },
  {
    id: "shakshuka", name: "Chickpea shakshuka", servings: 2,
    protein: 24, kcal: 420, veggie: true, time: "25 min",
    desc: "Eggs baked in spiced tomatoes and chickpeas, bread for dipping.",
    uses: [["eggs", 0.33, "4 eggs"], ["chickpeas", 1, "1 tin"], ["toms", 2, "2 tins"], ["onions", 0.2, "1 onion"], ["bread", 0.2, "3 slices"], ["pantry", 0.06, "paprika & cumin"]],
    method: [
      "Soften the chopped onion in oil, add 1 tsp each paprika and cumin, then the tomatoes and drained chickpeas.",
      "Simmer 10 minutes until thickened, then make 4 wells in the sauce.",
      "Crack an egg into each well, cover and cook 5–7 minutes until the whites are set.",
      "Serve straight from the pan with toasted bread for dipping.",
    ],
  },
  {
    id: "peanutNoodles", name: "Peanut tofu noodles", servings: 2,
    protein: 24, kcal: 520, veggie: true, time: "20 min",
    desc: "Peanut butter, soy and a splash of pasta water make the sauce.",
    uses: [["tofu", 1, "1 block"], ["noodles", 0.8, "200g"], ["pb", 0.15, "50g"], ["frozenVeg", 0.4, "400g"], ["pantry", 0.06, "soy & chilli flakes"]],
    method: [
      "Cube and fry the tofu in a hot oiled pan until golden, about 8 minutes.",
      "Cook the noodles, adding the frozen veg for the last 3 minutes. Keep a mug of the water.",
      "Whisk the peanut butter with 2 tbsp soy sauce and enough noodle water to make a pourable sauce.",
      "Toss everything together and finish with chilli flakes.",
    ],
  },
  {
    id: "fajitaWraps", name: "Chicken fajita wraps", servings: 3,
    protein: 35, kcal: 480, veggie: false, time: "20 min",
    desc: "Sliced breast, charred onions, warm wraps. Batch it for lunches.",
    uses: [["chickenBreast", 0.45, "450g"], ["wraps", 0.5, "4 wraps"], ["onions", 0.3, "2 onions"], ["pantry", 0.08, "fajita spices & oil"]],
    method: [
      "Slice the chicken and onions. Toss the chicken in 1 tbsp fajita spice mix (paprika, cumin, chilli, garlic).",
      "Get a pan very hot with oil and cook the chicken 5–6 minutes until charred and cooked through. Set aside.",
      "Cook the onions in the same pan until softened and browned at the edges.",
      "Warm the wraps, fill and roll. Cold ones make a great packed lunch.",
    ],
  },
];

const money = (n) => "£" + n.toFixed(2);

function usesCost(uses, storeIdx) {
  return uses.reduce((sum, [key, frac]) => {
    const ing = INGREDIENTS[key];
    const price = storeIdx === -1 ? Math.min(...ing.prices) : ing.prices[storeIdx];
    return sum + price * frac;
  }, 0);
}

const emptyWeek = () => Object.fromEntries(DAYS.map((d) => [d, {}]));
const emptyExtras = () => Object.fromEntries(DAYS.map((d) => [d, []]));

export default function ProteinPerPound() {
  const [tab, setTab] = useState("meals");
  const [store, setStore] = useState(-1);
  const [sortBy, setSortBy] = useState("value");
  const [veggieOnly, setVeggieOnly] = useState(false);
  const [openMeal, setOpenMeal] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);
  const [customMeals, setCustomMeals] = useState([]);

  const [week, setWeek] = useState(emptyWeek);
  const [extras, setExtras] = useState(emptyExtras);
  const [addDay, setAddDay] = useState("Mon");

  const [qDay, setQDay] = useState("Mon");
  const [qName, setQName] = useState("");
  const [qKcal, setQKcal] = useState(300);
  const [qProtein, setQProtein] = useState(10);
  const [qCost, setQCost] = useState(1.5);

  const [budget, setBudget] = useState(30);
  const [kcalTarget, setKcalTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(120);

  const [rName, setRName] = useState("");
  const [rServings, setRServings] = useState(2);
  const [rProtein, setRProtein] = useState(25);
  const [rKcal, setRKcal] = useState(450);
  const [rVeggie, setRVeggie] = useState(false);
  const [rItems, setRItems] = useState([["chickenThigh", 0.5]]);
  const [rMethod, setRMethod] = useState("");

  // AI recipe generator
  const [gPrompt, setGPrompt] = useState("");
  const [gLoading, setGLoading] = useState(false);
  const [gError, setGError] = useState("");
  const [gRecipe, setGRecipe] = useState(null);

  const allMeals = useMemo(() => [...MEALS, ...customMeals], [customMeals]);
  const findMeal = (id) => allMeals.find((m) => m.id === id);

  const rows = useMemo(() => {
    let list = allMeals.filter((m) => !veggieOnly || m.veggie).map((m) => {
      const perServing = usesCost(m.uses, store) / m.servings;
      return { ...m, perServing, valuePerPound: perServing > 0 ? m.protein / perServing : 0 };
    });
    if (sortBy === "value") list.sort((a, b) => b.valuePerPound - a.valuePerPound);
    if (sortBy === "cheap") list.sort((a, b) => a.perServing - b.perServing);
    if (sortBy === "protein") list.sort((a, b) => b.protein - a.protein);
    return list;
  }, [store, sortBy, veggieOnly, allMeals]);

  const dayStats = useMemo(() => {
    const stats = {};
    DAYS.forEach((d) => {
      let kcal = 0, protein = 0, mealCost = 0, extraCost = 0, count = 0;
      Object.entries(week[d]).forEach(([id, n]) => {
        const m = findMeal(id);
        if (!m) return;
        kcal += m.kcal * n;
        protein += m.protein * n;
        mealCost += (usesCost(m.uses, -1) / m.servings) * n;
        count += n;
      });
      extras[d].forEach((x) => {
        kcal += x.kcal * x.n;
        protein += x.protein * x.n;
        extraCost += x.cost * x.n;
        count += x.n;
      });
      stats[d] = { kcal, protein, mealCost, extraCost, count };
    });
    return stats;
  }, [week, extras, allMeals]);

  const totalItems = DAYS.reduce((s, d) => s + dayStats[d].count, 0);
  const daysPlanned = DAYS.filter((d) => dayStats[d].count > 0);
  const avgKcal = daysPlanned.length
    ? daysPlanned.reduce((s, d) => s + dayStats[d].kcal, 0) / daysPlanned.length : 0;
  const avgProtein = daysPlanned.length
    ? daysPlanned.reduce((s, d) => s + dayStats[d].protein, 0) / daysPlanned.length : 0;
  const daysOnTarget = daysPlanned.filter((d) => dayStats[d].kcal <= kcalTarget).length;
  const extrasSpend = DAYS.reduce((s, d) => s + dayStats[d].extraCost, 0);
  const extrasKcal = DAYS.reduce((s, d) =>
    s + extras[d].reduce((a, x) => a + x.kcal * x.n, 0), 0);

  const shopping = useMemo(() => {
    const need = {};
    DAYS.forEach((d) => {
      Object.entries(week[d]).forEach(([id, n]) => {
        const m = findMeal(id);
        if (!m) return;
        m.uses.forEach(([key, frac]) => {
          need[key] = (need[key] || 0) + (frac / m.servings) * n;
        });
      });
    });
    const items = Object.entries(need).map(([key, frac]) => ({
      key, ing: INGREDIENTS[key], packs: Math.ceil(frac - 0.0001),
    })).filter((i) => i.packs > 0);
    const totals = STORES.map((_, si) => items.reduce((s, i) => s + i.ing.prices[si] * i.packs, 0));
    return { items, totals };
  }, [week, allMeals]);

  const cheapestStore = shopping.totals.length ? shopping.totals.indexOf(Math.min(...shopping.totals)) : 0;
  const groceriesTotal = shopping.totals[cheapestStore] || 0;
  const weekSpend = groceriesTotal + extrasSpend;
  const budgetPct = budget > 0 ? Math.min((weekSpend / budget) * 100, 100) : 0;
  const overBudget = weekSpend > budget;

  const addServing = (day, id) =>
    setWeek((w) => ({ ...w, [day]: { ...w[day], [id]: (w[day][id] || 0) + 1 } }));
  const removeServing = (day, id) =>
    setWeek((w) => {
      const dayPlan = { ...w[day] };
      if (dayPlan[id] > 1) dayPlan[id] -= 1; else delete dayPlan[id];
      return { ...w, [day]: dayPlan };
    });

  const addExtra = (day, item) =>
    setExtras((e) => {
      const list = e[day].map((x) => ({ ...x }));
      const found = list.find((x) => x.name === item.name && x.kcal === item.kcal);
      if (found) found.n += 1;
      else list.push({ uid: Date.now() + Math.random(), ...item, n: 1 });
      return { ...e, [day]: list };
    });
  const removeExtra = (day, uid) =>
    setExtras((e) => {
      const list = e[day].map((x) => ({ ...x })).filter((x) => {
        if (x.uid !== uid) return true;
        x.n -= 1;
        return x.n > 0;
      });
      return { ...e, [day]: list };
    });

  const addCustomExtra = () => {
    if (!qName.trim()) return;
    addExtra(qDay, {
      name: qName.trim(),
      kcal: Math.max(0, qKcal),
      protein: Math.max(0, qProtein),
      cost: Math.max(0, qCost),
    });
    setQName("");
  };

  const recipeCosts = STORES.map((_, si) => usesCost(rItems, si));
  const recipeCheapest = rItems.length ? Math.min(...recipeCosts) : 0;
  const saveRecipe = () => {
    if (!rItems.length) return;
    setCustomMeals((c) => [...c, {
      id: "custom-" + Date.now(),
      name: rName.trim() || "My recipe",
      servings: Math.max(1, rServings),
      protein: Math.max(0, rProtein),
      kcal: Math.max(0, rKcal),
      veggie: rVeggie, custom: true, time: "—",
      desc: "Your own recipe, priced from the ingredient database.",
      uses: rItems.map((x) => [...x]),
      method: rMethod.split("\n").map((s) => s.trim()).filter(Boolean),
    }]);
    setTab("meals");
  };

  // ---- AI recipe generation via the Claude API ----
  const ingredientCatalogue = Object.entries(INGREDIENTS)
    .map(([k, ing]) => `${k} | ${ing.name} | pack: ${ing.pack} | cheapest £${Math.min(...ing.prices).toFixed(2)}`)
    .join("\n");

  const generateRecipe = async () => {
    if (!gPrompt.trim() || gLoading) return;
    setGLoading(true); setGError(""); setGRecipe(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You create cheap, healthy, high-protein UK recipes. You may ONLY use these ingredients (format: key | name | pack size | cheapest price):\n${ingredientCatalogue}\n\nUser request: "${gPrompt.trim()}"\n\nRespond with ONLY a raw JSON object — no markdown fences, no commentary:\n{"name": string, "desc": string (one appetising sentence), "servings": int, "protein": int (grams per serving), "kcal": int (per serving), "veggie": bool, "time": string (e.g. "30 min"), "uses": [[ingredientKey, fractionOfPackUsedByWholeRecipe, humanQuantity]], "method": [4-6 short cooking steps]}\n\nRules: fractions are of the stated pack size and cover the WHOLE recipe (all servings), e.g. 600g from a 1kg pack = 0.6, 2 tins = 2. humanQuantity is the real-world amount like "400g" or "2 tins" or "4 eggs". Keep macros realistic for the quantities used. Only use ingredient keys from the list above.`,
          }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const r = JSON.parse(clean);
      const uses = (Array.isArray(r.uses) ? r.uses : [])
        .filter((u) => Array.isArray(u) && INGREDIENTS[u[0]] && Number(u[1]) > 0)
        .map((u) => [u[0], Number(u[1]), String(u[2] || "")]);
      if (!uses.length) throw new Error("No valid ingredients in response");
      setGRecipe({
        name: String(r.name || "Generated recipe"),
        desc: String(r.desc || "AI-generated recipe."),
        servings: Math.max(1, Math.round(Number(r.servings) || 2)),
        protein: Math.max(0, Math.round(Number(r.protein) || 0)),
        kcal: Math.max(0, Math.round(Number(r.kcal) || 0)),
        veggie: !!r.veggie,
        time: String(r.time || "—"),
        uses,
        method: Array.isArray(r.method) ? r.method.map(String).filter(Boolean) : [],
      });
    } catch (err) {
      console.error("Recipe generation failed:", err);
      setGError("Couldn't generate a recipe that time — hit Generate again (the odd attempt needs a retry).");
    }
    setGLoading(false);
  };

  const saveGenerated = () => {
    if (!gRecipe) return;
    setCustomMeals((c) => [...c, { ...gRecipe, id: "gen-" + Date.now(), custom: true, generated: true }]);
    setGRecipe(null);
    setGPrompt("");
    setTab("meals");
  };

  const gCosts = gRecipe ? STORES.map((_, si) => usesCost(gRecipe.uses, si)) : null;
  const gCheapest = gCosts ? Math.min(...gCosts) : 0;
  const gPerServing = gRecipe ? gCheapest / gRecipe.servings : 0;

  const kcalBar = (kcal) => {
    const pct = Math.min((kcal / kcalTarget) * 100, 100);
    const over = kcal > kcalTarget;
    return (
      <div className="bar mini">
        <div className="barfill" style={{ width: `${pct}%`, background: over ? "var(--deal)" : "var(--green)" }} />
      </div>
    );
  };

  return (
    <div className="ppp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        .ppp-root {
          --paper:#F7F6F1; --ink:#1C2331; --tag:#FFD500; --deal:#D62828; --green:#20713F; --line:#D9D6CC;
          font-family:'Inter',system-ui,sans-serif; background:var(--paper); color:var(--ink);
          min-height:100vh; padding:0 0 64px;
        }
        .ppp-disp { font-family:'Barlow Condensed','Arial Narrow',sans-serif; }
        .hdr { border-bottom:3px solid var(--ink); padding:22px 20px 16px; display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; justify-content:space-between; }
        .hdr h1 { margin:0; font-size:clamp(30px,5vw,44px); line-height:.9; font-weight:800; text-transform:uppercase; letter-spacing:.5px; font-family:'Barlow Condensed',sans-serif; }
        .hdr h1 .slash { color:var(--deal); }
        .hdr p { margin:4px 0 0; font-size:13px; color:#555b66; max-width:360px; }
        .tabs { display:flex; gap:8px; flex-wrap:wrap; }
        .tabbtn { font-family:'Barlow Condensed',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:.6px;
          font-size:16px; padding:8px 14px; border:2px solid var(--ink); background:transparent; color:var(--ink); cursor:pointer; }
        .tabbtn.on { background:var(--ink); color:var(--paper); }
        .tabbtn .cnt { background:var(--tag); color:var(--ink); border-radius:10px; padding:0 7px; margin-left:6px; font-size:13px; }
        .ctrls { display:flex; flex-wrap:wrap; gap:10px; align-items:center; padding:14px 20px; border-bottom:1px solid var(--line); }
        .ctrls label, .fld label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; font-weight:600; color:#555b66; }
        .pill { font-size:13px; font-weight:600; padding:6px 12px; border:1.5px solid var(--ink); background:transparent; cursor:pointer; color:var(--ink); }
        .pill.on { background:var(--ink); color:var(--paper); }
        select, input[type=number], input[type=text], textarea { font:inherit; font-weight:600; font-size:13px; padding:6px 8px; border:1.5px solid var(--ink); background:#fff; color:var(--ink); }
        input[type=number] { width:80px; }
        textarea { font-weight:400; width:100%; max-width:520px; min-height:90px; }
        .grid { display:grid; gap:14px; padding:18px 20px; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); }
        .card { background:#fff; border:1.5px solid var(--ink); display:flex; flex-direction:column; }
        .card-top { padding:14px 14px 10px; flex:1; }
        .badges { display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
        .badge { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; padding:3px 7px; border:1px solid var(--ink); }
        .badge.v { border-color:var(--green); color:var(--green); }
        .badge.best { background:var(--deal); border-color:var(--deal); color:#fff; }
        .badge.cust { background:var(--ink); color:var(--paper); }
        .card h3 { margin:0 0 4px; font-size:24px; font-weight:700; line-height:1; font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; }
        .card .desc { font-size:12.5px; color:#555b66; margin:0 0 10px; line-height:1.45; }
        .stats { display:flex; gap:12px; font-size:12px; color:#555b66; flex-wrap:wrap; }
        .stats b { color:var(--ink); font-size:14px; }
        .tagrow { display:flex; align-items:stretch; border-top:1.5px solid var(--ink); }
        .sel { background:var(--tag); padding:8px 12px; flex:1; clip-path:polygon(0 0,100% 0,100% 100%,10px 100%,0 calc(100% - 10px)); }
        .sel .big { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:26px; line-height:1; }
        .sel .sm { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; }
        .valcell { padding:8px 12px; text-align:right; }
        .valcell .big { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:26px; line-height:1; color:var(--green); }
        .valcell .sm { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:#555b66; }
        .actions { display:flex; border-top:1.5px solid var(--ink); }
        .actions button { flex:1; font:inherit; font-weight:600; font-size:12.5px; padding:9px 2px; background:transparent; border:none; cursor:pointer; color:var(--ink); }
        .actions button + button { border-left:1.5px solid var(--ink); }
        .actions .add { background:var(--ink); color:var(--paper); }
        .brk { border-top:1px dashed var(--line); padding:10px 14px; font-size:12.5px; }
        .brk table { width:100%; border-collapse:collapse; }
        .brk th, .brk td { text-align:right; padding:3px 4px; font-weight:400; }
        .brk th:first-child, .brk td:first-child { text-align:left; }
        .brk th { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#555b66; border-bottom:1px solid var(--line); }
        .brk .lo { color:var(--green); font-weight:700; }
        .recipe { border-top:1px dashed var(--line); padding:10px 14px 14px; font-size:12.5px; }
        .recipe h4 { margin:0 0 6px; font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; font-size:16px; letter-spacing:.5px; }
        .recipe .time { font-size:11px; font-weight:700; color:var(--deal); text-transform:uppercase; letter-spacing:.6px; }
        .recipe ul { margin:6px 0 10px; padding-left:16px; }
        .recipe ul li { margin-bottom:2px; }
        .recipe ol { margin:6px 0 0; padding-left:18px; }
        .recipe ol li { margin-bottom:6px; line-height:1.45; }
        .listwrap { padding:18px 20px; }
        .totrow { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0 20px; max-width:860px; }
        .tot { border:1.5px solid var(--ink); background:#fff; padding:10px 12px; }
        .tot.win { background:var(--tag); }
        .tot .st { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; }
        .tot .pr { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:28px; line-height:1.1; }
        .tot .df { font-size:11px; color:#555b66; }
        .empty { border:1.5px dashed var(--ink); padding:36px 20px; text-align:center; color:#555b66; font-size:14px; max-width:860px; }
        .note { padding:20px; font-size:11px; color:#8a8f99; }
        .fldrow { display:flex; flex-wrap:wrap; gap:14px; margin:14px 0; align-items:flex-end; }
        .fld { display:flex; flex-direction:column; gap:4px; }
        .bar { height:14px; border:1.5px solid var(--ink); background:#fff; margin:6px 0 4px; }
        .bar.mini { height:8px; border-width:1px; margin:4px 0; }
        .barfill { height:100%; transition:width .3s; }
        .targets { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; margin:14px 0; max-width:860px; }
        .tcard { border:1.5px solid var(--ink); background:#fff; padding:10px 12px; font-size:12px; }
        .tcard .big { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:24px; line-height:1.1; }
        .ok { color:var(--green); } .bad { color:var(--deal); }
        .weekgrid { display:grid; gap:10px; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); margin:6px 0 20px; }
        .daycard { border:1.5px solid var(--ink); background:#fff; display:flex; flex-direction:column; }
        .daycard.over { border-color:var(--deal); }
        .dayhead { display:flex; justify-content:space-between; align-items:baseline; padding:8px 10px 4px; }
        .dayhead .dname { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:20px; text-transform:uppercase; }
        .dayhead .dcost { font-size:11px; color:#555b66; }
        .daybody { padding:0 10px 8px; flex:1; }
        .dentry { display:flex; align-items:center; gap:6px; font-size:12px; padding:4px 0; border-bottom:1px dashed var(--line); }
        .dentry .nm { flex:1; line-height:1.25; }
        .dentry .nm .zap { color:var(--deal); font-weight:700; }
        .dentry .kc { color:#555b66; white-space:nowrap; }
        .mini-btn { border:1px solid var(--ink); background:transparent; cursor:pointer; font-weight:700; font-size:12px;
          width:20px; height:20px; line-height:1; padding:0; color:var(--ink); }
        .dayfoot { padding:6px 10px 10px; border-top:1.5px solid var(--ink); font-size:12px; }
        .dayfoot .kcal { display:flex; justify-content:space-between; font-weight:600; }
        .dayfoot .left { font-size:11px; }
        .dayadd { width:100%; margin-top:6px; }
        .quickbox { border:1.5px solid var(--ink); background:#fff; padding:12px 14px; margin:0 0 16px; max-width:860px; }
        .quickbox h3 { margin:0 0 2px; font-family:'Barlow Condensed',sans-serif; text-transform:uppercase; font-size:20px; }
        .quickbox p { margin:0 0 8px; font-size:12px; color:#555b66; }
        .bwrap { padding:18px 20px; max-width:860px; }
        .irow { display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap; }
        .xbtn { border:1.5px solid var(--ink); background:transparent; cursor:pointer; font-weight:700; padding:4px 10px; color:var(--ink); }
        .bigbtn { font-family:'Barlow Condensed',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:.6px; font-size:16px;
          padding:10px 20px; border:2px solid var(--ink); background:var(--ink); color:var(--paper); cursor:pointer; }
        .bigbtn.alt { background:transparent; color:var(--ink); }
        @media (max-width:560px){ .totrow{grid-template-columns:repeat(2,1fr);} }
        button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline:3px solid var(--deal); outline-offset:2px; }
      `}</style>

      <header className="hdr">
        <div>
          <h1>Protein<span className="slash">/</span>Pound</h1>
          <p>High-protein meals ranked by what they actually cost at the till.</p>
        </div>
        <div className="tabs">
          <button className={`tabbtn ${tab === "meals" ? "on" : ""}`} onClick={() => setTab("meals")}>Meals</button>
          <button className={`tabbtn ${tab === "gen" ? "on" : ""}`} onClick={() => setTab("gen")}>✨ Generate</button>
          <button className={`tabbtn ${tab === "build" ? "on" : ""}`} onClick={() => setTab("build")}>Price my recipe</button>
          <button className={`tabbtn ${tab === "week" ? "on" : ""}`} onClick={() => setTab("week")}>
            My week{totalItems > 0 && <span className="cnt">{totalItems}</span>}
          </button>
        </div>
      </header>

      {/* ------------------------------ MEALS ------------------------------ */}
      {tab === "meals" && (
        <>
          <div className="ctrls">
            <label>Price at</label>
            <select value={store} onChange={(e) => setStore(Number(e.target.value))}>
              <option value={-1}>Cheapest mix</option>
              {STORES.map((s, i) => <option key={s} value={i}>{s}</option>)}
            </select>
            <label style={{ marginLeft: 6 }}>Sort</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="value">Best protein per £</option>
              <option value="cheap">Cheapest per serving</option>
              <option value="protein">Most protein</option>
            </select>
            <button className={`pill ${veggieOnly ? "on" : ""}`} onClick={() => setVeggieOnly(!veggieOnly)}>
              Vegetarian
            </button>
            <label style={{ marginLeft: 6 }}>Add servings to</label>
            <select value={addDay} onChange={(e) => setAddDay(e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid">
            {rows.map((m, idx) => (
              <div className="card" key={m.id}>
                <div className="card-top">
                  <div className="badges">
                    {idx === 0 && sortBy === "value" && <span className="badge best">Best value</span>}
                    {m.custom && <span className="badge cust">{m.generated ? "✨ AI" : "Yours"}</span>}
                    {m.veggie && <span className="badge v">Veggie</span>}
                    <span className="badge">{m.servings} servings</span>
                  </div>
                  <h3>{m.name}</h3>
                  <p className="desc">{m.desc}</p>
                  <div className="stats">
                    <span><b>{m.protein}g</b> protein / serving</span>
                    <span><b>{m.kcal}</b> kcal</span>
                    {m.time && m.time !== "—" && <span><b>{m.time}</b></span>}
                  </div>
                </div>
                <div className="tagrow">
                  <div className="sel">
                    <div className="big ppp-disp">{money(m.perServing)}</div>
                    <div className="sm">per serving · {store === -1 ? "cheapest mix" : STORES[store]}</div>
                  </div>
                  <div className="valcell">
                    <div className="big ppp-disp">{m.valuePerPound.toFixed(0)}g</div>
                    <div className="sm">protein per £1</div>
                  </div>
                </div>

                {openRecipe === m.id && (
                  <div className="recipe">
                    <h4>Recipe <span className="time">· {m.time || "—"} · serves {m.servings}</span></h4>
                    <ul>
                      {m.uses.map(([key, frac, qty]) => (
                        <li key={key}>
                          {qty || qtyLabel(frac)} {INGREDIENTS[key].name.toLowerCase()}
                        </li>
                      ))}
                    </ul>
                    {m.method && m.method.length > 0 ? (
                      <ol>
                        {m.method.map((step, i) => <li key={i}>{step}</li>)}
                      </ol>
                    ) : (
                      <div style={{ color: "#8a8f99" }}>No method saved for this recipe yet.</div>
                    )}
                  </div>
                )}

                {openMeal === m.id && (
                  <div className="brk">
                    <table>
                      <thead>
                        <tr><th>Ingredient</th>{STORES.map((s) => <th key={s}>{s.slice(0, 5)}</th>)}</tr>
                      </thead>
                      <tbody>
                        {m.uses.map(([key, frac]) => {
                          const ing = INGREDIENTS[key];
                          const costs = ing.prices.map((p) => p * frac);
                          const lo = Math.min(...costs);
                          return (
                            <tr key={key}>
                              <td>{ing.name}</td>
                              {costs.map((c, i) => (
                                <td key={i} className={c === lo ? "lo" : ""}>{money(c)}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="actions">
                  <button onClick={() => { setOpenRecipe(openRecipe === m.id ? null : m.id); if (openMeal === m.id) setOpenMeal(null); }}>
                    {openRecipe === m.id ? "Hide recipe" : "Recipe"}
                  </button>
                  <button onClick={() => { setOpenMeal(openMeal === m.id ? null : m.id); if (openRecipe === m.id) setOpenRecipe(null); }}>
                    {openMeal === m.id ? "Hide prices" : "Prices"}
                  </button>
                  <button className="add" onClick={() => addServing(addDay, m.id)}>
                    Add to {addDay}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --------------------------- AI GENERATOR --------------------------- */}
      {tab === "gen" && (
        <div className="bwrap">
          <h2 className="ppp-disp" style={{ textTransform: "uppercase", fontSize: 28, margin: "6px 0 2px" }}>
            ✨ Generate a recipe
          </h2>
          <p style={{ fontSize: 13, color: "#555b66", margin: "0 0 14px" }}>
            Describe what you fancy and Claude invents a recipe on the spot using the priced
            ingredient database — so it arrives already costed at all four supermarkets.
          </p>

          <div className="fldrow" style={{ alignItems: "flex-end" }}>
            <div className="fld" style={{ flex: 1, minWidth: 260 }}>
              <label>What do you fancy?</label>
              <input type="text" value={gPrompt} style={{ width: "100%" }}
                placeholder='e.g. "high-protein dinner under £1.50 a serving using chicken thighs"'
                onChange={(e) => setGPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generateRecipe(); }} />
            </div>
            <button className="bigbtn" onClick={generateRecipe} disabled={gLoading}
              style={gLoading ? { opacity: 0.6, cursor: "wait" } : {}}>
              {gLoading ? "Generating…" : "Generate"}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {[
              "Cheap veggie dinner, at least 25g protein",
              "Something with tuna I can batch cook for lunches",
              "A big breakfast under 400 kcal",
            ].map((ex) => (
              <button key={ex} className="pill" onClick={() => setGPrompt(ex)}>{ex}</button>
            ))}
          </div>

          {gError && (
            <div className="tcard" style={{ borderColor: "var(--deal)", marginBottom: 14 }}>
              <span className="bad" style={{ fontWeight: 600 }}>{gError}</span>
            </div>
          )}

          {gRecipe && (
            <div className="card" style={{ maxWidth: 620 }}>
              <div className="card-top">
                <div className="badges">
                  <span className="badge cust">✨ AI</span>
                  {gRecipe.veggie && <span className="badge v">Veggie</span>}
                  <span className="badge">{gRecipe.servings} servings</span>
                </div>
                <h3>{gRecipe.name}</h3>
                <p className="desc">{gRecipe.desc}</p>
                <div className="stats">
                  <span><b>{gRecipe.protein}g</b> protein / serving</span>
                  <span><b>{gRecipe.kcal}</b> kcal</span>
                  <span><b>{gRecipe.time}</b></span>
                </div>
              </div>
              <div className="tagrow">
                <div className="sel">
                  <div className="big ppp-disp">{money(gPerServing)}</div>
                  <div className="sm">per serving · cheapest mix</div>
                </div>
                <div className="valcell">
                  <div className="big ppp-disp">
                    {gPerServing > 0 ? (gRecipe.protein / gPerServing).toFixed(0) : 0}g
                  </div>
                  <div className="sm">protein per £1</div>
                </div>
              </div>
              <div className="recipe">
                <h4>Recipe <span className="time">· {gRecipe.time} · serves {gRecipe.servings}</span></h4>
                <ul>
                  {gRecipe.uses.map(([key, frac, qty]) => (
                    <li key={key}>{qty || qtyLabel(frac)} {INGREDIENTS[key].name.toLowerCase()}</li>
                  ))}
                </ul>
                {gRecipe.method.length > 0 && (
                  <ol>{gRecipe.method.map((step, i) => <li key={i}>{step}</li>)}</ol>
                )}
              </div>
              {gCosts && (
                <div className="brk">
                  <table>
                    <thead>
                      <tr>{STORES.map((s) => <th key={s}>{s}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr>
                        {gCosts.map((c, i) => (
                          <td key={i} className={c === gCheapest ? "lo" : ""}>{money(c)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <div className="actions">
                <button onClick={() => { setGRecipe(null); generateRecipe(); }}>Try another</button>
                <button onClick={() => setGRecipe(null)}>Discard</button>
                <button className="add" onClick={saveGenerated}>Save to my meals</button>
              </div>
            </div>
          )}

          {!gRecipe && !gLoading && !gError && (
            <div className="empty" style={{ maxWidth: 620 }}>
              Your generated recipe will appear here — priced per supermarket, with macros
              and a full method. Save it and it joins the meal rankings like any other recipe.
            </div>
          )}
        </div>
      )}

      {/* --------------------------- RECIPE BUILDER --------------------------- */}
      {tab === "build" && (
        <div className="bwrap">
          <h2 className="ppp-disp" style={{ textTransform: "uppercase", fontSize: 28, margin: "6px 0 2px" }}>
            Price my recipe
          </h2>
          <p style={{ fontSize: 13, color: "#555b66", margin: "0 0 14px" }}>
            Build a recipe from the ingredient database and see what it costs at each supermarket.
            Save it and it joins the meal rankings — method and all.
          </p>

          <div className="fldrow">
            <div className="fld">
              <label>Recipe name</label>
              <input type="text" value={rName} placeholder="e.g. Mum's chicken curry"
                onChange={(e) => setRName(e.target.value)} style={{ width: 220 }} />
            </div>
            <div className="fld">
              <label>Servings</label>
              <input type="number" min="1" value={rServings} onChange={(e) => setRServings(Number(e.target.value))} />
            </div>
            <div className="fld">
              <label>Protein / serving (g)</label>
              <input type="number" min="0" value={rProtein} onChange={(e) => setRProtein(Number(e.target.value))} />
            </div>
            <div className="fld">
              <label>Kcal / serving</label>
              <input type="number" min="0" value={rKcal} onChange={(e) => setRKcal(Number(e.target.value))} />
            </div>
            <div className="fld">
              <label>Vegetarian</label>
              <button className={`pill ${rVeggie ? "on" : ""}`} onClick={() => setRVeggie(!rVeggie)}>
                {rVeggie ? "Yes" : "No"}
              </button>
            </div>
          </div>

          <div style={{ margin: "10px 0 6px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", color: "#555b66" }}>
            Ingredients
          </div>
          {rItems.map(([key, frac], i) => (
            <div className="irow" key={i}>
              <select value={key} onChange={(e) => {
                const next = rItems.map((x) => [...x]); next[i][0] = e.target.value; setRItems(next);
              }}>
                {Object.entries(INGREDIENTS).map(([k, ing]) => (
                  <option key={k} value={k}>{ing.name} ({ing.pack})</option>
                ))}
              </select>
              <select value={frac} onChange={(e) => {
                const next = rItems.map((x) => [...x]); next[i][1] = Number(e.target.value); setRItems(next);
              }}>
                {AMOUNTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <button className="xbtn" aria-label="Remove ingredient"
                onClick={() => setRItems(rItems.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="bigbtn alt" style={{ fontSize: 14, padding: "6px 14px" }}
            onClick={() => setRItems([...rItems.map((x) => [...x]), ["eggs", 0.25]])}>
            + Add ingredient
          </button>

          <div style={{ margin: "16px 0 6px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", color: "#555b66" }}>
            Method (one step per line, optional)
          </div>
          <textarea value={rMethod} placeholder={"Fry the onions...\nAdd the chicken...\nSimmer 20 minutes..."}
            onChange={(e) => setRMethod(e.target.value)} />

          {rItems.length > 0 && (
            <>
              <div className="totrow" style={{ marginTop: 20 }}>
                {STORES.map((s, i) => (
                  <div className={`tot ${recipeCosts[i] === recipeCheapest ? "win" : ""}`} key={s}>
                    <div className="st">{s}{recipeCosts[i] === recipeCheapest ? " · cheapest" : ""}</div>
                    <div className="pr ppp-disp">{money(recipeCosts[i])}</div>
                    <div className="df">{money(recipeCosts[i] / Math.max(1, rServings))} / serving</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, marginBottom: 14 }}>
                At the cheapest store that's <b>{money(recipeCheapest / Math.max(1, rServings))} per serving</b>
                {rProtein > 0 && (
                  <> — <b className="ok">
                    {(rProtein / (recipeCheapest / Math.max(1, rServings))).toFixed(0)}g protein per £1
                  </b></>
                )}
              </div>
              <button className="bigbtn" onClick={saveRecipe}>Save to my meals</button>
            </>
          )}
        </div>
      )}

      {/* --------------------------- MY WEEK (TRACKER) --------------------------- */}
      {tab === "week" && (
        <div className="listwrap">
          <div className="fldrow">
            <div className="fld">
              <label>Daily calorie target</label>
              <input type="number" min="0" step="50" value={kcalTarget} onChange={(e) => setKcalTarget(Number(e.target.value))} />
            </div>
            <div className="fld">
              <label>Daily protein target (g)</label>
              <input type="number" min="0" step="5" value={proteinTarget} onChange={(e) => setProteinTarget(Number(e.target.value))} />
            </div>
            <div className="fld">
              <label>Weekly budget (£)</label>
              <input type="number" min="0" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>

          <div className="quickbox">
            <h3>⚡ Quick add</h3>
            <p>
              Log anything you eat off-plan — cereal, a meal deal at work, a takeaway.
              Pick from the dropdown inside any day, or add a custom item here.
              (In the mobile app this is where the barcode scanner lives.)
            </p>
            <div className="fldrow" style={{ margin: 0 }}>
              <div className="fld">
                <label>Day</label>
                <select value={qDay} onChange={(e) => setQDay(e.target.value)}>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Item</label>
                <input type="text" value={qName} placeholder="e.g. Boots meal deal"
                  onChange={(e) => setQName(e.target.value)} style={{ width: 180 }} />
              </div>
              <div className="fld">
                <label>Kcal</label>
                <input type="number" min="0" step="10" value={qKcal} onChange={(e) => setQKcal(Number(e.target.value))} />
              </div>
              <div className="fld">
                <label>Protein (g)</label>
                <input type="number" min="0" value={qProtein} onChange={(e) => setQProtein(Number(e.target.value))} />
              </div>
              <div className="fld">
                <label>Cost (£)</label>
                <input type="number" min="0" step="0.1" value={qCost} onChange={(e) => setQCost(Number(e.target.value))} />
              </div>
              <button className="bigbtn" style={{ fontSize: 14, padding: "8px 16px" }} onClick={addCustomExtra}>
                Log it
              </button>
            </div>
          </div>

          <div className="weekgrid">
            {DAYS.map((d) => {
              const s = dayStats[d];
              const over = s.kcal > kcalTarget;
              const remaining = kcalTarget - s.kcal;
              return (
                <div className={`daycard ${over ? "over" : ""}`} key={d}>
                  <div className="dayhead">
                    <span className="dname">{d}</span>
                    {s.count > 0 && (
                      <span className="dcost">
                        {money(s.mealCost + s.extraCost)}
                        {s.extraCost > 0 && <> (⚡{money(s.extraCost)})</>}
                      </span>
                    )}
                  </div>
                  <div className="daybody">
                    {Object.entries(week[d]).map(([id, n]) => {
                      const m = findMeal(id);
                      if (!m) return null;
                      return (
                        <div className="dentry" key={id}>
                          <span className="nm">{m.name}{n > 1 ? ` ×${n}` : ""}</span>
                          <span className="kc">{m.kcal * n}</span>
                          <button className="mini-btn" aria-label="Remove one serving"
                            onClick={() => removeServing(d, id)}>−</button>
                          <button className="mini-btn" aria-label="Add one serving"
                            onClick={() => addServing(d, id)}>+</button>
                        </div>
                      );
                    })}
                    {extras[d].map((x) => (
                      <div className="dentry" key={x.uid}>
                        <span className="nm"><span className="zap">⚡</span> {x.name}{x.n > 1 ? ` ×${x.n}` : ""}</span>
                        <span className="kc">{x.kcal * x.n}</span>
                        <button className="mini-btn" aria-label="Remove one"
                          onClick={() => removeExtra(d, x.uid)}>−</button>
                        <button className="mini-btn" aria-label="Add one"
                          onClick={() => addExtra(d, { name: x.name, kcal: x.kcal, protein: x.protein, cost: x.cost })}>+</button>
                      </div>
                    ))}
                    <select className="dayadd" value=""
                      onChange={(e) => { if (e.target.value) addServing(d, e.target.value); e.target.value = ""; }}>
                      <option value="">+ Add a meal…</option>
                      {allMeals.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.kcal} kcal, {m.protein}g)</option>
                      ))}
                    </select>
                    <select className="dayadd" value=""
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (!Number.isNaN(idx) && e.target.value !== "") addExtra(d, SNACKS[idx]);
                        e.target.value = "";
                      }}>
                      <option value="">⚡ Quick add…</option>
                      {SNACKS.map((sn, i) => (
                        <option key={sn.name} value={i}>{sn.name} ({sn.kcal} kcal)</option>
                      ))}
                    </select>
                  </div>
                  <div className="dayfoot">
                    <div className="kcal">
                      <span>{s.kcal.toLocaleString()} / {kcalTarget.toLocaleString()} kcal</span>
                      <span className={s.protein >= proteinTarget ? "ok" : ""}>{s.protein}g</span>
                    </div>
                    {kcalBar(s.kcal)}
                    <div className={`left ${over ? "bad" : "ok"}`}>
                      {over
                        ? `${(s.kcal - kcalTarget).toLocaleString()} kcal over target`
                        : `${remaining.toLocaleString()} kcal left`}
                      {s.protein > 0 && s.protein < proteinTarget && (
                        <span style={{ color: "#555b66" }}> · {proteinTarget - s.protein}g protein to go</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalItems === 0 ? (
            <div className="empty">
              Nothing logged yet. Add planned meals to a day, or ⚡ quick-add whatever you
              actually ate — cereal, a meal deal, a takeaway. Calories, protein and budget
              all track from here.
            </div>
          ) : (
            <>
              <div className="targets">
                <div className="tcard">
                  <div>Avg calories (planned days)</div>
                  <div className={`big ppp-disp ${avgKcal <= kcalTarget ? "ok" : "bad"}`}>
                    {Math.round(avgKcal).toLocaleString()}
                  </div>
                  <div style={{ color: "#555b66" }}>target {kcalTarget.toLocaleString()} kcal/day</div>
                </div>
                <div className="tcard">
                  <div>Days on calorie target</div>
                  <div className={`big ppp-disp ${daysOnTarget === daysPlanned.length ? "ok" : ""}`}>
                    {daysOnTarget} / {daysPlanned.length}
                  </div>
                  <div style={{ color: "#555b66" }}>planned days at or under target</div>
                </div>
                <div className="tcard">
                  <div>Avg protein (planned days)</div>
                  <div className={`big ppp-disp ${avgProtein >= proteinTarget ? "ok" : "bad"}`}>
                    {Math.round(avgProtein)}g
                  </div>
                  <div style={{ color: "#555b66" }}>target {proteinTarget}g/day</div>
                </div>
                <div className="tcard">
                  <div>⚡ Food on the go</div>
                  <div className="big ppp-disp">{money(extrasSpend)}</div>
                  <div style={{ color: "#555b66" }}>{extrasKcal.toLocaleString()} kcal off-plan this week</div>
                </div>
              </div>

              <div className="tcard" style={{ marginBottom: 12, maxWidth: 860 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>
                    Weekly budget — groceries {money(groceriesTotal)} ({STORES[cheapestStore]}) + on the go {money(extrasSpend)}
                  </span>
                  <span className={overBudget ? "bad" : "ok"} style={{ fontWeight: 700 }}>
                    {overBudget
                      ? `${money(weekSpend - budget)} over budget`
                      : `${money(budget - weekSpend)} left of ${money(budget)}`}
                  </span>
                </div>
                <div className="bar">
                  <div className="barfill" style={{
                    width: `${budgetPct}%`,
                    background: overBudget ? "var(--deal)" : "var(--green)",
                  }} />
                </div>
                <div style={{ color: "#555b66" }}>{money(weekSpend)} of {money(budget)}</div>
              </div>

              {shopping.items.length > 0 && (
                <>
                  <div className="totrow">
                    {STORES.map((s, i) => (
                      <div className={`tot ${i === cheapestStore ? "win" : ""}`} key={s}>
                        <div className="st">{s}{i === cheapestStore ? " · cheapest" : ""}</div>
                        <div className="pr ppp-disp">{money(shopping.totals[i])}</div>
                        {i !== cheapestStore && (
                          <div className="df">+{money(shopping.totals[i] - shopping.totals[cheapestStore])}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: "#555b66", marginBottom: 6 }}>
                    Shopping list covers planned meals only (⚡ items are bought on the go).
                    Quantities rounded up to whole packs.
                  </div>
                  <div className="brk" style={{ background: "#fff", border: "1.5px solid var(--ink)", maxWidth: 860 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Ingredient</th><th>Packs</th>
                          {STORES.map((s) => <th key={s}>{s.slice(0, 5)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {shopping.items.map(({ key, ing, packs }) => {
                          const costs = ing.prices.map((p) => p * packs);
                          const lo = Math.min(...costs);
                          return (
                            <tr key={key}>
                              <td>{ing.name} <span style={{ color: "#8a8f99" }}>({ing.pack})</span></td>
                              <td>{packs}</td>
                              {costs.map((c, i) => (
                                <td key={i} className={c === lo ? "lo" : ""}>{money(c)}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="note">
        Prototype — prices are illustrative sample data for Tesco, Aldi, Asda and Sainsbury's;
        grab-and-go items use typical values. In production, prices come from a live grocery
        API and quick-add items from a barcode/nutrition database (e.g. Open Food Facts).
        Calorie and protein figures are estimates; targets are general guides, not medical advice.
      </div>
    </div>
  );
}

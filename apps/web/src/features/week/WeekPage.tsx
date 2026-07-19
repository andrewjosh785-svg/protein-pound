import { Fragment, useEffect, useState } from "react";
import {
  DAY_LABELS,
  buildPriceLookup,
  buildShoppingList,
  cheapestStoreId,
  computeDayStats,
  formatPriceCheckDate,
  latestPriceCheck,
  money,
  shoppingListTotalsByStore,
  type DayOfWeek,
  type Ingredient,
  type Meal,
  type ShoppingListItem,
} from "@protein-pound/shared";
import { useProfile } from "../../lib/queries/useProfile";
import { useCurrentWeekPlan } from "../../lib/queries/useCurrentWeekPlan";
import { usePlanEntries } from "../../lib/queries/usePlanEntries";
import { useLogEntries } from "../../lib/queries/useLogEntries";
import { useSnackPresets } from "../../lib/queries/useSnackPresets";
import { useMeals } from "../../lib/queries/useMeals";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

const AISLE_ORDER = [
  "Meat & Fish",
  "Dairy & Chilled",
  "Tins & Pulses",
  "Bakery & Grains",
  "Fruit & Veg",
  "Frozen",
  "Store Cupboard",
];

interface ShoppingGroup {
  category: string;
  items: ShoppingListItem[];
}

function groupShoppingItemsByAisle(
  items: ShoppingListItem[],
  ingredients: Map<string, Ingredient>
): ShoppingGroup[] {
  const byCategory = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const category = ingredients.get(item.ingredientId)?.category ?? "Other";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(item);
  }
  return [...AISLE_ORDER, "Other"]
    .filter((category) => byCategory.has(category))
    .map((category) => ({ category, items: byCategory.get(category)! }));
}

function buildShoppingListText(
  groups: ShoppingGroup[],
  ingredients: Map<string, Ingredient>,
  cheapestStoreName: string | null
): string {
  const lines = ["Shopping list — Protein/Pound"];
  if (cheapestStoreName) lines.push(`Cheapest overall: ${cheapestStoreName}`);
  lines.push("");
  for (const group of groups) {
    lines.push(group.category);
    for (const item of group.items) {
      const ing = ingredients.get(item.ingredientId);
      const packWord = item.packsNeeded === 1 ? "pack" : "packs";
      lines.push(`- ${ing?.name ?? "Ingredient"} — ${item.packsNeeded} ${packWord} (${ing?.packLabel ?? ""})`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function WeekPage() {
  return <WeekPlanner />;
}

function WeekPlanner() {
  const profile = useProfile();
  const weekPlan = useCurrentWeekPlan();
  const planId = weekPlan.data;
  const planEntries = usePlanEntries(planId);
  const logEntries = useLogEntries(planId);
  const snackPresets = useSnackPresets();
  const mealsQuery = useMeals();
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();

  const [kcalTargetInput, setKcalTargetInput] = useState(2000);
  const [proteinTargetInput, setProteinTargetInput] = useState(120);
  const [budgetInput, setBudgetInput] = useState(30);

  const [qDay, setQDay] = useState<DayOfWeek>(0);
  const [qName, setQName] = useState("");
  const [qKcal, setQKcal] = useState(300);
  const [qProtein, setQProtein] = useState(10);
  const [qCost, setQCost] = useState(1.5);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setKcalTargetInput(profile.data.dailyKcalTarget);
      setProteinTargetInput(profile.data.dailyProteinTarget);
      setBudgetInput(profile.data.weeklyBudget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.dailyKcalTarget, profile.data?.dailyProteinTarget, profile.data?.weeklyBudget]);

  const isLoading =
    profile.isLoading ||
    weekPlan.isLoading ||
    planEntries.isLoading ||
    logEntries.isLoading ||
    snackPresets.isLoading ||
    mealsQuery.isLoading ||
    ingredientsQuery.isLoading ||
    storesQuery.isLoading;
  const isError =
    profile.isError ||
    weekPlan.isError ||
    planEntries.isError ||
    logEntries.isError ||
    snackPresets.isError ||
    mealsQuery.isError ||
    ingredientsQuery.isError ||
    storesQuery.isError;

  if (isLoading) return <div className="note">Loading your week…</div>;
  if (isError) return <div className="note">Couldn't load your week. Try refreshing.</div>;

  const kcalTarget = kcalTargetInput;
  const proteinTarget = proteinTargetInput;
  const budget = budgetInput;

  const meals = mealsQuery.data ?? [];
  const mealsById = new Map<string, Meal>(meals.map((m) => [m.id, m]));
  const ingredients = ingredientsQuery.data!;
  const { stores, prices } = storesQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const entries = planEntries.data ?? [];
  const extras = logEntries.data ?? [];
  const presets = snackPresets.data ?? [];

  const dayStats = DAYS.map((day) => computeDayStats(day, entries, extras, mealsById, priceLookup));
  const totalItems = dayStats.reduce((s, d) => s + d.count, 0);
  const plannedIndices = DAYS.filter((_, i) => dayStats[i].count > 0);
  const avgKcal = plannedIndices.length
    ? plannedIndices.reduce<number>((s, day) => s + dayStats[day].kcal, 0) / plannedIndices.length
    : 0;
  const avgProtein = plannedIndices.length
    ? plannedIndices.reduce<number>((s, day) => s + dayStats[day].proteinG, 0) / plannedIndices.length
    : 0;
  const daysOnTarget = plannedIndices.filter((day) => dayStats[day].kcal <= kcalTarget).length;
  const extrasSpend = dayStats.reduce((s, d) => s + d.extraCost, 0);
  const extrasKcal = DAYS.reduce<number>(
    (s, day) => s + extras.filter((e) => e.dayOfWeek === day).reduce((a, e) => a + e.kcal * e.quantity, 0),
    0
  );

  const shoppingItems = buildShoppingList(entries, mealsById);
  const shoppingTotals = shoppingListTotalsByStore(shoppingItems, stores, priceLookup);
  const cheapestId = cheapestStoreId(shoppingTotals);
  const groceriesTotal = cheapestId ? shoppingTotals[cheapestId] : 0;
  const lastChecked = latestPriceCheck(prices);
  const groupedShopping = groupShoppingItemsByAisle(shoppingItems, ingredients);
  const cheapestStoreName = cheapestId ? stores.find((s) => s.id === cheapestId)?.name ?? null : null;
  const shoppingListText = buildShoppingListText(groupedShopping, ingredients, cheapestStoreName);

  const copyShoppingList = async () => {
    await navigator.clipboard.writeText(shoppingListText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emailShoppingList = () => {
    const subject = encodeURIComponent("Shopping list — Protein/Pound");
    const body = encodeURIComponent(shoppingListText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const weekSpend = groceriesTotal + extrasSpend;
  const budgetPct = budget > 0 ? Math.min((weekSpend / budget) * 100, 100) : 0;
  const overBudget = weekSpend > budget;

  const commitTargets = () => {
    profile.update.mutate({
      dailyKcalTarget: kcalTargetInput,
      dailyProteinTarget: proteinTargetInput,
      weeklyBudget: budgetInput,
    });
  };

  const addCustomExtra = () => {
    if (!qName.trim()) return;
    logEntries.addEntry.mutate({
      day: qDay,
      item: { name: qName.trim(), kcal: Math.max(0, qKcal), proteinG: Math.max(0, qProtein), cost: Math.max(0, qCost) },
    });
    setQName("");
  };

  const kcalBar = (kcal: number) => {
    const pct = Math.min((kcal / kcalTarget) * 100, 100);
    const over = kcal > kcalTarget;
    return (
      <div className="bar mini">
        <div className="barfill" style={{ width: `${pct}%`, background: over ? "var(--deal)" : "var(--green)" }} />
      </div>
    );
  };

  return (
    <div className="listwrap">
      <h2 className="sr-only">My week</h2>
      <div className="fldrow">
        <div className="fld">
          <label>Daily calorie target</label>
          <input
            type="number"
            min="0"
            step="50"
            value={kcalTargetInput}
            onChange={(e) => setKcalTargetInput(Number(e.target.value))}
            onBlur={commitTargets}
          />
        </div>
        <div className="fld">
          <label>Daily protein target (g)</label>
          <input
            type="number"
            min="0"
            step="5"
            value={proteinTargetInput}
            onChange={(e) => setProteinTargetInput(Number(e.target.value))}
            onBlur={commitTargets}
          />
        </div>
        <div className="fld">
          <label>Weekly budget (£)</label>
          <input
            type="number"
            min="0"
            value={budgetInput}
            onChange={(e) => setBudgetInput(Number(e.target.value))}
            onBlur={commitTargets}
          />
        </div>
      </div>

      <div className="quickbox">
        <h3>⚡ Quick add</h3>
        <p>
          Log anything you eat off-plan — cereal, a meal deal at work, a takeaway. Pick from the
          dropdown inside any day, or add a custom item here.
        </p>
        <div className="fldrow" style={{ margin: 0 }}>
          <div className="fld">
            <label>Day</label>
            <select value={qDay} onChange={(e) => setQDay(Number(e.target.value) as DayOfWeek)}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Item</label>
            <input
              type="text"
              value={qName}
              placeholder="e.g. Boots meal deal"
              onChange={(e) => setQName(e.target.value)}
              style={{ width: 180 }}
            />
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
        {DAYS.map((day) => {
          const stats = dayStats[day];
          const over = stats.kcal > kcalTarget;
          const remaining = kcalTarget - stats.kcal;
          const dayEntries = entries.filter((e) => e.dayOfWeek === day);
          const dayExtras = extras.filter((e) => e.dayOfWeek === day);

          return (
            <div className={"daycard " + (over ? "over" : "")} key={day}>
              <div className="dayhead">
                <span className="dname">{DAY_LABELS[day]}</span>
                {stats.count > 0 && (
                  <span className="dcost">
                    {money(stats.mealCost + stats.extraCost)}
                    {stats.extraCost > 0 && <> (⚡{money(stats.extraCost)})</>}
                  </span>
                )}
              </div>
              <div className="daybody">
                {dayEntries.map((entry) => {
                  const meal = mealsById.get(entry.mealId);
                  if (!meal) return null;
                  return (
                    <div className="dentry" key={entry.id}>
                      <span className="nm">{meal.name}</span>
                      <span className="kc">{meal.kcal * entry.servings}</span>
                      <button
                        className="mini-btn"
                        aria-label={`Remove one serving of ${meal.name}`}
                        onClick={() => planEntries.removeServing.mutate({ day, mealId: entry.mealId })}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="servings-input"
                        aria-label={`Servings of ${meal.name}`}
                        value={entry.servings}
                        onChange={(e) =>
                          planEntries.setServings.mutate({
                            day,
                            mealId: entry.mealId,
                            servings: Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      <button
                        className="mini-btn"
                        aria-label={`Add one serving of ${meal.name}`}
                        onClick={() => planEntries.addServing.mutate({ day, mealId: entry.mealId })}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
                {dayExtras.map((extra) => (
                  <div className="dentry" key={extra.id}>
                    <span className="nm">
                      <span className="zap">⚡</span> {extra.name}
                      {extra.quantity > 1 ? ` ×${extra.quantity}` : ""}
                    </span>
                    <span className="kc">{extra.kcal * extra.quantity}</span>
                    <button
                      className="mini-btn"
                      aria-label={`Remove one serving of ${extra.name}`}
                      onClick={() => logEntries.removeEntry.mutate(extra.id)}
                    >
                      −
                    </button>
                    <button
                      className="mini-btn"
                      aria-label={`Add one serving of ${extra.name}`}
                      onClick={() =>
                        logEntries.addEntry.mutate({
                          day,
                          item: { name: extra.name, kcal: extra.kcal, proteinG: extra.proteinG, cost: extra.cost },
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                ))}
                <select
                  className="dayadd"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) planEntries.addServing.mutate({ day, mealId: e.target.value });
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Add a meal…</option>
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.kcal} kcal, {m.proteinG}g)
                    </option>
                  ))}
                </select>
                <select
                  className="dayadd"
                  value=""
                  onChange={(e) => {
                    const preset = presets.find((p) => p.id === e.target.value);
                    if (preset) {
                      logEntries.addEntry.mutate({
                        day,
                        item: { name: preset.name, kcal: preset.kcal, proteinG: preset.proteinG, cost: preset.cost, snackPresetId: preset.id },
                      });
                    }
                    e.target.value = "";
                  }}
                >
                  <option value="">⚡ Quick add…</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kcal} kcal)
                    </option>
                  ))}
                </select>
              </div>
              <div className="dayfoot">
                <div className="kcal">
                  <span>
                    {stats.kcal.toLocaleString()} / {kcalTarget.toLocaleString()} kcal
                  </span>
                  <span className={stats.proteinG >= proteinTarget ? "ok" : ""}>{stats.proteinG}g</span>
                </div>
                {kcalBar(stats.kcal)}
                <div className={"left " + (over ? "bad" : "ok")}>
                  {over
                    ? `${(stats.kcal - kcalTarget).toLocaleString()} kcal over target`
                    : `${remaining.toLocaleString()} kcal left`}
                  {stats.proteinG > 0 && stats.proteinG < proteinTarget && (
                    <span style={{ color: "var(--muted)" }}> · {proteinTarget - stats.proteinG}g protein to go</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalItems === 0 ? (
        <div className="empty">
          Nothing logged yet. Add planned meals to a day, or ⚡ quick-add whatever you actually ate
          — cereal, a meal deal, a takeaway. Calories, protein and budget all track from here.
        </div>
      ) : (
        <>
          <div className="targets">
            <div className="tcard">
              <div>Avg calories (planned days)</div>
              <div className={"big ppp-disp " + (avgKcal <= kcalTarget ? "ok" : "bad")}>
                {Math.round(avgKcal).toLocaleString()}
              </div>
              <div style={{ color: "var(--muted)" }}>target {kcalTarget.toLocaleString()} kcal/day</div>
            </div>
            <div className="tcard">
              <div>Days on calorie target</div>
              <div className={"big ppp-disp " + (daysOnTarget === plannedIndices.length ? "ok" : "")}>
                {daysOnTarget} / {plannedIndices.length}
              </div>
              <div style={{ color: "var(--muted)" }}>planned days at or under target</div>
            </div>
            <div className="tcard">
              <div>Avg protein (planned days)</div>
              <div className={"big ppp-disp " + (avgProtein >= proteinTarget ? "ok" : "bad")}>
                {Math.round(avgProtein)}g
              </div>
              <div style={{ color: "var(--muted)" }}>target {proteinTarget}g/day</div>
            </div>
            <div className="tcard">
              <div>⚡ Food on the go</div>
              <div className="big ppp-disp">{money(extrasSpend)}</div>
              <div style={{ color: "var(--muted)" }}>{extrasKcal.toLocaleString()} kcal off-plan this week</div>
            </div>
          </div>

          <div className="tcard" style={{ marginBottom: 12, maxWidth: 860 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>
                Weekly budget — groceries {money(groceriesTotal)} (
                {cheapestId ? stores.find((s) => s.id === cheapestId)?.name : "—"}) + on the go{" "}
                {money(extrasSpend)}
              </span>
              <span className={overBudget ? "bad" : "ok"} style={{ fontWeight: 700 }}>
                {overBudget ? `${money(weekSpend - budget)} over budget` : `${money(budget - weekSpend)} left of ${money(budget)}`}
              </span>
            </div>
            <div className="bar">
              <div
                className="barfill"
                style={{ width: `${budgetPct}%`, background: overBudget ? "var(--deal)" : "var(--green)" }}
              />
            </div>
            <div style={{ color: "var(--muted)" }}>
              {money(weekSpend)} of {money(budget)}
            </div>
          </div>

          {shoppingItems.length > 0 && (
            <>
              <div className="totrow">
                {stores.map((s) => (
                  <div className={"tot " + (s.id === cheapestId ? "win" : "")} key={s.id}>
                    <div className="st">
                      {s.name}
                      {s.id === cheapestId ? " · cheapest" : ""}
                    </div>
                    <div className="pr ppp-disp">{money(shoppingTotals[s.id] ?? 0)}</div>
                    {s.id !== cheapestId && (
                      <div className="df">+{money((shoppingTotals[s.id] ?? 0) - groceriesTotal)}</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                Shopping list covers planned meals only (⚡ items are bought on the go). Quantities
                rounded up to whole packs, grouped by aisle.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <button className="pill" onClick={copyShoppingList}>
                  {copied ? "Copied!" : "Copy list"}
                </button>
                <button className="pill" onClick={() => window.print()}>
                  Print
                </button>
                <button className="pill" onClick={emailShoppingList}>
                  Email
                </button>
              </div>
              <div
                className="brk print-shopping-list"
                style={{ background: "var(--surface)", border: "1.5px solid var(--ink)", maxWidth: 860 }}
              >
                <table>
                  <thead>
                    <tr>
                      <th className="namecol">Ingredient</th>
                      <th>Packs</th>
                      {stores.map((s) => (
                        <th key={s.id}>{s.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedShopping.map((group) => (
                      <Fragment key={group.category}>
                        <tr className="catrow">
                          <td colSpan={2 + stores.length}>{group.category}</td>
                        </tr>
                        {group.items.map((item) => {
                          const ing = ingredients.get(item.ingredientId);
                          const costs = stores.map(
                            (s) => (priceLookup.get(item.ingredientId)?.get(s.id) ?? 0) * item.packsNeeded
                          );
                          const lo = Math.min(...costs);
                          return (
                            <tr key={item.ingredientId}>
                              <td className="namecol">
                                {ing?.name ?? "Ingredient"} <span style={{ color: "var(--faint)" }}>({ing?.packLabel})</span>
                              </td>
                              <td>{item.packsNeeded}</td>
                              {costs.map((c, i) => (
                                <td key={i} className={c === lo ? "lo" : ""}>
                                  {money(c)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastChecked && (
                <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>
                  Prices last checked {formatPriceCheckDate(lastChecked)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

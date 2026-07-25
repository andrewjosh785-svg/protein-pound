// mirrors apps/web/src/features/week/WeekPage.tsx — same day-stats/shopping-list/budget
// calculations (packages/shared, untouched), rebuilt with RN primitives. The web
// version's 7-column CSS grid becomes a vertical stack of day cards (matching how the
// web app already responsively stacks at mobile widths — verified during the earlier
// mobile-responsiveness audit). window.print() is dropped entirely (no mobile
// equivalent); mailto: export becomes the native Share sheet; navigator.clipboard
// becomes expo-clipboard.
import { Fragment, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Clipboard from "expo-clipboard";
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
  todayAsDayOfWeek,
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
import { useCopyLastWeek } from "../../lib/queries/useCopyLastWeek";
import { BarcodeScannerScreen } from "../scan/BarcodeScannerScreen";
import { ScanConfirmSheet } from "../scan/ScanConfirmSheet";
import type { BarcodeLookupResult } from "../../lib/openFoodFacts";
import { colors } from "../../theme/tokens";

type ScanFlow = { phase: "scanning" } | { phase: "confirm"; barcode: string; prefill: BarcodeLookupResult | null };

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

function groupShoppingItemsByAisle(items: ShoppingListItem[], ingredients: Map<string, Ingredient>): ShoppingGroup[] {
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

function buildShoppingListText(groups: ShoppingGroup[], ingredients: Map<string, Ingredient>, cheapestStoreName: string | null): string {
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
  const profile = useProfile();
  const weekPlan = useCurrentWeekPlan();
  const planId = weekPlan.data;
  const planEntries = usePlanEntries(planId);
  const logEntries = useLogEntries(planId);
  const snackPresets = useSnackPresets();
  const mealsQuery = useMeals();
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();
  const copyLastWeek = useCopyLastWeek(planId);

  const [kcalTargetInput, setKcalTargetInput] = useState("2000");
  const [proteinTargetInput, setProteinTargetInput] = useState("120");
  const [budgetInput, setBudgetInput] = useState("30");

  const [qDay, setQDay] = useState<DayOfWeek>(0);
  const [qName, setQName] = useState("");
  const [qKcal, setQKcal] = useState("300");
  const [qProtein, setQProtein] = useState("10");
  const [qCarbs, setQCarbs] = useState("0");
  const [qFat, setQFat] = useState("0");
  const [qCost, setQCost] = useState("1.5");
  const [copied, setCopied] = useState(false);
  const [scanFlow, setScanFlow] = useState<ScanFlow | null>(null);

  useEffect(() => {
    if (profile.data) {
      setKcalTargetInput(String(profile.data.dailyKcalTarget));
      setProteinTargetInput(String(profile.data.dailyProteinTarget));
      setBudgetInput(String(profile.data.weeklyBudget));
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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't load your week. Try refreshing.</Text>
      </View>
    );
  }

  if (scanFlow?.phase === "scanning") {
    return (
      <BarcodeScannerScreen
        onCancel={() => setScanFlow(null)}
        onConfirm={(barcode, prefill) => setScanFlow({ phase: "confirm", barcode, prefill })}
      />
    );
  }
  if (scanFlow?.phase === "confirm") {
    return (
      <ScanConfirmSheet
        barcode={scanFlow.barcode}
        prefill={scanFlow.prefill}
        planId={planId}
        onCancel={() => setScanFlow(null)}
        onDone={() => setScanFlow(null)}
      />
    );
  }

  const kcalTarget = Math.max(0, Number(kcalTargetInput) || 0);
  const proteinTarget = Math.max(0, Number(proteinTargetInput) || 0);
  const budget = Math.max(0, Number(budgetInput) || 0);

  const meals = mealsQuery.data ?? [];
  const mealsById = new Map<string, Meal>(meals.map((m) => [m.id, m]));
  const ingredients = ingredientsQuery.data!;
  const { stores, prices } = storesQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const entries = planEntries.data ?? [];
  const extras = logEntries.data ?? [];
  const presets = snackPresets.data ?? [];

  const dayStats = DAYS.map((day) => computeDayStats(day, entries, extras, mealsById, priceLookup));
  const todayDow = todayAsDayOfWeek();
  const todayStats = dayStats[todayDow];
  const dailyBudget = budget / 7;
  const todaySpend = todayStats.mealCost + todayStats.extraCost;
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
    await Clipboard.setStringAsync(shoppingListText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareShoppingList = () => {
    Share.share({ message: shoppingListText, title: "Shopping list — Protein/Pound" });
  };

  const weekSpend = groceriesTotal + extrasSpend;
  const budgetPct = budget > 0 ? Math.min((weekSpend / budget) * 100, 100) : 0;
  const overBudget = weekSpend > budget;

  const commitTargets = () => {
    profile.update.mutate({
      dailyKcalTarget: kcalTarget,
      dailyProteinTarget: proteinTarget,
      weeklyBudget: budget,
    });
  };

  const addCustomExtra = () => {
    if (!qName.trim()) return;
    logEntries.addEntry.mutate({
      day: qDay,
      item: {
        name: qName.trim(),
        kcal: Math.max(0, Number(qKcal) || 0),
        proteinG: Math.max(0, Number(qProtein) || 0),
        carbsG: Math.max(0, Number(qCarbs) || 0),
        fatG: Math.max(0, Number(qFat) || 0),
        cost: Math.max(0, Number(qCost) || 0),
      },
    });
    setQName("");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <TodaySummary
        dayLabel={DAY_LABELS[todayDow]}
        stats={todayStats}
        kcalTarget={kcalTarget}
        proteinTarget={proteinTarget}
        dailyBudget={dailyBudget}
        spend={todaySpend}
      />

      <View style={styles.targetsRow}>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Daily calories</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={kcalTargetInput}
            onChangeText={setKcalTargetInput}
            onEndEditing={commitTargets}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Daily protein (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={proteinTargetInput}
            onChangeText={setProteinTargetInput}
            onEndEditing={commitTargets}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Weekly budget (£)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={budgetInput}
            onChangeText={setBudgetInput}
            onEndEditing={commitTargets}
          />
        </View>
      </View>

      <View style={styles.quickBox}>
        <Text style={styles.quickHeading}>⚡ Quick add</Text>
        <Text style={styles.quickBody}>
          Log anything you eat off-plan — cereal, a meal deal at work, a takeaway.
        </Text>
        <Text style={styles.fieldLabel}>Day</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={qDay} onValueChange={(v) => setQDay(v as DayOfWeek)}>
            {DAYS.map((d) => (
              <Picker.Item key={d} label={DAY_LABELS[d]} value={d} />
            ))}
          </Picker>
        </View>
        <Text style={styles.fieldLabel}>Item</Text>
        <TextInput style={styles.input} value={qName} onChangeText={setQName} placeholder="e.g. Boots meal deal" />
        <View style={styles.row3}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Kcal</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={qKcal} onChangeText={setQKcal} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Protein (g)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={qProtein} onChangeText={setQProtein} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Cost (£)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={qCost} onChangeText={setQCost} />
          </View>
        </View>
        <View style={styles.row3}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Carbs (g)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={qCarbs} onChangeText={setQCarbs} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Fat (g)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={qFat} onChangeText={setQFat} />
          </View>
        </View>
        <View style={styles.quickAddActionsRow}>
          <Pressable style={[styles.logBtn, styles.flex1]} onPress={addCustomExtra}>
            <Text style={styles.logBtnText}>Log it</Text>
          </Pressable>
          <Pressable style={styles.scanBtn} onPress={() => setScanFlow({ phase: "scanning" })}>
            <Text style={styles.scanBtnText}>📷 Scan a barcode</Text>
          </Pressable>
        </View>
      </View>

      {DAYS.map((day) => (
        <DayCard
          key={day}
          day={day}
          isToday={day === todayDow}
          stats={dayStats[day]}
          kcalTarget={kcalTarget}
          proteinTarget={proteinTarget}
          entries={entries.filter((e) => e.dayOfWeek === day)}
          extras={extras.filter((e) => e.dayOfWeek === day)}
          mealsById={mealsById}
          meals={meals}
          presets={presets}
          planEntries={planEntries}
          logEntries={logEntries}
        />
      ))}

      {entries.length === 0 && (
        <View style={styles.copyLastWeekBox}>
          <Text style={styles.emptyText}>No meals planned this week yet.</Text>
          <Pressable
            style={[styles.actionPill, copyLastWeek.isPending && { opacity: 0.6 }]}
            onPress={() => copyLastWeek.mutate()}
            disabled={copyLastWeek.isPending}
          >
            <Text style={styles.actionPillText}>{copyLastWeek.isPending ? "Copying…" : "Copy last week's plan"}</Text>
          </Pressable>
          {copyLastWeek.isError && (
            <Text style={styles.badText}>
              {copyLastWeek.error instanceof Error ? copyLastWeek.error.message : "Couldn't copy last week."}
            </Text>
          )}
        </View>
      )}

      {totalItems === 0 ? (
        <Text style={styles.emptyText}>
          Nothing logged yet. Add planned meals to a day, or ⚡ quick-add whatever you actually ate.
        </Text>
      ) : (
        <>
          <View style={styles.targetCardsRow}>
            <TargetCard
              label="Avg calories (planned days)"
              value={Math.round(avgKcal).toLocaleString()}
              good={avgKcal <= kcalTarget}
              sub={`target ${kcalTarget.toLocaleString()} kcal/day`}
            />
            <TargetCard
              label="Days on calorie target"
              value={`${daysOnTarget} / ${plannedIndices.length}`}
              good={daysOnTarget === plannedIndices.length}
              sub="planned days at or under target"
            />
            <TargetCard
              label="Avg protein (planned days)"
              value={`${Math.round(avgProtein)}g`}
              good={avgProtein >= proteinTarget}
              sub={`target ${proteinTarget}g/day`}
            />
            <TargetCard label="⚡ Food on the go" value={money(extrasSpend)} sub={`${extrasKcal.toLocaleString()} kcal off-plan`} />
          </View>

          <View style={styles.budgetCard}>
            <Text style={styles.budgetHeading}>
              Groceries {money(groceriesTotal)} ({cheapestId ? stores.find((s) => s.id === cheapestId)?.name : "—"}) + on
              the go {money(extrasSpend)}
            </Text>
            <Text style={[styles.budgetStatus, overBudget ? styles.badText : styles.okText]}>
              {overBudget ? `${money(weekSpend - budget)} over budget` : `${money(budget - weekSpend)} left of ${money(budget)}`}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${budgetPct}%`, backgroundColor: overBudget ? colors.deal : colors.green }]} />
            </View>
            <Text style={styles.budgetNote}>
              Groceries round up to whole packs across the week — day-by-day figures below are each
              day's fractional share, so they won't sum to exactly this total.
            </Text>
          </View>

          {shoppingItems.length > 0 && (
            <>
              <View style={styles.totRow}>
                {stores.map((s) => (
                  <View key={s.id} style={[styles.totCard, s.id === cheapestId && styles.totCardWin]}>
                    <Text style={styles.totStore}>
                      {s.name}
                      {s.id === cheapestId ? " · cheapest" : ""}
                    </Text>
                    <Text style={styles.totPrice}>{money(shoppingTotals[s.id] ?? 0)}</Text>
                    {s.id !== cheapestId && (
                      <Text style={styles.totDiff}>+{money((shoppingTotals[s.id] ?? 0) - groceriesTotal)}</Text>
                    )}
                  </View>
                ))}
              </View>

              <Text style={styles.shoppingNote}>
                Shopping list covers planned meals only. Quantities rounded up to whole packs, grouped by aisle.
              </Text>
              <View style={styles.actionsRow}>
                <Pressable style={styles.actionPill} onPress={copyShoppingList}>
                  <Text style={styles.actionPillText}>{copied ? "Copied!" : "Copy list"}</Text>
                </Pressable>
                <Pressable style={styles.actionPill} onPress={shareShoppingList}>
                  <Text style={styles.actionPillText}>Share</Text>
                </Pressable>
              </View>

              <View style={styles.shoppingTable}>
                {groupedShopping.map((group) => (
                  <Fragment key={group.category}>
                    <Text style={styles.aisleHeading}>{group.category}</Text>
                    {group.items.map((item) => {
                      const ing = ingredients.get(item.ingredientId);
                      const costs = stores.map((s) => (priceLookup.get(item.ingredientId)?.get(s.id) ?? 0) * item.packsNeeded);
                      const lo = Math.min(...costs);
                      return (
                        <View key={item.ingredientId} style={styles.shoppingRow}>
                          <Text style={styles.shoppingRowName}>
                            {ing?.name ?? "Ingredient"} ({item.packsNeeded} {item.packsNeeded === 1 ? "pack" : "packs"})
                          </Text>
                          <View style={styles.shoppingRowCosts}>
                            {costs.map((c, i) => (
                              <Text key={i} style={[styles.priceCell, c === lo && styles.priceCellLo]}>
                                {stores[i].name}: {money(c)}
                              </Text>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </Fragment>
                ))}
              </View>
              {lastChecked && <Text style={styles.lastChecked}>Prices last checked {formatPriceCheckDate(lastChecked)}</Text>}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function TodaySummary({
  dayLabel,
  stats,
  kcalTarget,
  proteinTarget,
  dailyBudget,
  spend,
}: {
  dayLabel: string;
  stats: ReturnType<typeof computeDayStats>;
  kcalTarget: number;
  proteinTarget: number;
  dailyBudget: number;
  spend: number;
}) {
  const kcalOver = stats.kcal > kcalTarget;
  const proteinBad = stats.proteinG < proteinTarget;
  const spendOver = spend > dailyBudget;

  return (
    <View style={styles.todayCard}>
      <Text style={styles.todayHeading}>Today · {dayLabel}</Text>

      <View style={styles.todayRow}>
        <Text style={styles.todayLabel}>Calories</Text>
        <Text style={styles.todayValue}>
          {stats.kcal.toLocaleString()} / {kcalTarget.toLocaleString()}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min((stats.kcal / Math.max(1, kcalTarget)) * 100, 100)}%`, backgroundColor: kcalOver ? colors.deal : colors.green },
          ]}
        />
      </View>

      <View style={[styles.todayRow, styles.todayRowSpaced]}>
        <Text style={styles.todayLabel}>Protein</Text>
        <Text style={styles.todayValue}>
          {stats.proteinG}g / {proteinTarget}g
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min((stats.proteinG / Math.max(1, proteinTarget)) * 100, 100)}%`, backgroundColor: proteinBad ? colors.line : colors.green },
          ]}
        />
      </View>

      <View style={[styles.todayRow, styles.todayRowSpaced]}>
        <Text style={styles.todayLabel}>Spend</Text>
        <Text style={styles.todayValue}>
          {money(spend)} / {money(dailyBudget)}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min((spend / Math.max(0.01, dailyBudget)) * 100, 100)}%`, backgroundColor: spendOver ? colors.deal : colors.green },
          ]}
        />
      </View>

      <Text style={styles.todayCaption}>
        {stats.count > 0
          ? `${stats.count} item${stats.count === 1 ? "" : "s"} logged today`
          : "Nothing logged for today yet — add a meal below or ⚡ quick-add what you ate."}
      </Text>
    </View>
  );
}

function TargetCard({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <View style={styles.targetCard}>
      <Text style={styles.targetLabel}>{label}</Text>
      <Text style={[styles.targetValue, good === true && styles.okText, good === false && styles.badText]}>{value}</Text>
      <Text style={styles.targetSub}>{sub}</Text>
    </View>
  );
}

function DayCard({
  day,
  isToday,
  stats,
  kcalTarget,
  proteinTarget,
  entries,
  extras,
  mealsById,
  meals,
  presets,
  planEntries,
  logEntries,
}: {
  day: DayOfWeek;
  isToday: boolean;
  stats: ReturnType<typeof computeDayStats>;
  kcalTarget: number;
  proteinTarget: number;
  entries: ReturnType<typeof usePlanEntries>["data"];
  extras: ReturnType<typeof useLogEntries>["data"];
  mealsById: Map<string, Meal>;
  meals: Meal[];
  presets: NonNullable<ReturnType<typeof useSnackPresets>["data"]>;
  planEntries: ReturnType<typeof usePlanEntries>;
  logEntries: ReturnType<typeof useLogEntries>;
}) {
  const over = stats.kcal > kcalTarget;
  const remaining = kcalTarget - stats.kcal;
  const [addMealValue, setAddMealValue] = useState("");
  const [quickAddValue, setQuickAddValue] = useState("");

  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday, over && styles.dayCardOver]}>
      <View style={styles.dayHead}>
        <View style={styles.dayNameRow}>
          <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>
        {stats.count > 0 && (
          <Text style={styles.dayCost}>
            {money(stats.mealCost + stats.extraCost)}
            {stats.extraCost > 0 ? ` (⚡${money(stats.extraCost)})` : ""}
          </Text>
        )}
      </View>

      {(entries ?? []).map((entry) => {
        const meal = mealsById.get(entry.mealId);
        if (!meal) return null;
        return (
          <View key={entry.id} style={styles.entryRow}>
            <Text style={styles.entryName}>{meal.name}</Text>
            <Text style={styles.entryKcal}>{meal.kcal * entry.servings}</Text>
            <Pressable style={styles.miniBtn} onPress={() => planEntries.removeServing.mutate({ day, mealId: entry.mealId })}>
              <Text style={styles.miniBtnText}>−</Text>
            </Pressable>
            <Text style={styles.servingsText}>{entry.servings}</Text>
            <Pressable style={styles.miniBtn} onPress={() => planEntries.addServing.mutate({ day, mealId: entry.mealId })}>
              <Text style={styles.miniBtnText}>+</Text>
            </Pressable>
          </View>
        );
      })}

      {(extras ?? []).map((extra) => (
        <View key={extra.id} style={styles.entryRow}>
          <Text style={styles.entryName}>
            ⚡ {extra.name}
            {extra.quantity > 1 ? ` ×${extra.quantity}` : ""}
          </Text>
          <Text style={styles.entryKcal}>{extra.kcal * extra.quantity}</Text>
          <Pressable style={styles.miniBtn} onPress={() => logEntries.removeEntry.mutate(extra.id)}>
            <Text style={styles.miniBtnText}>−</Text>
          </Pressable>
          <Pressable
            style={styles.miniBtn}
            onPress={() =>
              logEntries.addEntry.mutate({
                day,
                item: {
                  name: extra.name,
                  kcal: extra.kcal,
                  proteinG: extra.proteinG,
                  carbsG: extra.carbsG,
                  fatG: extra.fatG,
                  cost: extra.cost,
                },
              })
            }
          >
            <Text style={styles.miniBtnText}>+</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.dayPickerWrap}>
        <Picker
          selectedValue={addMealValue}
          onValueChange={(v) => {
            if (v) planEntries.addServing.mutate({ day, mealId: v });
            setAddMealValue("");
          }}
        >
          <Picker.Item label="+ Add a meal…" value="" />
          {meals.map((m) => (
            <Picker.Item key={m.id} label={`${m.name} (${m.kcal} kcal, ${m.proteinG}g)`} value={m.id} />
          ))}
        </Picker>
      </View>
      <View style={styles.dayPickerWrap}>
        <Picker
          selectedValue={quickAddValue}
          onValueChange={(v) => {
            const preset = presets.find((p) => p.id === v);
            if (preset) {
              logEntries.addEntry.mutate({
                day,
                item: {
                  name: preset.name,
                  kcal: preset.kcal,
                  proteinG: preset.proteinG,
                  carbsG: preset.carbsG,
                  fatG: preset.fatG,
                  cost: preset.cost,
                  snackPresetId: preset.id,
                },
              });
            }
            setQuickAddValue("");
          }}
        >
          <Picker.Item label="⚡ Quick add…" value="" />
          {presets.map((p) => (
            <Picker.Item key={p.id} label={`${p.name} (${p.kcal} kcal)`} value={p.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.dayFoot}>
        <View style={styles.dayFootRow}>
          <Text style={styles.dayFootText}>
            {stats.kcal.toLocaleString()} / {kcalTarget.toLocaleString()} kcal
          </Text>
          <Text style={[styles.dayFootText, stats.proteinG >= proteinTarget && styles.okText]}>{stats.proteinG}g</Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min((stats.kcal / Math.max(1, kcalTarget)) * 100, 100)}%`, backgroundColor: over ? colors.deal : colors.green },
            ]}
          />
        </View>
        <Text style={[styles.dayFootLeft, over ? styles.badText : styles.okText]}>
          {over ? `${(stats.kcal - kcalTarget).toLocaleString()} kcal over target` : `${remaining.toLocaleString()} kcal left`}
          {stats.proteinG > 0 && stats.proteinG < proteinTarget ? ` · ${proteinTarget - stats.proteinG}g protein to go` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noteText: { fontSize: 13, color: colors.muted },
  targetsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  flex1: { flex: 1 },
  row3: { flexDirection: "row", gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  quickBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 14, marginBottom: 16 },
  quickHeading: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  quickBody: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  pickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.paper },
  quickAddActionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  logBtn: { backgroundColor: colors.ink, borderRadius: 6, paddingVertical: 10, alignItems: "center" },
  logBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  scanBtn: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  todayCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.ink, borderRadius: 8, padding: 14, marginBottom: 16 },
  todayHeading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: colors.muted, marginBottom: 10 },
  todayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  todayRowSpaced: { marginTop: 10 },
  todayLabel: { fontSize: 13, color: colors.ink },
  todayValue: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  todayCaption: { fontSize: 11.5, color: colors.muted, marginTop: 10 },
  dayCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, marginBottom: 10 },
  dayCardOver: { borderColor: colors.deal },
  dayCardToday: { borderColor: colors.tag, borderWidth: 2 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dayNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayName: { fontSize: 14, fontWeight: "800", color: colors.ink },
  todayBadge: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: 10, fontWeight: "700", color: colors.ink },
  dayCost: { fontSize: 12, color: colors.muted },
  entryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  entryName: { flex: 1, fontSize: 12, color: colors.ink },
  entryKcal: { fontSize: 11, color: colors.muted, width: 40, textAlign: "right" },
  miniBtn: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  miniBtnText: { fontSize: 14, color: colors.ink, fontWeight: "700" },
  servingsText: { fontSize: 12, fontWeight: "700", color: colors.ink, width: 20, textAlign: "center" },
  dayPickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, marginBottom: 6, backgroundColor: colors.paper },
  dayFoot: { marginTop: 8 },
  dayFootRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  dayFootText: { fontSize: 11, color: colors.muted },
  dayFootLeft: { fontSize: 11, marginTop: 4 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  okText: { color: colors.green },
  badText: { color: colors.deal },
  emptyText: { fontSize: 13, color: colors.muted, marginVertical: 16, textAlign: "center" },
  copyLastWeekBox: { alignItems: "center", gap: 8, marginBottom: 4 },
  targetCardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  targetCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10 },
  targetLabel: { fontSize: 10, color: colors.muted, marginBottom: 4 },
  targetValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  targetSub: { fontSize: 10, color: colors.faint, marginTop: 2 },
  budgetCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, marginBottom: 12 },
  budgetHeading: { fontSize: 12, fontWeight: "600", color: colors.ink, marginBottom: 4 },
  budgetStatus: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  budgetNote: { fontSize: 11, color: colors.faint, marginTop: 6 },
  totRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  totCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 10 },
  totCardWin: { borderColor: colors.green, borderWidth: 2 },
  totStore: { fontSize: 11, color: colors.muted, marginBottom: 4 },
  totPrice: { fontSize: 18, fontWeight: "800", color: colors.ink },
  totDiff: { fontSize: 11, color: colors.faint },
  shoppingNote: { fontSize: 11, color: colors.muted, marginBottom: 8 },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionPill: { borderWidth: 1, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  actionPillText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  shoppingTable: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12 },
  aisleHeading: { fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase", marginTop: 10, marginBottom: 6 },
  shoppingRow: { marginBottom: 8 },
  shoppingRowName: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  shoppingRowCosts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  priceCell: { fontSize: 11, color: colors.muted },
  priceCellLo: { color: colors.green, fontWeight: "700" },
  lastChecked: { fontSize: 11, color: colors.faint, marginTop: 8 },
});

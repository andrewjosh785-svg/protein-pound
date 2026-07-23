// mirrors apps/web/src/features/meals/MealsPage.tsx — same filtering/sorting/best-value
// logic (packages/shared calculations, untouched), rebuilt with RN primitives. The web
// version's URLSearchParams shareable-link sync has no native equivalent and is dropped
// entirely per the plan — filters are just local component state here.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert } from "react-native";
import {
  buildPriceLookup,
  formatIngredientLine,
  formatPriceCheckDate,
  latestPriceCheck,
  mealCostPerServing,
  money,
  packAmountLabel,
  proteinPerPound,
  servingsLabel,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  type Ingredient,
  type Meal,
  type MealCategory,
  type PriceLookup,
  type Store,
} from "@protein-pound/shared";
import { useMeals } from "../../lib/queries/useMeals";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useDeleteMeal } from "../../lib/queries/useDeleteMeal";
import { useAuth } from "../../lib/auth/AuthContext";
import { AiEditPanel } from "./AiEditPanel";
import { colors } from "../../theme/tokens";

type SortBy = "value" | "cheap" | "protein";
type DietFilter = "all" | "veggie" | "meat";
type OwnerFilter = "all" | "mine";

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "value", label: "Best £/g" },
  { value: "cheap", label: "Cheapest" },
  { value: "protein", label: "Most protein" },
];
const DIET_OPTIONS: Array<{ value: DietFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "veggie", label: "Veggie" },
  { value: "meat", label: "Meat" },
];
const OWNER_OPTIONS: Array<{ value: OwnerFilter; label: string }> = [
  { value: "all", label: "All meals" },
  { value: "mine", label: "My recipes" },
];

function Pill<T extends string>({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.pill, active && styles.pillOn]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function MealsPage({
  onEditMeal,
  onOpenMeal,
}: {
  onEditMeal: (meal: Meal) => void;
  onOpenMeal: (meal: Meal) => void;
}) {
  const { user } = useAuth();
  const mealsQuery = useMeals();
  const storesQuery = useStoresAndPrices();
  const ingredientsQuery = useIngredients();
  const deleteMeal = useDeleteMeal();

  const [searchQuery, setSearchQuery] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("value");
  const [category, setCategory] = useState<MealCategory | "">("");
  const [dietFilter, setDietFilter] = useState<DietFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [openPricesId, setOpenPricesId] = useState<string | null>(null);
  const [openAiEditId, setOpenAiEditId] = useState<string | null>(null);

  if (mealsQuery.isLoading || storesQuery.isLoading || ingredientsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (mealsQuery.isError || storesQuery.isError || ingredientsQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't load meals — check your connection and try again.</Text>
      </View>
    );
  }

  const meals = mealsQuery.data ?? [];
  const { stores, prices } = storesQuery.data!;
  const ingredients = ingredientsQuery.data!;
  const priceLookup = buildPriceLookup(prices);
  const lastChecked = latestPriceCheck(prices);

  const searchLower = searchQuery.trim().toLowerCase();
  const rows = meals
    .filter(
      (m) =>
        !searchLower || m.name.toLowerCase().includes(searchLower) || m.description.toLowerCase().includes(searchLower)
    )
    .filter((m) => dietFilter === "all" || (dietFilter === "veggie" ? m.isVeggie : !m.isVeggie))
    .filter((m) => ownerFilter === "all" || (!!user && m.ownerId === user.id))
    .filter((m) => !category || m.category === category)
    .map((m) => {
      const perServing = mealCostPerServing(m, priceLookup, storeId);
      return { meal: m, perServing, valuePerPound: proteinPerPound(perServing, m.proteinG) };
    });

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "value") return b.valuePerPound - a.valuePerPound;
    if (sortBy === "cheap") return a.perServing - b.perServing;
    return b.meal.proteinG - a.meal.proteinG;
  });

  let bestValueMealId: string | null = null;
  let bestValueSoFar = -Infinity;
  for (const m of meals) {
    const v = proteinPerPound(mealCostPerServing(m, priceLookup, storeId), m.proteinG);
    if (v > bestValueSoFar) {
      bestValueSoFar = v;
      bestValueMealId = m.id;
    }
  }

  const storeLabel = storeId ? stores.find((s) => s.id === storeId)?.name ?? "" : "cheapest mix";

  return (
    <FlatList
      style={styles.list}
      data={sorted}
      keyExtractor={(row) => row.meal.id}
      ListHeaderComponent={
        <View>
          <TextInput
            style={styles.search}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search meals…"
          />
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Price at</Text>
            <View style={styles.pillRow}>
              <Pill active={storeId === null} label="Cheapest mix" onPress={() => setStoreId(null)} />
              {stores.map((s) => (
                <Pill key={s.id} active={storeId === s.id} label={s.name} onPress={() => setStoreId(s.id)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort</Text>
            <View style={styles.pillRow}>
              {SORT_OPTIONS.map((o) => (
                <Pill key={o.value} active={sortBy === o.value} label={o.label} onPress={() => setSortBy(o.value)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category</Text>
            <View style={styles.pillRow}>
              <Pill active={category === ""} label="All" onPress={() => setCategory("")} />
              {MEAL_CATEGORIES.map((c) => (
                <Pill key={c} active={category === c} label={MEAL_CATEGORY_LABELS[c]} onPress={() => setCategory(c)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Diet</Text>
            <View style={styles.pillRow}>
              {DIET_OPTIONS.map((o) => (
                <Pill key={o.value} active={dietFilter === o.value} label={o.label} onPress={() => setDietFilter(o.value)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Show</Text>
            <View style={styles.pillRow}>
              {OWNER_OPTIONS.map((o) => (
                <Pill key={o.value} active={ownerFilter === o.value} label={o.label} onPress={() => setOwnerFilter(o.value)} />
              ))}
            </View>
          </View>
          {lastChecked && (
            <Text style={styles.lastChecked}>Prices last checked {formatPriceCheckDate(lastChecked)}</Text>
          )}
          {sorted.length === 0 && (
            <Text style={styles.emptyText}>
              {searchLower
                ? `No meals match "${searchQuery.trim()}".`
                : ownerFilter === "mine"
                ? "You haven't saved any recipes yet — generate one with ✨ Generate, or build one in Price my recipe."
                : "No meals match these filters."}
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <MealCard
          meal={item.meal}
          perServing={item.perServing}
          valuePerPound={item.valuePerPound}
          isBest={item.meal.id === bestValueMealId && sortBy === "value"}
          storeLabel={storeLabel}
          ingredients={ingredients}
          stores={stores}
          priceLookup={priceLookup}
          recipeOpen={openRecipeId === item.meal.id}
          onToggleRecipe={() => {
            setOpenRecipeId(openRecipeId === item.meal.id ? null : item.meal.id);
            setOpenPricesId(null);
            setOpenAiEditId(null);
          }}
          pricesOpen={openPricesId === item.meal.id}
          onTogglePrices={() => {
            setOpenPricesId(openPricesId === item.meal.id ? null : item.meal.id);
            setOpenRecipeId(null);
            setOpenAiEditId(null);
          }}
          aiEditOpen={openAiEditId === item.meal.id}
          onToggleAiEdit={() => {
            setOpenAiEditId(openAiEditId === item.meal.id ? null : item.meal.id);
            setOpenRecipeId(null);
            setOpenPricesId(null);
          }}
          isOwner={!!user && item.meal.ownerId === user.id}
          onEdit={() => onEditMeal(item.meal)}
          onOpen={() => onOpenMeal(item.meal)}
          onDelete={() => {
            Alert.alert("Delete meal?", `"${item.meal.name}" can't be undone.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deleteMeal.mutate(item.meal.id) },
            ]);
          }}
        />
      )}
    />
  );
}

function MealCard({
  meal,
  perServing,
  valuePerPound,
  isBest,
  storeLabel,
  ingredients,
  stores,
  priceLookup,
  recipeOpen,
  onToggleRecipe,
  pricesOpen,
  onTogglePrices,
  aiEditOpen,
  onToggleAiEdit,
  isOwner,
  onEdit,
  onOpen,
  onDelete,
}: {
  meal: Meal;
  perServing: number;
  valuePerPound: number;
  isBest: boolean;
  storeLabel: string;
  ingredients: Map<string, Ingredient>;
  stores: Store[];
  priceLookup: PriceLookup;
  recipeOpen: boolean;
  onToggleRecipe: () => void;
  pricesOpen: boolean;
  onTogglePrices: () => void;
  aiEditOpen: boolean;
  onToggleAiEdit: () => void;
  isOwner: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [scaleServings, setScaleServings] = useState(String(meal.servings));
  const scaleNum = Math.max(1, Number(scaleServings) || meal.servings);
  const isScaled = scaleNum !== meal.servings;
  const scaleFactor = meal.servings > 0 ? scaleNum / meal.servings : 1;

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        {isBest && <Badge text="Best value" tone="best" />}
        {meal.source !== "builtin" && <Badge text={meal.source === "ai" ? "✨ AI" : "Yours"} tone="cust" />}
        {meal.isVeggie && <Badge text="Veggie" tone="v" />}
        <Badge text={MEAL_CATEGORY_LABELS[meal.category]} />
        <Badge text={servingsLabel(meal.servings)} />
      </View>
      <Pressable onPress={onOpen}>
        <Text style={styles.mealName}>{meal.name}</Text>
      </Pressable>
      <Text style={styles.mealDesc}>{meal.description}</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          <Text style={styles.statBold}>{meal.proteinG}g</Text> protein / serving
        </Text>
        <Text style={styles.statText}>
          <Text style={styles.statBold}>{meal.kcal}</Text> kcal
        </Text>
        {!!meal.timeLabel && <Text style={styles.statText}>{meal.timeLabel}</Text>}
      </View>

      <View style={styles.tagRow}>
        <View>
          <Text style={styles.bigValue}>{money(perServing)}</Text>
          <Text style={styles.smallLabel}>per serving · {storeLabel}</Text>
        </View>
        <View>
          <Text style={styles.bigValue}>{valuePerPound.toFixed(0)}g</Text>
          <Text style={styles.smallLabel}>protein per £1</Text>
        </View>
      </View>

      {recipeOpen && (
        <View style={styles.recipeBlock}>
          <Text style={styles.recipeHeading}>
            Recipe · {meal.timeLabel ?? "—"} · serves {meal.servings}
          </Text>
          <View style={styles.scaleRow}>
            <Text style={styles.filterLabel}>Cooking for</Text>
            <TextInput
              style={styles.scaleInput}
              keyboardType="number-pad"
              value={scaleServings}
              onChangeText={setScaleServings}
            />
            <Text style={styles.smallLabel}>servings</Text>
          </View>
          {isScaled && (
            <Text style={styles.scaledNote}>
              For {scaleNum} servings: {money(perServing * scaleNum)} total ·{" "}
              {Math.round(meal.kcal * scaleNum).toLocaleString()} kcal · {Math.round(meal.proteinG * scaleNum)}g protein
            </Text>
          )}
          {meal.ingredients.map((use) => {
            const name = ingredients.get(use.ingredientId)?.name ?? "ingredient";
            return (
              <Text key={use.ingredientId} style={styles.listItem}>
                • {formatIngredientLine(use.humanQuantity, name)}
                {isScaled && (
                  <Text style={styles.faintText}> — {packAmountLabel(use.packFraction * scaleFactor)} for {scaleNum}</Text>
                )}
              </Text>
            );
          })}
          {meal.method.map((step, i) => (
            <Text key={i} style={styles.listItem}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      {pricesOpen && (
        <View style={styles.priceTable}>
          {meal.ingredients.map((use) => {
            const ing = ingredients.get(use.ingredientId);
            const costs = stores.map((s) => (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction);
            const lo = Math.min(...costs);
            return (
              <View key={use.ingredientId} style={styles.priceRow}>
                <Text style={styles.priceRowName}>{ing?.name ?? "Ingredient"}</Text>
                <View style={styles.priceRowCosts}>
                  {costs.map((c, i) => (
                    <Text key={i} style={[styles.priceCell, c === lo && styles.priceCellLo]}>
                      {stores[i].name}: {money(c)}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {aiEditOpen && <AiEditPanel meal={meal} ingredients={ingredients} isOwner={isOwner} />}

      <View style={styles.actionsRow}>
        <ActionBtn label={recipeOpen ? "Hide recipe" : "Recipe"} onPress={onToggleRecipe} />
        <ActionBtn label={pricesOpen ? "Hide prices" : "Prices"} onPress={onTogglePrices} />
        <ActionBtn label={aiEditOpen ? "Cancel" : "✨ Edit with AI"} onPress={onToggleAiEdit} />
        {isOwner && <ActionBtn label="Edit" onPress={onEdit} />}
        {isOwner && <ActionBtn label="Delete" tone="deal" onPress={onDelete} />}
      </View>
    </View>
  );
}

function Badge({ text, tone }: { text: string; tone?: "best" | "cust" | "v" }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "best" && styles.badgeBest,
        tone === "cust" && styles.badgeCust,
        tone === "v" && styles.badgeV,
      ]}
    >
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress, tone }: { label: string; onPress: () => void; tone?: "deal" }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Text style={[styles.actionBtnText, tone === "deal" && { color: colors.deal }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noteText: { fontSize: 13, color: colors.muted, textAlign: "center" },
  search: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  filterGroup: { marginHorizontal: 16, marginBottom: 8 },
  filterLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 4 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.ink },
  pillOn: { backgroundColor: colors.ink },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  pillTextOn: { color: colors.paper },
  lastChecked: { fontSize: 11, color: colors.faint, marginHorizontal: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: colors.muted, margin: 20, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  badge: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeBest: { backgroundColor: colors.tag, borderColor: colors.tag },
  badgeCust: { backgroundColor: colors.ink, borderColor: colors.ink },
  badgeV: { backgroundColor: colors.green, borderColor: colors.green },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.ink },
  mealName: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: 2 },
  mealDesc: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 10 },
  statText: { fontSize: 12, color: colors.muted },
  statBold: { fontWeight: "700", color: colors.ink },
  tagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.paper,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  bigValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  smallLabel: { fontSize: 11, color: colors.muted },
  recipeBlock: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  recipeHeading: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  scaleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  scaleInput: {
    width: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 13,
    color: colors.ink,
  },
  scaledNote: { fontSize: 12, color: colors.ink, backgroundColor: colors.paper, padding: 8, borderRadius: 6, marginBottom: 8 },
  listItem: { fontSize: 13, color: colors.ink, marginBottom: 4, lineHeight: 18 },
  faintText: { color: colors.faint },
  priceTable: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  priceRow: { marginBottom: 8 },
  priceRowName: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 2 },
  priceRowCosts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  priceCell: { fontSize: 12, color: colors.muted },
  priceCellLo: { color: colors.green, fontWeight: "700" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.ink },
});

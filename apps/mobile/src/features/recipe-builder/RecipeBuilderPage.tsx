// mirrors apps/web/src/features/recipe-builder/RecipeBuilderPage.tsx — same costing
// logic (packages/shared), rebuilt with RN primitives. Web's native <select> elements
// (ingredient/pack-fraction/category) become @react-native-picker/picker; everything
// else is plain TextInput/Pressable.
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  money,
  proteinPerPound,
  PACK_AMOUNTS,
  packAmountLabel,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  type Meal,
  type MealCategory,
} from "@protein-pound/shared";
import { useIngredients } from "../../lib/queries/useIngredients";
import { useStoresAndPrices } from "../../lib/queries/useStoresAndPrices";
import { useSaveCustomMeal } from "../../lib/queries/useSaveCustomMeal";
import { useUpdateCustomMeal } from "../../lib/queries/useUpdateCustomMeal";
import { colors } from "../../theme/tokens";

interface BuilderItem {
  ingredientId: string;
  packFraction: number;
}

const emptyForm = () => ({
  name: "",
  servings: 2,
  protein: 25,
  kcal: 450,
  veggie: false,
  category: "dinner" as MealCategory,
  method: "",
  items: [] as BuilderItem[],
});

export function RecipeBuilderPage({
  editingMeal,
  onDoneEditing,
}: {
  editingMeal: Meal | null;
  onDoneEditing: () => void;
}) {
  const ingredientsQuery = useIngredients();
  const storesQuery = useStoresAndPrices();
  const save = useSaveCustomMeal();
  const update = useUpdateCustomMeal();

  const [name, setName] = useState("");
  const [servings, setServings] = useState("2");
  const [protein, setProtein] = useState("25");
  const [kcal, setKcal] = useState("450");
  const [veggie, setVeggie] = useState(false);
  const [category, setCategory] = useState<MealCategory>("dinner");
  const [method, setMethod] = useState("");
  const [items, setItems] = useState<BuilderItem[]>([]);

  useEffect(() => {
    if (editingMeal) {
      setName(editingMeal.name);
      setServings(String(editingMeal.servings));
      setProtein(String(editingMeal.proteinG));
      setKcal(String(editingMeal.kcal));
      setVeggie(editingMeal.isVeggie);
      setCategory(editingMeal.category);
      setMethod(editingMeal.method.join("\n"));
      setItems(editingMeal.ingredients.map((use) => ({ ingredientId: use.ingredientId, packFraction: use.packFraction })));
    } else {
      const blank = emptyForm();
      setName(blank.name);
      setServings(String(blank.servings));
      setProtein(String(blank.protein));
      setKcal(String(blank.kcal));
      setVeggie(blank.veggie);
      setCategory(blank.category);
      setMethod(blank.method);
      setItems(blank.items);
    }
    save.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMeal]);

  if (ingredientsQuery.isLoading || storesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (ingredientsQuery.isError || storesQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.noteText}>Couldn't load the ingredient database.</Text>
      </View>
    );
  }

  const ingredients = ingredientsQuery.data!;
  const ingredientList = Array.from(ingredients.values()).sort((a, b) => a.name.localeCompare(b.name));
  const { stores, prices } = storesQuery.data!;
  const priceLookup = new Map<string, Map<string, number>>();
  for (const p of prices) {
    if (!priceLookup.has(p.ingredientId)) priceLookup.set(p.ingredientId, new Map());
    priceLookup.get(p.ingredientId)!.set(p.storeId, p.price);
  }

  const defaultIngredientId = ingredientList[0]?.id ?? "";

  const addItem = () => setItems((prev) => [...prev, { ingredientId: defaultIngredientId, packFraction: 0.25 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<BuilderItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const servingsNum = Math.max(1, Number(servings) || 1);
  const proteinNum = Math.max(0, Number(protein) || 0);
  const kcalNum = Math.max(0, Number(kcal) || 0);

  const meal: Meal = {
    id: editingMeal?.id ?? "builder",
    slug: "builder",
    name: name.trim() || "My recipe",
    servings: servingsNum,
    proteinG: proteinNum,
    kcal: kcalNum,
    isVeggie: veggie,
    timeLabel: editingMeal?.timeLabel ?? null,
    description: editingMeal?.description ?? "Your own recipe, priced from the ingredient database.",
    method: method
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    source: editingMeal?.source ?? "custom",
    ownerId: null,
    category,
    ingredients: items.map((it, index) => ({
      ingredientId: it.ingredientId,
      packFraction: it.packFraction,
      humanQuantity: packAmountLabel(it.packFraction),
      sortOrder: index,
    })),
  };

  const storeCosts = stores.map((s) => ({
    store: s,
    cost: meal.ingredients.reduce(
      (sum, use) => sum + (priceLookup.get(use.ingredientId)?.get(s.id) ?? 0) * use.packFraction,
      0
    ),
  }));
  const cheapestCost = storeCosts.length ? Math.min(...storeCosts.map((s) => s.cost)) : 0;
  const perServing = meal.servings > 0 ? cheapestCost / meal.servings : 0;
  const valuePerPound = proteinPerPound(perServing, meal.proteinG);

  const isEditing = editingMeal !== null;
  const activeMutation = isEditing ? update : save;

  const handleSave = () => {
    if (!items.length) return;
    if (isEditing) {
      update.mutate({ mealId: editingMeal.id, meal }, { onSuccess: onDoneEditing });
    } else {
      save.mutate(meal);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.heading}>{isEditing ? "Edit recipe" : "Price my recipe"}</Text>
      <Text style={styles.subtext}>
        {isEditing
          ? "Update the recipe and save — it'll refresh in your Meals list."
          : "Build a recipe from the ingredient database and see what it costs at each supermarket."}
      </Text>

      <Text style={styles.fieldLabel}>Recipe name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Mum's chicken curry" />

      <View style={styles.row3}>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Servings</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={servings} onChangeText={setServings} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Protein/serving (g)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={protein} onChangeText={setProtein} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Kcal/serving</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={kcal} onChangeText={setKcal} />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Vegetarian</Text>
      <Pressable style={[styles.pill, veggie && styles.pillOn]} onPress={() => setVeggie(!veggie)}>
        <Text style={[styles.pillText, veggie && styles.pillTextOn]}>{veggie ? "Yes" : "No"}</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.pillRow}>
        {MEAL_CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.pill, category === c && styles.pillOn]} onPress={() => setCategory(c)}>
            <Text style={[styles.pillText, category === c && styles.pillTextOn]}>{MEAL_CATEGORY_LABELS[c]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Ingredients</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.ingredientRow}>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={item.ingredientId} onValueChange={(v) => updateItem(i, { ingredientId: v })}>
              {ingredientList.map((ing) => (
                <Picker.Item key={ing.id} label={`${ing.name} (${ing.packLabel})`} value={ing.id} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrapSmall}>
            <Picker
              selectedValue={item.packFraction}
              onValueChange={(v) => updateItem(i, { packFraction: Number(v) })}
            >
              {PACK_AMOUNTS.map(([v, label]) => (
                <Picker.Item key={v} label={label} value={v} />
              ))}
            </Picker>
          </View>
          <Pressable style={styles.removeBtn} onPress={() => removeItem(i)}>
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addItem}>
        <Text style={styles.addBtnText}>+ Add ingredient</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Method (one step per line, optional)</Text>
      <TextInput
        style={styles.methodInput}
        value={method}
        onChangeText={setMethod}
        placeholder={"Fry the onions...\nAdd the chicken...\nSimmer 20 minutes..."}
        multiline
        numberOfLines={5}
      />

      {items.length > 0 && (
        <>
          <View style={styles.totRow}>
            {storeCosts.map(({ store, cost }) => (
              <View key={store.id} style={[styles.totCard, cost === cheapestCost && styles.totCardWin]}>
                <Text style={styles.totStore}>
                  {store.name}
                  {cost === cheapestCost ? " · cheapest" : ""}
                </Text>
                <Text style={styles.totPrice}>{money(cost)}</Text>
                <Text style={styles.totPerServing}>{money(cost / Math.max(1, meal.servings))} / serving</Text>
              </View>
            ))}
          </View>
          <Text style={styles.summaryText}>
            At the cheapest store that's <Text style={styles.bold}>{money(perServing)} per serving</Text>
            {meal.proteinG > 0 && (
              <Text>
                {" "}
                — <Text style={styles.okBold}>{valuePerPound.toFixed(0)}g protein per £1</Text>
              </Text>
            )}
          </Text>

          {activeMutation.isError && (
            <Text style={styles.errorText}>
              {activeMutation.error instanceof Error ? activeMutation.error.message : "Could not save recipe."}
            </Text>
          )}
          {save.isSuccess && !isEditing ? (
            <Text style={styles.okText}>Saved — it's now in your Meals list.</Text>
          ) : (
            <View style={styles.saveRow}>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={activeMutation.isPending}>
                <Text style={styles.saveBtnText}>
                  {activeMutation.isPending ? "Saving…" : isEditing ? "Save changes" : "Save to my meals"}
                </Text>
              </Pressable>
              {isEditing && (
                <Pressable style={styles.cancelBtn} onPress={onDoneEditing}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noteText: { fontSize: 13, color: colors.muted },
  heading: { fontSize: 22, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  subtext: { fontSize: 13, color: colors.muted, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 4, marginTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 8, marginTop: 18 },
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
  row3: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.ink },
  pillOn: { backgroundColor: colors.ink },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  pillTextOn: { color: colors.paper },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  pickerWrap: { flex: 2, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface },
  pickerWrapSmall: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 14, color: colors.deal, fontWeight: "700" },
  addBtn: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.ink, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  methodInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.surface,
    minHeight: 100,
    textAlignVertical: "top",
  },
  totRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  totCard: { flex: 1, minWidth: 100, borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 10, backgroundColor: colors.surface },
  totCardWin: { borderColor: colors.green, borderWidth: 2 },
  totStore: { fontSize: 11, color: colors.muted, marginBottom: 4 },
  totPrice: { fontSize: 18, fontWeight: "800", color: colors.ink },
  totPerServing: { fontSize: 11, color: colors.faint },
  summaryText: { fontSize: 13, color: colors.ink, marginTop: 12, marginBottom: 14 },
  bold: { fontWeight: "700" },
  okBold: { fontWeight: "700", color: colors.green },
  errorText: { fontSize: 12.5, color: colors.deal, marginBottom: 10 },
  okText: { fontSize: 13, color: colors.green },
  saveRow: { flexDirection: "row", gap: 8 },
  saveBtn: { backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 10 },
  saveBtnText: { color: colors.paper, fontSize: 13, fontWeight: "700" },
  cancelBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 10 },
  cancelBtnText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
});

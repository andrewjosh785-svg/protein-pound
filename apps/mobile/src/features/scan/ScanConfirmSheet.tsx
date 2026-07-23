// Shown after a barcode scan (found or not-found) — everything here is editable, since
// Open Food Facts data quality varies a lot per product, and a "not found" scan needs a
// fully manual fallback anyway. "Log it" writes through the exact same mutation as the
// existing manual Quick-add box (useLogEntries().addEntry) — a scanned item is just
// another custom-sourced log entry, no new backend/schema work needed.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { DAY_LABELS, type DayOfWeek } from "@protein-pound/shared";
import type { BarcodeLookupResult } from "../../lib/openFoodFacts";
import { useLogEntries } from "../../lib/queries/useLogEntries";
import { colors } from "../../theme/tokens";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

function todayAsDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay(); // 0 = Sun .. 6 = Sat
  return (jsDay === 0 ? 6 : jsDay - 1) as DayOfWeek; // convert to 0 = Mon .. 6 = Sun
}

export function ScanConfirmSheet({
  barcode,
  prefill,
  planId,
  onDone,
  onCancel,
}: {
  barcode: string;
  prefill: BarcodeLookupResult | null;
  planId: string | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const logEntries = useLogEntries(planId);
  const [name, setName] = useState(prefill?.name ?? `Scanned item (${barcode})`);
  // Defaults to the whole pack (not a single serving) — logging "the bag I just ate" and
  // knowing what the whole bag cost is the common case; a lone serving's cost is the
  // fiddly one. Falls back to 1 when the product's data doesn't give us a pack size.
  const initialServings = prefill?.packServings ? Math.round(prefill.packServings * 10) / 10 : 1;
  // Product recognised but Open Food Facts has no nutrition facts filled in for it — a
  // real, fairly common gap, distinct from a genuine 0 (e.g. water). Shown as a hint
  // below rather than silently prefilling zeros that look like confirmed real values.
  const missingNutritionData = !!prefill && prefill.kcalPerServing === null;
  const [servings, setServings] = useState(String(initialServings));
  const [kcal, setKcal] = useState(String(Math.round((prefill?.kcalPerServing ?? 0) * initialServings)));
  const [protein, setProtein] = useState(String(Math.round((prefill?.proteinGPerServing ?? 0) * initialServings)));
  const [cost, setCost] = useState("");
  const [day, setDay] = useState<DayOfWeek>(todayAsDayOfWeek());

  const handleServingsChange = (value: string) => {
    setServings(value);
    if (!prefill || prefill.kcalPerServing === null || prefill.proteinGPerServing === null) return;
    const n = Math.max(0, Number(value) || 0);
    setKcal(String(Math.round(prefill.kcalPerServing * n)));
    setProtein(String(Math.round(prefill.proteinGPerServing * n)));
  };

  const handleLog = () => {
    if (!name.trim()) return;
    logEntries.addEntry.mutate(
      {
        day,
        item: {
          name: name.trim(),
          kcal: Math.max(0, Number(kcal) || 0),
          proteinG: Math.max(0, Number(protein) || 0),
          cost: Math.max(0, Number(cost) || 0),
        },
      },
      { onSuccess: onDone }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{prefill ? "Confirm and log" : "Log manually"}</Text>
      {!prefill && <Text style={styles.subtext}>Couldn't find this product — fill in what you know.</Text>}
      {missingNutritionData && (
        <Text style={styles.subtext}>
          Found "{prefill!.name}", but this database doesn't have its nutrition info yet — fill in kcal/protein yourself.
        </Text>
      )}

      <Text style={styles.fieldLabel}>Item</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      {prefill && (
        <>
          <Text style={styles.fieldLabel}>
            Servings {prefill.packServings ? "(defaults to the whole pack)" : ""}
          </Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={servings} onChangeText={handleServingsChange} />
        </>
      )}

      <View style={styles.row3}>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Kcal</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={kcal} onChangeText={setKcal} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Protein (g)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={protein} onChangeText={setProtein} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Total cost (£)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={cost} onChangeText={setCost} placeholder="0.00" />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Day</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={day} onValueChange={(v) => setDay(v as DayOfWeek)}>
          {DAYS.map((d) => (
            <Picker.Item key={d} label={DAY_LABELS[d]} value={d} />
          ))}
        </Picker>
      </View>

      {logEntries.addEntry.isError && (
        <Text style={styles.errorText}>
          {logEntries.addEntry.error instanceof Error ? logEntries.addEntry.error.message : "Couldn't log this — try again."}
        </Text>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.logBtn, logEntries.addEntry.isPending && styles.logBtnDisabled]}
          onPress={handleLog}
          disabled={logEntries.addEntry.isPending}
        >
          <Text style={styles.logBtnText}>{logEntries.addEntry.isPending ? "Logging…" : "Log it"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 20 },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  subtext: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 4, marginTop: 12 },
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
  row3: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  pickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.surface },
  errorText: { fontSize: 12, color: colors.deal, marginTop: 12 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  logBtn: { flex: 1, backgroundColor: colors.ink, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { fontSize: 13, fontWeight: "700", color: colors.paper },
});

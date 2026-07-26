// Shown after a meal photo estimate (found or not-found) — everything here is editable, since
// this is a rough AI guess from a photo, not an exact lookup like barcode scan. "Log it" writes
// through the exact same mutation as the manual Quick-add box and barcode scan
// (useLogEntries().addEntry) — no new backend/schema work needed. Unlike ScanConfirmSheet,
// there's no pack-size/servings concept: a photo shows one plate, not a product with a pack.
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { DAY_LABELS, todayAsDayOfWeek, type DayOfWeek } from "@protein-pound/shared";
import type { MealPhotoEstimate } from "../../lib/queries/useEstimateMealPhoto";
import { useLogEntries } from "../../lib/queries/useLogEntries";
import { colors } from "../../theme/tokens";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export function MealPhotoConfirmSheet({
  estimate,
  planId,
  onDone,
  onCancel,
}: {
  estimate: MealPhotoEstimate | null;
  planId: string | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const logEntries = useLogEntries(planId);
  const [name, setName] = useState(estimate?.name ?? "");
  const [kcal, setKcal] = useState(String(estimate?.kcal ?? 0));
  const [protein, setProtein] = useState(String(estimate?.protein ?? 0));
  const [carbs, setCarbs] = useState(String(estimate?.carbs ?? 0));
  const [fat, setFat] = useState(String(estimate?.fat ?? 0));
  const [cost, setCost] = useState("");
  const [day, setDay] = useState<DayOfWeek>(todayAsDayOfWeek());

  const handleLog = () => {
    if (!name.trim()) return;
    logEntries.addEntry.mutate(
      {
        day,
        item: {
          name: name.trim(),
          kcal: Math.max(0, Number(kcal) || 0),
          proteinG: Math.max(0, Number(protein) || 0),
          carbsG: Math.max(0, Number(carbs) || 0),
          fatG: Math.max(0, Number(fat) || 0),
          cost: Math.max(0, Number(cost) || 0),
        },
      },
      { onSuccess: onDone }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{estimate ? "Confirm and log" : "Log manually"}</Text>
      {!estimate && <Text style={styles.subtext}>Couldn't recognise a meal in that photo — fill in what you know.</Text>}
      {estimate && (
        <View style={styles.aiNote}>
          <Text style={styles.aiNoteText}>
            🤖 Rough AI estimate from your photo — check it looks right before logging.
            {estimate.notes ? " " + estimate.notes : ""}
          </Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>Item</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Chicken stir fry" />

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
          <Text style={styles.fieldLabel}>Cost (£)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={cost} onChangeText={setCost} placeholder="optional" />
        </View>
      </View>

      <View style={styles.row3}>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Carbs (g)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={carbs} onChangeText={setCarbs} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>Fat (g)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={fat} onChangeText={setFat} />
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
  aiNote: { backgroundColor: colors.surface, borderRadius: 6, padding: 10, marginTop: 10, marginBottom: 4 },
  aiNoteText: { fontSize: 12, color: colors.muted, lineHeight: 17 },
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

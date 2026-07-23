// Full-screen camera view for scanning a product barcode, then looking it up via Open
// Food Facts. Camera permission and the scan itself can't be verified without a
// physical device — this is the one part of the feature that needs a real on-device test.
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { lookupBarcode, type BarcodeLookupResult } from "../../lib/openFoodFacts";
import { colors } from "../../theme/tokens";

type ScanState =
  | { phase: "scanning" }
  | { phase: "looking-up" }
  | { phase: "found"; barcode: string; result: BarcodeLookupResult }
  | { phase: "not-found"; barcode: string };

export function BarcodeScannerScreen({
  onConfirm,
  onCancel,
}: {
  onConfirm: (barcode: string, prefill: BarcodeLookupResult | null) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ phase: "scanning" });

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (state.phase !== "scanning") return; // ignore repeat fires while we're already processing one
    setState({ phase: "looking-up" });
    try {
      const result = await lookupBarcode(data);
      setState(result ? { phase: "found", barcode: data, result } : { phase: "not-found", barcode: data });
    } catch {
      setState({ phase: "not-found", barcode: data });
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera access is needed to scan a barcode.</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
        onBarcodeScanned={state.phase === "scanning" ? handleScan : undefined}
      />
      <View style={styles.overlay}>
        {state.phase === "scanning" && <Text style={styles.overlayText}>Point the camera at a barcode</Text>}
        {state.phase === "looking-up" && (
          <View style={styles.overlayCard}>
            <ActivityIndicator color={colors.paper} />
            <Text style={styles.overlayCardText}>Looking it up…</Text>
          </View>
        )}
        {state.phase === "found" && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayCardTitle}>{state.result.name}</Text>
            <Text style={styles.overlayCardText}>
              {state.result.kcalPerServing === null
                ? "No nutrition info in this database — you can still fill it in yourself"
                : `${state.result.kcalPerServing} kcal · ${state.result.proteinGPerServing}g protein (per serving)`}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => onConfirm(state.barcode, state.result)}>
              <Text style={styles.primaryBtnText}>Use this</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => setState({ phase: "scanning" })}>
              <Text style={styles.retryBtnText}>Scan again</Text>
            </Pressable>
          </View>
        )}
        {state.phase === "not-found" && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayCardTitle}>Couldn't find that product</Text>
            <Text style={styles.overlayCardText}>You can still log it manually with the barcode as a starting point.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => onConfirm(state.barcode, null)}>
              <Text style={styles.primaryBtnText}>Enter manually</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => setState({ phase: "scanning" })}>
              <Text style={styles.retryBtnText}>Scan again</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Pressable style={styles.closeBtn} onPress={onCancel}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.paper },
  permissionText: { fontSize: 14, color: colors.ink, textAlign: "center", marginBottom: 16 },
  overlay: { flex: 1, justifyContent: "flex-end", padding: 20 },
  overlayText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 40,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 8,
  },
  overlayCard: { backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 10, padding: 16, alignItems: "center" },
  overlayCardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  overlayCardText: { color: "#ddd", fontSize: 12, marginBottom: 12, textAlign: "center" },
  primaryBtn: { backgroundColor: colors.paper, borderRadius: 6, paddingHorizontal: 20, paddingVertical: 10 },
  primaryBtnText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  retryBtn: { marginTop: 10 },
  retryBtnText: { color: "#ddd", fontSize: 12, textDecorationLine: "underline" },
  cancelBtn: { marginTop: 12 },
  cancelBtnText: { color: colors.deal, fontSize: 13, fontWeight: "600" },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

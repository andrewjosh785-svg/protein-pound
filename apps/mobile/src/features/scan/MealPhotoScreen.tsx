// Full-screen camera view for photographing a meal (or picking an existing photo), then
// estimating rough nutrition via Gemini vision. Mirrors BarcodeScannerScreen.tsx's shape —
// camera permission and the capture/estimate round-trip can't be verified without a physical
// device, same limitation as the barcode feature.
import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions, type CameraView as CameraViewRef } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useEstimateMealPhoto, type MealPhotoEstimate } from "../../lib/queries/useEstimateMealPhoto";
import { colors } from "../../theme/tokens";

type PhotoState =
  | { phase: "capture" }
  | { phase: "estimating" }
  | { phase: "found"; estimate: MealPhotoEstimate }
  | { phase: "not-found" }
  | { phase: "error"; message: string };

export function MealPhotoScreen({
  onConfirm,
  onCancel,
}: {
  onConfirm: (estimate: MealPhotoEstimate | null) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<PhotoState>({ phase: "capture" });
  const cameraRef = useRef<CameraViewRef>(null);
  const estimateMealPhoto = useEstimateMealPhoto();

  const runEstimate = async (mimeType: string, base64: string) => {
    setState({ phase: "estimating" });
    estimateMealPhoto.mutate(
      { mimeType, data: base64 },
      {
        onSuccess: (estimate) => {
          setState(estimate.name ? { phase: "found", estimate } : { phase: "not-found" });
        },
        onError: (error) => {
          setState({ phase: "error", message: error instanceof Error ? error.message : "Something went wrong." });
        },
      }
    );
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
    if (photo?.base64) runEstimate("image/jpeg", photo.base64);
  };

  const handlePickFromLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) runEstimate("image/jpeg", asset.base64);
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
        <Text style={styles.permissionText}>Camera access is needed to photograph a meal.</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={handlePickFromLibrary}>
          <Text style={styles.cancelBtnText}>Choose from library instead</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} />
      <View style={styles.overlay}>
        {state.phase === "capture" && (
          <>
            <Text style={styles.overlayText}>Frame the meal, then take a photo</Text>
            <View style={styles.captureRow}>
              <Pressable style={styles.libraryBtn} onPress={handlePickFromLibrary}>
                <Text style={styles.libraryBtnText}>Library</Text>
              </Pressable>
              <Pressable style={styles.shutterBtn} onPress={handleCapture} />
              <View style={styles.libraryBtn} />
            </View>
          </>
        )}
        {state.phase === "estimating" && (
          <View style={styles.overlayCard}>
            <ActivityIndicator color={colors.paper} />
            <Text style={styles.overlayCardText}>Estimating…</Text>
          </View>
        )}
        {state.phase === "found" && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayCardTitle}>{state.estimate.name}</Text>
            <Text style={styles.overlayCardText}>
              ~{state.estimate.kcal} kcal · {state.estimate.protein}g protein (rough estimate)
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => onConfirm(state.estimate)}>
              <Text style={styles.primaryBtnText}>Use this</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => setState({ phase: "capture" })}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </View>
        )}
        {(state.phase === "not-found" || state.phase === "error") && (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayCardTitle}>
              {state.phase === "not-found" ? "Couldn't recognise a meal in that photo" : "Something went wrong"}
            </Text>
            <Text style={styles.overlayCardText}>
              {state.phase === "error" ? state.message : "You can still log it manually."}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => onConfirm(null)}>
              <Text style={styles.primaryBtnText}>Enter manually</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => setState({ phase: "capture" })}>
              <Text style={styles.retryBtnText}>Try again</Text>
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
    marginBottom: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 8,
  },
  captureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.4)",
  },
  libraryBtn: { width: 60, alignItems: "center" },
  libraryBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
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

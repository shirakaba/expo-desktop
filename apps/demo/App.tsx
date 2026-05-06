import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View, TurboModuleRegistry } from "react-native";
// import {} from "expo-desktop-stubs"

export default function App() {
  useEffect(() => {
    console.log(
      "Checking",
      TurboModuleRegistry.get<any>("DataMarshallingExamples").ExplicitPrimitiveArgs(
        true,
        1,
        2.0,
        "s",
      ),
    );
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

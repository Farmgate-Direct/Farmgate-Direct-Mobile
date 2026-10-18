// Route stub that opens the farmer product screen on one product's batches.
// The heavy lifting lives in the tab screen so the same view works whether the
// farmer drilled in from a link or tapped a product in the list.
import { useLocalSearchParams } from "expo-router";

import { ProductScreen } from "../(tabs)/product";

// Reads the product id from the route, plus the optional "archived" flag that
// decides whether the screen opens on live batches or archived ones.
export default function FarmerProductBatches() {
  const { id, mode } = useLocalSearchParams<{
    id: string;
    mode?: string;
  }>();

  return (
    <ProductScreen
      detailProductId={id}
      initialViewMode={mode === "archived" ? "archived" : "active"}
    />
  );
}

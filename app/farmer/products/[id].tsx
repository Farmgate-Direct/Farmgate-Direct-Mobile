// Route stub that opens the farmer product screen on one product's variations.
import { useLocalSearchParams } from "expo-router";

import { ProductScreen } from "../(tabs)/product";

export default function FarmerProductDetails() {
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

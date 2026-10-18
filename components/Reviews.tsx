// Star rating and buyer comments shown on a product.
import { Text, View } from "react-native";

// Draws one star per rating point.
export function Stars({ rating }: { rating: number }) {
  return (
    <Text className="text-yellow-500 text-sm">
      {"★".repeat(rating)}
    </Text>
  );
}

// One review card with the reviewer, date, and comment.
export function ReviewItem({ item }: any) {
  return (
    <View className="bg-gray-100 rounded-2xl p-4 mb-3 mt-3">
      <Stars rating={item.rating} />

      <Text className="font-semibold text-gray-800 mt-1">
        {item.user}
      </Text>

      <Text className="text-xs text-gray-400">
        {item.date}
      </Text>

      <Text className="text-gray-600 mt-2 leading-5">
        “{item.comment}”
      </Text>
    </View>
  );
}

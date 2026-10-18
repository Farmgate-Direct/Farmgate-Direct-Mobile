// Scrollable row of category icons used to filter products.
import { ScrollView, Image, Text, TouchableOpacity, View } from "react-native";
import { categories } from "@/constants/categories";

type Props = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

// Highlights the selected category so the buyer can see the active filter.
export default function Categories({ selectedCategory, onSelectCategory }: Props) {
  return (
    <View className="mt-5 mb-1">
      <View className="flex-row justify-between items-center mx-4 mb-3">
        <Text className="text-gray-800 font-bold text-lg">Categories</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {categories.map((item, index) => {
          const active = selectedCategory === item.name;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.75}
              onPress={() => onSelectCategory(item.name)}
              className="items-center"
              style={{ width: 68 }}
            >
              <View
                className={`rounded-2xl items-center justify-center mb-1.5 ${
                  active ? "bg-green-700" : "bg-white"
                }`}
                style={{
                  width: 60,
                  height: 60,
                  elevation: active ? 6 : 2,
                  shadowColor: active ? "#15803d" : "#000",
                  shadowOpacity: active ? 0.25 : 0.06,
                  shadowRadius: active ? 8 : 4,
                  borderWidth: active ? 0 : 1,
                  borderColor: "#e5e7eb",
                }}
              >
                <Image source={item.img} style={{ width: 32, height: 32 }} resizeMode="contain" />
              </View>

              <Text
                className={`text-[10px] text-center leading-tight font-semibold ${
                  active ? "text-green-700" : "text-gray-500"
                }`}
                numberOfLines={2}
              >
                {item.name}
              </Text>

              {/* Small dot marking the active category. */}
              {active && (
                <View className="w-1.5 h-1.5 rounded-full bg-green-600 mt-1" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
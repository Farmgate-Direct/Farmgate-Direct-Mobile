// Buyer product details screen with reviews.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../FirebaseConfig";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "@/src/context/ToastContext";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";
import { addToCart } from "@/src/services/cartService";
import {
  getProductById,
  getReviewsByProduct,
} from "@/src/services/productService";
import { ProductType, ProductVariation, ReviewType } from "@/src/types/product";

const DARK_GREEN = "#14532d";
const DESCRIPTION_PREVIEW_LENGTH = 180;

export default function ProductDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<ProductType | null>(null);
  const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyerId, setBuyerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"cart" | "buynow">("cart");
  const [farmerProfileImage, setFarmerProfileImage] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const videoPlayer = useVideoPlayer(product?.video ?? null, (player) => {
    player.loop = false;
  });
  const { isPlaying: isProductVideoPlaying } = useEvent(
    videoPlayer,
    "playingChange",
    { isPlaying: videoPlayer.playing }
  );

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const loadUser = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem("user");
      if (!data) return;
      const user = JSON.parse(data);
      setBuyerId(user.uid || user.userId || user.id || "");
      setBuyerName(user.fullName || user.name || "");
    } catch (e) {
      getUserFriendlyErrorMessage(e, "Load buyer product details");
    }
  }, []);

  const loadProduct = useCallback(async () => {
    try {
      if (!id) return;
      const data = await getProductById(String(id));
      setProduct(data);

      if (data) {
        const [reviewData, farmerDoc] = await Promise.all([
          getReviewsByProduct(data.docId),
          getDoc(doc(db, "users", data.farmerId)),
        ]);
        const initialVariation =
          data.variations.find(
            (variation) => variation.stock > 0 && variation.status === "Available"
          ) || data.variations[0];
        setSelectedVariationId(initialVariation?.id || "");

        // Older reviews may use different identity/image field names. Resolve
        // their avatar from the matching user document as a display fallback.
        const profileImageByBuyerId = new Map<string, string>();
        const reviewsWithProfiles = await Promise.all(
          reviewData.map(async (review) => {
            const legacyReview = review as ReviewType & {
              profileImage?: string;
              uid?: string;
              userId?: string;
            };
            const buyerKey =
              legacyReview.buyerId ||
              legacyReview.userId ||
              legacyReview.uid ||
              "";
            const directImage =
              legacyReview.buyerProfileImage ||
              legacyReview.profileImage ||
              "";

            if (directImage || !buyerKey) return review;
            if (profileImageByBuyerId.has(buyerKey)) {
              return {
                ...review,
                buyerProfileImage: profileImageByBuyerId.get(buyerKey) || "",
              };
            }

            try {
              let buyerData: Record<string, any> | null = null;
              const buyerDoc = await getDoc(doc(db, "users", buyerKey));
              if (buyerDoc.exists()) {
                buyerData = buyerDoc.data();
              } else {
                const userSnapshot = await getDocs(
                  query(collection(db, "users"), where("uid", "==", buyerKey))
                );
                buyerData = userSnapshot.docs[0]?.data() || null;
              }

              if (!buyerData && legacyReview.buyerName) {
                const userSnapshot = await getDocs(
                  query(
                    collection(db, "users"),
                    where("fullName", "==", legacyReview.buyerName)
                  )
                );
                buyerData = userSnapshot.docs[0]?.data() || null;
              }

              const profileImage = buyerData?.profileImage || "";
              profileImageByBuyerId.set(buyerKey, profileImage);
              if (profileImage) {
                await updateDoc(doc(db, "reviews", review.docId), {
                  buyerProfileImage: profileImage,
                });
              }
              return { ...review, buyerProfileImage: profileImage };
            } catch {
              profileImageByBuyerId.set(buyerKey, "");
              return review;
            }
          })
        );

        setReviews(reviewsWithProfiles);
        if (farmerDoc.exists()) {
          setFarmerProfileImage(farmerDoc.data().profileImage || "");
        }
      }
    } catch (e) {
      getUserFriendlyErrorMessage(e, "Load buyer product reviews");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
    void loadUser();
  }, [loadProduct, loadUser]);

  const variations = product?.variations || [];
  const selectedVariation: ProductVariation | null =
    variations.find((variation) => variation.id === selectedVariationId) ||
    variations[0] ||
    null;
  const availableVariations = variations.filter(
    (variation) => variation.status === "Available" && variation.stock > 0
  );
  const totalAvailableStock = availableVariations.reduce(
    (sum, variation) => sum + variation.stock,
    0
  );
  const prices = (availableVariations.length ? availableVariations : variations).map(
    (variation) => variation.price
  );
  const minPrice = prices.length
    ? Math.min(...prices)
    : 0;
  const maxPrice = prices.length
    ? Math.max(...prices)
    : 0;
  const unitPrice = selectedVariation?.price || 0;
  const variantMaxStock = Math.floor(
    selectedVariation && selectedVariation.status === "Available"
      ? selectedVariation.stock
      : 0
  );

  const [reviewFilter, setReviewFilter] = useState<string | "all">("all");
  const reviewedVariationIds = useMemo(
    () =>
      Array.from(
        new Set(
          reviews
            .map((review) => review.variationId)
            .filter((variationId): variationId is string => Boolean(variationId))
        )
      ),
    [reviews]
  );
  const filteredReviews = useMemo(
    () =>
      reviewFilter === "all"
        ? reviews
        : reviews.filter((review) => review.variationId === reviewFilter),
    [reviews, reviewFilter]
  );

  const avgRating = product?.rating || 0;
  const totalReviews = product?.totalReviews || 0;

  // The rating bars shown like in the Play Store, one per star.
  // They are computed from the full reviews array and not from filteredReviews,
  // so they stay consistent with avgRating and totalReviews above, which are
  // also unfiltered product level values.
  const ratingDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1-star ... index 4 = 5-star
    reviews.forEach((r) => {
      const rounded = Math.round(r.rating);
      if (rounded >= 1 && rounded <= 5) counts[rounded - 1]++;
    });
    const total = reviews.length;
    return [5, 4, 3, 2, 1].map((star) => {
      const count = counts[star - 1];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { star, count, pct };
    });
  }, [reviews]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color={DARK_GREEN} />
        <Text className="mt-3 text-green-900 font-semibold text-sm">Loading product…</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-8">
        <Text className="text-5xl mb-4">🌿</Text>
        <Text className="text-gray-700 font-bold text-lg">Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-green-900 px-6 py-3 rounded-2xl">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const productImages = product.images?.length
    ? product.images
    : product.video
      ? []
      : product.image
        ? [product.image]
        : [];
  const productMedia = [
    ...(product.video
      ? [{ type: "video" as const, uri: product.video }]
      : []),
    ...productImages.map((uri) => ({ type: "image" as const, uri })),
  ];
  const mediaWidth = Dimensions.get("window").width;

  const openModal = (mode: "cart" | "buynow") => {
    if (!selectedVariation || selectedVariation.status !== "Available" || selectedVariation.stock < 1) {
      showToast("This product is currently unavailable.");
      return;
    }
    setModalMode(mode);
    setQuantity(1);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  const handleAddToCart = async () => {
    if (!product?.docId || !selectedVariation || quantity > selectedVariation.stock) return;
    if (!buyerId) {
      showToast("Please log in to add items to your cart.");
      return;
    }
    try {
      await addToCart({
        productId: product.docId,
        variationId: selectedVariation.id,
        variationName: selectedVariation.name,
        buyerId,
        buyerName,
        farmerId: product.farmerId,
        farmName: product.farmName,
        name: product.name,
        image: product.image,
        price: selectedVariation.price,
        quantity,
        unit: selectedVariation.unit,
        createdAt: Date.now(),
      });
      showToast(`${product.name} added to cart!`);
      closeModal();
    } catch (error) {
      showToast(
        getUserFriendlyErrorMessage(
          error,
          "Add buyer product to cart",
          "We couldn't add this item to your cart. Please try again."
        )
      );
    }
  };

  const handleBuyNow = () => {
    if (!product || !selectedVariation || quantity > selectedVariation.stock) return;
    closeModal();
    router.push({
      pathname: "/buyer/checkout",
      params: {
        items: JSON.stringify([{
          farmName: product.farmName,
          farmerId: product.farmerId,
          products: [{
            productId: product.docId,
            variationId: selectedVariation.id,
            variationName: selectedVariation.name,
            name: product.name,
            price: selectedVariation.price,
            image: product.image,
            quantity,
            unit: selectedVariation.unit,
          }],
        }]),
        buyerId,
      },
    });
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 120 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Swipeable photo and video gallery, with the video first. */}
          <View
            className="w-full aspect-square bg-[#f0fdf4]"
            style={{ marginHorizontal: -20, marginTop: -20, marginBottom: 12, width: "auto" }}
          >
            {productMedia.length > 0 ? (
              <FlatList
                ref={carouselRef}
                data={productMedia}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(media) => `${media.type}-${media.uri}`}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / mediaWidth
                  );
                  if (productMedia[index]?.type !== "video") {
                    videoPlayer.pause();
                  }
                  setSelectedMediaIndex(index);
                }}
                renderItem={({ item: media }) => (
                  <View style={{ width: mediaWidth, height: "100%" }}>
                    {media.type === "video" ? (
                      <>
                        <VideoView
                          player={videoPlayer}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          nativeControls={false}
                        />
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={
                            isProductVideoPlaying
                              ? "Pause product video"
                              : "Play product video"
                          }
                          onPress={() =>
                            isProductVideoPlaying
                              ? videoPlayer.pause()
                              : videoPlayer.play()
                          }
                          className="absolute inset-0 items-center justify-center"
                        >
                          <View className="h-14 w-14 items-center justify-center rounded-full bg-black/50">
                            <Ionicons
                              name={isProductVideoPlaying ? "pause" : "play"}
                              size={28}
                              color="white"
                            />
                          </View>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Image
                        source={{ uri: media.uri }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    )}
                  </View>
                )}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="leaf-outline" size={64} color="#86efac" />
              </View>
            )}

            <LinearGradient
              colors={["rgba(0,0,0,0.35)", "transparent"]}
              className="absolute top-0 left-0 right-0 h-36"
              pointerEvents="none"
            />

            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute top-14 left-4 bg-white/90 p-2.5 rounded-[10px]"
              style={{ elevation: 3 }}
            >
              <Ionicons name="arrow-back" size={20} color={DARK_GREEN} />
            </TouchableOpacity>
          </View>

          {productMedia.length > 1 && (
            <View className="mb-5">
              <View className="flex-row items-center justify-center gap-1.5 mb-3">
                {productMedia.map((media, index) => (
                  <View
                    key={`dot-${media.type}-${media.uri}`}
                    style={{
                      width: selectedMediaIndex === index ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor:
                        selectedMediaIndex === index ? DARK_GREEN : "#d1d5db",
                    }}
                  />
                ))}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <View className="flex-row gap-2">
                  {productMedia.map((media, index) => (
                    <TouchableOpacity
                      key={`${media.type}-${media.uri}`}
                      onPress={() => {
                        if (media.type !== "video") {
                          videoPlayer.pause();
                        }
                        setSelectedMediaIndex(index);
                        carouselRef.current?.scrollToOffset({
                          offset: index * mediaWidth,
                          animated: true,
                        });
                      }}
                      className="h-16 w-16 overflow-hidden rounded-[10px]"
                      style={{
                        borderWidth: selectedMediaIndex === index ? 2 : 1,
                        borderColor:
                          selectedMediaIndex === index ? DARK_GREEN : "#e5e7eb",
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            media.type === "video"
                              ? product.image
                              : media.uri,
                        }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                      {media.type === "video" && (
                        <View className="absolute inset-0 items-center justify-center bg-black/30">
                          <Ionicons name="play" size={22} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Product name on the left, price on the right. */}
          <View className="flex-row items-start justify-between">
            {/* Name with the star rating under it. */}
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-black text-gray-900 leading-tight">
                {product.name}
              </Text>

              {avgRating > 0 && (
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text className="text-amber-600 font-bold text-xs">
                    {avgRating.toFixed(1)}
                  </Text>
                  <Text className="text-gray-400 text-[10px]">
                    ({totalReviews})
                  </Text>
                </View>
              )}
            </View>

            {/* Price range across the listing's available variations. */}
            <View className="items-end">
              {totalAvailableStock > 0 ? (
                <>
                  <Text className="text-green-900 font-black text-2xl">
                    ₱{minPrice.toFixed(2)}
                    {maxPrice !== minPrice ? `–₱${maxPrice.toFixed(2)}` : ""}
                  </Text>
                  <Text className="text-green-900 font-bold text-xs mt-1">
                    {availableVariations.length} variations available
                  </Text>
                </>
              ) : (
                <Text className="text-gray-400 font-bold text-sm">
                  Unavailable
                </Text>
              )}
            </View>
          </View>

         {/* Where the farm is. */}
          <View className="flex-row items-center justify-between mt-3">
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/buyer/farm/[farmerId]",
                  params: { farmerId: product.farmerId },
                })
              }
              className="flex-row items-center gap-1"
            >
              <Ionicons name="location-outline" size={13} color={DARK_GREEN} />
              <Text className="text-green-900 font-semibold text-sm">
                {product.farmName}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={DARK_GREEN} />
            </TouchableOpacity>

          </View>

          {selectedVariation && (
            <View className="mt-2 flex-row items-center py-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="layers-outline" size={16} color={DARK_GREEN} />
                <Text className="text-green-900 font-bold text-sm" numberOfLines={1}>
                  {selectedVariation.name}: ₱{selectedVariation.price.toFixed(2)} / {selectedVariation.unit}
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, marginHorizontal: 10 }} />
            </View>
          )}

          {/* What the farmer wrote about the product. */}
          {product.description ? (
            <>
            {/* Divider between the description and the reviews. */}
              <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginTop: 10, marginBottom: 10 }} />
              <View>
                <Text className="text-gray-800 font-bold text-base mb-2">About this product</Text>
                <Text className="text-gray-600 leading-6 text-sm">
                  {descriptionExpanded || product.description.length <= DESCRIPTION_PREVIEW_LENGTH
                    ? product.description
                    : `${product.description.slice(0, DESCRIPTION_PREVIEW_LENGTH).trim()}...`}
                </Text>
                {product.description.length > DESCRIPTION_PREVIEW_LENGTH && (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded((expanded) => !expanded)}
                    className="self-start mt-1"
                  >
                    <Text className="text-green-900 font-semibold text-sm">
                      {descriptionExpanded ? "See less" : "See more"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : null}

          <View className="mt-5">
            <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginBottom: 16 }} />
            <Text className="text-gray-800 font-bold text-base mb-4">Reviews</Text>
              <View className="flex-row items-center mb-4">
                <View className="items-center pr-5" style={{ width: 108 }}>
                  <Text
                    className="text-gray-900 font-black"
                    style={{ fontSize: 52, lineHeight: 56 }}
                  >
                    {avgRating.toFixed(1)}
                  </Text>
                  <View className="flex-row gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(avgRating) ? "star" : "star-outline"}
                        size={14}
                        color="#f59e0b"
                      />
                    ))}
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">
                    {totalReviews} reviews
                  </Text>
                </View>

                <View className="flex-1 gap-1.5">
                  {ratingDistribution.map(({ star, pct }) => (
                    <View key={star} className="flex-row items-center gap-2">
                      <Text className="text-gray-500 text-[11px]" style={{ width: 10 }}>
                        {star}
                      </Text>
                      <View className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text className="text-gray-400 text-[10px]" style={{ width: 30 }}>
                        {pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: "#e5e7eb", opacity: 0.6, marginBottom: 16 }} />

              {reviewedVariationIds.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                >
                  <TouchableOpacity
                    onPress={() => setReviewFilter("all")}
                    className={`px-4 py-2 rounded-full ${
                      reviewFilter === "all" ? "bg-green-900" : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        reviewFilter === "all" ? "text-white" : "text-gray-600"
                      }`}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  {reviewedVariationIds.map((variationId) => {
                    const variationName =
                      reviews.find((review) => review.variationId === variationId)
                        ?.variationName || "Variation";
                    return (
                      <TouchableOpacity
                        key={variationId}
                        onPress={() => setReviewFilter(variationId)}
                        className={`px-4 py-2 rounded-full ${
                          reviewFilter === variationId ? "bg-green-900" : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            reviewFilter === variationId ? "text-white" : "text-gray-600"
                          }`}
                        >
                          {variationName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            {filteredReviews.length === 0 ? (
              <Text className="text-center text-gray-400 mt-6">
                {reviewFilter === "all"
                  ? "No reviews yet."
                  : "No reviews yet for this variation."}
              </Text>
            ) : (
              filteredReviews.map((item, index) => (
                <View key={item.docId} className="mb-1">
                  {item.variationName ? (
                    <Text className="text-gray-400 text-[10px] mb-1">
                      {item.variationName}
                    </Text>
                  ) : null}
                  <ReviewCard item={item} />
                  {index < filteredReviews.length - 1 && (
                    <View style={{ height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 }} />
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100"
        style={{ elevation: 12, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-stretch">
          <TouchableOpacity
            onPress={() => {
              if (!product.farmName || !product.farmerId) {
                showToast("Farmer info not available.");
                return;
              }
              router.push({
                pathname: "/buyer/messages/ChatScreen",
                params: {
                  farmerName: product.farmName,
                  farmerId: product.farmerId,
                  farmerProfileImage: farmerProfileImage || "",
                },
              });
            }}
            className="px-5 items-center justify-center"
          >
            <AntDesign name="message" size={20} color={DARK_GREEN} />
          </TouchableOpacity>

          <View className="w-px bg-gray-100" />

          <TouchableOpacity
            onPress={() => openModal("cart")}
            disabled={totalAvailableStock <= 0}
            className="px-5 items-center justify-center flex-row gap-2"
          >
            <Ionicons name="cart-outline" size={20} color={totalAvailableStock > 0 ? DARK_GREEN : "#9ca3af"} />
            <Text className={`font-bold text-sm ${totalAvailableStock > 0 ? "text-green-900" : "text-gray-400"}`}>
              Cart
            </Text>
          </TouchableOpacity>

          <View className="w-px bg-gray-200" />

          <TouchableOpacity
            onPress={() => openModal("buynow")}
            disabled={totalAvailableStock <= 0}
            className={`flex-1 items-center justify-center py-5 ${
              totalAvailableStock > 0 ? "bg-green-900" : "bg-gray-300"
            }`}
            style={totalAvailableStock > 0 ? { elevation: 4, shadowColor: DARK_GREEN, shadowOpacity: 0.25, shadowRadius: 8 } : undefined}
          >
            <Text className="text-white font-black text-base">
              {totalAvailableStock > 0 ? "Buy Now" : "Out of Stock"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Animated.View
          className="flex-1 justify-end"
          style={{ opacity: fadeAnim }}
        >
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={closeModal}
          />
        </Animated.View>

        {product && selectedVariation && (
          <Animated.View
            className="bg-white rounded-t-[32px] px-6 pt-3 pb-10 absolute bottom-0 w-full"
            style={{
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 2,
              borderColor: DARK_GREEN,
              elevation: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.16,
              shadowRadius: 12,
            }}
          >
            <View className="flex-row gap-4 mb-5 mt-2">
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: "#f0fdf4",
                }}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons
                      name="leaf-outline"
                      size={28}
                      color="#86efac"
                    />
                  </View>
                )}
              </View>

              <View className="flex-1">
                <Text
                  className="font-black text-gray-900 text-base"
                  numberOfLines={2}
                >
                  {product.name}
                </Text>

                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={DARK_GREEN}
                  />
                  <Text className="text-green-900 text-xs font-semibold">
                    {product.farmName}
                  </Text>
                </View>

                <Text className="text-green-900 font-black text-xl mt-1.5">
                  ₱{Number(unitPrice).toFixed(2)}
                  <Text className="text-gray-400 text-xs font-normal">
                    {" / "}
                    {selectedVariation.unit}
                  </Text>
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {selectedVariation.stock} {selectedVariation.unit} available
                </Text>
              </View>
            </View>

            <View className="h-px bg-gray-100 mb-4" />

            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-2">
                Choose size or unit
              </Text>
              <ScrollView style={{ maxHeight: 184 }} showsVerticalScrollIndicator={false}>
                {variations.map((variation) => {
                  const selected = variation.id === selectedVariation.id;
                  const unavailable =
                    variation.status !== "Available" || variation.stock <= 0;
                  return (
                    <TouchableOpacity
                      key={variation.id}
                      disabled={unavailable}
                      onPress={() => {
                        setSelectedVariationId(variation.id);
                        setQuantity(1);
                      }}
                      className="flex-row items-center justify-between rounded-xl border px-3 py-3 mb-2"
                      style={{
                        borderColor: selected ? DARK_GREEN : "#e5e7eb",
                        backgroundColor: selected ? "#f0fdf4" : "#ffffff",
                        borderWidth: selected ? 2 : 1,
                        opacity: unavailable ? 0.55 : 1,
                      }}
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-gray-900 font-bold">{variation.name}</Text>
                        <Text className="text-gray-500 text-xs">
                          {variation.stock} {variation.unit} available
                        </Text>
                        {variation.description ? (
                          <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                            {variation.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="text-green-900 font-black">
                        ₱{variation.price.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-700 font-semibold">
                Quantity
              </Text>

              <View className="flex-row items-center gap-4">
                <TouchableOpacity
                  onPress={() =>
                    setQuantity((q) => Math.max(1, q - 1))
                  }
                  className="bg-gray-100 w-10 h-10 rounded-[5px] items-center justify-center"
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={quantity <= 1 ? "#d1d5db" : "#374151"}
                  />
                </TouchableOpacity>

                <Text className="font-black text-lg w-7 text-center text-gray-900">
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setQuantity((q) =>
                      Math.min(Math.max(1, variantMaxStock), q + 1)
                    )
                  }
                  className="bg-green-900 w-10 h-10 rounded-[5px] items-center justify-center"
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      quantity >= Math.max(1, variantMaxStock)
                        ? "#86efac"
                        : "white"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Running total of the chosen quantity. */}
            <View className="flex-row justify-between items-center px-1 py-3 mb-5">
              <Text className="text-gray-500 font-medium">
                Total ({quantity}x {selectedVariation.name})
              </Text>

              <Text className="font-black text-green-900 text-xl">
                ₱{(Number(unitPrice) * quantity).toFixed(2)}
              </Text>
            </View>

            {/* Skips the cart and goes straight to checkout. */}
            <TouchableOpacity
              onPress={
                modalMode === "cart"
                  ? handleAddToCart
                  : handleBuyNow
              }
              className="bg-green-900 py-4 rounded-[5px] items-center justify-center"
              style={{
                elevation: 4,
                shadowColor: DARK_GREEN,
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}
              activeOpacity={0.85}
            >
              <Text className="text-white font-black text-base">
                {modalMode === "cart" ? "Add to Cart" : "Buy Now"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Modal>
    </View>
  );
}

function ReviewCard({ item }: { item: ReviewType }) {
  return (
    <View className="flex-row items-center gap-3 bg-gray-50 rounded-2xl p-4">
      <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center overflow-hidden">
        {item.buyerProfileImage ? (
          <Image
            source={{ uri: item.buyerProfileImage }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Text className="text-green-900 font-bold text-sm">
            {item.buyerName?.charAt(0) || "?"}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-gray-800 text-sm">{item.buyerName}</Text>
          <Text className="text-gray-400 text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View className="flex-row gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= item.rating ? "star" : "star-outline"}
              size={12}
              color="#f59e0b"
            />
          ))}
        </View>

        <Text className="text-gray-600 text-sm mt-2 leading-5">{item.comment}</Text>
      </View>
    </View>
  );
}
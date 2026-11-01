// Farmer edit product info modal screen.
import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ProductType } from "../../../src/types/product";
import { ProductCategoryKey } from "@/src/constants/productCatalog";
import {
  getProductVideoValidationError,
  MAX_PRODUCT_IMAGES,
} from "@/src/constants/productMedia";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  product: ProductType;
  onSave: (product: ProductType) => Promise<void>;
  loading: boolean;
};

// Edits the listing's shared name, category, description, and media.
const EditProductModal = ({ visible, onClose, product, onSave, loading }: Props) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategoryKey>("Vegetables");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imagePublicIds, setImagePublicIds] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const previewPlayer = useVideoPlayer(video || null, (player) => {
    player.loop = false;
  });
  const { isPlaying: isPreviewPlaying } = useEvent(
    previewPlayer,
    "playingChange",
    { isPlaying: previewPlayer.playing }
  );
  const [error, setError] = useState("");

// Fills the form with the current values of the product.
  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setCategory((product.category as ProductCategoryKey) || "Vegetables");
      setDescription(product.description || "");
      setImages(
        product.images?.length
          ? product.images
          : !product.video && product.image
            ? [product.image]
            : []
      );
      setImagePublicIds(
        product.imagePublicIds?.length
          ? product.imagePublicIds
          : product.imagePublicId
            ? [product.imagePublicId]
            : []
      );
      setVideo(product.video || "");
      setError("");
    }
  }, [product]);

  const isFormValid =
    name.trim() !== "" &&
    category.trim() !== "" &&
    description.trim() !== "" &&
    (images.length > 0 || video !== "");

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PRODUCT_IMAGES - images.length,
    });
    if (!result.canceled && result.assets?.length) {
      setError("");
      setImages((current) =>
        [...current, ...result.assets.map((asset) => asset.uri).filter(Boolean)]
          .slice(0, MAX_PRODUCT_IMAGES)
      );
      setImagePublicIds((current) => [
        ...current,
        ...result.assets.map(() => ""),
      ].slice(0, MAX_PRODUCT_IMAGES));
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 20,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const validationError = getProductVideoValidationError(asset);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setVideo(asset.uri);
  };

// Validates the input and saves the edited product information.
  const handleSave = async () => {
    if (!isFormValid) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");

    try {
      await onSave({
        ...product,
        name,
        category,
        description,
        image: images[0] || "",
        images,
        imagePublicIds,
        imagePublicId: imagePublicIds[0] || "",
        video,
        videoPublicId: video ? product.videoPublicId || "" : "",
      });
      onClose();
    } catch (err) {
      setError(
        getUserFriendlyErrorMessage(
          err,
          "Save farmer product media",
          "We couldn't save these product changes right now. Please try again in a moment."
        )
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center bg-black/40 px-6">
        <View className="max-h-[90%] rounded-[10px] bg-white p-5">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-[10px] bg-green-50">
                <Ionicons name="create-outline" size={21} color="#14532d" />
              </View>
              <Text className="text-lg font-bold text-gray-900">
                Edit product
              </Text>
            </View>
            <Text className="mb-4 text-sm leading-5 text-gray-500">
              Product name and category are locked. Manage each variation&apos;s
              price, unit, stock, and description from the product listing.
            </Text>

            {error ? (
              <View className="mb-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}

            {/* The category cannot be edited. Together with the name it identifies this
                listing, so changing it could break the match with the existing
                batches. */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-1">CATEGORY</Text>
              <View className="flex-row items-center justify-between rounded-[10px] border border-gray-200 bg-gray-100 px-4 py-3">
                <Text className="text-gray-500">{category}</Text>
                <Ionicons name="lock-closed" size={14} color="#9ca3af" />
              </View>
            </View>

            {/* The product name cannot be edited either, for the same reason. */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-1">PRODUCT NAME</Text>
              <View className="flex-row items-center justify-between rounded-[10px] border border-gray-200 bg-gray-100 px-4 py-3">
                <Text className="text-gray-500">{name}</Text>
                <Ionicons name="lock-closed" size={14} color="#9ca3af" />
              </View>
            </View>

            <Text className="text-xs text-gray-500 mb-1">DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe product..."
              className="mb-4 h-24 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
            />

            <Text className="text-xs text-gray-500 mb-1">
              PRODUCT MEDIA
            </Text>
            <View className="mb-6 rounded-[10px] border border-gray-300 bg-gray-50 p-3">
              {video ? (
                <View className="mb-3">
                  <View className="relative h-44 w-full overflow-hidden rounded-[10px] bg-black">
                    <VideoView
                      player={previewPlayer}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                      nativeControls={false}
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        isPreviewPlaying
                          ? "Pause product video"
                          : "Play product video"
                      }
                      onPress={() =>
                        isPreviewPlaying
                          ? previewPlayer.pause()
                          : previewPlayer.play()
                      }
                      className="absolute inset-0 items-center justify-center"
                    >
                      <View className="h-12 w-12 items-center justify-center rounded-full bg-black/50">
                        <Ionicons
                          name={isPreviewPlaying ? "pause" : "play"}
                          size={24}
                          color="white"
                        />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel="Remove video"
                      onPress={() => {
                        previewPlayer.pause();
                        setVideo("");
                      }}
                      className="absolute right-2 top-2"
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color="#dc2626"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text className="mt-1 text-sm text-gray-700">
                    20-second product video selected
                  </Text>
                </View>
              ) : null}
              {images.length > 0 && (
                <View className="mb-3 flex-row flex-wrap gap-2">
                  {images.map((uri, index) => (
                    <View key={`${uri}-${index}`}>
                      <Image
                        source={{ uri }}
                        className="h-16 w-16 rounded-[10px]"
                      />
                      <TouchableOpacity
                        accessibilityLabel={`Remove image ${index + 1}`}
                        onPress={() => {
                          setImages((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index)
                          );
                          setImagePublicIds((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index)
                          );
                        }}
                        className="absolute -right-1 -top-1"
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#dc2626"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={pickImages}
                  disabled={images.length >= MAX_PRODUCT_IMAGES}
                  className="flex-1 items-center rounded-[10px] border border-[#14532d] px-2 py-3"
                >
                  <Text className="text-center text-xs font-semibold text-[#14532d]">
                    Add images ({images.length}/{MAX_PRODUCT_IMAGES})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickVideo}
                  disabled={video !== ""}
                  className="flex-1 items-center rounded-[10px] border border-[#14532d] px-2 py-3"
                >
                  <Text className="text-center text-xs font-semibold text-[#14532d]">
                    Add 20-sec video
                  </Text>
                </TouchableOpacity>
              </View>
              <Text className="mt-2 text-[10px] text-gray-500">
                Add up to 5 images and 1 video (20 seconds, 25 MB max).
              </Text>
            </View>

            <View className="flex-row">
              <TouchableOpacity
                onPress={onClose}
                className="mr-2 flex-1 items-center rounded-[10px] border border-[#14532d] py-3"
              >
                <View className="items-center justify-center">
                  <Text className="font-semibold text-[#14532d]">Cancel</Text>
                  <Text className="text-[10px] text-[#14532d]">(Kanselahin)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!isFormValid || loading}
                className="ml-2 flex-1 items-center rounded-[10px] py-3"
                style={{
                  backgroundColor:
                    isFormValid && !loading ? "#14532d" : "#9ca3af",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="items-center justify-center">
                    <Text className="text-white font-bold">Save</Text>
                    <Text className="text-[10px] text-white/80">(I-save)</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default EditProductModal;
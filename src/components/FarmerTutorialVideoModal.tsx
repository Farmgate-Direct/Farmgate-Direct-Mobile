import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tutorial = "dashboard" | "products" | "orders";

type Props = {
  tutorial: Tutorial;
  title: string;
  visible: boolean;
  onClose: () => void;
};

const videos = {
  dashboard: require("../../assets/vidoes/dashboard-tutorial.mp4"),
  products: require("../../assets/vidoes/productlisting-tutorial.mp4"),
  orders: require("../../assets/vidoes/order-tutorial.mp4"),
};

const videoAspectRatios = {
  dashboard: 576 / 1280,
  products: 574 / 1280,
  orders: 574 / 1280,
};

const FarmerTutorialVideoModal = ({
  tutorial,
  title,
  visible,
  onClose,
}: Props) => {
  if (!visible) return null;

  return (
    <TutorialVideoPlayerModal
      tutorial={tutorial}
      title={title}
      onClose={onClose}
    />
  );
};

type VideoModalProps = Omit<Props, "visible">;

const TutorialVideoPlayerModal = ({
  tutorial,
  title,
  onClose,
}: VideoModalProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(videos[tutorial], (videoPlayer) => {
    videoPlayer.loop = false;
  });
  const aspectRatio = videoAspectRatios[tutorial];
  const maxVideoHeight = Math.max(
    200,
    windowHeight - insets.top - insets.bottom - 88
  );
  const videoWidth = Math.min(
    windowWidth - 40,
    maxVideoHeight * aspectRatio,
    440
  );
  const videoHeight = videoWidth / aspectRatio;

  useEffect(() => {
    player.currentTime = 0;
    player.play();
  }, [player]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View
          className="overflow-hidden rounded-2xl bg-white"
          style={{ width: videoWidth }}
        >
          <View className="flex-row items-center justify-between bg-green-900 px-4 py-3">
            <Text className="flex-1 text-base font-bold text-white">
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close tutorial"
              className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              <Ionicons name="close" size={22} color="white" />
            </TouchableOpacity>
          </View>
          <VideoView
            player={player}
            style={{
              width: "100%",
              height: videoHeight,
              backgroundColor: "#000",
            }}
            contentFit="contain"
            nativeControls
            surfaceType="textureView"
          />
        </View>
      </View>
    </Modal>
  );
};

export default FarmerTutorialVideoModal;

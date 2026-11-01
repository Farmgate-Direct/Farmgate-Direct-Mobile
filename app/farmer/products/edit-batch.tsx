// Farmer edit batch price, stock and status modal.
import { Ionicons } from "@expo/vector-icons";
import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  BatchType,
} from "../../../src/types/product";
import { getUserFriendlyErrorMessage } from "@/src/utils/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  batch: BatchType | null;
  unit: string;

  onSave: (
    batchDocId: string,
    updates: {
      price: number;
      status: string;
      restockQuantity: number;
    }
  ) => Promise<void>;

  loading: boolean;
};

type DropdownProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (
    value: string
  ) => void;
};

const STATUSES = [
  "Available",
  "Out of Stock",
];

const Dropdown = ({
  label,
  value,
  options,
  onSelect,
}: DropdownProps) => {

  const [open, setOpen] =
    useState(false);

  return (
    <View className="mb-4">

      <Text className="text-xs text-gray-500 mb-1">
        {label}
      </Text>

      <TouchableOpacity
        onPress={() =>
          setOpen(!open)
        }
        className="flex-row items-center justify-between rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3"
      >

        <Text className="text-gray-800">
          {value}
        </Text>

        <Ionicons
          name={
            open
              ? "chevron-up"
              : "chevron-down"
          }
          size={18}
          color="#374151"
        />

      </TouchableOpacity>

      {open && (
        <View className="mt-1 overflow-hidden rounded-[10px] border border-gray-300 bg-white">

          {options.map(
            (option) => (

              <TouchableOpacity
                key={option}
                onPress={() => {
                  onSelect(
                    option
                  );
                  setOpen(false);
                }}
                className={`px-4 py-3 ${
                  option === value
                    ? "bg-[#14532d]"
                    : "bg-white"
                }`}
              >

                <Text
                  className={
                    option ===
                    value
                      ? "text-white"
                      : "text-black"
                  }
                >
                  {option}
                </Text>

              </TouchableOpacity>
            )
          )}

        </View>
      )}

    </View>
  );
};

// Main edit batch modal component.
const EditBatchModal = ({
  visible,
  onClose,
  batch,
  unit,
  onSave,
  loading,
}: Props) => {

  const [price, setPrice] =
    useState("");

  const [restockQuantity, setRestockQuantity] =
    useState("0");

  const [status, setStatus] =
    useState("Available");

  const [error, setError] =
    useState("");

// Fills the form with the current values of the batch.
  useEffect(() => {

    if (batch) {

      setPrice(
        batch.price?.toString() ||
          ""
      );

      setRestockQuantity(
        "0"
      );

      setStatus(
        batch.status ||
          "Available"
      );

      setError("");
    }

  }, [batch]);

  const handlePriceChange = (
    text: string
  ) => {

    if (
      /^\d*\.?\d*$/.test(
        text
      )
    ) {

      setPrice(text);
    }
  };

  const handleRestockChange = (
    text: string
  ) => {

    if (
      /^\d*$/.test(text)
    ) {

      setRestockQuantity(
        text
      );
    }
  };

  const restockValue =
    Number(
      restockQuantity || 0
    );

  const isFormValid =
    price !== "" &&
    Number(price) >= 0 &&
    status.trim() !== "" &&
    restockValue >= 0;

// Validates the input and saves the changes to the batch.
  const handleSave = async () => {

    if (!batch) {
      return;
    }

    if (!isFormValid) {

      setError(
        "Please enter a valid price, restock quantity, and status."
      );

      return;
    }

    setError("");

    try {

      await onSave(
        batch.docId,
        {
          price:
            Number(price),

          status,

          restockQuantity:
            restockValue,
        }
      );

      onClose();

    } catch (err) {
      setError(
        getUserFriendlyErrorMessage(
          err,
          "Save farmer product batch",
          "We couldn't save these batch changes right now. Please try again in a moment."
        )
      );
    }
  };

  if (!batch) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={
        onClose
      }
    >

      <View className="flex-1 justify-center bg-black/40 px-6">

        <View className="max-h-[90%] rounded-[10px] bg-white p-5">

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
          >

            <View className="flex-row items-center justify-between mb-1">

              <Text className="text-lg font-bold text-gray-800">
                Edit Batch{" "}
                {String(
                  batch.batchNumber
                ).padStart(
                  3,
                  "0"
                )}
              </Text>

              <Ionicons
                name="layers-outline"
                size={22}
                color="#14532d"
              />

            </View>

            <Text className="text-xs text-gray-400 mb-4">
              Batch information and stock can be updated anytime.
              There is no weekly limit.
            </Text>

            {error ? (

              <View className="mb-4 rounded-[10px] border border-red-100 bg-red-50 p-3">

                <Text className="text-red-600 text-sm">
                  {error}
                </Text>

              </View>

            ) : null}

            <View className="mb-4 rounded-[10px] bg-gray-50 px-4 py-4">

              <View className="flex-row justify-between">

                <View>

                  <Text className="text-gray-500 text-xs">
                    Current Stock
                  </Text>

                  <Text className="text-gray-800 font-bold text-xl mt-1">
                    {batch.stock} {unit}
                  </Text>

                </View>

                <View className="items-end">

                  <Text className="text-gray-500 text-xs">
                    Unit
                  </Text>

                  <Text className="text-gray-800 font-semibold mt-1">
                    {unit}
                  </Text>

                </View>

              </View>

              <View className="border-t border-gray-200 mt-3 pt-3">

                <Text className="text-gray-500 text-xs">
                  Total Recorded Stock
                </Text>

                <Text className="text-gray-800 font-bold text-base mt-1">
                  {batch.totalHarvested} {unit}
                </Text>

              </View>

              <Text className="mt-2 text-xs text-gray-500">
                Restock quantity will be added to the current stock.
                Existing sales history will not be changed.
              </Text>

            </View>

            <Text className="mb-1 text-xs text-gray-500">
              PRICE (₱ per {unit.replace(/^per /, "")})
            </Text>

            <TextInput
              value={price}
              onChangeText={
                handlePriceChange
              }
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              className="mb-4 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
            />

            <Text className="mb-1 text-xs text-gray-500">
              RESTOCK QUANTITY ({unit})
            </Text>

            <TextInput
              value={
                restockQuantity
              }
              onChangeText={
                handleRestockChange
              }
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              className="mb-2 rounded-[10px] border border-gray-300 bg-gray-100 px-4 py-3 text-gray-800"
            />

            <Text className="mb-4 text-xs text-gray-500">
              Enter 0 if you are not adding stock.
            </Text>

            <View className="mb-4 rounded-[10px] bg-green-50 p-4">

              <Text className="text-xs text-gray-600">
                Stock after save
              </Text>

              <Text className="mt-1 text-2xl font-bold text-[#14532d]">
                {Number(
                  batch.stock || 0
                ) +
                  restockValue}{" "}
                {unit}
              </Text>

            </View>

            <Dropdown
              label="STATUS"
              value={status}
              options={STATUSES}
              onSelect={
                setStatus
              }
            />

            <View className="flex-row justify-between mt-2">

              <TouchableOpacity
                onPress={
                  onClose
                }
                disabled={
                  loading
                }
                className="w-[48%] items-center rounded-[10px] border border-[#14532d] py-3"
              >

                <Text className="font-semibold text-[#14532d]">
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                onPress={
                  handleSave
                }
                disabled={
                  !isFormValid ||
                  loading
                }
                className="w-[48%] items-center rounded-[10px] py-3"
                style={{
                  backgroundColor:
                    isFormValid && !loading ? "#14532d" : "#9ca3af",
                }}
              >

                {loading ? (

                  <ActivityIndicator
                    color="#fff"
                  />

                ) : (

                  <Text className="text-white font-bold">
                    Save
                  </Text>

                )}

              </TouchableOpacity>

            </View>

          </ScrollView>

        </View>

      </View>

    </Modal>
  );
};

export default EditBatchModal;
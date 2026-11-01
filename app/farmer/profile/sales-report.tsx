import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFarmerScreenBottomPadding } from "@/src/constants/farmerLayout";
import {
  getFarmerSalesOverview,
  getFarmerSalesReport,
  type FarmerSalesOverview,
  type FarmerSalesReport,
} from "@/src/services/farmerSalesReportService";
import {
  getUserFriendlyErrorMessage,
} from "@/src/utils/userFacingError";

const FILTERS = ["All", "This Week", "This Month", "This Year", "Custom"] as const;
type Filter = (typeof FILTERS)[number];
type PickerTarget = "start" | "end";
const FILTER_OPTIONS = FILTERS.map((label) => ({ label, value: label }));

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getPresetRange = (filter: Exclude<Filter, "Custom">, now: Date) => {
  const today = startOfDay(now);
  if (filter === "This Week") {
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    return { start: monday, end: endOfDay(today) };
  }
  if (filter === "This Month") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: endOfDay(today),
    };
  }
  return {
    start: new Date(today.getFullYear(), 0, 1),
    end: endOfDay(today),
  };
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatMoney = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildReportHtml = (
  report: FarmerSalesReport,
  period: string,
  generatedAt: Date
) => {
  const rows = report.orders
    .map((order) => {
      const products = order.products
        .map(
          (product) =>
            `<div class="product-line"><strong>${escapeHtml(product.name)}</strong><span>${product.quantity} ${escapeHtml(product.unit)}</span></div>`
        )
        .join("");
      return `<tr>
        <td class="order-id">${escapeHtml(order.orderId)}</td>
        <td>${escapeHtml(order.buyerName)}</td>
        <td class="products-cell">${products || "—"}</td>
        <td class="center">${order.quantity}</td>
        <td>${order.orderDate ? formatDate(new Date(order.orderDate)) : "—"}</td>
        <td>${formatDate(new Date(order.completedDate))}</td>
        <td class="amount">${formatMoney(order.totalAmount)}</td>
      </tr>`;
    })
    .join("");
  const topProducts = report.topProducts
    .map(
      (product, index) => `<tr>
        <td class="rank">${index + 1}</td>
        <td><strong>${escapeHtml(product.name)}</strong></td>
        <td class="center">${product.quantity} ${escapeHtml(product.unit)}</td>
        <td class="amount">${formatMoney(product.sales)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 28px 30px 34px; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .brand { margin: 0 0 22px; padding: 17px 30px 15px; background: #15803d; color: #fff; }
          .brand-row { display: flex; justify-content: space-between; align-items: center; }
          .brand-name { font-size: 14px; font-weight: 700; letter-spacing: .2px; }
          .brand-tag { color: #dcfce7; font-size: 8px; }
          .heading-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
          h1 { margin: 0; color: #111827; font-size: 18px; }
          .period { padding: 5px 9px; border-radius: 3px; background: #15803d; color: #fff; font-size: 8px; font-weight: 700; }
          .generated { margin: 0; color: #6b7280; font-size: 8px; }
          .divider { height: 1px; margin: 12px 0 15px; background: #15803d; }
          .identity { display: flex; gap: 32px; margin-bottom: 14px; }
          .identity-label { display: block; margin-bottom: 3px; color: #6b7280; font-size: 7px; text-transform: uppercase; letter-spacing: .5px; }
          .identity-value { color: #111827; font-size: 9px; font-weight: 700; }
          .summary { display: flex; gap: 8px; margin-bottom: 16px; }
          .metric { flex: 1; padding: 10px 11px; border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb; }
          .metric.primary { border-color: #bbf7d0; background: #ecfdf5; }
          .label { color: #6b7280; font-size: 7px; text-transform: uppercase; letter-spacing: .35px; }
          .value { margin-top: 5px; color: #111827; font-size: 13px; font-weight: 700; }
          .section { margin: 15px 0 6px; padding: 6px 9px; background: #ecfdf5; color: #14532d; font-size: 9px; font-weight: 700; }
          .section-meta { float: right; color: #64748b; font-size: 7px; font-weight: 400; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          th { padding: 7px 5px; border: 1px solid #15803d; background: #15803d; color: #fff; text-align: left; font-size: 7px; }
          td { padding: 6px 5px; border: 1px solid #e5e7eb; vertical-align: top; overflow-wrap: anywhere; font-size: 7.5px; }
          tbody tr:nth-child(even) { background: #f9fafb; }
          tr { page-break-inside: avoid; }
          .rank { width: 7%; color: #15803d; text-align: center; font-weight: 700; }
          .center { text-align: center; }
          .amount { text-align: right; white-space: nowrap; font-weight: 700; }
          .order-id { font-weight: 700; }
          .products-cell { line-height: 1.5; }
          .product-line { display: flex; justify-content: space-between; gap: 5px; }
          .empty { padding: 14px; color: #6b7280; text-align: center; }
          .footer { margin-top: 18px; padding-top: 7px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 7px; }
        </style>
      </head>
      <body>
        <header class="brand">
          <div class="brand-row">
            <div class="brand-name">FarmGate Direct</div>
            <div class="brand-tag">FARMER SALES</div>
          </div>
        </header>
        <div class="heading-row">
          <h1>Sales Report</h1>
          <span class="period">${escapeHtml(period)}</span>
        </div>
        <p class="generated"> ${escapeHtml(generatedAt.toLocaleString("en-PH"))}</p>
        <div class="divider"></div>
        <section class="identity">
          <div><span class="identity-label">Farmer</span><span class="identity-value">${escapeHtml(report.farmerName)}</span></div>
          <div><span class="identity-label">Farm</span><span class="identity-value">${escapeHtml(report.farmName)}</span></div>
        </section>
        <section class="summary">
          <div class="metric primary"><div class="label">Total Sales</div><div class="value">${formatMoney(report.totals.sales)}</div></div>
          <div class="metric"><div class="label">Completed Orders</div><div class="value">${report.totals.completedOrders}</div></div>
          <div class="metric"><div class="label">Products Sold</div><div class="value">${report.totals.productsSold}</div></div>
        </section>
        <div class="section">Best-Selling Products<span class="section-meta">Ranked by quantity sold</span></div>
        <table>
          <colgroup><col style="width:7%"><col style="width:53%"><col style="width:20%"><col style="width:20%"></colgroup>
          <thead><tr><th>#</th><th>Product</th><th class="center">Quantity Sold</th><th class="amount">Sales</th></tr></thead>
          <tbody>${topProducts || `<tr><td class="empty" colspan="4">No product sales in this period.</td></tr>`}</tbody>
        </table>
        <div class="section">Completed Sales<span class="section-meta">${report.totals.completedOrders} orders</span></div>
        <table>
          <colgroup><col style="width:13%"><col style="width:14%"><col style="width:25%"><col style="width:8%"><col style="width:12%"><col style="width:14%"><col style="width:14%"></colgroup>
          <thead><tr>
            <th>Order ID</th><th>Buyer</th><th>Products Purchased</th><th>Quantity</th>
            <th>Order Date</th><th>Completed</th><th class="amount">Sales</th>
          </tr></thead>
          <tbody>${rows || `<tr><td class="empty" colspan="7">No completed sales in this period.</td></tr>`}</tbody>
        </table>
        <div class="footer">FarmGate Direct &bull; Farmer Sales Report &bull; ${escapeHtml(period)}</div>
      </body>
    </html>`;
};

const SalesReport = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [filter, setFilter] = useState<Filter>("All");
  const [customStart, setCustomStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [customEnd, setCustomEnd] = useState(startOfDay(now));
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [report, setReport] = useState<FarmerSalesReport | null>(null);
  const [salesOverview, setSalesOverview] =
    useState<FarmerSalesOverview | null>(null);
  const [customOverview, setCustomOverview] =
    useState<FarmerSalesReport | null>(null);
  const [customOverviewLoading, setCustomOverviewLoading] = useState(false);
  const [customOverviewError, setCustomOverviewError] = useState<string | null>(
    null
  );
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const range = useMemo(() => {
    if (filter === "Custom") {
      return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    }
    if (
      filter === "This Week" ||
      filter === "This Month" ||
      filter === "This Year"
    ) {
      return getPresetRange(filter, new Date());
    }
    if (filter === "All") {
      return { start: new Date(0), end: endOfDay(new Date()) };
    }
    return getPresetRange("This Month", new Date());
  }, [filter, customEnd, customStart]);
  const period =
    filter === "All"
      ? "All time"
      : `${formatDate(range.start)} – ${formatDate(range.end)}`;
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();

  useEffect(() => {
    let active = true;
    setOverviewLoading(true);
    setOverviewError(null);

    getFarmerSalesOverview()
      .then((result) => {
        if (active) setSalesOverview(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSalesOverview(null);
        setOverviewError(
          getUserFriendlyErrorMessage(
            error,
            "Load farmer sales overview",
            "We couldn't load your sales overview. Please try again."
          )
        );
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [overviewRefresh]);

  useEffect(() => {
    if (filter !== "Custom") return;
    let active = true;
    setCustomOverviewLoading(true);
    setCustomOverviewError(null);
    getFarmerSalesReport(new Date(rangeStart), new Date(rangeEnd))
      .then((result) => {
        if (active) setCustomOverview(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCustomOverview(null);
        setCustomOverviewError(
          getUserFriendlyErrorMessage(
            error,
            "Load custom farmer sales overview",
            "We couldn't load your sales overview. Please try again."
          )
        );
      })
      .finally(() => {
        if (active) setCustomOverviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, rangeStart, rangeEnd]);

  const selectedOverview =
    filter === "Custom"
      ? customOverview
      : filter === "All"
        ? salesOverview?.all
      : filter === "This Week"
        ? salesOverview?.week
        : filter === "This Year"
          ? salesOverview?.year
          : salesOverview?.month;

  const clearGeneratedReport = () => {
    setReport(null);
    setPdfUri(null);
  };

  const selectFilter = (value: Filter) => {
    setFilter(value);
    clearGeneratedReport();
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setPickerTarget(null);
    if (event.type !== "set" || !selectedDate || !pickerTarget) return;

    if (pickerTarget === "start") {
      const nextStart = startOfDay(selectedDate);
      setCustomStart(nextStart);
      if (nextStart > customEnd) setCustomEnd(nextStart);
    } else {
      const nextEnd = startOfDay(selectedDate);
      setCustomEnd(nextEnd < customStart ? customStart : nextEnd);
    }
    setFilter("Custom");
    clearGeneratedReport();
  };

  const generateReport = async () => {
    if (range.start > range.end) {
      Alert.alert("Check your dates", "The start date must be before the end date.");
      return;
    }

    setGenerating(true);
    clearGeneratedReport();
    try {
      const result = await getFarmerSalesReport(range.start, range.end);
      const file = await Print.printToFileAsync({
        html: buildReportHtml(result, period, new Date()),
      });
      setReport(result);
      setPdfUri(file.uri);
    } catch (error) {
      Alert.alert(
        "Report unavailable",
        getUserFriendlyErrorMessage(
          error,
          "Generate farmer sales report",
          "We couldn't prepare your report right now. Please try again in a moment."
        )
      );
    } finally {
      setGenerating(false);
    }
  };

  const previewPdf = async () => {
    if (!pdfUri) return;
    try {
      await Print.printAsync({ uri: pdfUri });
    } catch (error) {
      Alert.alert(
        "Preview unavailable",
        getUserFriendlyErrorMessage(
          error,
          "Preview farmer sales report",
          "We couldn't open the PDF preview. Please try sharing the report instead."
        )
      );
    }
  };

  const sharePdf = async () => {
    if (!pdfUri) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "PDF sharing isn't available on this device. You can still preview or save the report."
        );
        return;
      }
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Farmer Sales Report",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert(
        "Sharing unavailable",
        getUserFriendlyErrorMessage(
          error,
          "Share farmer sales report",
          "We couldn't share the PDF right now. Please try again."
        )
      );
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View
        className="flex-row items-center bg-green-900 px-5 pb-5"
        style={{ paddingTop: insets.top + 16 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="ml-4 text-2xl font-bold text-white">Sales Report</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: getFarmerScreenBottomPadding(insets.bottom),
        }}
      >
        <Text className="mb-3 text-lg font-bold text-gray-900">
          Sales overview
        </Text>
        <View className="mb-5">
          {overviewLoading ? (
            <View className="items-center rounded-2xl bg-white px-4 py-8">
              <ActivityIndicator size="small" color="#14532d" />
              <Text className="mt-2 text-sm text-gray-500">
                Loading your sales overview...
              </Text>
            </View>
          ) : overviewError ? (
            <View className="rounded-2xl border border-amber-100 bg-white p-4">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-amber-50">
                  <Ionicons
                    name="time-outline"
                    size={23}
                    color="#a16207"
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-gray-900">
                    Sales overview unavailable
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-gray-500">
                    {overviewError}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setOverviewRefresh((value) => value + 1)}
                className="mt-4 min-h-11 flex-row items-center justify-center rounded-xl bg-green-800 px-4"
              >
                <Ionicons name="refresh-outline" size={18} color="white" />
                <Text className="ml-2 text-sm font-semibold text-white">
                  Try again
                </Text>
              </TouchableOpacity>
            </View>
          ) : salesOverview ? (
            <>
              <View className="mb-2 rounded-xl bg-green-900 px-4 py-4">
                <Text className="text-sm font-medium text-green-100">
                  Overall sales
                </Text>
                <Text className="mt-1 text-2xl font-bold text-white">
                  {formatMoney(salesOverview.all.totals.sales)}
                </Text>
                <Text className="mt-1 text-xs text-green-100">
                  {salesOverview.all.totals.completedOrders} completed{" "}
                  {salesOverview.all.totals.completedOrders === 1
                    ? "order"
                    : "orders"}
                </Text>
              </View>
              {[
                { label: "Sales this week", report: salesOverview.week },
                { label: "Sales this month", report: salesOverview.month },
                { label: "Sales this year", report: salesOverview.year },
              ].map(({ label, report: periodReport }) => (
                <View
                  key={label}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
                >
                  <View>
                    <Text className="text-sm font-medium text-gray-700">
                      {label}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {periodReport.totals.completedOrders} completed{" "}
                      {periodReport.totals.completedOrders === 1
                        ? "order"
                        : "orders"}
                    </Text>
                  </View>
                  <Text className="ml-2 text-base font-bold text-gray-900">
                    {formatMoney(periodReport.totals.sales)}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </View>

        <Text className="mb-2 text-base font-semibold text-gray-800">
          Best-selling items
        </Text>
        <Dropdown
          style={{
            backgroundColor: "#ffffff",
            borderColor: "#e5e7eb",
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 16,
            height: 50,
            marginBottom: 12,
          }}
          data={FILTER_OPTIONS}
          labelField="label"
          valueField="value"
          value={filter}
          placeholder="Select report period"
          activeColor="#f0fdf4"
          onChange={(item) => selectFilter(item.value as Filter)}
        />

        {filter === "Custom" && (
          <View className="mb-4 flex-row gap-3">
            {(["start", "end"] as const).map((target) => {
              const date = target === "start" ? customStart : customEnd;
              return (
                <TouchableOpacity
                  key={target}
                  onPress={() => setPickerTarget(target)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <Text className="text-xs font-medium text-gray-500">
                    {target === "start" ? "From" : "To"}
                  </Text>
                  <Text className="mt-1 font-semibold text-gray-800">
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {pickerTarget && (
          <DateTimePicker
            value={pickerTarget === "start" ? customStart : customEnd}
            mode="date"
            display="default"
            maximumDate={pickerTarget === "start" ? customEnd : undefined}
            minimumDate={pickerTarget === "end" ? customStart : undefined}
            onChange={handleDateChange}
          />
        )}

        <View className="mb-5">
          {filter === "Custom" && customOverviewLoading ? (
            <View className="items-center rounded-2xl bg-white px-4 py-6">
              <ActivityIndicator size="small" color="#14532d" />
              <Text className="mt-2 text-sm text-gray-500">
                Loading best-selling items...
              </Text>
            </View>
          ) : filter === "Custom" && customOverviewError ? (
            <Text className="rounded-xl bg-white p-4 text-sm text-gray-500">
              {customOverviewError}
            </Text>
          ) : selectedOverview ? (
            selectedOverview.topProducts.length > 0 ? (
              <>
                <View className="mb-3 rounded-2xl border border-green-100 bg-green-50 p-4">
                  <View className="mb-2">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-green-800">
                      Pinakamabentang item
                    </Text>
                  </View>
                  <Text className="text-lg font-bold text-gray-900">
                    {selectedOverview.topProducts[0].name}
                  </Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text className="text-sm text-gray-600">
                      {selectedOverview.topProducts[0].quantity}{" "}
                      {selectedOverview.topProducts[0].unit} sold
                    </Text>
                    <Text className="text-sm font-semibold text-gray-800">
                      {formatMoney(selectedOverview.topProducts[0].sales)}
                    </Text>
                  </View>
                </View>
                <View className="rounded-2xl border border-gray-100 bg-white p-4">
                  <View className="mb-3">
                    <Text className="text-base font-bold text-gray-900">
                      Best-selling products
                    </Text>
                  </View>
                  {selectedOverview.topProducts.map((product, index) => (
                    <View
                      key={`${product.name}-${product.unit}`}
                      className={`flex-row items-center justify-between ${
                        index < selectedOverview.topProducts.length - 1
                          ? "mb-3"
                          : ""
                      }`}
                    >
                      <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-green-50">
                        <Text className="text-xs font-bold text-green-800">
                          {index + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold text-gray-800"
                          numberOfLines={1}
                        >
                          {product.name}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {product.quantity} {product.unit} sold
                        </Text>
                      </View>
                      <Text className="ml-3 text-sm font-semibold text-gray-700">
                        {formatMoney(product.sales)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text className="rounded-xl bg-white p-4 text-sm text-gray-500">
                No completed product sales in this period yet.
              </Text>
            )
          ) : null}
        </View>

        <TouchableOpacity
          onPress={generateReport}
          disabled={
            generating ||
            overviewLoading ||
            Boolean(overviewError) ||
            (filter === "Custom" && customOverviewLoading)
          }
          className={`min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3 ${
            generating ||
            overviewLoading ||
            overviewError ||
            (filter === "Custom" && customOverviewLoading)
              ? "bg-green-800/50"
              : "bg-green-800"
          }`}
        >
          {generating ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="white" />
              <Text className="ml-2 font-semibold text-white">
                Generate Sales Report PDF
              </Text>
            </>
          )}
        </TouchableOpacity>

        {report && pdfUri && (
          <View className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-base font-semibold text-gray-800">
              PDF ready
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              {report.totals.completedOrders} completed{" "}
              {report.totals.completedOrders === 1 ? "order" : "orders"} ·{" "}
              {formatMoney(report.totals.sales)} total sales
            </Text>
            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={previewPdf}
                className="min-h-11 flex-1 flex-row items-center justify-center rounded-lg border border-green-800 px-2"
              >
                <Ionicons name="eye-outline" size={18} color="#166534" />
                <Text className="ml-2 text-sm font-semibold text-green-800">
                  Preview / Save PDF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sharePdf}
                className="min-h-11 flex-1 flex-row items-center justify-center rounded-lg bg-green-800 px-2"
              >
                <Ionicons name="share-outline" size={18} color="white" />
                <Text className="ml-2 text-sm font-semibold text-white">
                  Share PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SalesReport;

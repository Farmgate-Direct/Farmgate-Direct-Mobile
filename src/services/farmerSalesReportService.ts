import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  type DocumentData,
  type QuerySnapshot,
  where,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";

export type FarmerSalesReportOrder = {
  id: string;
  orderId: string;
  buyerName: string;
  products: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  quantity: number;
  orderDate: string | null;
  completedDate: string;
  totalAmount: number;
};

export type FarmerSalesReport = {
  farmerName: string;
  farmName: string;
  totals: {
    sales: number;
    productsSold: number;
    completedOrders: number;
  };
  topProducts: {
    name: string;
    unit: string;
    quantity: number;
    sales: number;
  }[];
  orders: FarmerSalesReportOrder[];
};

export type FarmerSalesOverview = {
  all: FarmerSalesReport;
  week: FarmerSalesReport;
  month: FarmerSalesReport;
  year: FarmerSalesReport;
};

type ReportProduct = FarmerSalesReportOrder["products"][number] & {
  productId: string;
  sales: number;
};

const COMPLETED_STATUSES = new Set(["delivered", "claimed"]);

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const getProducts = (value: unknown): ReportProduct[] =>
  (Array.isArray(value) ? value : [])
    .map((item: any) => {
      const quantity = numberOrNull(item?.quantity) ?? 0;
      const price = numberOrNull(item?.price) ?? 0;
      return {
        productId: String(item?.productId || ""),
        name: String(item?.name || "Product"),
        quantity: quantity > 0 ? quantity : 0,
        unit: String(item?.unit || ""),
        sales: quantity > 0 && price >= 0 ? roundMoney(price * quantity) : 0,
      };
    })
    .filter((product) => product.quantity > 0);

const getOrderSubtotal = (
  order: Record<string, any>,
  products: ReportProduct[]
) => {
  const savedSubtotal =
    numberOrNull(order.subTotal) ?? numberOrNull(order.subtotal);
  if (savedSubtotal !== null && savedSubtotal >= 0) {
    return roundMoney(savedSubtotal);
  }

  if (products.length > 0) {
    return roundMoney(
      products.reduce((sum, product) => sum + product.sales, 0)
    );
  }

  const total = numberOrNull(order.total) ?? 0;
  const deliveryFee = numberOrNull(order.deliveryFee) ?? 0;
  return roundMoney(Math.max(0, total - deliveryFee));
};

const getFarmerSalesData = async () => {
  const farmer = getAuth().currentUser;
  if (!farmer) {
    throw new Error("Your login session has expired. Please login again.");
  }

  const profileSnapshot = await getDoc(doc(db, "users", farmer.uid));
  if (!profileSnapshot.exists() || profileSnapshot.data().role !== "farmer") {
    throw new Error("Farmer profile could not be verified.");
  }

  const ordersSnapshot = await getDocs(
    query(
      collection(db, "orders"),
      where("farmerId", "==", farmer.uid)
    )
  );
  return {
    farmerId: farmer.uid,
    profile: profileSnapshot.data(),
    ordersSnapshot,
  };
};

const buildFarmerSalesReport = (
  start: Date,
  end: Date,
  farmerId: string,
  profile: Record<string, any>,
  ordersSnapshot: QuerySnapshot<DocumentData, DocumentData>
): FarmerSalesReport => {
  const orders: FarmerSalesReportOrder[] = [];
  const topProducts = new Map<
    string,
    FarmerSalesReport["topProducts"][number]
  >();
  const seenOrderIds = new Set<string>();

  ordersSnapshot.forEach((orderSnapshot) => {
    const order = orderSnapshot.data();
    const completedAt = toDate(order.deliveredAt) || toDate(order.createdAt);
    if (
      order.farmerId !== farmerId ||
      !COMPLETED_STATUSES.has(order.status) ||
      !completedAt ||
      completedAt < start ||
      completedAt > end
    ) {
      return;
    }

    const orderId = String(order.orderNumber || orderSnapshot.id);
    if (seenOrderIds.has(orderId)) return;

    const products = getProducts(order.products);
    const subtotal = getOrderSubtotal(order, products);
    seenOrderIds.add(orderId);

    products.forEach((product) => {
      const key = `${product.productId || product.name.toLowerCase()}|${product.unit.toLowerCase()}`;
      const existing = topProducts.get(key) || {
        name: product.name,
        unit: product.unit,
        quantity: 0,
        sales: 0,
      };
      existing.quantity = roundMoney(existing.quantity + product.quantity);
      existing.sales = roundMoney(existing.sales + product.sales);
      topProducts.set(key, existing);
    });

    const createdAt = toDate(order.createdAt);

    orders.push({
      id: orderSnapshot.id,
      orderId,
      buyerName: String(order.buyerName || "Buyer"),
      products: products.map(({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })),
      quantity: products.reduce((total, product) => total + product.quantity, 0),
      orderDate: createdAt?.toISOString() || null,
      completedDate: completedAt.toISOString(),
      totalAmount: roundMoney(subtotal),
    });
  });

  orders.sort(
    (first, second) =>
      new Date(second.completedDate).getTime() -
      new Date(first.completedDate).getTime()
  );
  const totals = orders.reduce(
    (result, order) => ({
      sales: roundMoney(result.sales + order.totalAmount),
      productsSold: result.productsSold + order.quantity,
    }),
    { sales: 0, productsSold: 0 }
  );
  return {
    farmerName: String(profile.fullName || "Farmer"),
    farmName: String(profile.farmName || "Farm"),
    totals: {
      ...totals,
      completedOrders: orders.length,
    },
    topProducts: Array.from(topProducts.values())
      .sort((first, second) => second.quantity - first.quantity || second.sales - first.sales)
      .slice(0, 5),
    orders,
  };
};

const validateRange = (start: Date, end: Date) => {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end < start
  ) {
    throw new Error("Choose a valid report date range.");
  }
};

export const getFarmerSalesReport = async (
  start: Date,
  end: Date
): Promise<FarmerSalesReport> => {
  validateRange(start, end);
  const { farmerId, profile, ordersSnapshot } = await getFarmerSalesData();
  return buildFarmerSalesReport(start, end, farmerId, profile, ordersSnapshot);
};

export const getFarmerSalesOverview = async (
  now = new Date()
): Promise<FarmerSalesOverview> => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const { farmerId, profile, ordersSnapshot } = await getFarmerSalesData();

  return {
    all: buildFarmerSalesReport(
      new Date(0),
      weekEnd,
      farmerId,
      profile,
      ordersSnapshot
    ),
    week: buildFarmerSalesReport(
      weekStart,
      weekEnd,
      farmerId,
      profile,
      ordersSnapshot
    ),
    month: buildFarmerSalesReport(
      monthStart,
      weekEnd,
      farmerId,
      profile,
      ordersSnapshot
    ),
    year: buildFarmerSalesReport(
      yearStart,
      weekEnd,
      farmerId,
      profile,
      ordersSnapshot
    ),
  };
};

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { db } from "../../FirebaseConfig";
import { normalizeProductName } from "@/src/constants/productCatalog";
import type {
  CreateProductInput,
  CreateReviewInput,
  ProductType,
  ProductVariation,
  ReviewType,
} from "../types/product";

const productCollection = collection(db, "products");
const reviewCollection = collection(db, "reviews");

const normalizeProduct = (
  id: string,
  data: Omit<CreateProductInput, "variations"> & {
    variations?: ProductVariation[];
  }
): ProductType => {
  const variations: ProductVariation[] =
    Array.isArray(data.variations) && data.variations.length > 0
      ? data.variations
      : [
          {
            id: "legacy-default",
            name: data.unit || "Standard",
            price: Number(data.price || 0),
            stock: Number(data.stock || 0),
            unit: data.unit || "unit",
            status:
              Number(data.stock || 0) > 0 ? "Available" : "Out of Stock",
          },
        ];

  return {
    ...data,
    docId: id,
    variations,
  };
};

const validateVariations = (
  variations: ProductVariation[]
): ProductVariation[] => {
  if (!Array.isArray(variations) || variations.length === 0) {
    throw new Error("Add at least one product variation.");
  }

  const ids = new Set<string>();
  const names = new Set<string>();

  return variations.map((variation) => {
    const id = String(variation.id || "").trim();
    const name = String(variation.name || "").trim();
    const unit = String(variation.unit || "").trim();
    const price = Number(variation.price);
    const stock = Number(variation.stock);

    if (!id || ids.has(id)) {
      throw new Error("Each variation must have a unique identifier.");
    }
    if (!name || !unit) {
      throw new Error("Every variation needs a name and unit.");
    }
    if (names.has(name.toLocaleLowerCase())) {
      throw new Error("Variation names must be unique for this product.");
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Enter a valid price for ${name}.`);
    }
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error(`Enter a non-negative stock quantity for ${name}.`);
    }

    ids.add(id);
    names.add(name.toLocaleLowerCase());
    return {
      ...variation,
      id,
      name,
      unit,
      price,
      stock,
      description: String(variation.description || "").trim(),
      status: stock > 0 ? "Available" : "Out of Stock",
    };
  });
};

const productSummary = (
  variations: ProductVariation[]
): Pick<CreateProductInput, "price" | "stock" | "status" | "unit"> => ({
  price: Math.min(...variations.map((variation) => variation.price)),
  stock: variations.reduce((sum, variation) => sum + variation.stock, 0),
  status: variations.some(
    (variation) => variation.stock > 0 && variation.status === "Available"
  )
    ? "Available"
    : "Out of Stock",
  unit: variations[0]?.unit || "unit",
});

export const getProductById = async (
  id: string
): Promise<ProductType | null> => {
  const snapshot = await getDoc(doc(db, "products", id));
  return snapshot.exists()
    ? normalizeProduct(snapshot.id, snapshot.data() as CreateProductInput)
    : null;
};

export const getFarmerProductNames = async (
  farmerId: string,
  includeArchived = false
): Promise<ProductType[]> => {
  const snapshot = await getDocs(
    query(productCollection, where("farmerId", "==", farmerId))
  );
  return snapshot.docs
    .map((item) =>
      normalizeProduct(item.id, item.data() as CreateProductInput)
    )
    .filter((product) => includeArchived || !product.archived);
};

export const getFarmerProducts = getFarmerProductNames;

export const getArchivedProducts = async (
  farmerId: string
): Promise<ProductType[]> =>
  (await getFarmerProductNames(farmerId, true)).filter(
    (product) => product.archived
  );

const findProduct = async (
  farmerId: string,
  name: string,
  category: string,
  archived: boolean
): Promise<ProductType | null> => {
  const snapshot = await getDocs(
    query(
      productCollection,
      where("farmerId", "==", farmerId),
      where("category", "==", category)
    )
  );
  const target = normalizeProductName(name);
  const match = snapshot.docs.find((item) => {
    const data = item.data() as CreateProductInput;
    return (
      Boolean(data.archived) === archived &&
      normalizeProductName(data.name) === target
    );
  });
  return match
    ? normalizeProduct(match.id, match.data() as CreateProductInput)
    : null;
};

export const findArchivedProduct = (
  farmerId: string,
  name: string,
  category: string
) => findProduct(farmerId, name, category, true);

export const findExistingProduct = (
  farmerId: string,
  name: string,
  category: string
) => findProduct(farmerId, name, category, false);

export const createProduct = async (
  input: CreateProductInput
): Promise<ProductType> => {
  const variations = validateVariations(input.variations);
  const existing = await findExistingProduct(
    input.farmerId,
    input.name,
    input.category
  );
  if (existing) {
    throw new Error("This product is already listed. Edit its variations instead.");
  }
  const archived = await findArchivedProduct(
    input.farmerId,
    input.name,
    input.category
  );
  if (archived) {
    throw new Error(
      `You have "${archived.name}" archived. Unarchive it before creating another listing.`
    );
  }

  const summary = productSummary(variations);
  const data = { ...input, ...summary, variations };
  const reference = await addDoc(productCollection, data);
  return { docId: reference.id, ...data };
};

export const updateProductInfo = async (product: ProductType) => {
  if (!product.docId) throw new Error("Product not found.");
  await updateDoc(doc(db, "products", product.docId), {
    name: product.name,
    category: product.category,
    description: product.description,
    image: product.image,
    imagePublicId: product.imagePublicId,
    images: product.images || [product.image],
    imagePublicIds: product.imagePublicIds || [product.imagePublicId],
    video: product.video || "",
    videoPublicId: product.videoPublicId || "",
  });
};

export const updateProductVariations = async (
  productId: string,
  variations: ProductVariation[]
) => {
  const normalized = validateVariations(variations);
  const currentUserId = getAuth().currentUser?.uid;
  if (!currentUserId) {
    throw new Error("Your login session has expired. Please login again.");
  }

  const productRef = doc(db, "products", productId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error("Product not found.");
    if (snapshot.data().farmerId !== currentUserId) {
      throw new Error("You are not authorized to update this product.");
    }

    transaction.update(productRef, {
      variations: normalized,
      ...productSummary(normalized),
      updatedAt: Date.now(),
    });
  });
};

export const archiveProduct = async (productId: string) => {
  await updateDoc(doc(db, "products", productId), {
    archived: true,
    updatedAt: Date.now(),
  });
};

export const unarchiveProduct = async (productId: string) => {
  await updateDoc(doc(db, "products", productId), {
    archived: false,
    updatedAt: Date.now(),
  });
};

export const deleteProduct = async (productId: string) => {
  await deleteDoc(doc(db, "products", productId));
};

export const addReview = async (review: CreateReviewInput) => {
  const reviewId = `${review.orderId}_${review.productId}`;
  const reviewRef = doc(reviewCollection, reviewId);
  const productRef = doc(db, "products", review.productId);

  await runTransaction(db, async (transaction) => {
    const [existingReview, productSnapshot] = await Promise.all([
      transaction.get(reviewRef),
      transaction.get(productRef),
    ]);

    if (existingReview.exists()) {
      throw new Error("You have already reviewed this product.");
    }
    if (!productSnapshot.exists()) throw new Error("Product not found.");

    const product = productSnapshot.data() as CreateProductInput;
    const previousCount = Math.max(0, Number(product.totalReviews) || 0);
    const previousRating = Math.max(0, Number(product.rating) || 0);
    const totalReviews = previousCount + 1;
    transaction.set(reviewRef, review);
    transaction.update(productRef, {
      rating:
        (previousRating * previousCount + review.rating) / totalReviews,
      totalReviews,
      lastReviewId: reviewId,
    });
  });
};

export const getReviewsByProduct = async (
  productId: string
): Promise<ReviewType[]> => {
  const snapshot = await getDocs(
    query(reviewCollection, where("productId", "==", productId))
  );
  return snapshot.docs
    .map((item) => ({
      docId: item.id,
      ...(item.data() as CreateReviewInput),
    }))
    .sort((first, second) => second.createdAt - first.createdAt);
};

export const subscribeToProducts = (
  callback: (products: ProductType[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    query(productCollection, orderBy("createdAt", "desc")),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((item) =>
            normalizeProduct(item.id, item.data() as CreateProductInput)
          )
          .filter((product) => !product.archived)
      ),
    onError
  );


// Product, batch, harvest, and review records stored in Firestore.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  increment,
  runTransaction,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { db } from "../../FirebaseConfig";
import { normalizeProductName } from "@/src/constants/productCatalog";

import type {
  CreateProductInput,
  ProductType,
  CreateBatchInput,
  BatchType,
  CreateHarvestRecordInput,
  HarvestRecordType,
  CreateReviewInput,
  ReviewType,
  SaleContribution,
} from "../types/product";

type HarvestRecordWithType = CreateHarvestRecordInput & {
  type?: "harvest" | "restock";
};

const productCollection = collection(db, "products");
const batchCollection = collection(db, "productBatches");
const harvestCollection = collection(db, "harvestRecords");
const reviewCollection = collection(db, "reviews");

// Reads one product by its document id, or null when it no longer exists.
export const getProductById = async (
  id: string
): Promise<ProductType | null> => {
  try {
    const snap = await getDoc(doc(db, "products", id));

    if (!snap.exists()) {
      return null;
    }

    return {
      docId: snap.id,
      ...(snap.data() as CreateProductInput),
    };
  } catch (error) {
    console.log("GET PRODUCT ERROR:", error);
    return null;
  }
};

// Returns the products of a farmer, hiding archived ones unless asked for.
export const getFarmerProductNames = async (
  farmerId: string,
  includeArchived: boolean = false
): Promise<ProductType[]> => {
  try {
    const q = query(
      productCollection,
      where("farmerId", "==", farmerId)
    );

    const snapshot = await getDocs(q);

    const products = snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateProductInput),
    }));

    return includeArchived
      ? products
      : products.filter((p) => !p.archived);
  } catch (error) {
    console.log("GET FARMER PRODUCTS ERROR:", error);
    return [];
  }
};

export const getFarmerProducts = getFarmerProductNames;

// Returns the products a farmer has archived.
export const getArchivedProducts = async (
  farmerId: string
): Promise<ProductType[]> => {
  const all = await getFarmerProductNames(
    farmerId,
    true
  );

  return all.filter((p) => p.archived);
};

// Looks for an active product of this farmer with the same name and category.
// The comparison ignores casing and extra spaces so the same crop is not
// listed twice.
const findExistingProduct = async (
  farmerId: string,
  name: string,
  category: string
): Promise<ProductType | null> => {
  const q = query(
    productCollection,
    where("farmerId", "==", farmerId),
    where("category", "==", category)
  );

  const snapshot = await getDocs(q);

  const target = normalizeProductName(name);

  const match = snapshot.docs.find((d) => {
    const data = d.data() as CreateProductInput;

    return (
      !data.archived &&
      normalizeProductName(data.name) === target
    );
  });

  if (!match) {
    return null;
  }

  return {
    docId: match.id,
    ...(match.data() as CreateProductInput),
  };
};

// Looks for an archived product with the same name and category, so the farmer
// can be told to unarchive it instead of creating a duplicate.
export const findArchivedProduct = async (
  farmerId: string,
  name: string,
  category: string
): Promise<ProductType | null> => {
  const q = query(
    productCollection,
    where("farmerId", "==", farmerId),
    where("category", "==", category)
  );

  const snapshot = await getDocs(q);

  const target = normalizeProductName(name);

  const match = snapshot.docs.find((d) => {
    const data = d.data() as CreateProductInput;

    return (
      !!data.archived &&
      normalizeProductName(data.name) === target
    );
  });

  if (!match) {
    return null;
  }

  return {
    docId: match.id,
    ...(match.data() as CreateProductInput),
  };
};

// Returns the batch with the highest batch number.
export const getLatestBatch = async (
  productId: string
): Promise<BatchType | null> => {
  const batches = await getBatchesByProduct(productId);

  return batches[0] || null;
};

// Returns the batch a new harvest should be added to.
export const getActiveBatchForHarvest = async (
  productId: string
): Promise<BatchType | null> => {
  return getLatestBatch(productId);
};

// Returns the batches of a product, newest batch number first.
export const getBatchesByProduct = async (
  productId: string,
  includeArchived: boolean = false
): Promise<BatchType[]> => {
  try {
    const q = query(
      batchCollection,
      where("productId", "==", productId)
    );

    const snapshot = await getDocs(q);

    const batches = snapshot.docs
      .map((d) => ({
        docId: d.id,
        ...(d.data() as CreateBatchInput),
      }))
      .sort(
        (a, b) =>
          b.batchNumber - a.batchNumber
      );

    return includeArchived
      ? batches
      : batches.filter((b) => !b.archived);
  } catch (error) {
    console.log("GET BATCHES ERROR:", error);
    return [];
  }
};

// Returns the harvest and restock records of a batch, oldest first.
export const getHarvestRecordsByBatch = async (
  batchId: string
): Promise<HarvestRecordType[]> => {
  try {
    const farmerId = getAuth().currentUser?.uid;
    if (!farmerId) {
      return [];
    }

    const q = query(
      harvestCollection,
      where("batchId", "==", batchId),
      where("farmerId", "==", farmerId)
    );

    const snapshot = await getDocs(q);

    const records = snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as HarvestRecordWithType),
    })) as HarvestRecordType[];

    return records.sort(
      (a, b) =>
        a.harvestDate - b.harvestDate
    );
  } catch (error) {
    console.log(
      "GET HARVEST RECORDS ERROR:",
      error
    );

    return [];
  }
};

// Adds up the stock of every sellable batch and writes the result back to the
// product, which is what the lists read to show price and stock.
const recalculateProductAggregates = async (
  productId: string
) => {
  const batches = await getBatchesByProduct(
    productId,
    true
  );

  const sellableBatches = batches.filter(
    (batch) =>
      batch.archived !== true &&
      Number(batch.stock) > 0 &&
      batch.status === "Available"
  );

  const totalStock = sellableBatches.reduce(
    (sum, batch) =>
      sum + Number(batch.stock || 0),
    0
  );

  const productRef = doc(
    db,
    "products",
    productId
  );

  // A product has one price for all of its batches, so never copy batch.price
  // onto the product here. Only stock and status are updated.
  await updateDoc(productRef, {
    stock: totalStock,
    status:
      totalStock > 0
        ? "Available"
        : "Out of Stock",
  });
};

// Copies the product price onto every batch of that product.
const syncProductPriceToAllBatches = async (
  productId: string,
  price: number
) => {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid price.");
  }

  const productRef = doc(
    db,
    "products",
    productId
  );

  await updateDoc(productRef, {
    price,
  });

  const batches = await getBatchesByProduct(
    productId,
    true
  );

  await Promise.all(
    batches.map((batch) =>
      updateDoc(
        doc(
          db,
          "productBatches",
          batch.docId
        ),
        { price }
      )
    )
  );
};

// Records a harvest. The product is created when it does not exist yet, and the
// quantity either joins the latest batch or starts a new one when forceNewBatch
// is set.
export const addHarvest = async (
  input: CreateProductInput,
  quantity: number,
  price: number,
  forceNewBatch: boolean = false,
  harvestDate?: number
): Promise<{
  product: ProductType;
  batch: BatchType;
  harvestRecord: HarvestRecordType;
  createdNewBatch: boolean;
}> => {
  try {
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Invalid harvest quantity."
      );
    }

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Invalid price."
      );
    }

    const existing =
      await findExistingProduct(
        input.farmerId,
        input.name,
        input.category
      );

    let product: ProductType;

    if (existing) {
      product = existing;
    } else {
      const archivedDuplicate =
        await findArchivedProduct(
          input.farmerId,
          input.name,
          input.category
        );

      if (archivedDuplicate) {
        throw new Error(
          `You have "${archivedDuplicate.name}" archived. Unarchive it in the Archived tab before adding a new harvest.`
        );
      }

      const docRef = await addDoc(
        productCollection,
        input
      );

      product = {
        docId: docRef.id,
        ...input,
      };
    }

    const effectiveHarvestDate =
      harvestDate ?? Date.now();

    // Every batch of a product is sold at the product price.
    const effectivePrice = Number(price);

    await syncProductPriceToAllBatches(
      product.docId,
      effectivePrice
    );

    const currentBatch =
      await getActiveBatchForHarvest(
        product.docId
      );

    let batch: BatchType;
    let createdNewBatch = false;

    if (
      currentBatch &&
      !forceNewBatch
    ) {
      const batchRef = doc(
        db,
        "productBatches",
        currentBatch.docId
      );

      await updateDoc(batchRef, {
        stock: increment(quantity),
        totalHarvested:
          increment(quantity),
        price: effectivePrice,
        status: "Available",
      });

      const updatedSnap =
        await getDoc(batchRef);

      if (!updatedSnap.exists()) {
        throw new Error(
          "Updated batch not found."
        );
      }

      batch = {
        docId: currentBatch.docId,
        ...(updatedSnap.data() as CreateBatchInput),
      };
    }

    else {
      if (
        currentBatch &&
        forceNewBatch
      ) {
        await updateDoc(
          doc(
            db,
            "productBatches",
            currentBatch.docId
          ),
          {
            status: "Out of Stock",
          }
        );
      }

      const newBatchInput = {
        productId: product.docId,
        farmerId: input.farmerId,

        batchNumber: currentBatch
          ? currentBatch.batchNumber + 1
          : 1,

        price: effectivePrice,
        stock: quantity,
        totalHarvested: quantity,
        status: "Available",
        createdAt: Date.now(),
        archived: false,
        archivedViaProduct: false,
      } as CreateBatchInput;

      const batchRef = await addDoc(
        batchCollection,
        newBatchInput
      );

      batch = {
        docId: batchRef.id,
        ...newBatchInput,
      };

      createdNewBatch = true;
    }

    const harvestRecordInput =
      {
        batchId: batch.docId,
        productId: product.docId,
        farmerId: input.farmerId,

        quantity,

        remainingQuantity:
          quantity,

        harvestDate:
          effectiveHarvestDate,

        createdAt: Date.now(),

        type: "harvest",
      } as HarvestRecordWithType;

    const harvestRef =
      await addDoc(
        harvestCollection,
        harvestRecordInput
      );

    const harvestRecord = {
      docId: harvestRef.id,
      ...harvestRecordInput,
    } as HarvestRecordType;

    await recalculateProductAggregates(
      product.docId
    );

    return {
      product,
      batch,
      harvestRecord,
      createdNewBatch,
    };
  } catch (error) {
    console.log(
      "ADD HARVEST ERROR:",
      error
    );

    throw error;
  }
};

// Updates the details a farmer can edit on a product.
export const updateProductInfo = async (
  product: ProductType
) => {
  try {
    if (!product.docId) {
      return;
    }

    const ref = doc(
      db,
      "products",
      product.docId
    );

    await updateDoc(ref, {
      name: product.name,
      category: product.category,
      unit: product.unit,
      description: product.description,
      image: product.image,
      imagePublicId:
        product.imagePublicId,
      images: product.images || [product.image],
      imagePublicIds:
        product.imagePublicIds || [product.imagePublicId],
      video: product.video || "",
      videoPublicId: product.videoPublicId || "",
    });
  } catch (error) {
    console.log(
      "UPDATE PRODUCT INFO ERROR:",
      error
    );

    throw error;
  }
};

// Applies batch updates and any restock in one transaction, so the batch
// totals and the restock record can never disagree.
export const updateBatch = async (
  batchDocId: string,
  updates: {
    price?: number;
    status?: string;
    restockQuantity?: number;
  }
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      throw new Error(
        "Batch not found."
      );
    }

    const batch =
      snap.data() as CreateBatchInput;

    const restockQuantity =
      Number(
        updates.restockQuantity || 0
      );

    if (
      !Number.isFinite(
        restockQuantity
      ) ||
      restockQuantity < 0
    ) {
      throw new Error(
        "Invalid restock quantity."
      );
    }

    if (
      updates.price !==
      undefined
    ) {
      if (
        !Number.isFinite(
          updates.price
        ) ||
        updates.price < 0
      ) {
        throw new Error(
          "Invalid price."
        );
      }
    }

    await runTransaction(
      db,
      async (transaction) => {
        const currentBatchSnap =
          await transaction.get(
            batchRef
          );

        if (
          !currentBatchSnap.exists()
        ) {
          throw new Error(
            "Batch not found."
          );
        }

        const batchUpdates: Record<
          string,
          any
        > = {};

        // A batch cannot have its own selling price. The price always comes from
        // the product.
        if (updates.price !== undefined) {
          batchUpdates.price = updates.price;
        }

        if (
          updates.status !==
          undefined
        ) {
          batchUpdates.status =
            updates.status;
        }

        if (
          restockQuantity > 0
        ) {
          batchUpdates.stock =
            increment(
              restockQuantity
            );

          batchUpdates.totalHarvested =
            increment(
              restockQuantity
            );

          // Restocking a batch that was out of stock makes it available again unless
          // the farmer picked another status.
          if (
            updates.status ===
              undefined ||
            updates.status ===
              "Available"
          ) {
            batchUpdates.status =
              "Available";
          }

          const restockRef =
            doc(harvestCollection);

          const now = Date.now();

          const restockRecord =
            {
              batchId:
                batchDocId,

              productId:
                batch.productId,

              farmerId:
                batch.farmerId,

              quantity:
                restockQuantity,

              remainingQuantity:
                restockQuantity,

              harvestDate:
                now,

              createdAt:
                now,

              type:
                "restock",
            } as HarvestRecordWithType;

          transaction.set(
            restockRef,
            restockRecord
          );
        }

        if (
          Object.keys(
            batchUpdates
          ).length > 0
        ) {
          transaction.update(
            batchRef,
            batchUpdates
          );
        }
      }
    );

    // Push the new price and the new total stock back to the product.
    if (updates.price !== undefined) {
      await syncProductPriceToAllBatches(
        batch.productId,
        updates.price
      );
    }

    await recalculateProductAggregates(
      batch.productId
    );
  } catch (error) {
    console.log(
      "UPDATE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// Hides a batch without deleting it, then refreshes the product totals.
export const archiveBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      return;
    }

    await updateDoc(
      batchRef,
      {
        archived: true,
        archivedViaProduct: false,
      }
    );

    const productId =
      (
        snap.data() as CreateBatchInput
      ).productId;

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "ARCHIVE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// Brings an archived batch back, then refreshes the product totals.
export const unarchiveBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    if (!snap.exists()) {
      return;
    }

    await updateDoc(
      batchRef,
      {
        archived: false,
        archivedViaProduct: false,
      }
    );

    const productId =
      (
        snap.data() as CreateBatchInput
      ).productId;

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "UNARCHIVE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// Deletes a harvest record and undoes its effect on the batch. Only the
// remainingQuantity is removed from the stock, because the rest of the harvest
// was already sold. For a harvest of 20 with 8 remaining, deleting it
// subtracts 8 from the stock and 20 from the total harvested.
export const deleteHarvestRecord = async (
  harvestDocId: string
) => {
  try {
    const ref = doc(
      db,
      "harvestRecords",
      harvestDocId
    );

    const snap =
      await getDoc(ref);

    if (!snap.exists()) {
      return;
    }

    const record =
      snap.data() as HarvestRecordWithType;

    await deleteDoc(ref);

    const batchRef = doc(
      db,
      "productBatches",
      record.batchId
    );

    await updateDoc(
      batchRef,
      {
        stock: increment(
          -record.remainingQuantity
        ),

        totalHarvested:
          increment(
            -record.quantity
          ),
      }
    );

    const batchSnap =
      await getDoc(batchRef);

    if (batchSnap.exists()) {
      await recalculateProductAggregates(
        (
          batchSnap.data() as CreateBatchInput
        ).productId
      );
    }
  } catch (error) {
    console.log(
      "DELETE HARVEST RECORD ERROR:",
      error
    );

    throw error;
  }
};

// Removes a batch for good, together with its harvest records, then refreshes
// the product totals.
export const deleteBatch = async (
  batchDocId: string
) => {
  try {
    const batchRef = doc(
      db,
      "productBatches",
      batchDocId
    );

    const snap =
      await getDoc(batchRef);

    const productId =
      snap.exists()
        ? (
            snap.data() as CreateBatchInput
          ).productId
        : null;

    const records =
      await getHarvestRecordsByBatch(
        batchDocId
      );

    await Promise.all(
      records.map((r) =>
        deleteDoc(
          doc(
            db,
            "harvestRecords",
            r.docId
          )
        )
      )
    );

    await deleteDoc(batchRef);

    if (productId) {
      await recalculateProductAggregates(
        productId
      );
    }
  } catch (error) {
    console.log(
      "DELETE BATCH ERROR:",
      error
    );

    throw error;
  }
};

// Takes stock out of the batches of a product, oldest batch first, and reports
// which batch each part of the sale came from.
export const recordSale = async (
  productId: string,
  quantity: number
): Promise<{
  contributions: SaleContribution[];
}> => {
  try {
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Invalid sale quantity."
      );
    }

    const productRef = doc(
      db,
      "products",
      productId
    );

    const productSnap = await getDoc(
      productRef
    );

    if (!productSnap.exists()) {
      throw new Error("Product not found.");
    }

    const product =
      productSnap.data() as CreateProductInput;

    const batches = (
      await getBatchesByProduct(
        productId,
        true
      )
    )
      .filter(
        (batch) =>
          batch.archived !== true &&
          batch.status === "Available" &&
          Number(batch.stock) > 0
      )
      .sort(
        (a, b) =>
          Number(a.batchNumber) -
          Number(b.batchNumber)
      );

    const totalAvailableStock =
      batches.reduce(
        (sum, batch) =>
          sum + Number(batch.stock || 0),
        0
      );

    if (totalAvailableStock < quantity) {
      throw new Error(
        `Kulang ang stock. Available: ${totalAvailableStock}.`
      );
    }

    const contributions: SaleContribution[] = [];
    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const currentStock = Number(
        batch.stock || 0
      );
      const takeFromBatch = Math.min(
        currentStock,
        remaining
      );

      if (takeFromBatch <= 0) continue;

      const harvestRecords = (
        await getHarvestRecordsByBatch(
          batch.docId
        )
      ).filter(
        (record) =>
          Number(record.remainingQuantity || 0) > 0
      );

      let remainingInBatch = takeFromBatch;

      for (const record of harvestRecords) {
        if (remainingInBatch <= 0) break;

        const available = Number(
          record.remainingQuantity || 0
        );
        const takeFromRecord = Math.min(
          available,
          remainingInBatch
        );

        await updateDoc(
          doc(
            db,
            "harvestRecords",
            record.docId
          ),
          {
            remainingQuantity: increment(
              -takeFromRecord
            ),
          }
        );

        contributions.push({
          batchId: batch.docId,
          batchNumber: batch.batchNumber,
          harvestRecordId: record.docId,
          quantity: takeFromRecord,
        });

        remainingInBatch -= takeFromRecord;
      }

      if (remainingInBatch > 0) {
        contributions.push({
          batchId: batch.docId,
          batchNumber: batch.batchNumber,
          harvestRecordId: null,
          quantity: remainingInBatch,
        });
      }

      const newStock = Number(
        (currentStock - takeFromBatch).toFixed(6)
      );

      await updateDoc(
        doc(
          db,
          "productBatches",
          batch.docId
        ),
        {
          stock: newStock,
          status:
            newStock > 0
              ? "Available"
              : "Out of Stock",
        }
      );

      remaining -= takeFromBatch;
    }

    if (remaining > 0) {
      throw new Error(
        "Unable to complete the sale from available batches."
      );
    }

    await updateDoc(productRef, {
      totalSales: increment(quantity),
      weeklySales: increment(quantity),
      monthlySales: increment(quantity),
    });

    await recalculateProductAggregates(
      productId
    );

    // Make sure no batch drifted away from the product price.
    const currentPrice = Number(
      product.price
    );

    if (Number.isFinite(currentPrice)) {
      await syncProductPriceToAllBatches(
        productId,
        currentPrice
      );
    }

    return { contributions };
  } catch (error) {
    console.log(
      "RECORD SALE ERROR:",
      error
    );

    throw error;
  }
};

// Stores a review and updates the product's average rating and review count.
export const addReview = async (
  review: CreateReviewInput
) => {
  try {
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
      if (!productSnapshot.exists()) {
        throw new Error("Product not found.");
      }

      const product = productSnapshot.data() as CreateProductInput;
      const previousCount = Math.max(0, Number(product.totalReviews) || 0);
      const previousRating = Math.max(0, Number(product.rating) || 0);
      const totalReviews = previousCount + 1;
      const rating =
        (previousRating * previousCount + review.rating) / totalReviews;

      transaction.set(reviewRef, review);
      transaction.update(productRef, {
        rating,
        totalReviews,
        lastReviewId: reviewId,
      });
    });
  } catch (error) {
    console.log(
      "ADD REVIEW ERROR:",
      error
    );

    throw error;
  }
};

// Returns every review of a product, newest first.
export const getReviewsByProduct = async (
  productId: string
): Promise<ReviewType[]> => {
  const q = query(
    reviewCollection,
    where(
      "productId",
      "==",
      productId
    )
  );

  const snapshot =
    await getDocs(q);

  const reviews =
    snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateReviewInput),
    }));

  return reviews.sort(
    (a, b) =>
      b.createdAt -
      a.createdAt
  );
};

// Returns the reviews tied to one batch of a product, newest first.
export const getReviewsByBatch = async (
  productId: string,
  batchId: string
): Promise<ReviewType[]> => {
  const q = query(
    reviewCollection,
    where(
      "batchId",
      "==",
      batchId
    )
  );

  const snapshot =
    await getDocs(q);

  const reviews =
    snapshot.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as CreateReviewInput),
    }));

  return reviews.sort(
    (a, b) =>
      b.createdAt -
      a.createdAt
  );
};

// Watches the products collection and calls back with the active ones whenever
// it changes. Returns the function that stops watching.
export const subscribeToProducts = (
  callback: (
    products: ProductType[]
  ) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    productCollection,
    orderBy(
      "createdAt",
      "desc"
    )
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const products =
        snapshot.docs
          .map((d) => ({
            docId: d.id,
            ...(d.data() as CreateProductInput),
          }))
          .filter(
            (p) => !p.archived
          );

      callback(products);
    },
    onError ||
      ((error) =>
        console.log(
          "REALTIME ERROR:",
          error
        ))
  );
};

// Hides a product and all of its batches. archivedViaProduct remembers that the
// batches were hidden as part of the product, not on their own.
export const archiveProduct = async (
  productId: string
) => {
  try {
    await updateDoc(
      doc(
        db,
        "products",
        productId
      ),
      {
        archived: true,
      }
    );

    const batches =
      await getBatchesByProduct(
        productId,
        true
      );

    await Promise.all(
      batches
        .filter(
          (b) => !b.archived
        )
        .map((b) =>
          updateDoc(
            doc(
              db,
              "productBatches",
              b.docId
            ),
            {
              archived: true,
              archivedViaProduct:
                true,
            }
          )
        )
    );
  } catch (error) {
    console.log(
      "ARCHIVE PRODUCT ERROR:",
      error
    );

    throw error;
  }
};

// Restores a product and only the batches that were archived together with it,
// leaving batches the farmer archived by themselves hidden.
export const unarchiveProduct = async (
  productId: string
) => {
  try {
    await updateDoc(
      doc(
        db,
        "products",
        productId
      ),
      {
        archived: false,
      }
    );

    const batches =
      await getBatchesByProduct(
        productId,
        true
      );

    await Promise.all(
      batches
        .filter(
          (b) =>
            b.archived &&
            b.archivedViaProduct
        )
        .map((b) =>
          updateDoc(
            doc(
              db,
              "productBatches",
              b.docId
            ),
            {
              archived: false,
              archivedViaProduct:
                false,
            }
          )
        )
    );

    await recalculateProductAggregates(
      productId
    );
  } catch (error) {
    console.log(
      "UNARCHIVE PRODUCT ERROR:",
      error
    );

    throw error;
  }
};

// Removes a product for good, together with every batch it had.
export const deleteProduct = async (
  docId: string
) => {
  try {
    await deleteDoc(
      doc(
        db,
        "products",
        docId
      )
    );

    const batches =
      await getBatchesByProduct(
        docId,
        true
      );

    await Promise.all(
      batches.map((b) =>
        deleteBatch(b.docId)
      )
    );
  } catch (error) {
    console.log(
      "DELETE ERROR:",
      error
    );

    throw error;
  }
};
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Upload, Plus, Download } from "lucide-react";
import {
  getInventoryByBranch,
  createInventory,
  updateInventory,
} from "@/Redux Toolkit/features/inventory/inventoryThunks";
import { getProductsByStore } from "@/Redux Toolkit/features/product/productThunks";
import { getCategoriesByStore } from "@/Redux Toolkit/features/category/categoryThunks";
import InventoryTable from "./InventoryTable";
import InventoryFilters from "./InventoryFilters";
import InventoryFormDialog from "./InventoryFormDialog";
import { useToast } from "@/components/ui/use-toast";

const Inventory = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const branch = useSelector((state) => state.branch?.branch);
  const { inventories = [] } = useSelector((state) => state.inventory || {});
  const { products = [] } = useSelector((state) => state.product || {});
  const { categories = [] } = useSelector((state) => state.category || {});

  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [editInventory, setEditInventory] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editProductId, setEditProductId] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (branch?.id) {
      dispatch(getInventoryByBranch(branch.id));
    }
    if (branch?.storeId) {
      dispatch(getProductsByStore(branch.storeId));
      dispatch(
        getCategoriesByStore({
          storeId: branch.storeId,
          token: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [branch, dispatch]);

  const getProductInfo = (inv) => {
    const safeProducts = Array.isArray(products) ? products : [];
    const safeCategories = Array.isArray(categories) ? categories : [];

    const pObj =
      inv?.product ||
      safeProducts.find((p) => p.id === (inv?.productId ?? inv?.product?.id));

    const catName =
      pObj?.category?.name ||
      (typeof pObj?.category === "string" ? pObj.category : null) ||
      inv?.category?.name ||
      (typeof inv?.category === "string" ? inv.category : null) ||
      safeCategories.find((c) => c.id === pObj?.categoryId)?.name ||
      "Chưa phân loại";

    return {
      id: inv?.id,
      productId: inv?.productId ?? pObj?.id,
      name: pObj?.name || inv?.productName || `Product #${inv?.productId}`,
      sku: pObj?.sku || inv?.sku || `SKU-${inv?.productId}`,
      category: catName,
      quantity: Number(inv?.quantity ?? 0),
      minStockLevel: Number(inv?.minStockLevel ?? 10),
      raw: inv,
    };
  };

  const inventoryRows = (Array.isArray(inventories) ? inventories : []).map(
    getProductInfo,
  );

  const filteredRows = inventoryRows.filter((row) => {
    const matchesSearch =
      !searchTerm.trim() ||
      (row.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !category ||
      category === "all" ||
      (row.category || "").toLowerCase() === category.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleAddInventory = async () => {
    if (!branch?.id || !selectedProductId || quantity <= 0) return;
    try {
      await dispatch(
        createInventory({
          branchId: branch.id,
          productId: Number(selectedProductId),
          quantity: Number(quantity),
        }),
      ).unwrap();
      toast({
        title: "Inventory Added",
        description: "Stock quantity has been updated successfully.",
      });
      setIsAddDialogOpen(false);
      setSelectedProductId("");
      setQuantity(1);
      dispatch(getInventoryByBranch(branch.id));
    } catch (err) {
      toast({
        title: "Failed to Add Inventory",
        description: err || "Could not add inventory.",
        variant: "destructive",
      });
    }
  };

  const handleOpenEditDialog = (row) => {
    setEditInventory(row);
    setEditQuantity(row.quantity);
    setEditProductId(row.productId);
    setIsEditDialogOpen(true);
  };

  const handleEditInventory = async () => {
    if (!editInventory || editQuantity < 0) return;
    try {
      await dispatch(
        updateInventory({
          id: editInventory.id,
          dto: {
            branchId: branch.id,
            productId: Number(editProductId),
            quantity: Number(editQuantity),
          },
        }),
      ).unwrap();
      toast({
        title: "Inventory Updated",
        description: "Stock quantity updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditInventory(null);
      setEditQuantity(1);
      setEditProductId("");
      dispatch(getInventoryByBranch(branch.id));
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err || "Failed to update inventory.",
        variant: "destructive",
      });
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !branch?.id) return;

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      let importedCount = 0;
      const safeProducts = Array.isArray(products) ? products : [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const skuOrId = cols[0];
        const qty = parseInt(cols[1], 10);
        if (!skuOrId || isNaN(qty) || qty <= 0) continue;

        const matchedProduct = safeProducts.find(
          (p) =>
            String(p.id) === skuOrId ||
            p.sku?.toLowerCase() === skuOrId.toLowerCase(),
        );
        if (matchedProduct) {
          await dispatch(
            createInventory({
              branchId: branch.id,
              productId: matchedProduct.id,
              quantity: qty,
            }),
          );
          importedCount++;
        }
      }

      dispatch(getInventoryByBranch(branch.id));
      toast({
        title: "CSV Import Completed",
        description: `Successfully imported ${importedCount} inventory records.`,
      });
    } catch {
      toast({
        title: "CSV Import Error",
        description:
          "Please provide a valid CSV with columns: SKU_or_ProductID,Quantity",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleExportCSV = () => {
    const header = "ID,ProductId,SKU,ProductName,Category,Quantity\n";
    const rows = filteredRows
      .map(
        (r) =>
          `${r.id},${r.productId},"${r.sku}","${(r.name || "").replace(/"/g, '""')}","${r.category}",${r.quantity}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch_${branch?.id || "inventory"}_stock.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Inventory Management
        </h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="gap-2 flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4" /> Add Inventory
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
          <Button
            variant="outline"
            className="gap-2 flex-1 sm:flex-initial"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button
            variant="outline"
            className="gap-2 flex-1 sm:flex-initial"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <InventoryFilters
        searchTerm={searchTerm}
        onSearch={(e) => setSearchTerm(e.target.value)}
        setSearchTerm={setSearchTerm}
        category={category}
        selectedCategory={category}
        onCategoryChange={setCategory}
        setCategory={setCategory}
        categories={categories}
        categoryList={categories}
        products={products}
        inventoryRows={filteredRows}
        inventories={filteredRows}
      />

      <InventoryTable
        rows={filteredRows}
        inventories={filteredRows}
        onEdit={handleOpenEditDialog}
      />

      <InventoryFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        quantity={quantity}
        setQuantity={setQuantity}
        onSubmit={handleAddInventory}
        products={products}
        mode="add"
      />

      <InventoryFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        selectedProductId={editProductId}
        setSelectedProductId={setEditProductId}
        quantity={editQuantity}
        setQuantity={setEditQuantity}
        onSubmit={handleEditInventory}
        products={products}
        mode="edit"
      />
    </div>
  );
};

export default Inventory;

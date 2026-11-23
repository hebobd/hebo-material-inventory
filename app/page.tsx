
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EmployeeManagement from "@/app/components/EmployeeManagement";
import ProfileSettings from "@/app/components/ProfileSettings";
import SettingsPanel from "@/app/components/SettingsPanel";

const supabase = createClient();

type Category = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  image_url?: string | null;
  color?: string | null;
};

type Material = {
  id: string;
  name: string;
  category_id: string | null;
  sku: string | null;
  unit: string;
  current_stock: number;
  avg_unit_cost: number;
  low_stock_threshold: number | null;
  notes: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  package_type?: string | null;
  package_size?: number | null;
  package_count?: number | null;
  categories?: { name: string } | null;
};

type Transaction = {
  id: string;
  transaction_type: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  transaction_date: string;
  note: string | null;
  materials?: { name: string; unit: string } | null;
};

type RecipeItem = {
  id?: string;
  material_id: string;
  quantity_per_batch: number;
  materials?: { name: string; unit: string; current_stock?: number; avg_unit_cost?: number } | null;
};

type Recipe = {
  id: string;
  name: string;
  finished_product_id: string;
  output_quantity: number;
  output_unit: string;
  notes: string | null;
  finished_products?: { name: string; current_stock: number; unit: string } | null;
  production_recipe_items?: RecipeItem[];
};

type ToastState = { message: string; kind: "success" | "error" | "info"; onConfirm?: () => void; confirmLabel?: string } | null;

type ProductionRun = {
  id: string;
  batch_number: string;
  batch_count: number;
  output_quantity: number;
  output_unit: string;
  total_cost: number;
  status: string;
  notes: string | null;
  produced_at: string;
  production_recipes?: { name: string } | null;
  finished_products?: { name: string } | null;
};

const categoryStyles = [
  "bg-amber-50 text-amber-700",
  "bg-orange-50 text-orange-700",
  "bg-blue-50 text-blue-700",
  "bg-purple-50 text-purple-700",
  "bg-green-50 text-green-700",
  "bg-gray-100 text-gray-700",
];

const icons = ["◉", "✿", "⚗", "❋", "◈", "＋"];

const navItems = [
  ["▦", "Overview"],
  ["◈", "Materials"],
  ["▤", "Categories"],
  ["⇄", "Stock Transactions"],
  ["⚗", "Production"],
  ["▥", "Reports"],
  ["♙", "Employees"],
  ["⚙", "My Profile"],
  ["⚙", "Settings"],
];

const emptyForm = {
  name: "",
  category_id: "",
  sku: "",
  unit: "g",
  current_stock: "0",
  avg_unit_cost: "0",
  low_stock_threshold: "0",
  notes: "",
  package_type: "packet",
  package_size: "1",
  package_count: "0",
};

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [navigationRestored, setNavigationRestored] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState("staff");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
      if (mounted && data?.is_active) setCurrentRole(data.role || "staff");
    })();
    return () => { mounted = false; };
  }, []);

  const visibleNavItems = useMemo(() => navItems.filter(([, label]) => {
    if (label === "Employees" || label === "Settings") return currentRole === "admin";
    if (currentRole === "staff") return !["Categories", "Reports"].includes(label);
    return true;
  }), [currentRole]);

  useEffect(() => {
    if (currentRole !== "admin" && ["Employees", "Settings"].includes(active)) {
      setActive("Overview");
    }
  }, [currentRole, active]);

  // Restore the last visited section before persisting anything.
  // This prevents the initial "Overview" state from overwriting the saved page.
  useEffect(() => {
    try {
      const savedPage = window.localStorage.getItem("hebo:last-visited-page");
      const allowedPages = navItems.map(([, label]) => label);
      if (savedPage && allowedPages.includes(savedPage)) {
        setActive(savedPage);
      }
    } catch (storageError) {
      console.warn("Unable to restore the last visited page:", storageError);
    } finally {
      setNavigationRestored(true);
    }
  }, []);

  // Persist navigation only after the initial restoration has completed.
  useEffect(() => {
    if (!navigationRestored) return;
    try {
      window.localStorage.setItem("hebo:last-visited-page", active);
    } catch (storageError) {
      console.warn("Unable to save the last visited page:", storageError);
    }
  }, [active, navigationRestored]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Date and list filters
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("All");
  const [transactionMaterialFilter, setTransactionMaterialFilter] = useState("All");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionSort, setTransactionSort] = useState("newest");
  const [overviewFrom, setOverviewFrom] = useState("");
  const [overviewTo, setOverviewTo] = useState("");
  const [overviewPreset, setOverviewPreset] = useState("all");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  // Category management
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "📦",
    color: "#82947B",
    image_url: "",
  });
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  type MaterialImage = { url: string; file?: File };
  const [materialImages, setMaterialImages] = useState<MaterialImage[]>([]);

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [stockMode, setStockMode] = useState<"in" | "out">("out");
  const [usageMaterialId, setUsageMaterialId] = useState("");
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [usagePurchaseTotal, setUsagePurchaseTotal] = useState("");
  const [usageImages, setUsageImages] = useState<MaterialImage[]>([]);
  const [usageSaving, setUsageSaving] = useState(false);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [finishedProductName, setFinishedProductName] = useState("");
  const [recipeOutputQuantity, setRecipeOutputQuantity] = useState("1");
  const [recipeOutputUnit, setRecipeOutputUnit] = useState("pcs");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeItems, setRecipeItems] = useState<{ material_id: string; quantity_per_batch: string }[]>([{ material_id: "", quantity_per_batch: "" }]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [productionSaving, setProductionSaving] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [productionBatchCount, setProductionBatchCount] = useState("1");
  const [productionNote, setProductionNote] = useState("");

  function showToast(message: string, kind?: "success" | "error" | "info") {
    const inferredKind = kind || (
      /unable|cannot|not enough|enter|please select|error|failed|invalid|violat|duplicate|permission|denied|not found|already exists|does not exist|must be/i.test(message)
        ? "error"
        : "success"
    );
    setToast({ message, kind: inferredKind });
  }

  function showConfirmToast(message: string, onConfirm: () => void, confirmLabel = "Confirm") {
    setToast({ message, kind: "info", onConfirm, confirmLabel });
  }

  useEffect(() => {
    if (!toast || toast.onConfirm) return;
    const timeout = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function localDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function applyOverviewPreset(preset: string) {
    setOverviewPreset(preset);
    const today = new Date();
    const todayString = localDateString(today);
    if (preset === "today") {
      setOverviewFrom(todayString);
      setOverviewTo(todayString);
    } else if (preset === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = localDateString(yesterday);
      setOverviewFrom(yesterdayString);
      setOverviewTo(yesterdayString);
    } else if (preset === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setOverviewFrom(localDateString(start));
      setOverviewTo(todayString);
    } else if (preset === "all") {
      setOverviewFrom("");
      setOverviewTo("");
    } else if (preset === "custom") {
      // Keep the currently selected dates while switching to a custom range.
      if (!overviewFrom && !overviewTo) {
        setOverviewFrom(todayString);
        setOverviewTo(todayString);
      }
    }
  }

  // --------------------------------------------------
  // FETCH DATABASE DATA
  // --------------------------------------------------

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      const [materialResult, categoryResult, transactionResult, recipeResult, runResult, finishedResult] =
        await Promise.all([
          supabase
            .from("materials")
            .select(`
              id,
              name,
              category_id,
              sku,
              unit,
              current_stock,
              avg_unit_cost,
              low_stock_threshold,
              notes,
              image_url,
              image_urls,
              package_type,
              package_size,
              package_count,
              is_archived,
              categories (
                name
              )
            `)
            .eq("is_archived", false)
            .order("name"),

          supabase
            .from("categories")
            .select("id, name, description, icon, image_url, color")
            .order("name"),

          supabase
            .from("stock_transactions")
            .select(`
              id,
              transaction_type,
              quantity,
              unit_cost,
              total_cost,
              transaction_date,
              note,
              materials (
                name,
                unit
              )
            `)
            .order("transaction_date", { ascending: false }),
          supabase
            .from("production_recipes")
            .select(`id,name,finished_product_id,output_quantity,output_unit,notes,finished_products(name,current_stock,unit),production_recipe_items(id,material_id,quantity_per_batch,materials(name,unit,current_stock,avg_unit_cost))`)
            .order("name"),
          supabase
            .from("production_runs")
            .select("id,batch_number,batch_count,output_quantity,output_unit,total_cost,status,notes,produced_at,production_recipes(name),finished_products(name)")
            .order("produced_at", { ascending: false })
            .limit(20),
          supabase
            .from("finished_products")
            .select("id,name,unit,current_stock")
            .order("name"),
        ]);

      if (materialResult.error) throw materialResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (transactionResult.error) throw transactionResult.error;
      if (recipeResult.error) throw recipeResult.error;
      if (runResult.error) throw runResult.error;
      if (finishedResult.error) throw finishedResult.error;

      setMaterials((materialResult.data || []) as unknown as Material[]);
      setCategories((categoryResult.data || []) as Category[]);
      setTransactions(
        (transactionResult.data || []) as unknown as Transaction[]
      );
      setRecipes((recipeResult.data || []) as unknown as Recipe[]);
      setProductionRuns((runResult.data || []) as unknown as ProductionRun[]);
      setFinishedProducts(finishedResult.data || []);
    } catch (err: any) {
      setError(err.message || "Unable to load database data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // --------------------------------------------------
  // CALCULATIONS
  // --------------------------------------------------

  const totalInventoryValue = materials.reduce(
    (sum, item) =>
      sum + Number(item.current_stock) * Number(item.avg_unit_cost),
    0
  );

  const lowStockItems = materials.filter(
    (item) =>
      Number(item.current_stock) <= Number(item.low_stock_threshold ?? 0)
  );

  const filtered = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku || "").toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [materials, search, selectedCategory]);

  const categoryStats = categories.map((category, index) => {
    const categoryMaterials = materials.filter(
      (item) => item.category_id === category.id
    );

    const value = categoryMaterials.reduce(
      (sum, item) =>
        sum + Number(item.current_stock) * Number(item.avg_unit_cost),
      0
    );

    return {
      ...category,
      count: categoryMaterials.length,
      value,
      icon: category.icon || icons[index % icons.length],
      color: categoryStyles[index % categoryStyles.length],
      dbColor: category.color || "#82947B",
    };
  });

  // --------------------------------------------------
  // CATEGORY MANAGEMENT
  // --------------------------------------------------

  const categoryIcons = [
    "📦", "🧈", "🧪", "🌸", "🫒", "🌿",
    "🌾", "🧴", "🧼", "☕", "💧", "✨",
    "🍯", "🪴", "🧂", "⚗️", "💎", "🧹",
  ];

  const categoryColors = [
    "#82947B", "#AA8872", "#5B4843", "#50604A",
    "#C49A6C", "#8B83B6", "#6B91A5", "#C77B78",
  ];

  function openAddCategory() {
    setEditingCategoryId(null);
    setCategoryForm({
      name: "",
      description: "",
      icon: "📦",
      color: "#82947B",
      image_url: "",
    });
    setCategoryImageFile(null);
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      icon: category.icon || "📦",
      color: category.color || "#82947B",
      image_url: category.image_url || "",
    });
    setCategoryImageFile(null);
    setCategoryModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = categoryForm.name.trim();
    if (!name) return showToast("Category name is required.");

    setCategorySaving(true);
    try {
      let imageUrl = categoryForm.image_url || null;

      if (categoryImageFile) {
        if (!categoryImageFile.type.startsWith("image/")) {
          throw new Error("Please select a valid image file.");
        }
        if (categoryImageFile.size > 5 * 1024 * 1024) {
          throw new Error("Image must be 5MB or smaller.");
        }

        const extension =
          categoryImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath =
          `categories/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("material-images")
          .upload(storagePath, categoryImageFile, {
            upsert: false,
            cacheControl: "3600",
            contentType: categoryImageFile.type,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("material-images")
          .getPublicUrl(storagePath);
        imageUrl = data.publicUrl;
      }

      const payload = {
        name,
        description: categoryForm.description.trim() || null,
        icon: categoryForm.icon,
        color: categoryForm.color,
        image_url: imageUrl,
      };

      const result = editingCategoryId
        ? await supabase
            .from("categories")
            .update(payload)
            .eq("id", editingCategoryId)
        : await supabase.from("categories").insert(payload);

      if (result.error) throw result.error;

      setCategoryModalOpen(false);
      setCategoryImageFile(null);
      await fetchData();
      showToast(
        editingCategoryId
          ? "Category updated successfully."
          : "Category created successfully."
      );
    } catch (err: any) {
      showToast(err.message || "Unable to save category.", "error");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDeleteCategory(category: Category) {
    const assignedMaterials = materials.filter(
      (item) => item.category_id === category.id
    );

    if (assignedMaterials.length > 0) {
      return showToast(
        `Cannot delete "${category.name}". ${assignedMaterials.length} material(s) are assigned to it. Reassign those materials first.`
      );
    }

    showConfirmToast(
      `Delete category "${category.name}"? This cannot be undone.`,
      () => { void (async () => {
        try {
          const { error: deleteError } = await supabase
            .from("categories")
            .delete()
            .eq("id", category.id);

          if (deleteError) throw deleteError;
          await fetchData();
          showToast("Category deleted successfully.");
        } catch (err: any) {
          showToast(err.message || "Unable to delete category.", "error");
        }
      })(); },
      "Delete category"
    );
  }

  // --------------------------------------------------
  // ADD MATERIAL
  // --------------------------------------------------

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setMaterialImages([]);
    setModalOpen(true);
  }

  // --------------------------------------------------
  // EDIT MATERIAL
  // --------------------------------------------------

  function openEditModal(item: Material) {
    setEditingId(item.id);

    setForm({
      name: item.name,
      category_id: item.category_id || "",
      sku: item.sku || "",
      unit: item.unit,
      current_stock: String(item.current_stock),
      avg_unit_cost: String(item.avg_unit_cost),
      low_stock_threshold: String(item.low_stock_threshold ?? 0),
      notes: item.notes || "",
      package_type: item.package_type || "unit",
      package_size: String(item.package_size ?? 1),
      package_count: String(
        Number(item.package_size || 1) > 0
          ? Number(item.current_stock) / Number(item.package_size || 1)
          : 0
      ),
    });
    const savedImages = item.image_urls?.length
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : [];
    setMaterialImages(savedImages.map((url) => ({ url })));

    setModalOpen(true);
  }

  // --------------------------------------------------
  // SAVE MATERIAL
  // --------------------------------------------------

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const packageSize = Number(form.package_size);
    const packageCount = Number(form.package_count);
    const calculatedStock = packageSize * packageCount;

    if (!form.name.trim()) {
      showToast("Material name is required.");
      return;
    }

    if (
      !Number.isFinite(packageSize) ||
      !Number.isFinite(packageCount) ||
      !Number.isFinite(Number(form.avg_unit_cost)) ||
      !Number.isFinite(Number(form.low_stock_threshold)) ||
      packageSize <= 0 ||
      packageCount < 0 ||
      Number(form.avg_unit_cost) < 0 ||
      Number(form.low_stock_threshold) < 0
    ) {
      showToast("Please enter valid positive numeric values.");
      return;
    }

    setSaving(true);

    try {
      const imageUrls: string[] = [];
      for (const image of materialImages) {
        if (image.file) {
          const extension = image.file.name.split(".").pop()?.toLowerCase() || "jpg";
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const storagePath = `materials/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("material-images")
            .upload(storagePath, image.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: image.file.type,
            });
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = supabase.storage
            .from("material-images")
            .getPublicUrl(storagePath);
          imageUrls.push(publicUrlData.publicUrl);
        } else {
          imageUrls.push(image.url);
        }
      }

      const payload = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        sku: form.sku.trim() || null,
        unit: form.unit.trim(),
        current_stock: calculatedStock,
        avg_unit_cost: Number(form.avg_unit_cost),
        low_stock_threshold: Number(form.low_stock_threshold),
        notes: form.notes.trim() || null,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls,
        package_type: form.package_type,
        package_size: packageSize,
        package_count: packageCount,
      };

      const result = editingId
        ? await supabase.from("materials").update(payload).eq("id", editingId)
        : await supabase.from("materials").insert(payload);

      if (result.error) throw result.error;

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setMaterialImages([]);

      await fetchData();
      showToast(editingId ? "Material updated successfully." : "Material added successfully.");
    } catch (err: any) {
      showToast(err.message || "Unable to save material. Check Storage bucket and database columns.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleImageChange(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const valid: MaterialImage[] = [];
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        showToast(`${file.name}: Please select an image file.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name}: Image must be 5MB or smaller.`);
        continue;
      }
      valid.push({ url: URL.createObjectURL(file), file });
    }
    setMaterialImages((current) => [...current, ...valid].slice(0, 10));
  }

  function removeMaterialImage(index: number) {
    setMaterialImages((current) => current.filter((_, i) => i !== index));
  }

  function openStockModal(mode: "in" | "out") {
    setStockMode(mode);
    setUsageMaterialId(materials[0]?.id || "");
    setUsageQuantity("");
    setUsageNote("");
    setUsagePurchaseTotal("");
    setUsageImages([]);
    setUsageModalOpen(true);
  }

  async function handleStockUsage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const material = materials.find((item) => item.id === usageMaterialId);
    const quantity = Number(usageQuantity);
    if (!material) return showToast("Please select a material.");
    if (!Number.isFinite(quantity) || quantity <= 0) return showToast("Enter a valid usage quantity.");
    if (stockMode === "out" && quantity > Number(material.current_stock)) {
      return showToast(`Not enough stock. Available: ${material.current_stock} ${material.unit}`);
    }

    const purchaseTotal = usagePurchaseTotal.trim() === "" ? null : Number(usagePurchaseTotal);
    if (stockMode === "in" && purchaseTotal !== null && (!Number.isFinite(purchaseTotal) || purchaseTotal < 0)) {
      return showToast("Enter a valid purchase total price, or leave it blank to keep the current average cost.");
    }

    setUsageSaving(true);
    try {
      // Upload optional new photos first. Existing gallery images are preserved.
      const uploadedImageUrls: string[] = [];
      if (stockMode === "in" && usageImages.length) {
        for (const image of usageImages) {
          if (!image.file) continue;
          const extension = image.file.name.split(".").pop()?.toLowerCase() || "jpg";
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const storagePath = `materials/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("material-images")
            .upload(storagePath, image.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: image.file.type,
            });
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = supabase.storage
            .from("material-images")
            .getPublicUrl(storagePath);
          uploadedImageUrls.push(publicUrlData.publicUrl);
        }
      }

      const rpcName = stockMode === "in" ? "receive_material_stock" : "consume_material_stock";
      const rpcArgs: Record<string, string | number | null> = {
        p_material_id: material.id,
        p_quantity: quantity,
        p_note: usageNote.trim() || null,
      };
      if (stockMode === "in") rpcArgs.p_purchase_total = purchaseTotal;

      const { error: usageError } = await supabase.rpc(rpcName, rpcArgs);
      if (usageError) throw usageError;

      // Add newly uploaded photos to the material gallery without removing old photos.
      if (uploadedImageUrls.length) {
        const existingImages = material.image_urls?.length
          ? material.image_urls
          : material.image_url ? [material.image_url] : [];
        const mergedImages = [...existingImages, ...uploadedImageUrls];
        const { error: imageUpdateError } = await supabase
          .from("materials")
          .update({ image_urls: mergedImages, image_url: mergedImages[0] || null })
          .eq("id", material.id);
        if (imageUpdateError) {
          throw new Error(`Stock was recorded, but photo gallery could not be updated: ${imageUpdateError.message}`);
        }
      }

      setUsageModalOpen(false);
      setUsageImages([]);
      setUsagePurchaseTotal("");
      await fetchData();
      showToast(stockMode === "in"
        ? `${quantity} ${material.unit} added to ${material.name}. Stock and average cost updated.`
        : `${quantity} ${material.unit} used from ${material.name}. Stock updated.`);
    } catch (err: any) {
      showToast(err.message || "Unable to record stock movement. Check the latest SQL migration and Storage bucket.", "error");
    } finally {
      setUsageSaving(false);
    }
  }

  // --------------------------------------------------
  // PRODUCTION RECIPES AND BATCHES
  // --------------------------------------------------

  function openRecipeModal() {
    setRecipeName("");
    setFinishedProductName("");
    setRecipeOutputQuantity("1");
    setRecipeOutputUnit("pcs");
    setRecipeNotes("");
    setRecipeItems([{ material_id: "", quantity_per_batch: "" }]);
    setRecipeModalOpen(true);
  }

  async function handleSaveRecipe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const outputQty = Number(recipeOutputQuantity);
    const validItems = recipeItems.filter((item) => item.material_id && Number(item.quantity_per_batch) > 0);
    if (!recipeName.trim() || !finishedProductName.trim() || outputQty <= 0 || validItems.length === 0) {
      return showToast("Enter recipe name, finished product, output quantity and at least one valid ingredient.");
    }
    if (new Set(validItems.map((item) => item.material_id)).size !== validItems.length) {
      return showToast("Please select each raw material only once in a recipe.");
    }
    setRecipeSaving(true);
    try {
      const { data: product, error: productError } = await supabase
        .from("finished_products")
        .upsert({ name: finishedProductName.trim(), unit: recipeOutputUnit }, { onConflict: "name" })
        .select("id")
        .single();
      if (productError) throw productError;

      const { data: recipe, error: recipeError } = await supabase
        .from("production_recipes")
        .insert({
          name: recipeName.trim(),
          finished_product_id: product.id,
          output_quantity: outputQty,
          output_unit: recipeOutputUnit,
          notes: recipeNotes.trim() || null,
        })
        .select("id")
        .single();
      if (recipeError) throw recipeError;

      const { error: itemsError } = await supabase.from("production_recipe_items").insert(
        validItems.map((item) => ({
          recipe_id: recipe.id,
          material_id: item.material_id,
          quantity_per_batch: Number(item.quantity_per_batch),
        }))
      );
      if (itemsError) throw itemsError;
      setRecipeModalOpen(false);
      await fetchData();
      showToast("Recipe saved successfully. You can reuse it for every production batch.");
    } catch (err: any) {
      showToast(err.message || "Unable to save recipe. Run the production SQL migration first.", "error");
    } finally {
      setRecipeSaving(false);
    }
  }

  async function handleCompleteProduction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const count = Number(productionBatchCount);
    if (!selectedRecipeId || !Number.isFinite(count) || count <= 0) return showToast("Select a recipe and enter a valid batch count.");
    setProductionSaving(true);
    try {
      const { data, error: productionError } = await supabase.rpc("complete_production_batch", {
        p_recipe_id: selectedRecipeId,
        p_batch_count: count,
        p_note: productionNote.trim() || null,
      });
      if (productionError) throw productionError;
      setProductionModalOpen(false);
      setProductionNote("");
      setProductionBatchCount("1");
      await fetchData();
      showToast(`Production completed successfully. Batch ${data?.batch_number || "created"}. Raw material stock has been deducted.`);
    } catch (err: any) {
      showToast(err.message || "Unable to complete production. Check ingredient stock and SQL migration.", "error");
    } finally {
      setProductionSaving(false);
    }
  }

  async function handleCancelProduction(run: ProductionRun) {
    if (run.status !== "completed") return;
    showConfirmToast(
      `Cancel batch ${run.batch_number}? Raw materials will be restored and finished goods stock will be reversed.`,
      () => { void (async () => {
        try {
          const { error: cancelError } = await supabase.rpc("cancel_production_batch", { p_run_id: run.id });
          if (cancelError) throw cancelError;
          await fetchData();
          showToast("Production batch cancelled and stock reversed.");
        } catch (err: any) {
          showToast(err.message || "Unable to cancel production batch.", "error");
        }
      })(); },
      "Cancel batch"
    );
  }

  // ARCHIVE MATERIAL (preserves transaction and production history)
  // --------------------------------------------------

  async function handleDelete(id: string) {
    showConfirmToast(
      "Remove this material from the active inventory? It will be archived, not permanently deleted. All past stock transactions and production records will be preserved.",
      () => { void (async () => {
        try {
          const { data, error } = await supabase
            .from("materials")
            .update({ is_archived: true })
            .eq("id", id)
            .select("id")
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error("Material was not found or you do not have permission to archive it.");

          await fetchData();
          showToast("Material archived. Its stock transaction and production history have been preserved.");
        } catch (err: any) {
          showToast(err.message || "Unable to archive material.", "error");
        }
      })(); },
      "Archive material"
    );
  }

  // --------------------------------------------------
  // FORMAT HELPERS
  // --------------------------------------------------

  function money(value: number) {
    return `৳${Number(value || 0).toLocaleString("en-BD", {
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function isStockIn(type: string) {
    const normalized = type.toLowerCase().replace(/[ -]/g, "_");
    return ["in", "stock_in", "purchase", "received", "receive"].includes(normalized);
  }

  function transactionMatchesDates(transaction: Transaction, from: string, to: string) {
    const day = String(transaction.transaction_date || "").slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  }

  const filteredTransactions = useMemo(() => {
    const rows = transactions.filter((t) => {
      const matchesDates = transactionMatchesDates(t, transactionFrom, transactionTo);
      const matchesType = transactionTypeFilter === "All" ||
        (transactionTypeFilter === "in" ? isStockIn(t.transaction_type) : !isStockIn(t.transaction_type));
      const matchesMaterial = transactionMaterialFilter === "All" ||
        materials.find((m) => m.id === transactionMaterialFilter)?.name === t.materials?.name;
      const query = transactionSearch.trim().toLowerCase();
      const matchesSearch = !query ||
        (t.materials?.name || "").toLowerCase().includes(query) ||
        (t.note || "").toLowerCase().includes(query) ||
        t.transaction_type.toLowerCase().includes(query);
      return matchesDates && matchesType && matchesMaterial && matchesSearch;
    });

    return rows.sort((a, b) => {
      if (transactionSort === "oldest") return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      if (transactionSort === "cost_high") return Number(b.total_cost) - Number(a.total_cost);
      if (transactionSort === "cost_low") return Number(a.total_cost) - Number(b.total_cost);
      return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
    });
  }, [transactions, materials, transactionFrom, transactionTo, transactionTypeFilter, transactionMaterialFilter, transactionSearch, transactionSort]);

  const overviewTransactions = useMemo(
    () => transactions.filter((t) => transactionMatchesDates(t, overviewFrom, overviewTo)),
    [transactions, overviewFrom, overviewTo]
  );
  const reportTransactions = useMemo(
    () => transactions.filter((t) => transactionMatchesDates(t, reportFrom, reportTo)),
    [transactions, reportFrom, reportTo]
  );
  const overviewStockIn = overviewTransactions.filter((t) => isStockIn(t.transaction_type));
  const overviewStockOut = overviewTransactions.filter((t) => !isStockIn(t.transaction_type));
  const reportStockIn = reportTransactions.filter((t) => isStockIn(t.transaction_type));
  const reportStockOut = reportTransactions.filter((t) => !isStockIn(t.transaction_type));
  const sumTransactionCost = (rows: Transaction[]) => rows.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
  const sumTransactionQuantity = (rows: Transaction[]) => rows.reduce((sum, t) => sum + Number(t.quantity || 0), 0);

  // --------------------------------------------------
  // MATERIAL INVENTORY TABLE
  // --------------------------------------------------

  function MaterialTable() {
    return (
      <section className="bg-white border border-[#E9EAE3] rounded-2xl overflow-hidden mb-8">
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Material Inventory</h2>
            <p className="text-xs text-[#92998E] mt-1">
              Track and manage your raw materials
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openStockModal("in")}
              disabled={materials.length === 0}
              className="border border-[#314B37] text-[#314B37] px-4 py-3 rounded-xl text-xs font-semibold hover:bg-[#F1F4EE] disabled:opacity-40"
            >
              + Add Stock
            </button>
            <button
              onClick={() => openStockModal("out")}
              disabled={materials.length === 0}
              className="border border-[#314B37] text-[#314B37] px-4 py-3 rounded-xl text-xs font-semibold hover:bg-[#F1F4EE] disabled:opacity-40"
            >
              − Use Material
            </button>
            <button
              onClick={openAddModal}
              className="bg-[#314B37] text-white px-4 py-3 rounded-xl text-xs font-semibold hover:bg-[#263C2D]"
            >
              + Add New Material
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-4 py-3 text-xs flex-1 outline-none focus:border-[#82947B]"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-4 py-3 text-xs outline-none"
          >
            <option value="All">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-[#F8F9F5] text-[#92998E]">
              <tr>
                <th className="px-6 py-4 font-medium">MATERIAL</th>
                <th className="px-6 py-4 font-medium">CATEGORY</th>
                <th className="px-6 py-4 font-medium">AVAILABLE STOCK</th>
                <th className="px-6 py-4 font-medium">UNIT COST</th>
                <th className="px-6 py-4 font-medium">STOCK VALUE</th>
                <th className="px-6 py-4 font-medium">STATUS</th>
                <th className="px-6 py-4 font-medium">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Loading materials...
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((item) => {
                  const low =
                    Number(item.current_stock) <=
                    Number(item.low_stock_threshold ?? 0);

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-[#F0F1EC] hover:bg-[#FAFBF8]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {(item.image_urls?.[0] || item.image_url) ? (
                            <img src={item.image_urls?.[0] || item.image_url || ""} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-[#E9EAE3]" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#F1F3ED] text-[#82947B] flex items-center justify-center text-lg">▧</div>
                          )}
                          <div>
                            <div className="font-semibold text-[#27372B]">{item.name}</div>
                            <div className="text-[10px] text-gray-400 mt-1">{item.sku || "No SKU"}{(item.image_urls?.length || 0) > 1 ? ` · ${item.image_urls!.length} photos` : ""}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-[#7D867A]">
                        {item.categories?.name || "Uncategorized"}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        <div>{Number(item.current_stock).toLocaleString()} {item.unit}</div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          {item.package_count ?? "—"} × {item.package_size ?? "—"} {item.unit} / {item.package_type || "unit"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {money(Number(item.avg_unit_cost))}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {money(
                          Number(item.current_stock) *
                            Number(item.avg_unit_cost)
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] ${
                            low
                              ? "bg-red-50 text-red-600"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {low ? "Low Stock" : "In Stock"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-[#536D53] font-semibold hover:underline"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-500 font-semibold hover:underline"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-[#92998E]"
                  >
                    No materials found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-[#F0F1EC] text-[10px] text-[#A0A69C]">
          Showing {filtered.length} of {materials.length} materials · Live
          Supabase Data
        </div>
      </section>
    );
  }

  // --------------------------------------------------
  // RECENT TRANSACTIONS
  // --------------------------------------------------

  function RecentTransactions() {
    return (
      <section className="bg-white border border-[#E9EAE3] rounded-2xl p-5 md:p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="font-semibold text-lg">Recent Transactions</h2>
            <p className="text-xs text-[#92998E] mt-1">
              Latest stock movements
            </p>
          </div>

          <button
            onClick={() => setActive("Stock Transactions")}
            className="text-xs text-[#536D53] font-semibold"
          >
            View history →
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 py-5">
            No transactions found.
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 5).map((transaction) => {
              const positive = isStockIn(transaction.transaction_type);

              return (
                <div
                  key={transaction.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F1EC] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EDF1E9] flex items-center justify-center text-[#536D53]">
                      {positive ? "↓" : "↑"}
                    </div>

                    <div>
                      <div className="text-sm font-semibold">
                        {transaction.materials?.name || "Material"}
                      </div>

                      <div className="text-[10px] text-[#92998E] mt-1">
                        {transaction.transaction_type} ·{" "}
                        {transaction.quantity} ·{" "}
                        {formatDate(transaction.transaction_date)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        positive ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {positive ? "+" : "-"}
                      {money(Number(transaction.total_cost))}
                    </div>

                    <div className="text-[10px] text-[#92998E] mt-1">
                      {transaction.note || transaction.transaction_type}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // --------------------------------------------------
  // DASHBOARD OVERVIEW
  // --------------------------------------------------

  function Overview() {
    return (
      <>
        <section className="bg-white border border-[#E9EAE3] rounded-2xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-sm">Overview Date Filter</h2>
              <p className="text-xs text-gray-400 mt-1">Choose a period to review your inventory activity.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["all", "All time"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["last30", "Last 30 days"],
                ["custom", "Custom date range"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyOverviewPreset(value)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    overviewPreset === value
                      ? "bg-[#314B37] text-white shadow-sm"
                      : "bg-[#F4F6F1] text-[#536D53] hover:bg-[#E9EEE5]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {overviewPreset === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="text-xs text-gray-500">
                From date
                <input
                  type="date"
                  value={overviewFrom}
                  max={overviewTo || undefined}
                  onChange={(e) => setOverviewFrom(e.target.value)}
                  className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs text-[#27372B]"
                />
              </label>
              <label className="text-xs text-gray-500">
                To date
                <input
                  type="date"
                  value={overviewTo}
                  min={overviewFrom || undefined}
                  onChange={(e) => setOverviewTo(e.target.value)}
                  className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs text-[#27372B]"
                />
              </label>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#F0F1EC]">
            <p className="text-[11px] text-[#92998E]">
              {overviewPreset === "all"
                ? "Showing all recorded inventory activity"
                : overviewPreset === "today"
                ? "Showing activity for today"
                : overviewPreset === "yesterday"
                ? "Showing activity for yesterday"
                : overviewPreset === "last30"
                ? "Showing the last 30 days, including today"
                : overviewFrom && overviewTo
                ? `${formatDate(overviewFrom)} – ${formatDate(overviewTo)}`
                : "Select your custom date range"}
            </p>
            <span className="text-[11px] font-semibold text-[#536D53]">
              {overviewTransactions.length} transactions
            </span>
          </div>
        </section>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[
            [
              "Total Inventory Value",
              money(totalInventoryValue),
              "Current stock valuation",
              "↗",
            ],
            [
              "Total Materials",
              String(materials.length),
              "Across all categories",
              "▤",
            ],
            [
              "Categories",
              String(categories.length),
              "Material groups",
              "◈",
            ],
            [
              "Low Stock Items",
              String(lowStockItems.length).padStart(2, "0"),
              "Need attention",
              "!",
            ],
          ].map(([title, value, sub, icon], i) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-[#E9EAE3] p-5"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#879084]">{title}</span>

                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    i === 3
                      ? "bg-red-50 text-red-600"
                      : "bg-[#EDF1E9] text-[#536D53]"
                  }`}
                >
                  {icon}
                </span>
              </div>

              <div className="text-2xl font-semibold mt-4">{value}</div>
              <div className="text-[11px] text-[#A0A69C] mt-2">{sub}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
          <div className="xl:col-span-2 bg-[#314B37] rounded-2xl p-6 md:p-7 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-xs text-[#D0DCCB] tracking-wide">
                TOTAL STOCK INVESTMENT
              </div>

              <div className="text-3xl md:text-4xl font-semibold mt-3">
                {money(totalInventoryValue)}
              </div>

              <p className="text-sm text-[#C2D0BF] mt-3">
                Estimated value of all available raw materials.
              </p>

              <button
                onClick={() => setActive("Reports")}
                className="mt-6 px-4 py-2.5 rounded-xl bg-[#E8EDE3] text-[#314B37] text-xs font-semibold hover:bg-white"
              >
                View Inventory Report →
              </button>
            </div>

            <div className="absolute -right-12 -bottom-28 w-72 h-72 rounded-full border-[40px] border-white/5" />
            <div className="absolute right-16 -top-20 w-48 h-48 rounded-full border-[25px] border-white/5" />
          </div>

          <div className="bg-white rounded-2xl border border-[#E9EAE3] p-6">
            <div className="font-semibold text-sm">Stock Alerts</div>

            <p className="text-xs text-[#92998E] mt-1">
              Materials that need attention
            </p>

            <div className="mt-6 space-y-4">
              {lowStockItems.length === 0 && (
                <p className="text-xs text-gray-400">
                  No low stock materials.
                </p>
              )}

              {lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-[#92998E] mt-1">
                      {item.current_stock} {item.unit} remaining
                    </div>
                  </div>

                  <span className="text-[10px] bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg">
                    Low Stock
                  </span>
                </div>
              ))}

              <button
                onClick={() => setActive("Materials")}
                className="text-xs text-[#536D53] font-semibold pt-2"
              >
                View all materials →
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">Material Categories</h2>
              <p className="text-xs text-[#92998E] mt-1">
                Inventory value grouped by category
              </p>
            </div>

            <button
              onClick={() => setActive("Categories")}
              className="text-xs font-semibold text-[#536D53]"
            >
              View all →
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {categoryStats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setActive("Materials");
                }}
                className="text-left bg-white border border-[#E9EAE3] rounded-2xl p-4 hover:border-[#82947B] transition"
              >
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{
                      backgroundColor: `${cat.dbColor}20`,
                      color: cat.dbColor,
                    }}
                  >
                    {cat.icon}
                  </div>
                )}

                <div className="text-sm font-semibold mt-4">{cat.name}</div>

                <div className="text-[10px] text-[#92998E] mt-1">
                  {cat.count} materials
                </div>

                <div className="font-semibold text-sm mt-3">
                  {money(cat.value)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <MaterialTable />

        <RecentTransactions />
      </>
    );
  }

  // --------------------------------------------------
  // PAGE CONTENT
  // --------------------------------------------------

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F7F7F3] text-[#27372B] md:flex">
      {toast && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#142219]/35 px-4 py-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(event) => {
            if (event.target === event.currentTarget && !toast.onConfirm) setToast(null);
          }}
        >
          <div className="w-full max-w-[430px] animate-in zoom-in-95 fade-in duration-200">
            <div
              role="dialog"
              aria-modal="true"
              className={`relative overflow-hidden rounded-3xl border p-4 shadow-[0_28px_90px_rgba(10,25,15,0.28)] backdrop-blur-2xl sm:p-5 ${
                toast.kind === "error"
                  ? "border-red-200/80 bg-white/90"
                  : toast.kind === "info"
                    ? "border-white/80 bg-white/90"
                    : "border-[#DCE8D9]/90 bg-white/90"
              }`}
            >
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="absolute right-3 top-3 z-10 rounded-lg px-2 py-1 text-sm text-[#9AA397] hover:bg-[#F4F6F1] hover:text-[#536D53]"
              >
                ×
              </button>

              <div className="flex items-start gap-3 pr-5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
                    toast.kind === "error"
                      ? "bg-red-50 text-red-600"
                      : toast.kind === "info"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-[#EDF4EA] text-[#314B37]"
                  }`}
                >
                  {toast.kind === "error" ? "!" : toast.kind === "info" ? "i" : "✓"}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-[#27372B]">
                    {toast.kind === "error"
                      ? "Something needs attention"
                      : toast.kind === "info"
                        ? "Information"
                        : "Successfully completed"}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-[#778174]">
                    {toast.message}
                  </p>
                </div>
              </div>

              {toast.onConfirm && (
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#E9EDE6] pt-4">
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="rounded-xl border border-[#E1E7DE] bg-white px-4 py-2.5 text-xs font-semibold text-[#536D53] transition hover:bg-[#F7F8F5]"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const action = toast.onConfirm;
                      setToast(null);
                      action?.();
                    }}
                    className="rounded-xl bg-[#314B37] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#263C2D]"
                  >
                    {toast.confirmLabel || "Confirm"}
                  </button>
                </div>
              )}

              {!toast.onConfirm && (
                <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-[#E8EEE5]/70">
                  <div className="h-full w-full rounded-full bg-[#82947B]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* RESPONSIVE SIDEBAR */}
      <aside className="w-full shrink-0 bg-[#263C2D] text-white md:sticky md:top-0 md:h-screen md:min-h-screen md:w-[245px] md:flex md:flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:block md:px-7 md:py-7">
          <div>
            <div className="text-xl font-semibold tracking-[0.18em] md:text-2xl">HEBO</div>
            <div className="mt-1 text-[9px] tracking-[0.23em] text-[#B6C5B5] md:text-[10px]">MATERIAL MANAGEMENT</div>
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-xl text-white md:hidden"
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        <div className={`${mobileMenuOpen ? "block" : "hidden"} pb-3 md:block md:flex-1`}>
          <div className="px-5 pb-2 pt-4 text-[10px] uppercase tracking-[0.2em] text-[#A8B8A8] md:pt-7">Workspace</div>
          <nav className="grid grid-cols-2 gap-1 px-3 md:block md:space-y-1">
            {visibleNavItems.map(([icon, label]) => (
              <button
                key={label}
                onClick={() => {
                  setActive(label);
                  setSelectedCategory("All");
                  setSearch("");
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-3 text-left text-xs transition md:gap-3 md:px-4 md:text-sm ${
                  active === label ? "bg-[#82947B] text-white shadow-lg" : "text-[#D0D9CE] hover:bg-white/10"
                }`}
              >
                <span className="w-5 shrink-0 text-center text-base md:text-lg">{icon}</span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto hidden p-5 md:block">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="text-xs text-[#C4D0C1]">Inventory Status</div>
            <div className="mt-2 text-sm font-medium">Your stock is being monitored.</div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full w-3/4 rounded-full bg-[#AFC09F]" /></div>
            <div className="mt-2 text-[10px] text-[#B7C6B5]">Live inventory data</div>
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A5B49A] font-semibold text-[#263C2D]">A</div>
            <div><div className="text-sm font-medium">Administrator</div><div className="text-[10px] text-[#B7C6B5]">Admin Account</div></div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-3 sm:p-5 md:p-9 lg:p-10">
        <header className="mb-5 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-[#849083] mb-2">
              HEBO / Inventory Management
            </div>

            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {active}
            </h1>

            <p className="text-sm text-[#899187] mt-2">
              Manage your raw materials and inventory.
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <button
              onClick={fetchData}
              title="Refresh data"
              className="w-10 h-10 rounded-xl border border-[#E5E7DF] bg-white hover:bg-gray-50"
            >
              ↻
            </button>

            <div className="flex items-center gap-2 bg-white border border-[#E5E7DF] rounded-xl px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-[#E7EDE3] flex items-center justify-center">
                A
              </div>

              <div className="text-xs">
                <div className="font-semibold">Admin</div>
                <div className="text-[#92988E]">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            Database Error: {error}
            <button
              onClick={fetchData}
              className="ml-3 underline font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="mb-6 text-xs text-[#92998E]">
            Syncing Supabase data...
          </div>
        )}

        {/* OVERVIEW */}

        {active === "Overview" && <Overview />}

        {/* MATERIALS */}

        {active === "Materials" && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5">
                <div className="text-xs text-gray-400">Total Materials</div>
                <div className="text-2xl font-semibold mt-3">
                  {materials.length}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5">
                <div className="text-xs text-gray-400">Inventory Value</div>
                <div className="text-2xl font-semibold mt-3">
                  {money(totalInventoryValue)}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5">
                <div className="text-xs text-gray-400">Low Stock</div>
                <div className="text-2xl font-semibold mt-3 text-red-600">
                  {lowStockItems.length}
                </div>
              </div>
            </section>

            <MaterialTable />
          </>
        )}

        {/* CATEGORIES */}

        {active === "Categories" && (
          <section className="bg-white border border-[#E9EAE3] rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-semibold text-lg">Database Categories</h2>
                <p className="text-xs text-[#92998E] mt-1">
                  Create and customize your material categories.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddCategory}
                className="bg-[#314B37] text-white px-4 py-3 rounded-xl text-xs font-semibold hover:bg-[#263C2D]"
              >
                + Add Category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 mb-4">No categories found.</p>
                <button type="button" onClick={openAddCategory} className="text-sm font-semibold text-[#536D53]">
                  Create your first category →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {categoryStats.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-[#E9EAE3] rounded-2xl p-5 hover:border-[#82947B] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {cat.image_url ? (
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="w-14 h-14 rounded-xl object-cover border border-[#E9EAE3]"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                          style={{
                            backgroundColor: `${cat.dbColor}20`,
                            color: cat.dbColor,
                          }}
                        >
                          {cat.icon}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCategory(cat)}
                          className="px-3 py-2 text-xs rounded-lg border border-[#E9EAE3] hover:bg-[#F1F4EE]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="px-3 py-2 text-xs rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold mt-4">{cat.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 min-h-4">
                      {cat.description || "No description"}
                    </p>
                    <p className="text-xs text-[#92998E] mt-3">
                      {cat.count} materials
                    </p>
                    <p className="font-semibold mt-2">{money(cat.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STOCK TRANSACTIONS */}

        {active === "Stock Transactions" && (
          <section className="bg-white border border-[#E9EAE3] rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg">Stock Transactions</h2>
                  <p className="text-xs text-gray-400 mt-1">Complete stock movement history from Supabase</p>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <span className="rounded-lg bg-green-50 text-green-700 px-3 py-2">+ Stock In</span>
                  <span className="rounded-lg bg-red-50 text-red-600 px-3 py-2">− Stock Out</span>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <label className="text-xs text-gray-500">From date
                <input type="date" value={transactionFrom} max={transactionTo || undefined} onChange={(e) => setTransactionFrom(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs text-[#27372B]" />
              </label>
              <label className="text-xs text-gray-500">To date
                <input type="date" value={transactionTo} min={transactionFrom || undefined} onChange={(e) => setTransactionTo(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs text-[#27372B]" />
              </label>
              <label className="text-xs text-gray-500">Transaction type
                <select value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs">
                  <option value="All">All transactions</option>
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (−)</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">Material
                <select value={transactionMaterialFilter} onChange={(e) => setTransactionMaterialFilter(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs">
                  <option value="All">All materials</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Search
                <input value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} placeholder="Material, note or type..." className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs" />
              </label>
              <label className="text-xs text-gray-500">Sort by
                <select value={transactionSort} onChange={(e) => setTransactionSort(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs">
                  <option value="newest">Date: Newest first</option>
                  <option value="oldest">Date: Oldest first</option>
                  <option value="cost_high">Amount: High to low</option>
                  <option value="cost_low">Amount: Low to high</option>
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs text-left">
                <thead className="bg-[#F8F9F5] text-gray-400">
                  <tr>
                    <th className="p-4">DATE</th><th className="p-4">MATERIAL</th><th className="p-4">TYPE</th><th className="p-4">QUANTITY</th><th className="p-4">UNIT COST</th><th className="p-4">TOTAL COST</th><th className="p-4">NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => {
                    const positive = isStockIn(t.transaction_type);
                    return (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-[#FAFBF8]">
                        <td className="p-4 whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                        <td className="p-4 font-semibold">{t.materials?.name || "Material"}</td>
                        <td className="p-4">{t.transaction_type}</td>
                        <td className={`p-4 font-semibold ${positive ? "text-green-700" : "text-red-600"}`}>
                          {positive ? "+" : "−"}{Number(t.quantity).toLocaleString()} {t.materials?.unit || ""}
                        </td>
                        <td className="p-4">{money(t.unit_cost)}</td>
                        <td className={`p-4 font-semibold ${positive ? "text-green-700" : "text-red-600"}`}>
                          {positive ? "+" : "−"}{money(t.total_cost)}
                        </td>
                        <td className="p-4">{t.note || "—"}</td>
                      </tr>
                    );
                  })}
                  {!loading && filteredTransactions.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">No transactions match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 text-xs text-gray-400 border-t flex flex-wrap items-center justify-between gap-2">
              <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
              <button type="button" onClick={() => { setTransactionFrom(""); setTransactionTo(""); setTransactionTypeFilter("All"); setTransactionMaterialFilter("All"); setTransactionSearch(""); setTransactionSort("newest"); }} className="font-semibold text-[#536D53]">Reset filters</button>
            </div>
          </section>
        )}

        {/* PRODUCTION */}

        {active === "Production" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5"><p className="text-xs text-gray-400">Saved Recipes</p><p className="text-2xl font-semibold mt-2">{recipes.length}</p></div>
              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5"><p className="text-xs text-gray-400">Finished Products</p><p className="text-2xl font-semibold mt-2">{finishedProducts.length}</p></div>
              <div className="bg-white rounded-2xl border border-[#E9EAE3] p-5"><p className="text-xs text-gray-400">Completed Batches</p><p className="text-2xl font-semibold mt-2">{productionRuns.filter((run) => run.status === "completed").length}</p></div>
            </section>

            <section className="bg-white border border-[#E9EAE3] rounded-2xl p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div><h2 className="font-semibold text-lg">Production Recipes</h2><p className="text-xs text-gray-400 mt-1">Save a formula once and reuse it for every batch.</p></div>
                <div className="flex gap-2"><button onClick={openRecipeModal} className="px-4 py-3 rounded-xl border border-[#314B37] text-[#314B37] text-xs font-semibold">+ Save Recipe</button><button disabled={!recipes.length} onClick={() => { setSelectedRecipeId(recipes[0]?.id || ""); setProductionBatchCount("1"); setProductionNote(""); setProductionModalOpen(true); }} className="px-4 py-3 rounded-xl bg-[#314B37] text-white text-xs font-semibold disabled:opacity-40">+ Create Production Batch</button></div>
              </div>
              {recipes.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">No saved recipes yet. Create your first recipe.</p> : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {recipes.map((recipe) => (
                    <div key={recipe.id} className="border border-[#E9EAE3] rounded-xl p-4">
                      <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{recipe.name}</h3><p className="text-xs text-gray-400 mt-1">Produces {recipe.output_quantity} {recipe.output_unit} · {recipe.finished_products?.name || "Finished product"}</p></div><span className="text-xs bg-[#EDF1E9] text-[#536D53] rounded-lg px-2 py-1 h-fit">Saved formula</span></div>
                      <div className="mt-4 space-y-2">{(recipe.production_recipe_items || []).map((item) => <div key={item.id || item.material_id} className="flex justify-between text-xs border-t border-gray-100 pt-2"><span>{item.materials?.name || "Ingredient"}</span><span className="font-semibold">{Number(item.quantity_per_batch).toLocaleString()} {item.materials?.unit || "unit"}</span></div>)}</div>
                      <div className="mt-4 text-xs text-gray-500">{recipe.notes || "No recipe notes"}</div>
                      <button onClick={() => { setSelectedRecipeId(recipe.id); setProductionBatchCount("1"); setProductionNote(""); setProductionModalOpen(true); }} className="mt-4 w-full rounded-lg bg-[#314B37] text-white py-2.5 text-xs font-semibold">Produce this recipe →</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-[#E9EAE3] rounded-2xl overflow-hidden">
              <div className="p-5"><h2 className="font-semibold text-lg">Finished Goods Stock</h2><p className="text-xs text-gray-400 mt-1">Stock increases automatically after a production batch is completed.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="bg-[#F8F9F5] text-gray-400"><tr><th className="p-4">PRODUCT</th><th className="p-4">AVAILABLE FINISHED STOCK</th><th className="p-4">UNIT</th></tr></thead><tbody>{finishedProducts.map((product) => <tr key={product.id} className="border-t border-gray-100"><td className="p-4 font-semibold">{product.name}</td><td className="p-4 font-semibold">{Number(product.current_stock).toLocaleString()}</td><td className="p-4">{product.unit}</td></tr>)}{finishedProducts.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400">No finished products yet.</td></tr>}</tbody></table></div>
            </section>

            <section className="bg-white border border-[#E9EAE3] rounded-2xl overflow-hidden">
              <div className="p-5"><h2 className="font-semibold text-lg">Production History</h2><p className="text-xs text-gray-400 mt-1">Recent batches, costing and stock reversal.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-[#F8F9F5] text-gray-400"><tr><th className="p-4">DATE</th><th className="p-4">BATCH</th><th className="p-4">RECIPE / PRODUCT</th><th className="p-4">BATCH COUNT</th><th className="p-4">OUTPUT</th><th className="p-4">TOTAL COST</th><th className="p-4">STATUS / ACTION</th></tr></thead><tbody>{productionRuns.map((run) => <tr key={run.id} className="border-t border-gray-100"><td className="p-4">{formatDate(run.produced_at)}</td><td className="p-4 font-semibold">{run.batch_number}</td><td className="p-4">{run.production_recipes?.name || run.finished_products?.name || "Production"}</td><td className="p-4">{run.batch_count}</td><td className="p-4">{Number(run.output_quantity).toLocaleString()} {run.output_unit}</td><td className="p-4 font-semibold">{money(run.total_cost)}</td><td className="p-4"><span className={`rounded-lg px-2 py-1 ${run.status === "completed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{run.status}</span>{run.status === "completed" && <button onClick={() => handleCancelProduction(run)} className="ml-3 text-red-600 font-semibold">Cancel batch</button>}</td></tr>)}{productionRuns.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No production batches yet.</td></tr>}</tbody></table></div>
            </section>
          </div>
        )}

        {/* REPORTS */}

        {active === "Reports" && (
          <div className="space-y-6">
            <section className="bg-white border border-[#E9EAE3] rounded-2xl p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div><h2 className="font-semibold text-lg">Inventory Reports</h2><p className="text-xs text-gray-400 mt-1">Filter transaction and stock movement reports by date.</p></div>
                <button type="button" onClick={() => { setReportFrom(""); setReportTo(""); }} className="text-xs font-semibold text-[#536D53]">Clear dates</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-gray-500">From date<input type="date" value={reportFrom} max={reportTo || undefined} onChange={(e) => setReportFrom(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs" /></label>
                <label className="text-xs text-gray-500">To date<input type="date" value={reportTo} min={reportFrom || undefined} onChange={(e) => setReportTo(e.target.value)} className="block w-full mt-1 border border-[#E6E9E1] bg-[#FAFBF8] rounded-xl px-3 py-2.5 text-xs" /></label>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E9EAE3] rounded-2xl p-5"><p className="text-xs text-gray-400">Current Inventory Value</p><p className="text-xl font-semibold mt-2">{money(totalInventoryValue)}</p></div>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-5"><p className="text-xs text-green-700">Stock In · {reportStockIn.length}</p><p className="text-xl font-semibold text-green-700 mt-2">+{money(sumTransactionCost(reportStockIn))}</p><p className="text-[11px] text-green-700 mt-1">+{sumTransactionQuantity(reportStockIn).toLocaleString()} units</p></div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5"><p className="text-xs text-red-700">Stock Out · {reportStockOut.length}</p><p className="text-xl font-semibold text-red-600 mt-2">−{money(sumTransactionCost(reportStockOut))}</p><p className="text-[11px] text-red-600 mt-1">−{sumTransactionQuantity(reportStockOut).toLocaleString()} units</p></div>
              <div className="bg-white border border-[#E9EAE3] rounded-2xl p-5"><p className="text-xs text-gray-400">Low Stock Items</p><p className="text-xl font-semibold mt-2">{lowStockItems.length}</p></div>
            </section>

            <section className="bg-white border border-[#E9EAE3] rounded-2xl overflow-hidden">
              <div className="p-5"><h3 className="font-semibold">Filtered Transaction Report</h3><p className="text-xs text-gray-400 mt-1">{reportTransactions.length} transactions in selected date range</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs text-left">
                  <thead className="bg-[#F8F9F5] text-gray-400"><tr><th className="p-4">DATE</th><th className="p-4">MATERIAL</th><th className="p-4">TYPE</th><th className="p-4">QUANTITY</th><th className="p-4">TOTAL COST</th><th className="p-4">NOTE</th></tr></thead>
                  <tbody>
                    {reportTransactions.map((t) => {
                      const positive = isStockIn(t.transaction_type);
                      return <tr key={t.id} className="border-t border-gray-100"><td className="p-4">{formatDate(t.transaction_date)}</td><td className="p-4 font-semibold">{t.materials?.name || "Material"}</td><td className="p-4">{t.transaction_type}</td><td className={`p-4 font-semibold ${positive ? "text-green-700" : "text-red-600"}`}>{positive ? "+" : "−"}{Number(t.quantity).toLocaleString()} {t.materials?.unit || ""}</td><td className={`p-4 font-semibold ${positive ? "text-green-700" : "text-red-600"}`}>{positive ? "+" : "−"}{money(t.total_cost)}</td><td className="p-4">{t.note || "—"}</td></tr>;
                    })}
                    {reportTransactions.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No transactions found for this date range.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {active === "Employees" && currentRole === "admin" && <EmployeeManagement />}
        {active === "My Profile" && <ProfileSettings />}
        {active === "Settings" && currentRole === "admin" && <SettingsPanel />}

        <footer className="text-center text-[10px] text-[#A0A69C] mt-8 pb-4">
          HEBO MATERIAL MANAGEMENT · INVENTORY CONTROL SYSTEM
        </footer>
      </main>

      {/* CATEGORY ADD / EDIT MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveCategory}
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingCategoryId ? "Edit Category" : "Add New Category"}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Customize your inventory category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500"
                aria-label="Close category form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Category Name *</label>
                <input
                  required
                  maxLength={80}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Essential Oils"
                  className="w-full border border-[#E6E9E1] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#82947B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2">Description</label>
                <textarea
                  maxLength={300}
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Describe this category..."
                  className="w-full border border-[#E6E9E1] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#82947B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2">Choose Category Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {categoryIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, icon })}
                      aria-label={`Select ${icon} icon`}
                      aria-pressed={categoryForm.icon === icon}
                      className={`h-11 rounded-xl border text-xl ${
                        categoryForm.icon === icon
                          ? "border-[#536D53] bg-[#EDF1E9]"
                          : "border-[#E9EAE3] hover:bg-gray-50"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2">Category Color</label>
                <div className="flex flex-wrap gap-3">
                  {categoryColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                      aria-label={`Select color ${color}`}
                      aria-pressed={categoryForm.color === color}
                      className={`w-9 h-9 rounded-full border-2 ${
                        categoryForm.color === color ? "border-[#27372B] scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2">Category Image (Optional)</label>
                <div className="border border-dashed border-[#D8DDD4] rounded-xl p-4">
                  {categoryImageFile || categoryForm.image_url ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={categoryImageFile ? URL.createObjectURL(categoryImageFile) : categoryForm.image_url}
                        alt="Category preview"
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryImageFile(null);
                          setCategoryForm({ ...categoryForm, image_url: "" });
                        }}
                        className="text-xs text-red-500"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center py-4">
                      <span className="text-2xl mb-2">▧</span>
                      <span className="text-xs font-medium">Click to upload image</span>
                      <span className="text-[10px] text-gray-400 mt-1">JPG, PNG, WEBP · Maximum 5MB</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                            showToast("Please select a JPG, PNG or WEBP image.");
                            e.currentTarget.value = "";
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            showToast("Image must be 5MB or smaller.");
                            e.currentTarget.value = "";
                            return;
                          }
                          setCategoryImageFile(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="flex-1 border border-[#E5E7DF] rounded-xl py-3 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={categorySaving}
                className="flex-1 bg-[#314B37] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {categorySaving ? "Saving..." : editingCategoryId ? "Update Category" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STOCK USAGE MODAL */}
      {recipeModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
            <div className="p-6 border-b border-[#E9EAE3] flex justify-between"><div><h2 className="text-lg font-semibold">Save Production Recipe</h2><p className="text-xs text-gray-400 mt-1">Define ingredients required for one standard batch.</p></div><button type="button" onClick={() => setRecipeModalOpen(false)} className="w-9 h-9 rounded-lg bg-gray-100">✕</button></div>
            <form onSubmit={handleSaveRecipe} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-medium mb-2">Recipe Name *</label><input required value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="e.g. Moroccan Black Soap - Standard" className="w-full border rounded-xl px-3 py-3 text-sm" /></div><div><label className="block text-xs font-medium mb-2">Finished Product Name *</label><input required value={finishedProductName} onChange={(e) => setFinishedProductName(e.target.value)} placeholder="e.g. HEBO Black Soap 150g" className="w-full border rounded-xl px-3 py-3 text-sm" /></div><div><label className="block text-xs font-medium mb-2">Output Quantity per Batch *</label><input required type="number" min="0.0001" step="any" value={recipeOutputQuantity} onChange={(e) => setRecipeOutputQuantity(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm" /></div><div><label className="block text-xs font-medium mb-2">Output Unit *</label><select value={recipeOutputUnit} onChange={(e) => setRecipeOutputUnit(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm bg-white"><option value="pcs">pcs</option><option value="jar">jar</option><option value="kg">kg</option><option value="g">g</option><option value="L">L</option></select></div></div>
              <div className="border border-[#E9EAE3] rounded-xl p-4"><div className="flex justify-between items-center mb-3"><div><h3 className="font-semibold text-sm">Raw Materials / Ingredients</h3><p className="text-[11px] text-gray-400 mt-1">Quantity required for one recipe batch.</p></div><button type="button" onClick={() => setRecipeItems((items) => [...items, { material_id: "", quantity_per_batch: "" }])} className="text-xs font-semibold text-[#536D53]">+ Add Ingredient</button></div>
                <div className="space-y-3">{recipeItems.map((item, index) => { const selected = materials.find((m) => m.id === item.material_id); return <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_32px] gap-2 items-end"><div><label className="block text-[11px] text-gray-500 mb-1">Material</label><select required value={item.material_id} onChange={(e) => setRecipeItems((items) => items.map((row, i) => i === index ? { ...row, material_id: e.target.value } : row))} className="w-full border rounded-lg px-3 py-2.5 text-xs bg-white"><option value="">Select material</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({Number(m.current_stock).toLocaleString()} {m.unit} available)</option>)}</select></div><div><label className="block text-[11px] text-gray-500 mb-1">Quantity ({selected?.unit || "unit"})</label><input required type="number" min="0.000001" step="any" value={item.quantity_per_batch} onChange={(e) => setRecipeItems((items) => items.map((row, i) => i === index ? { ...row, quantity_per_batch: e.target.value } : row))} className="w-full border rounded-lg px-3 py-2.5 text-xs" placeholder="e.g. 500" /></div><button type="button" disabled={recipeItems.length === 1} onClick={() => setRecipeItems((items) => items.filter((_, i) => i !== index))} className="h-9 text-red-500 disabled:opacity-30">✕</button></div>; })}</div>
              </div>
              <div><label className="block text-xs font-medium mb-2">Recipe Notes</label><textarea rows={2} value={recipeNotes} onChange={(e) => setRecipeNotes(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm" placeholder="Optional instructions or formula notes" /></div>
              <div className="flex gap-3"><button type="button" onClick={() => setRecipeModalOpen(false)} className="flex-1 border rounded-xl py-3 text-sm">Cancel</button><button disabled={recipeSaving} type="submit" className="flex-1 bg-[#314B37] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">{recipeSaving ? "Saving..." : "Save Recipe"}</button></div>
            </form>
          </div>
        </div>
      )}

      {productionModalOpen && (() => {
        const recipe = recipes.find((item) => item.id === selectedRecipeId);
        const count = Number(productionBatchCount) || 0;
        const totalOutput = recipe ? Number(recipe.output_quantity) * count : 0;
        const estimatedCost = recipe ? (recipe.production_recipe_items || []).reduce((sum, item) => sum + Number(item.quantity_per_batch) * count * Number(item.materials?.avg_unit_cost || 0), 0) : 0;
        return <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-auto"><div className="p-6 border-b border-[#E9EAE3] flex justify-between"><div><h2 className="text-lg font-semibold">Create Production Batch</h2><p className="text-xs text-gray-400 mt-1">Ingredients will be deducted after confirmation.</p></div><button onClick={() => setProductionModalOpen(false)} className="w-9 h-9 rounded-lg bg-gray-100">✕</button></div><form onSubmit={handleCompleteProduction} className="p-6 space-y-4"><div><label className="block text-xs font-medium mb-2">Select Saved Recipe *</label><select required value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm bg-white">{recipes.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.finished_products?.name}</option>)}</select></div><div><label className="block text-xs font-medium mb-2">Number of Batches *</label><input required type="number" min="0.0001" step="any" value={productionBatchCount} onChange={(e) => setProductionBatchCount(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm" /></div>{recipe && <><div className="rounded-xl bg-[#F1F4EE] p-4 grid grid-cols-2 gap-3"><div><p className="text-xs text-gray-500">Finished Output</p><p className="text-xl font-semibold mt-1">{totalOutput.toLocaleString()} {recipe.output_unit}</p></div><div className="text-right"><p className="text-xs text-gray-500">Estimated Material Cost</p><p className="text-xl font-semibold mt-1">{money(estimatedCost)}</p></div></div><div className="border rounded-xl p-4"><h3 className="text-sm font-semibold mb-3">Stock deduction preview</h3>{(recipe.production_recipe_items || []).map((item) => { const needed = Number(item.quantity_per_batch) * count; const available = Number(item.materials?.current_stock || 0); const enough = available >= needed; return <div key={item.id || item.material_id} className="flex justify-between gap-3 text-xs py-2 border-t first:border-0"><span>{item.materials?.name}</span><span className={enough ? "text-[#536D53]" : "text-red-600"}>{needed.toLocaleString()} / {available.toLocaleString()} {item.materials?.unit} {enough ? "✓" : "· Insufficient"}</span></div>; })}</div></>}<div><label className="block text-xs font-medium mb-2">Production Note</label><textarea rows={2} value={productionNote} onChange={(e) => setProductionNote(e.target.value)} className="w-full border rounded-xl px-3 py-3 text-sm" placeholder="Optional batch note" /></div><div className="flex gap-3"><button type="button" onClick={() => setProductionModalOpen(false)} className="flex-1 border rounded-xl py-3 text-sm">Cancel</button><button type="submit" disabled={productionSaving || !recipe || (recipe.production_recipe_items || []).some((item) => Number(item.materials?.current_stock || 0) < Number(item.quantity_per_batch) * count)} className="flex-1 bg-[#314B37] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">{productionSaving ? "Processing..." : "Confirm Production"}</button></div></form></div></div>;
      })()}

      {usageModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto">
            <div className="flex justify-between items-center p-6 border-b border-[#E9EAE3]">
              <div>
                <h2 className="text-lg font-semibold">{stockMode === "in" ? "Add Stock / Stock In" : "Use Material / Stock Out"}</h2>
                <p className="text-xs text-gray-400 mt-1">{stockMode === "in" ? "Record newly purchased or received stock" : "Select a raw material and record the quantity used"}</p>
              </div>
              <button type="button" onClick={() => setUsageModalOpen(false)} className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600">✕</button>
            </div>
            <form onSubmit={handleStockUsage} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2">Select Material *</label>
                <select required value={usageMaterialId} onChange={(e) => { setUsageMaterialId(e.target.value); setUsageQuantity(""); }} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm bg-white">
                  {materials.map((item) => <option key={item.id} value={item.id}>{item.name} — {Number(item.current_stock).toLocaleString()} {item.unit} available</option>)}
                </select>
              </div>
              {(() => {
                const selected = materials.find((item) => item.id === usageMaterialId);
                if (!selected) return null;
                const movedQuantity = Number(usageQuantity) || 0;
                const remaining = stockMode === "in"
                  ? Number(selected.current_stock) + movedQuantity
                  : Math.max(0, Number(selected.current_stock) - movedQuantity);
                return (
                  <>
                    <div className="rounded-xl bg-[#F1F4EE] p-4 flex justify-between items-center gap-3">
                      <div><p className="text-xs text-[#6F7D6D]">Current Available Stock</p><p className="text-lg font-semibold mt-1">{Number(selected.current_stock).toLocaleString()} {selected.unit}</p></div>
                      <div className="text-right"><p className="text-xs text-[#6F7D6D]">{stockMode === "in" ? "After Stock In" : "After Usage"}</p><p className={`text-lg font-semibold mt-1 ${stockMode === "out" && remaining <= Number(selected.low_stock_threshold || 0) ? "text-red-600" : "text-[#314B37]"}`}>{remaining.toLocaleString()} {selected.unit}</p></div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2">{stockMode === "in" ? `Quantity Received (${selected.unit}) *` : `Quantity Used (${selected.unit}) *`}</label>
                      <input required type="number" min="0.000001" {...(stockMode === "out" ? { max: selected.current_stock } : {})} step="any" value={usageQuantity} onChange={(e) => setUsageQuantity(e.target.value)} placeholder={stockMode === "in" ? `Quantity to add in ${selected.unit}` : `Maximum ${selected.current_stock} ${selected.unit}`} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm" />
                    </div>
                    {stockMode === "in" && (
                      <>
                        <div>
                          <label className="block text-xs font-medium mb-2">Total Purchase Price (৳) <span className="text-gray-400">· Optional</span></label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={usagePurchaseTotal}
                            onChange={(e) => setUsagePurchaseTotal(e.target.value)}
                            placeholder="e.g. 300.00"
                            className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Enter the total amount paid for this received quantity. Average unit cost will be recalculated automatically. Leave blank to keep the current average cost.</p>
                          {Number(usageQuantity) > 0 && usagePurchaseTotal.trim() !== "" && Number(usagePurchaseTotal) >= 0 && (
                            <p className="text-xs text-[#536D53] mt-2">This purchase rate: {money(Number(usagePurchaseTotal) / Number(usageQuantity))} per {selected.unit}</p>
                          )}
                        </div>
                        <div className="border border-[#E9EAE3] rounded-xl p-3">
                          <label className="block text-xs font-medium mb-2">Add New Material Photos <span className="text-gray-400">· Optional</span></label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const valid: MaterialImage[] = [];
                              for (const file of files) {
                                if (!file.type.startsWith("image/")) {
                                  showToast(`${file.name}: Please select an image file.`);
                                  continue;
                                }
                                if (file.size > 5 * 1024 * 1024) {
                                  showToast(`${file.name}: Image must be 5MB or smaller.`);
                                  continue;
                                }
                                valid.push({ url: URL.createObjectURL(file), file });
                              }
                              setUsageImages((current) => [...current, ...valid].slice(0, 10));
                              e.currentTarget.value = "";
                            }}
                            className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDF1E9] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#314B37]"
                          />
                          <p className="text-[10px] text-gray-400 mt-2">You can add up to 10 photos in total. Existing photos will remain. JPG, PNG or WEBP · Max 5MB each.</p>
                          {usageImages.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 mt-3">
                              {usageImages.map((image, index) => (
                                <div key={`${image.url}-${index}`} className="relative">
                                  <img src={image.url} alt={`New material photo ${index + 1}`} className="w-full aspect-square object-cover rounded-lg border border-[#E9EAE3]" />
                                  <button type="button" onClick={() => setUsageImages((current) => current.filter((_, i) => i !== index))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs">×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-medium mb-2">{stockMode === "in" ? "Supplier / Purchase Note" : "Reason / Production Note"}</label>
                      <textarea rows={3} value={usageNote} onChange={(e) => setUsageNote(e.target.value)} placeholder={stockMode === "in" ? "e.g. Purchased from supplier / invoice number" : "e.g. Used for 20 soap bars / Batch #001"} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm resize-none" />
                    </div>
                    {stockMode === "out" && remaining <= Number(selected.low_stock_threshold || 0) && Number(usageQuantity) > 0 && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">Warning: This usage will bring stock to the low-stock threshold or below.</p>}
                  </>
                );
              })()}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setUsageModalOpen(false)} className="flex-1 border border-[#E5E7DF] rounded-xl py-3 text-sm">Cancel</button>
                <button type="submit" disabled={usageSaving || !usageMaterialId} className="flex-1 bg-[#314B37] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">{usageSaving ? "Saving..." : stockMode === "in" ? "Confirm Stock In" : "Confirm Stock Out"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT MATERIAL MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-auto">
            <div className="flex justify-between items-center p-6 border-b border-[#E9EAE3]">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingId ? "Edit Material" : "Add New Material"}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Enter your raw material information
                </p>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2">
                  Material Name *
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="e.g. Olive Oil"
                  className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#82947B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2">
                    Category
                  </label>

                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                    className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm bg-white outline-none"
                  >
                    <option value="">Select category</option>

                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2">
                    SKU
                  </label>

                  <input
                    value={form.sku}
                    onChange={(e) =>
                      setForm({ ...form, sku: e.target.value })
                    }
                    placeholder="Optional SKU"
                    className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="border border-[#E9EAE3] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-semibold">Material Photos</label>
                    <p className="text-[10px] text-gray-400 mt-1">Upload up to 10 images · JPG, PNG or WEBP · Max 5MB each</p>
                  </div>
                  <span className="text-[10px] text-[#82947B]">{materialImages.length}/10</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(e) => { handleImageChange(e.target.files); e.currentTarget.value = ""; }}
                  className="w-full text-xs"
                />
                {materialImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {materialImages.map((image, index) => (
                      <div key={`${image.url}-${index}`} className="relative group">
                        <img src={image.url} alt={`${form.name || "Material"} ${index + 1}`} className="w-full aspect-square rounded-xl object-cover border border-[#E5E7DF]" />
                        {index === 0 && <span className="absolute left-1 bottom-1 bg-[#314B37] text-white text-[9px] px-1.5 py-1 rounded-md">Main</span>}
                        <button type="button" onClick={() => removeMaterialImage(index)} aria-label="Remove image" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2">Stock Unit *</label>
                  <select required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm bg-white outline-none">
                    {["g", "kg", "ml", "L", "pcs"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2">Package Type *</label>
                  <select value={form.package_type} onChange={(e) => setForm({ ...form, package_type: e.target.value })} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm bg-white outline-none">
                    {["packet", "jar", "bottle", "bag", "box", "can", "sachet", "unit"].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2">Quantity per Package ({form.unit}) *</label>
                  <input required type="number" min="0.000001" step="any" value={form.package_size} onChange={(e) => setForm({ ...form, package_size: e.target.value })} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none" placeholder="e.g. 150" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2">Number of Packages *</label>
                  <input required type="number" min="0" step="any" value={form.package_count} onChange={(e) => setForm({ ...form, package_count: e.target.value })} className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none" placeholder="e.g. 2" />
                </div>
              </div>

              <div className="rounded-xl bg-[#F1F4EE] p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#6F7D6D]">Calculated Available Stock</div>
                  <div className="text-[10px] text-[#92998E] mt-1">{form.package_count || 0} × {form.package_size || 0} {form.unit} per {form.package_type}</div>
                </div>
                <div className="text-xl font-semibold text-[#314B37]">{((Math.max(0, Number(form.package_count) || 0)) * (Math.max(0, Number(form.package_size) || 0))).toLocaleString()} {form.unit}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2">
                    Average Unit Cost (৳ per {form.unit})
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.avg_unit_cost}
                    onChange={(e) =>
                      setForm({ ...form, avg_unit_cost: e.target.value })
                    }
                    className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2">
                    Low Stock Alert Threshold ({form.unit})
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.low_stock_threshold}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        low_stock_threshold: e.target.value,
                      })
                    }
                    className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none"
                    placeholder={form.unit === "g" ? "e.g. 100" : "Enter alert quantity"}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Dashboard alert appears when stock reaches this amount or lower.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2">
                  Notes
                </label>

                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder="Additional information..."
                  className="w-full border border-[#E5E7DF] rounded-xl px-4 py-3 text-sm outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-[#E5E7DF] rounded-xl py-3 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#314B37] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#263C2D] disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Material"
                    : "Save Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

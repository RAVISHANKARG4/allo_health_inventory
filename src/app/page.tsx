"use client";

import * as React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Package,
  Warehouse,
  Layers,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  inventory: InventoryItem[];
}

export default function ProductsPage() {
  const router = useRouter();
  const {
    data: products,
    error,
    isLoading,
    mutate,
  } = useSWR<Product[]>("/api/products", fetcher, {
    refreshInterval: 10000, // auto refresh every 10s
  });

  // Modal State
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null,
  );
  const [selectedInventory, setSelectedInventory] =
    React.useState<InventoryItem | null>(null);
  const [reserveQuantity, setReserveQuantity] = React.useState<number>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Idempotency Testing helper
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>("");
  const [useCustomKey, setUseCustomKey] = React.useState(false);

  // Auto-generate random idempotency key on mount or modal open
  React.useEffect(() => {
    if (!useCustomKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [selectedProduct, useCustomKey]);

  const handleOpenReserve = (product: Product, inv: InventoryItem) => {
    setSelectedProduct(product);
    setSelectedInventory(inv);
    setReserveQuantity(1);
  };

  const handleCloseReserve = () => {
    setSelectedProduct(null);
    setSelectedInventory(null);
  };

  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedInventory) return;

    if (reserveQuantity < 1) {
      toast({
        title: "Invalid Quantity",
        description: "Please select a quantity of at least 1.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const reservationKey = idempotencyKey.trim();

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(reservationKey ? { "Idempotency-Key": reservationKey } : {}),
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          warehouseId: selectedInventory.warehouse.id,
          quantity: reserveQuantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle stock conflict or error
        toast({
          title: `Reservation Failed (${response.status})`,
          description: data.error?.message || "Failed to create reservation.",
          variant: "destructive",
        });

        // Mutate products to refresh stock display
        mutate();
        return;
      }

      toast({
        title: "Success!",
        description: `Successfully reserved ${reserveQuantity} unit(s).`,
        variant: "success",
      });

      // Clear custom key flag to auto-gen next one
      if (!useCustomKey) {
        setIdempotencyKey(crypto.randomUUID());
      }

      handleCloseReserve();
      // Mutate catalog stock cache immediately
      mutate();

      // Redirect to the reservation checkout page
      router.push(`/reservations/${data.reservation.id}`);
    } catch (err) {
      console.error(err);
      toast({
        title: "Network Error",
        description: "An unexpected connection error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger manual release-expired job for testing convenience
  const [isCleaning, setIsCleaning] = React.useState(false);
  const handleTriggerCleanup = async () => {
    setIsCleaning(true);
    try {
      const res = await fetch("/api/cron/release-expired", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Cron Execution Complete",
          description: `Released ${data.releasedCount} expired reservation(s).`,
          variant: "success",
        });
        mutate();
      } else {
        toast({
          title: "Cleanup Failed",
          description: data.error?.message || "Error occurred.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not contact cron API.",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 md:p-8 rounded-2xl border border-indigo-500/10 bg-slate-950/40 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> High Concurrency
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Safe Mutex
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
            Multi-Warehouse Inventory Control
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Real-time catalog displaying available stocks. Click reserve to
            allocate stock temporarily. Overselling is prevented at the database
            layer using Postgres{" "}
            <code className="text-indigo-300 font-mono">FOR UPDATE</code> row
            locking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh Catalog
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTriggerCleanup}
            loading={isCleaning}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300"
          >
            Trigger Cron Cleanup
          </Button>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && !products && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card
              key={i}
              className="animate-pulse border-slate-800 bg-slate-950/20"
            >
              <div className="h-40 bg-slate-800/20 rounded-t-xl" />
              <div className="p-6 space-y-4">
                <div className="h-4 bg-slate-800/40 rounded w-2/3" />
                <div className="h-3 bg-slate-800/30 rounded w-1/2" />
                <div className="space-y-2 pt-4">
                  <div className="h-8 bg-slate-800/20 rounded" />
                  <div className="h-8 bg-slate-800/20 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="p-6 rounded-xl border border-rose-500/20 bg-rose-950/10 text-rose-200 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <div>
            <h4 className="font-semibold">Failed to load inventory data</h4>
            <p className="text-xs text-rose-300/80">
              Make sure your PostgreSQL database credentials are set and
              migrations have run.
            </p>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {products && Array.isArray(products) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {products.map((product) => (
            <Card
              key={product.id}
              className="border-slate-800/50 bg-slate-950/20 hover:border-slate-700/50 transition-colors"
            >
              <CardHeader className="border-b border-slate-900/60 pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-400" />
                      {product.name}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs text-slate-500">
                      SKU: {product.sku}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5" /> Warehouse Distribution
                  </h4>
                  <div className="divide-y divide-slate-900/40">
                    {product.inventory.map((inv) => (
                      <div
                        key={inv.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-200">
                            {inv.warehouse.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {inv.warehouse.location}
                          </p>
                        </div>

                        {/* Stock metrics */}
                        <div className="flex items-center gap-6">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-medium">
                                Total
                              </p>
                              <p className="text-sm font-mono font-semibold text-slate-300">
                                {inv.totalUnits}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-medium">
                                Reserved
                              </p>
                              <p className="text-sm font-mono font-semibold text-amber-400">
                                {inv.reservedUnits}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-medium">
                                Avail
                              </p>
                              <Badge
                                variant={
                                  inv.availableUnits > 5
                                    ? "success"
                                    : inv.availableUnits > 0
                                      ? "warning"
                                      : "destructive"
                                }
                                className="font-mono mt-0.5"
                              >
                                {inv.availableUnits}
                              </Badge>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={
                              inv.availableUnits > 0 ? "default" : "outline"
                            }
                            disabled={inv.availableUnits <= 0}
                            onClick={() => handleOpenReserve(product, inv)}
                            className="w-24 font-semibold text-xs"
                          >
                            {inv.availableUnits > 0 ? "Reserve" : "Sold Out"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reservation Dialog Modal */}
      <Dialog
        open={selectedProduct !== null}
        onOpenChange={(open) => !open && handleCloseReserve()}
      >
        {selectedProduct && selectedInventory && (
          <form onSubmit={handleReserveSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                Reserve Stock
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                You are initiating a checkout reservation. Stock will be
                temporarily locked for 10 minutes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-slate-300 text-sm">
              <div className="rounded-lg bg-slate-900/60 p-4 space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Product:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedProduct.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Warehouse:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedInventory.warehouse.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock Available:</span>
                  <span className="font-semibold font-mono text-indigo-400">
                    {selectedInventory.availableUnits} unit(s)
                  </span>
                </div>
              </div>

              {/* Quantity input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Reservation Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedInventory.availableUnits}
                  value={reserveQuantity}
                  onChange={(e) =>
                    setReserveQuantity(
                      Math.min(
                        selectedInventory.availableUnits,
                        Math.max(1, parseInt(e.target.value) || 1),
                      ),
                    )
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                  required
                />
              </div>

              {/* Idempotency testing simulation */}
              <div className="space-y-2 border-t border-slate-900 pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Idempotency-Key Header
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="customKeyCheck"
                      checked={useCustomKey}
                      onChange={(e) => setUseCustomKey(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="customKeyCheck"
                      className="text-xs text-slate-400 cursor-pointer"
                    >
                      Lock / Edit Key
                    </label>
                  </div>
                </div>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) =>
                    useCustomKey && setIdempotencyKey(e.target.value)
                  }
                  disabled={!useCustomKey}
                  className="w-full h-9 px-3 rounded-md border border-slate-900/60 bg-slate-950 text-xs font-mono text-indigo-300 disabled:opacity-60 focus:outline-none"
                  placeholder="UUID Format Idempotency Key"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Providing the same key on a second click simulates
                  double-clicks and returns the cached response, preventing
                  duplicate reservations.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseReserve}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} className="min-w-32">
                Reserve Stock
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  );
}

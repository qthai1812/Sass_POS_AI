import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  getAllSubscriptionPlans,
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
} from "@/Redux Toolkit/features/subscriptionPlan/subscriptionPlanThunks";
import { toast } from "../../../components/ui/use-toast";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../components/ui/table";
import AddPlanDialog from "./AddPlanDialog";
import { Switch } from "../../../components/ui/switch";
import EditPlanDialog from "./EditPlanDialog";
import {
  Edit,
  Trash2,
  BarChart3,
  Boxes,
  Plug,
  ShoppingBag,
  FileBadge,
  Headphones,
  MapPin,
  Plus,
  CreditCard,
} from "lucide-react";

const FEATURE_FLAGS = [
  {
    key: "advancedReports",
    label: "Advanced Reports",
    icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
  },
  {
    key: "inventory",
    label: "Inventory System",
    icon: <Boxes className="w-4 h-4 text-emerald-500" />,
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: <Plug className="w-4 h-4 text-purple-500" />,
  },
  {
    key: "ecommerce",
    label: "eCommerce",
    icon: <ShoppingBag className="w-4 h-4 text-orange-500" />,
  },
  {
    key: "invoiceBranding",
    label: "Invoice Branding",
    icon: <FileBadge className="w-4 h-4 text-pink-500" />,
  },
  {
    key: "prioritySupport",
    label: "Priority Support",
    icon: <Headphones className="w-4 h-4 text-amber-500" />,
  },
  {
    key: "multiLocation",
    label: "Multi-location",
    icon: <MapPin className="w-4 h-4 text-cyan-500" />,
  },
];

function getFeatureBadges(plan) {
  return FEATURE_FLAGS.filter((f) => plan[f.key]).map((f) => (
    <TooltipProvider key={f.key}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center p-1 rounded bg-muted mr-1">
            {f.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{f.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ));
}

const columns = [
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "billingCycle", label: "Billing Cycle" },
  { key: "maxBranches", label: "Branches" },
  { key: "maxUsers", label: "Users" },
  { key: "maxProducts", label: "Products" },
  { key: "status", label: "Status" },
  { key: "features", label: "Features" },
  { key: "actions", label: "Actions" },
];

const SubscriptionPlansPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { plans, error } = useSelector((state) => state.subscriptionPlan);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    dispatch(getAllSubscriptionPlans());
  }, [dispatch]);

  const filteredPlans = useMemo(() => {
    let filtered = plans || [];
    if (search) {
      filtered = filtered.filter((plan) =>
        plan.name?.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return filtered;
  }, [plans, search]);

  const handleDelete = async (id) => {
    if (
      window.confirm("Are you sure you want to delete this subscription plan?")
    ) {
      const res = await dispatch(deleteSubscriptionPlan(id));
      if (res.meta.requestStatus === "fulfilled") {
        toast({
          title: "Deleted",
          description: "Subscription plan deleted successfully",
        });
      } else {
        toast({
          title: "Error",
          description: res.payload || "Failed to delete plan",
          variant: "destructive",
        });
      }
    }
  };

  const handleStatusToggle = async (plan) => {
    setStatusLoadingId(plan.id);
    const updated = { ...plan, active: !plan.active };
    delete updated.createdAt;
    delete updated.updatedAt;
    const res = await dispatch(
      updateSubscriptionPlan({ id: plan.id, plan: updated }),
    );
    setStatusLoadingId(null);
    if (res.meta.requestStatus === "fulfilled") {
      toast({
        title: "Status Updated",
        description: `Plan is now ${updated.active ? "Active" : "Inactive"}`,
      });
      dispatch(getAllSubscriptionPlans());
    } else {
      toast({
        title: "Error",
        description: res.payload || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AddPlanDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => dispatch(getAllSubscriptionPlans())}
      />
      <EditPlanDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        plan={selectedPlan}
        onSuccess={() => {
          setEditDialogOpen(false);
          setSelectedPlan(null);
          dispatch(getAllSubscriptionPlans());
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/super-admin/settings?tab=payment")}
            className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          >
            <CreditCard className="w-4 h-4 mr-2 text-emerald-600" />
            Cấu hình Nhận tiền (MoMo / Visa)
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Plan
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <Input
          placeholder="Search plans..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>
      <div
        className="overflow-x-auto bg-card text-card-foreground border rounded-lg shadow-sm"
        style={{ maxHeight: 500, overflowY: "auto" }}
      >
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="px-4 py-2 text-left font-semibold"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No plans found.
                </TableCell>
              </TableRow>
            )}
            {filteredPlans.map((plan) => (
              <TableRow key={plan.id} className="border-b hover:bg-muted/50">
                <TableCell className="px-4 py-2 font-medium">
                  {plan.name}
                </TableCell>
                <TableCell className="px-4 py-2">
                  {Number(plan.price || 0).toLocaleString("vi-VN")} ₫
                </TableCell>
                <TableCell className="px-4 py-2">{plan.billingCycle}</TableCell>
                <TableCell className="px-4 py-2">
                  {plan.maxBranches ?? "-"}
                </TableCell>
                <TableCell className="px-4 py-2">
                  {plan.maxUsers ?? "-"}
                </TableCell>
                <TableCell className="px-4 py-2">
                  {plan.maxProducts ?? "-"}
                </TableCell>
                <TableCell className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!plan.active}
                      onCheckedChange={() => handleStatusToggle(plan)}
                      disabled={statusLoadingId === plan.id}
                    />
                    <span
                      className={
                        plan.active ? "text-green-600" : "text-red-500"
                      }
                    >
                      {plan.active ? "Active" : "Inactive"}
                    </span>
                    {statusLoadingId === plan.id && (
                      <span className="text-xs text-muted-foreground">
                        Updating...
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2">
                  {getFeatureBadges(plan)}
                </TableCell>
                <TableCell className="px-4 py-2 flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPlan(plan);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {error && <div className="text-red-500 mt-4">{error}</div>}
    </div>
  );
};

export default SubscriptionPlansPage;

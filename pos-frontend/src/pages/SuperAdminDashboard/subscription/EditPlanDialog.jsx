import React, { useState, memo } from "react";
import { useDispatch } from "react-redux";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../../components/ui/select";
import { Switch } from "../../../components/ui/switch";
import { Button } from "../../../components/ui/button";
import { updateSubscriptionPlan } from "@/Redux Toolkit/features/subscriptionPlan/subscriptionPlanThunks";

const BILLING_CYCLES = [
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" },
];

// Synchronized 100% with Backend SubscriptionPlanDTO.java / PlanFeature.java
// Tính năng cố định của gói; `hint` mô tả đúng phần hệ thống bị giới hạn khi tắt tính năng.
const FEATURE_FIELDS = [
  {
    key: "advancedReports",
    label: "Advanced Reports",
    hint: "Reports & Analytics pages",
  },
  {
    key: "inventory",
    label: "Inventory System",
    hint: "Branch stock management & stock tracking at POS",
  },
  {
    key: "integrations",
    label: "Integrations",
    hint: "Plan label only (no module yet)",
  },
  {
    key: "ecommerce",
    label: "eCommerce",
    hint: "Plan label only (no module yet)",
  },
  {
    key: "invoiceBranding",
    label: "Invoice Branding",
    hint: "Store name on invoice PDF",
  },
  {
    key: "prioritySupport",
    label: "Priority Support",
    hint: "Plan label only (no module yet)",
  },
  {
    key: "multiLocation",
    label: "Multi-location",
    hint: "More than 1 branch per store",
  },
  {
    key: "aiCopilot",
    label: "AI Copilot & Smart POS",
    hint: "AI Insights, Smart Restock, Voice Order & Cross-sell",
  },
];

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Name is required"),
  description: Yup.string().required("Description is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .required("Price is required")
    .min(0),
  billingCycle: Yup.string()
    .oneOf(["MONTHLY", "YEARLY"])
    .required("Billing cycle is required"),
  maxBranches: Yup.number()
    .typeError("Branches must be a number")
    .required("Branches is required")
    .min(1),
  maxUsers: Yup.number()
    .typeError("Users must be a number")
    .required("Users is required")
    .min(1),
  maxProducts: Yup.number()
    .typeError("Products must be a number")
    .required("Products is required")
    .min(1),
  advancedReports: Yup.boolean().required(),
  inventory: Yup.boolean().required(),
  integrations: Yup.boolean().required(),
  ecommerce: Yup.boolean().required(),
  invoiceBranding: Yup.boolean().required(),
  prioritySupport: Yup.boolean().required(),
  multiLocation: Yup.boolean().required(),
  aiCopilot: Yup.boolean().required(),
});

const FeaturesSwitchGrid = memo(({ handleFeatureSwitch }) => (
  <div className="grid grid-cols-2 gap-2">
    {FEATURE_FIELDS.map((f) => (
      <label key={f.key} className="flex items-center gap-2 cursor-pointer">
        <Field name={f.key} type="checkbox">
          {({ field }) => (
            <Switch
              checked={!!field.value}
              onCheckedChange={(val) => handleFeatureSwitch(f.key, val)}
              aria-label={f.label}
            />
          )}
        </Field>
        <span className="text-sm leading-tight">
          {f.label}
          <span className="block text-[11px] text-muted-foreground">{f.hint}</span>
        </span>
      </label>
    ))}
  </div>
));
FeaturesSwitchGrid.displayName = "FeaturesSwitchGrid";

const getInitialValues = (plan) => {
  if (!plan) return null;
  return {
    name: plan.name || "",
    description: plan.description || "",
    price: plan.price ?? "",
    billingCycle: plan.billingCycle || "MONTHLY",
    maxBranches: plan.maxBranches ?? "",
    maxUsers: plan.maxUsers ?? "",
    maxProducts: plan.maxProducts ?? "",
    active: plan.active ?? true,
    advancedReports: plan.advancedReports ?? plan.enableAdvancedReports ?? false,
    inventory: plan.inventory ?? plan.enableInventory ?? false,
    integrations: plan.integrations ?? plan.enableIntegrations ?? false,
    ecommerce: plan.ecommerce ?? plan.enableEcommerce ?? false,
    invoiceBranding: plan.invoiceBranding ?? plan.enableInvoiceBranding ?? false,
    prioritySupport: plan.prioritySupport ?? false,
    multiLocation: plan.multiLocation ?? plan.enableMultiLocation ?? false,
    aiCopilot: plan.aiCopilot ?? false,
  };
};

const EditPlanDialog = ({ open, onOpenChange, plan, onSuccess }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  if (!plan) return null;

  const handleSubmit = async (values, { setSubmitting, setErrors }) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        price: Number(values.price),
        maxBranches: Number(values.maxBranches),
        maxUsers: Number(values.maxUsers),
        maxProducts: Number(values.maxProducts),
      };
      const res = await dispatch(
        updateSubscriptionPlan({ id: plan.id, plan: payload })
      );
      if (res.meta.requestStatus === "fulfilled") {
        if (onSuccess) onSuccess();
      } else {
        setErrors({ submit: res.payload || "Failed to update plan" });
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const renderForm = ({ isSubmitting, errors, setFieldValue }) => {
    const handleFeatureSwitch = (key, val) => {
      setFieldValue(key, val);
    };
    return (
      <Form className="space-y-4">
        <div>
          <label className="block font-medium" htmlFor="plan-name">
            Name
          </label>
          <Field
            as={Input}
            id="plan-name"
            name="name"
            placeholder="Plan name"
          />
          <ErrorMessage
            name="name"
            component="div"
            className="text-red-500 text-xs"
          />
        </div>
        <div>
          <label className="block font-medium" htmlFor="plan-description">
            Description
          </label>
          <Field
            as={Input}
            id="plan-description"
            name="description"
            placeholder="Description"
          />
          <ErrorMessage
            name="description"
            component="div"
            className="text-red-500 text-xs"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium" htmlFor="plan-price">
              Price (₫)
            </label>
            <Field
              as={Input}
              id="plan-price"
              name="price"
              type="number"
              min="0"
              placeholder="Price"
            />
            <ErrorMessage
              name="price"
              component="div"
              className="text-red-500 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="block font-medium" htmlFor="plan-billing-cycle">
              Billing Cycle
            </label>
            <Field name="billingCycle">
              {({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => setFieldValue("billingCycle", val)}
                >
                  <SelectTrigger className="w-full" id="plan-billing-cycle">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <ErrorMessage
              name="billingCycle"
              component="div"
              className="text-red-500 text-xs"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium" htmlFor="plan-branches">
              Branches
            </label>
            <Field
              as={Input}
              id="plan-branches"
              name="maxBranches"
              type="number"
              min="1"
              placeholder="Branches"
            />
            <ErrorMessage
              name="maxBranches"
              component="div"
              className="text-red-500 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="block font-medium" htmlFor="plan-users">
              Users
            </label>
            <Field
              as={Input}
              id="plan-users"
              name="maxUsers"
              type="number"
              min="1"
              placeholder="Users"
            />
            <ErrorMessage
              name="maxUsers"
              component="div"
              className="text-red-500 text-xs"
            />
          </div>
          <div className="flex-1">
            <label className="block font-medium" htmlFor="plan-products">
              Products
            </label>
            <Field
              as={Input}
              id="plan-products"
              name="maxProducts"
              type="number"
              min="1"
              placeholder="Products"
            />
            <ErrorMessage
              name="maxProducts"
              component="div"
              className="text-red-500 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="block font-medium mb-2">Features</label>
          <p className="text-xs text-muted-foreground mb-2">
            Fixed features. Turning one off blocks exactly that part of the system for stores on this plan.
          </p>
          <FeaturesSwitchGrid handleFeatureSwitch={handleFeatureSwitch} />
        </div>
        {errors.submit && (
          <div className="text-red-500 text-xs">{errors.submit}</div>
        )}
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting || loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </Form>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Subscription Plan</DialogTitle>
        </DialogHeader>
        <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 4 }}>
          <Formik
            initialValues={getInitialValues(plan)}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {renderForm}
          </Formik>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditPlanDialog;

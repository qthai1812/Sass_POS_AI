import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { createBranch, updateBranch } from "@/Redux Toolkit/features/branch/branchThunks";

const BranchForm = ({ initialValues, onSubmit, onCancel, isEditing }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);

  const validationSchema = Yup.object({
    name: Yup.string().required("Branch Name is required"),
    address: Yup.string().required("Address is required"),
    email: Yup.string().email("Invalid email address").optional(),
    phone: Yup.string().required("Phone Number is required"),
    openTime: Yup.string().optional(),
    closeTime: Yup.string().optional(),
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const jwt = localStorage.getItem("jwt");
      if (!store?.id) {
        toast({
          title: "Error",
          description: "Store information or authentication JWT missing!",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const branchData = {
        name: values.name,
        address: values.address,
        email: values.email || undefined,
        phone: values.phone,
        openTime: values.openTime || undefined,
        closeTime: values.closeTime || undefined,
        storeId: store.id,
      };

      if (isEditing) {
        await dispatch(updateBranch({ id: initialValues.id, dto: branchData, jwt })).unwrap();
        toast({ title: "Success", description: "Branch updated successfully" });
      } else {
        await dispatch(createBranch({ dto: branchData, jwt })).unwrap();
        toast({ title: "Success", description: "Branch created successfully" });
      }
      onSubmit();
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || error || `Failed to ${isEditing ? "update" : "create"} branch`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{
        name: initialValues?.name || "",
        address: initialValues?.address || "",
        email: initialValues?.email || "",
        phone: initialValues?.phone || "",
        openTime: initialValues?.openTime || "08:00",
        closeTime: initialValues?.closeTime || "22:00",
      }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      {({ isSubmitting }) => (
        <Form className="space-y-4 py-2 pr-2">
          <div className="space-y-2">
            <label htmlFor="name">Branch Name</label>
            <Field
              as={Input}
              id="name"
              name="name"
              placeholder="Enter branch name"
            />
            <ErrorMessage name="name" component="div" className="text-red-500 text-sm" />
          </div>

          <div className="space-y-2">
            <label htmlFor="address">Address</label>
            <Field
              as={Input}
              id="address"
              name="address"
              placeholder="Enter branch address"
            />
            <ErrorMessage name="address" component="div" className="text-red-500 text-sm" />
          </div>

          <div className="space-y-2">
            <label htmlFor="email">Branch Email (Optional)</label>
            <Field
              as={Input}
              id="email"
              name="email"
              type="email"
              placeholder="Enter branch email"
            />
            <ErrorMessage name="email" component="div" className="text-red-500 text-sm" />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone">Phone Number</label>
            <Field
              as={Input}
              id="phone"
              name="phone"
              placeholder="Enter phone number"
            />
            <ErrorMessage name="phone" component="div" className="text-red-500 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="openTime">Open Time</label>
              <Field
                as={Input}
                id="openTime"
                name="openTime"
                type="time"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="closeTime">Close Time</label>
              <Field
                as={Input}
                id="closeTime"
                name="closeTime"
                type="time"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              {isSubmitting || loading ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Branch" : "Add Branch")}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default BranchForm;
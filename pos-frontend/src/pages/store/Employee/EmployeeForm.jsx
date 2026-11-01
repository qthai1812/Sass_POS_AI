import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllBranchesByStore } from "@/Redux Toolkit/features/branch/branchThunks";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const EmployeeForm = ({ initialData, onSubmit, roles }) => {
  const dispatch = useDispatch();
  const { branches, branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);

  const isEdit = Boolean(initialData?.id);
  const availableBranches =
    branches?.length > 0 ? branches : branch ? [branch] : [];

  const validationSchema = useMemo(
    () =>
      Yup.object({
        fullName: Yup.string().required("Employee name is required"),
        email: Yup.string()
          .email("Invalid email address")
          .required("Email is required"),
        phone: Yup.string().required("Phone number is required"),
        role: Yup.string().required("Role is required"),
        branchId: Yup.string().when("role", {
          is: (role) =>
            role === "ROLE_BRANCH_MANAGER" || role === "ROLE_BRANCH_CASHIER",
          then: (schema) => schema.required("Branch is required"),
          otherwise: (schema) => schema.notRequired(),
        }),
        password: isEdit
          ? Yup.string()
              .min(6, "Password must be at least 6 characters")
              .notRequired()
          : Yup.string()
              .min(6, "Password must be at least 6 characters")
              .required("Password is required"),
      }),
    [isEdit],
  );

  useEffect(() => {
    if (store?.id) {
      dispatch(
        getAllBranchesByStore({
          storeId: store.id,
          jwt: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [dispatch, store?.id]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      fullName: initialData?.fullName || "",
      email: initialData?.email || "",
      password: initialData?.password || "",
      phone: initialData?.phone || "",
      role: initialData?.role || "",
      branchId: initialData?.branchId
        ? String(initialData.branchId)
        : branch?.id
          ? String(branch.id)
          : "",
    },
    validationSchema,
    onSubmit: (values) => {
      const payload = {
        ...values,
        branchId: values.branchId ? Number(values.branchId) : undefined,
      };
      if (isEdit && !payload.password) {
        delete payload.password;
      }
      onSubmit(payload);
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4 py-2 pr-2">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          value={formik.values.fullName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder="Enter employee name"
        />
        {formik.touched.fullName && formik.errors.fullName ? (
          <div className="text-red-500 text-sm">{formik.errors.fullName}</div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder="Enter email address"
        />
        {formik.touched.email && formik.errors.email ? (
          <div className="text-red-500 text-sm">{formik.errors.email}</div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder={
            isEdit ? "Leave blank to keep current password" : "Enter password"
          }
        />
        {formik.touched.password && formik.errors.password ? (
          <div className="text-red-500 text-sm">{formik.errors.password}</div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          value={formik.values.phone}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          placeholder="Enter phone number"
        />
        {formik.touched.phone && formik.errors.phone ? (
          <div className="text-red-500 text-sm">{formik.errors.phone}</div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={formik.values.role}
            onValueChange={(value) => {
              formik.setFieldValue("role", value);
              if (
                value !== "ROLE_BRANCH_MANAGER" &&
                value !== "ROLE_BRANCH_CASHIER"
              ) {
                formik.setFieldValue("branchId", "");
              }
            }}
            onOpenChange={() => formik.setFieldTouched("role", true)}
            className="w-full"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formik.touched.role && formik.errors.role ? (
            <div className="text-red-500 text-sm">{formik.errors.role}</div>
          ) : null}
        </div>
        {(formik.values.role === "ROLE_BRANCH_MANAGER" ||
          formik.values.role === "ROLE_BRANCH_CASHIER") && (
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <Select
              value={formik.values.branchId}
              onValueChange={(value) => formik.setFieldValue("branchId", value)}
              onOpenChange={() => formik.setFieldTouched("branchId", true)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formik.touched.branchId && formik.errors.branchId ? (
              <div className="text-red-500 text-sm">
                {formik.errors.branchId}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit">
          {isEdit ? "Save Changes" : "Add Employee"}
        </Button>
      </div>
    </form>
  );
};

export default EmployeeForm;

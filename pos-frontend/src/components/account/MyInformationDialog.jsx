import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Shield,
  ArrowRightLeft,
  Lock,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Building2,
  Store as StoreIcon,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Send,
  Ban,
} from "lucide-react";
import {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from "@/Redux Toolkit/features/user/userThunks";
import api from "@/utils/api";
import { toast } from "sonner";

const ROLE_LABELS = {
  ROLE_SUPER_ADMIN: "Super Admin (Quản trị nền tảng)",
  ROLE_STORE_OWNER: "Chủ chuỗi cửa hàng (Store Owner)",
  ROLE_BRANCH_MANAGER: "Quản lý chi nhánh (Branch Manager)",
  ROLE_CASHIER: "Thu ngân (Cashier)",
};

const STATUS_BADGE = {
  PENDING: {
    label: "Chờ duyệt",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Từ chối",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
    icon: Ban,
  },
};

export default function MyInformationDialog({
  open,
  onOpenChange,
  defaultTab = "profile",
}) {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);
  const { branch } = useSelector((state) => state.branch);

  const [activeTab, setActiveTab] = useState(defaultTab);

  // Tab 1: Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 2: Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingPwd, setSavingPwd] = useState(false);

  // Tab 3: Branch Transfer Request state (for ROLE_CASHIER & ROLE_BRANCH_MANAGER)
  const isBranchEmployee =
    userProfile?.role === "ROLE_CASHIER" ||
    userProfile?.role === "ROLE_BRANCH_MANAGER";

  const [storeBranches, setStoreBranches] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loadingTransferData, setLoadingTransferData] = useState(false);
  const [toBranchId, setToBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || "");
      setPhone(userProfile.phone || "");
    }
  }, [userProfile, open]);

  const effectiveStoreId = userProfile?.storeId || store?.id || branch?.storeId;
  const effectiveStoreName =
    userProfile?.storeName || store?.brand || branch?.store?.brand || "—";
  const effectiveBranchId = userProfile?.branchId || branch?.id;
  const effectiveBranchName =
    userProfile?.branchName || branch?.name || "Toàn chuỗi cửa hàng";

  const fetchBranchTransferData = useCallback(async () => {
    if (!isBranchEmployee || !open) return;
    setLoadingTransferData(true);
    try {
      const promises = [api.get("/api/branch-transfer-requests/my")];
      if (effectiveStoreId) {
        promises.push(api.get(`/api/branches/store/${effectiveStoreId}`));
      }
      const [reqRes, branchRes] = await Promise.all(promises);
      setMyRequests(Array.isArray(reqRes?.data) ? reqRes.data : []);
      if (branchRes?.data) {
        setStoreBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
      }
    } catch (err) {
      console.error("Failed to load branch transfer data:", err);
    } finally {
      setLoadingTransferData(false);
    }
  }, [isBranchEmployee, open, effectiveStoreId]);

  useEffect(() => {
    if (open && isBranchEmployee) {
      fetchBranchTransferData();
    }
  }, [open, isBranchEmployee, fetchBranchTransferData]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!fullName || !fullName.trim()) {
      toast.error("Họ và tên không được để trống.");
      return;
    }
    setSavingProfile(true);
    try {
      await dispatch(
        updateUserProfile({
          fullName: fullName.trim(),
          phone: phone ? phone.trim() : "",
        }),
      ).unwrap();
      toast.success("Đã cập nhật thông tin cá nhân thành công!");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Không thể cập nhật thông tin");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e) => {
    e?.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }
    setSavingPwd(true);
    try {
      await dispatch(
        changeUserPassword({
          currentPassword,
          newPassword,
        }),
      ).unwrap();
      toast.success("Đổi mật khẩu thành công! Phiên làm việc của bạn đã được đồng bộ.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Đổi mật khẩu thất bại");
    } finally {
      setSavingPwd(false);
    }
  };

  const availableTargetBranches = storeBranches.filter(
    (b) => String(b.id) !== String(effectiveBranchId),
  );

  const hasPendingRequest = myRequests.some((r) => r.status === "PENDING");

  const handleSubmitTransferRequest = async (e) => {
    e?.preventDefault();
    if (!toBranchId) {
      toast.error("Vui lòng chọn chi nhánh muốn chuyển đến.");
      return;
    }
    if (!transferReason || !transferReason.trim()) {
      toast.error("Vui lòng nhập lý do xin chuyển chi nhánh.");
      return;
    }
    setSubmittingTransfer(true);
    try {
      await api.post("/api/branch-transfer-requests", {
        toBranchId: Number(toBranchId),
        reason: transferReason.trim(),
      });
      toast.success("Đã gửi đơn yêu cầu chuyển chi nhánh tới Chủ cửa hàng!");
      setToBranchId("");
      setTransferReason("");
      await fetchBranchTransferData();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể gửi yêu cầu chuyển chi nhánh",
      );
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleCancelRequest = async (reqId) => {
    setCancellingId(reqId);
    try {
      await api.put(`/api/branch-transfer-requests/${reqId}/cancel`);
      toast.success("Đã hủy đơn yêu cầu chuyển chi nhánh.");
      await fetchBranchTransferData();
      const token = localStorage.getItem("jwt");
      if (token) {
        dispatch(getUserProfile(token));
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể hủy đơn yêu cầu",
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="w-5 h-5 text-emerald-600" />
            Thông tin tài khoản (My Information)
          </DialogTitle>
          <DialogDescription>
            Quản lý hồ sơ cá nhân, bảo mật mật khẩu
            {isBranchEmployee ? " và gửi yêu cầu chuyển chi nhánh trong cùng chuỗi cửa hàng." : "."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList
            className={`grid w-full ${
              isBranchEmployee ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>Hồ sơ cá nhân</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>Đổi mật khẩu</span>
            </TabsTrigger>
            {isBranchEmployee && (
              <TabsTrigger value="transfer" className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Chuyển chi nhánh</span>
                {hasPendingRequest && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          <TabsContent value="profile" className="space-y-4 pt-3">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="my-info-fullname">Họ và tên *</Label>
                  <Input
                    id="my-info-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên..."
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="my-info-phone">Số điện thoại</Label>
                  <Input
                    id="my-info-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Nhập số điện thoại..."
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Thông tin định danh & phân quyền (Chỉ đọc - Read-only)
                  </span>
                  <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                    Đang hoạt động
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Email đăng nhập
                    </Label>
                    <Input
                      value={userProfile?.email || ""}
                      readOnly
                      disabled
                      className="bg-muted/70 text-muted-foreground cursor-not-allowed h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Vai trò hệ thống
                    </Label>
                    <Input
                      value={
                        ROLE_LABELS[userProfile?.role] ||
                        userProfile?.role ||
                        ""
                      }
                      readOnly
                      disabled
                      className="bg-muted/70 text-muted-foreground cursor-not-allowed h-9"
                    />
                  </div>

                  {userProfile?.role !== "ROLE_SUPER_ADMIN" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <StoreIcon className="w-3 h-3" /> Chuỗi cửa hàng (Store)
                        </Label>
                        <Input
                          value={effectiveStoreName}
                          readOnly
                          disabled
                          className="bg-muted/70 text-muted-foreground cursor-not-allowed h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Chi nhánh làm việc
                        </Label>
                        <Input
                          value={
                            userProfile?.role === "ROLE_STORE_OWNER"
                              ? "Quản trị toàn chuỗi cửa hàng"
                              : effectiveBranchName
                          }
                          readOnly
                          disabled
                          className="bg-muted/70 text-muted-foreground cursor-not-allowed h-9"
                        />
                      </div>
                    </>
                  )}
                </div>

                {isBranchEmployee && (
                  <p className="text-xs text-muted-foreground pt-1">
                    * Nhân viên không thể tự ý đổi chuỗi cửa hàng hoặc chi nhánh trực tiếp. Nếu muốn chuyển sang chi nhánh khác trong cùng chuỗi, vui lòng chuyển sang tab{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("transfer")}
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      Chuyển chi nhánh
                    </button>{" "}
                    để gửi đơn cho Chủ cửa hàng phê duyệt.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Lưu thay đổi
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: ĐỔI MẬT KHẨU */}
          <TabsContent value="security" className="space-y-4 pt-3">
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  Chính sách bảo mật mật khẩu
                </div>
                <p>
                  • Mật khẩu mới phải từ 6 ký tự trở lên và không trùng với mật khẩu hiện tại.
                </p>
                <p>
                  • Giới hạn tối đa 3 lần đổi mật khẩu/ngày, mỗi lần cách nhau tối thiểu 5 phút.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="my-info-cur-pwd">Mật khẩu hiện tại *</Label>
                  <div className="relative">
                    <Input
                      id="my-info-cur-pwd"
                      type={showPwd.current ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang sử dụng..."
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPwd((s) => ({ ...s, current: !s.current }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPwd.current ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="my-info-new-pwd">Mật khẩu mới (≥ 6 ký tự) *</Label>
                    <div className="relative">
                      <Input
                        id="my-info-new-pwd"
                        type={showPwd.new ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới..."
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, new: !s.new }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPwd.new ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="my-info-confirm-pwd">Xác nhận mật khẩu mới *</Label>
                    <div className="relative">
                      <Input
                        id="my-info-confirm-pwd"
                        type={showPwd.confirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới..."
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPwd((s) => ({ ...s, confirm: !s.confirm }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPwd.confirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={savingPwd}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {savingPwd ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Đổi mật khẩu
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 3: YÊU CẦU CHUYỂN CHI NHÁNH (CHO NHÂN VIÊN CHI NHÁNH) */}
          {isBranchEmployee && (
            <TabsContent value="transfer" className="space-y-4 pt-3">
              <div className="rounded-lg border bg-muted/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                      Gửi đơn xin chuyển chi nhánh
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Chi nhánh hiện tại:{" "}
                      <span className="font-medium text-foreground">
                        {effectiveBranchName}
                      </span>{" "}
                      ({effectiveStoreName})
                    </p>
                  </div>
                </div>

                {hasPendingRequest ? (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                    Bạn đang có 1 đơn yêu cầu chuyển chi nhánh ở trạng thái{" "}
                    <strong>Chờ duyệt</strong>. Vui lòng đợi Chủ cửa hàng phê duyệt hoặc hủy đơn bên dưới nếu muốn chọn lại chi nhánh khác.
                  </div>
                ) : availableTargetBranches.length === 0 ? (
                  <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    Chuỗi cửa hàng hiện chưa có chi nhánh nào khác ngoài chi nhánh bạn đang làm việc.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTransferRequest} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="target-branch">
                        Chọn chi nhánh muốn chuyển đến *
                      </Label>
                      <Select value={toBranchId} onValueChange={setToBranchId}>
                        <SelectTrigger id="target-branch">
                          <SelectValue placeholder="-- Chọn chi nhánh trong cùng chuỗi cửa hàng --" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTargetBranches.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.name} {b.address ? `— ${b.address}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="transfer-reason">
                        Lý do xin chuyển chi nhánh *
                      </Label>
                      <Textarea
                        id="transfer-reason"
                        rows={2}
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        placeholder="Ví dụ: Chuyển chỗ ở gần chi nhánh mới, thuận tiện đi lại..."
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={submittingTransfer}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        size="sm"
                      >
                        {submittingTransfer ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Đang gửi...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1.5" />
                            Gửi đơn cho Chủ cửa hàng
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Lịch sử đơn yêu cầu của nhân viên */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lịch sử đơn chuyển chi nhánh của bạn ({myRequests.length})
                </h4>

                {loadingTransferData ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang tải danh sách yêu cầu...
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="text-center py-6 border rounded-lg text-xs text-muted-foreground">
                    Bạn chưa gửi đơn yêu cầu chuyển chi nhánh nào.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                    {myRequests.map((req) => {
                      const st = STATUS_BADGE[req.status] || STATUS_BADGE.PENDING;
                      const StatusIcon = st.icon;
                      return (
                        <div
                          key={req.id}
                          className="rounded-lg border p-3 text-xs space-y-1.5 bg-card"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{req.fromBranchName}</span>
                              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-emerald-600 font-semibold">
                                {req.toBranchName}
                              </span>
                            </div>
                            <Badge variant="outline" className={st.className}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {st.label}
                            </Badge>
                          </div>

                          <p className="text-muted-foreground">
                            <strong>Lý do:</strong> {req.reason}
                          </p>

                          {req.reviewNote && (
                            <p className="text-muted-foreground bg-muted/50 rounded px-2 py-1">
                              <strong>Phản hồi:</strong> {req.reviewNote}
                              {req.reviewedByName ? ` (${req.reviewedByName})` : ""}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                            <span>
                              Gửi lúc:{" "}
                              {req.createdAt
                                ? new Date(req.createdAt).toLocaleString("vi-VN")
                                : "—"}
                            </span>
                            {req.status === "PENDING" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={cancellingId === req.id}
                                onClick={() => handleCancelRequest(req.id)}
                                className="h-6 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              >
                                {cancellingId === req.id
                                  ? "Đang hủy..."
                                  : "Hủy yêu cầu"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

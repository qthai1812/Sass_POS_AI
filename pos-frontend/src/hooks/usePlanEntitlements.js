import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getMyEntitlements } from "@/Redux Toolkit/features/subscription/subscriptionThunks";

/**
 * Quyền lợi theo gói cước của cửa hàng người dùng đang đăng nhập (do backend tính từ gói ACTIVE còn hạn).
 * - `hasFeature(key)`: key là tên cờ của gói (advancedReports, inventory, invoiceBranding, multiLocation, ...).
 *   Khi chưa tải xong hoặc cửa hàng chưa có gói ACTIVE thì mặc định là được phép (backend vẫn là nơi chặn thật sự).
 * - `refresh()`: tải lại sau khi nâng cấp/đổi gói.
 */
export default function usePlanEntitlements() {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user?.userProfile?.id);
  const { entitlements, entitlementsUserId, entitlementsLoading } = useSelector(
    (state) => state.subscription,
  );

  const valid = entitlements && entitlementsUserId === (userId ?? null);

  useEffect(() => {
    if (userId && localStorage.getItem("jwt")) {
      dispatch(getMyEntitlements(userId));
    }
  }, [dispatch, userId]);

  const refresh = useCallback(() => {
    if (userId) dispatch(getMyEntitlements(userId));
  }, [dispatch, userId]);

  const hasFeature = useCallback(
    (key) => {
      if (!valid) return true;
      return entitlements.features?.[key] !== false;
    },
    [valid, entitlements],
  );

  return {
    entitlements: valid ? entitlements : null,
    loading: !valid && entitlementsLoading,
    ready: Boolean(valid),
    hasFeature,
    refresh,
  };
}

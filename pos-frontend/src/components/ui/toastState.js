export const TOAST_LIMIT = 2;
export const MAX_TOAST_DURATION = 3000;
export const TOAST_REMOVE_DELAY = 200;

export const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
};

/**
 * Clamp any toast duration to a safe range with a strict upper bound of MAX_TOAST_DURATION (3s).
 */
export function clampToastDuration(duration) {
  if (duration === undefined || duration === null) {
    return MAX_TOAST_DURATION;
  }
  const numeric = Number(duration);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return MAX_TOAST_DURATION;
  }
  return Math.min(MAX_TOAST_DURATION, Math.max(500, Math.round(numeric)));
}

/**
 * Pure reducer managing the active toast queue:
 * - Newest toast is always inserted at the front (never dropped by old toasts)
 * - Existing toast with the same `id` is replaced in-place at the front
 * - List is truncated at TOAST_LIMIT so stacked notifications never cover the page
 */
export function toastReducer(state, action) {
  switch (action.type) {
    case actionTypes.ADD_TOAST: {
      const incoming = {
        ...action.toast,
        duration: clampToastDuration(action.toast?.duration),
      };
      const withoutDuplicate = (state.toasts || []).filter(
        (t) => t.id !== incoming.id,
      );
      return {
        ...state,
        toasts: [incoming, ...withoutDuplicate].slice(0, TOAST_LIMIT),
      };
    }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: (state.toasts || []).map((t) =>
          t.id === action.toastId
            ? {
                ...t,
                ...action.toast,
                ...(action.toast?.duration !== undefined
                  ? { duration: clampToastDuration(action.toast.duration) }
                  : {}),
              }
            : t,
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;
      return {
        ...state,
        toasts: (state.toasts || []).map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: (state.toasts || []).filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
}

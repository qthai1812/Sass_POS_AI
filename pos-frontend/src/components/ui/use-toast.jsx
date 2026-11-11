import * as React from "react";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  actionTypes,
  clampToastDuration,
  MAX_TOAST_DURATION,
  TOAST_REMOVE_DELAY,
  toastReducer,
} from "@/components/ui/toastState";

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const autoDismissTimers = new Map();
const removeTimers = new Map();

const clearAutoDismissTimer = (toastId) => {
  if (toastId === undefined) {
    autoDismissTimers.forEach((timer) => clearTimeout(timer));
    autoDismissTimers.clear();
    return;
  }
  const timer = autoDismissTimers.get(toastId);
  if (timer) {
    clearTimeout(timer);
    autoDismissTimers.delete(toastId);
  }
};

const clearRemoveTimer = (toastId) => {
  if (toastId === undefined) {
    removeTimers.forEach((timer) => clearTimeout(timer));
    removeTimers.clear();
    return;
  }
  const timer = removeTimers.get(toastId);
  if (timer) {
    clearTimeout(timer);
    removeTimers.delete(toastId);
  }
};

const clearToastTimers = (toastId) => {
  clearAutoDismissTimer(toastId);
  clearRemoveTimer(toastId);
};

const addToRemoveQueue = (toastId) => {
  if (removeTimers.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    removeTimers.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  removeTimers.set(toastId, timeout);
};

const scheduleAutoDismiss = (toastId, duration) => {
  clearToastTimers(toastId);
  const clamped = clampToastDuration(duration);
  // Start exit transition slightly before MAX_TOAST_DURATION so the toast
  // finishes fading out and is completely unmounted within <= 3 seconds.
  const dismissDelay = Math.min(
    clamped,
    Math.max(500, MAX_TOAST_DURATION - TOAST_REMOVE_DELAY),
  );
  const timeout = setTimeout(() => {
    autoDismissTimers.delete(toastId);
    dispatch({
      type: actionTypes.DISMISS_TOAST,
      toastId,
    });
  }, dismissDelay);
  autoDismissTimers.set(toastId, timeout);
};

const listeners = [];

let memoryState = { toasts: [] };

function dispatch(action) {
  const prevIds = new Set(memoryState.toasts.map((t) => t.id));

  if (action.type === actionTypes.DISMISS_TOAST) {
    const targetIds =
      action.toastId !== undefined
        ? [action.toastId]
        : memoryState.toasts.map((t) => t.id);
    targetIds.forEach((id) => {
      clearAutoDismissTimer(id);
      addToRemoveQueue(id);
    });
  } else if (action.type === actionTypes.REMOVE_TOAST) {
    clearToastTimers(action.toastId);
  }

  memoryState = toastReducer(memoryState, action);

  if (action.type === actionTypes.ADD_TOAST) {
    const activeIds = new Set(memoryState.toasts.map((t) => t.id));
    prevIds.forEach((id) => {
      if (!activeIds.has(id)) {
        clearToastTimers(id);
      }
    });
  }

  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast({ ...props }) {
  const id = props.id ? String(props.id) : genId();
  const instanceKey = genId();
  const effectiveDuration = clampToastDuration(props.duration);

  const update = (nextProps) => {
    if (nextProps?.duration !== undefined) {
      scheduleAutoDismiss(id, nextProps.duration);
    }
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...nextProps },
      toastId: id,
    });
  };

  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  scheduleAutoDismiss(id, effectiveDuration);

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      _instanceKey: instanceKey,
      duration: effectiveDuration,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    setState(memoryState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={MAX_TOAST_DURATION}>
      {toasts.map(function ({
        id,
        _instanceKey,
        title,
        description,
        action,
        ...props
      }) {
        return (
          <Toast key={_instanceKey || id} {...props}>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

export { useToast, toast, Toaster };

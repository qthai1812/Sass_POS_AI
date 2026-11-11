import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  actionTypes,
  clampToastDuration,
  MAX_TOAST_DURATION,
  TOAST_LIMIT,
  TOAST_REMOVE_DELAY,
  toastReducer,
} from "./toastState.js";

describe("toastState", () => {
  it("clamps all durations to at most 3000ms (3 seconds)", () => {
    assert.equal(clampToastDuration(undefined), 3000);
    assert.equal(clampToastDuration(null), 3000);
    assert.equal(clampToastDuration(Infinity), 3000);
    assert.equal(clampToastDuration(-100), 3000);
    assert.equal(clampToastDuration(10000), 3000);
    assert.equal(clampToastDuration(3000), 3000);
    assert.equal(clampToastDuration(1500), 1500);
    assert.equal(clampToastDuration(100), 500);
    assert.equal(MAX_TOAST_DURATION, 3000);
    assert.ok(TOAST_REMOVE_DELAY <= 300);
  });

  it("prepends newest toast and replaces duplicates so warnings are never dropped", () => {
    let state = { toasts: [] };

    // Simulate adding 6 different notifications quickly
    for (let i = 1; i <= 6; i++) {
      state = toastReducer(state, {
        type: actionTypes.ADD_TOAST,
        toast: { id: `toast-${i}`, title: `Toast ${i}`, open: true },
      });
    }

    assert.equal(state.toasts.length, TOAST_LIMIT);
    assert.equal(state.toasts[0].id, "toast-6");

    // Simulate "Missing Return Reason" warning after 6 prior notifications
    state = toastReducer(state, {
      type: actionTypes.ADD_TOAST,
      toast: {
        id: "refund-validation-error",
        title: "Missing Return Reason",
        duration: 8000,
        open: true,
      },
    });

    assert.equal(state.toasts[0].id, "refund-validation-error");
    assert.equal(state.toasts[0].title, "Missing Return Reason");
    assert.equal(state.toasts[0].duration, 3000);
  });

  it("replaces pos-add-to-cart toast in-place when selecting many products", () => {
    let state = { toasts: [] };

    for (const name of ["Polo", "Jeans", "Jacket", "Shoes", "Hat"]) {
      state = toastReducer(state, {
        type: actionTypes.ADD_TOAST,
        toast: {
          id: "pos-add-to-cart",
          title: "Added to cart",
          description: `${name} added to cart`,
          duration: 1500,
          open: true,
        },
      });
    }

    assert.equal(state.toasts.length, 1);
    assert.equal(state.toasts[0].description, "Hat added to cart");
    assert.equal(state.toasts[0].duration, 1500);
  });

  it("marks toast closed on DISMISS_TOAST and removes it on REMOVE_TOAST", () => {
    let state = {
      toasts: [{ id: "1", title: "Hello", duration: 3000, open: true }],
    };

    state = toastReducer(state, {
      type: actionTypes.DISMISS_TOAST,
      toastId: "1",
    });
    assert.equal(state.toasts[0].open, false);

    state = toastReducer(state, {
      type: actionTypes.REMOVE_TOAST,
      toastId: "1",
    });
    assert.equal(state.toasts.length, 0);
  });
});

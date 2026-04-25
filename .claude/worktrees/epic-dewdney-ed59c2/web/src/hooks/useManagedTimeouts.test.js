import { renderHook, act } from "@testing-library/react";
import useManagedTimeouts from "./useManagedTimeouts";

describe("useManagedTimeouts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("fires a scheduled callback after the delay", () => {
    const { result } = renderHook(() => useManagedTimeouts());
    const spy = jest.fn();

    act(() => {
      result.current.set(spy, 1000);
    });

    expect(spy).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(spy).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("clear() prevents the callback from firing", () => {
    const { result } = renderHook(() => useManagedTimeouts());
    const spy = jest.fn();

    let id;
    act(() => {
      id = result.current.set(spy, 500);
    });
    act(() => {
      result.current.clear(id);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  test("clear() is safe when called with a nullish id", () => {
    const { result } = renderHook(() => useManagedTimeouts());
    expect(() => result.current.clear(null)).not.toThrow();
    expect(() => result.current.clear(undefined)).not.toThrow();
  });

  test("unmount clears every pending callback so no setState-on-unmounted fires", () => {
    const { result, unmount } = renderHook(() => useManagedTimeouts());
    const first = jest.fn();
    const second = jest.fn();

    act(() => {
      result.current.set(first, 1000);
      result.current.set(second, 2000);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});

"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastFn = (message: string, undo?: () => void) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<ToastFn>((message, undo) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, undo });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast.message}
          {toast.undo && <button onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}

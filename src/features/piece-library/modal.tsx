"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./piece-library.module.css";

export function EditorModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (typeof dialog?.showModal === "function") dialog.showModal(); else dialog?.setAttribute("open", "");
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { dialog?.close?.(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.modal} aria-label={title} onCancel={e => { e.preventDefault(); closeRef.current(); }}>
    <header className={styles.modalHeader}><h2>{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`}>Close ×</button></header>
    {children}
  </dialog>;
}

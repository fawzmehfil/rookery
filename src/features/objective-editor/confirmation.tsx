"use client";
import { useEffect, useRef } from "react";
import styles from "./objective-editor.module.css";

export function ConfirmChange({message,onConfirm,onCancel,confirmLabel}:{message:string;onConfirm:()=>void;onCancel:()=>void;confirmLabel:string}){
  const cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();return ()=>previous?.focus();},[]);
  return <section className={styles.confirmation} role="group" aria-label="Confirm replacement"><p role="alert">{message}</p><div className={styles.actions}><button ref={cancel} onClick={onCancel}>Cancel replacement</button><button onClick={onConfirm}>{confirmLabel}</button></div></section>;
}

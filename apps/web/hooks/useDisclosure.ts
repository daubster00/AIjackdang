"use client";

import { useCallback, useState } from "react";

/**
 * 열림/닫힘 상태를 관리하는 작은 훅.
 * 모달·드로어·드롭다운 등에서 재사용한다.
 */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((value) => !value), []);
  return { open, onOpen, onClose, onToggle, setOpen };
}

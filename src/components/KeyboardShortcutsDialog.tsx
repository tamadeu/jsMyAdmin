"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next"; // Import useTranslation

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KeyboardShortcutsDialog = ({ open, onOpenChange }: KeyboardShortcutsDialogProps) => {
  const { t } = useTranslation(); // Initialize useTranslation

  const shortcuts = [
    { action: t("keyboardShortcutsDialog.executeSqlQuery"), shortcut: "Ctrl + Enter" },
    { action: t("keyboardShortcutsDialog.previousTab"), shortcut: "Shift + ArrowLeft" },
    { action: t("keyboardShortcutsDialog.nextTab"), shortcut: "Shift + ArrowRight" },
    { action: t("keyboardShortcutsDialog.closeActiveTab"), shortcut: "Shift + X" },
    { action: t("keyboardShortcutsDialog.editCell"), shortcut: t("keyboardShortcutsDialog.doubleClick") },
    { action: t("keyboardShortcutsDialog.saveCellEdit"), shortcut: "Enter" },
    { action: t("keyboardShortcutsDialog.cancelCellEdit"), shortcut: "Escape" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> {t("keyboardShortcutsDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("keyboardShortcutsDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{t("keyboardShortcutsDialog.action")}</TableHead>
                <TableHead>{t("keyboardShortcutsDialog.shortcut")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortcuts.map((shortcut, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{shortcut.action}</TableCell>
                  <TableCell className="font-mono bg-muted px-2 py-1 rounded-sm text-sm">{shortcut.shortcut}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;
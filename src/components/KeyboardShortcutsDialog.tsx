"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { action: "Executar Query (SQL Editor)", shortcut: "Ctrl + Enter" },
  { action: "Navegar para a aba anterior", shortcut: "Shift + ArrowLeft" },
  { action: "Navegar para a próxima aba", shortcut: "Shift + ArrowRight" },
  { action: "Fechar aba ativa", shortcut: "Shift + X" },
  { action: "Editar célula (Navegador de Dados)", shortcut: "Duplo clique" },
  { action: "Salvar edição de célula (Navegador de Dados)", shortcut: "Enter" },
  { action: "Cancelar edição de célula (Navegador de Dados)", shortcut: "Escape" },
];

const KeyboardShortcutsDialog = ({ open, onOpenChange }: KeyboardShortcutsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Aqui estão os atalhos de teclado disponíveis para navegar e interagir com a aplicação.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Ação</TableHead>
                <TableHead>Atalho</TableHead>
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
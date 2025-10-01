"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar"; // Import the existing Sidebar component

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 sm:w-80">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
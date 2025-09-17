import { Wifi, Bell, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  subtitle?: string;
  database?: string;
  table?: string;
}

const Header = ({ title, subtitle, database, table }: HeaderProps) => {
  return (
    <header className="border-b border-border px-6 py-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {database && table ? (
            <>
              <h1 className="text-xl font-semibold">Table: {table}</h1>
              <div className="text-sm text-muted-foreground">
                Databases / {database} / {table}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle && (
                <div className="text-sm text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <Badge variant="outline" className="text-green-500 border-green-500">Connected</Badge>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 bg-accent px-3 py-1 rounded-md">
            <User className="h-4 w-4" />
            <span className="text-sm">AD</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
import DatabaseConfigComponent from "@/components/database-config";
import { useTranslation } from "react-i18next"; // Import useTranslation

const Configuration = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6">
        <DatabaseConfigComponent />
      </div>
    </div>
  );
};

export default Configuration;
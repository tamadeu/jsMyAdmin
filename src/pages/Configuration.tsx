import DatabaseConfigComponent from "@/components/database-config";

const Configuration = () => {
  return (
    <div className="overflow-y-auto h-full">
      <div className="p-6">
        <DatabaseConfigComponent />
      </div>
    </div>
  );
};

export default Configuration;
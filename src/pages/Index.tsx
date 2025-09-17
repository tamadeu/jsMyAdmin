import Dashboard from "./Dashboard";
import Layout from "@/components/layout/Layout";

const Index = () => {
  return (
    <Layout title="Database Dashboard">
      <div className="overflow-y-auto">
        <Dashboard />
      </div>
    </Layout>
  );
};

export default Index;
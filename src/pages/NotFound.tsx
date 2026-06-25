import { Link } from "react-router-dom";
import { Factory } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <Factory className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Página não encontrada</p>
      <Link to="/" className="text-primary hover:underline text-sm">Voltar ao Dashboard</Link>
    </div>
  );
};

export default NotFound;

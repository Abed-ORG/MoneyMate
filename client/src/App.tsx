import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardFiltersProvider } from "./contexts/DashboardFiltersContext";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DashboardFiltersProvider>
          <AppRoutes />
        </DashboardFiltersProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

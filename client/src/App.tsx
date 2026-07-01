import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardFiltersProvider } from "./contexts/DashboardFiltersContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AppRoutes } from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DashboardFiltersProvider>
            <AppRoutes />
          </DashboardFiltersProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

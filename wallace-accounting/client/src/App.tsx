import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Unauthorized from "@/pages/Unauthorized";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Statements from "./pages/Statements";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import T4A from "./pages/T4A";
import Receipts from "./pages/Receipts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/statements" component={Statements} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/reports" component={Reports} />
      <Route path="/t4a" component={T4A} />
      <Route path="/receipts" component={Receipts} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          {/* Unauthorized page renders outside DashboardLayout to avoid auth redirect loop */}
          <Switch>
            <Route path="/unauthorized" component={Unauthorized} />
            <Route>
              <DashboardLayout>
                <Router />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

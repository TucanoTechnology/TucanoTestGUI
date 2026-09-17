import { AuthProvider, useAuth } from "./app/AuthProvider.js";
import { LoginScreen } from "./app/LoginScreen.js";
import { AppShell } from "./app/AppShell.js";

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppShell />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

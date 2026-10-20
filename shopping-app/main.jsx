import React from "react";
import { createRoot } from "react-dom/client";
import PasswordGate from "./password-gate.jsx";
import ShoppingList from "./family-shopping-list.jsx";

createRoot(document.getElementById("root")).render(
  <PasswordGate>
    <ShoppingList />
  </PasswordGate>
);

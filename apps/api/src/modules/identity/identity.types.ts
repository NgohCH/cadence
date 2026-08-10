export interface CadenceUser {
  id: string;
  displayName: string;
  email: string;
  status: "active" | "disabled";
  identityProvider: string;
}
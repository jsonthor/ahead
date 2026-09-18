import { SignupForm } from "@/components/auth/signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up — Potential",
  description: "Create a Potential account and start a training calendar.",
};

export default function SignupPage() {
  return <SignupForm />;
}

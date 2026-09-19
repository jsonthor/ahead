import { SignupForm } from "@/components/auth/signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up — Ahead",
  description: "Create an Ahead account and start a training calendar.",
  robots: { index: false, follow: false },
};

export default function SignupJoinPage() {
  return <SignupForm />;
}

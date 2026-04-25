import { redirect } from "next/navigation"

/** @deprecated Use `/login` — Google OAuth is one flow for sign-in and first-time users. */
export default function SignupPage() {
  redirect("/login")
}

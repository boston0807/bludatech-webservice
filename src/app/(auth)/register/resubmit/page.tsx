// src/app/(auth)/register/resubmit/page.tsx
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ResubmitForm } from "./resubmit-form";

export default function ResubmitPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResubmitForm />
    </Suspense>
  );
}

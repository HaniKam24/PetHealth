import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-card p-10 rounded-3xl border border-border shadow-sm">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
          <AlertCircle size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Page not found
          </h1>
          <p className="text-muted-foreground text-lg">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-colors w-full"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

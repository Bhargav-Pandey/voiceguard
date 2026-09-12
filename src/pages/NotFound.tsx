import { GlassBackdrop, GlassLogo, GlassPanel } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative min-h-screen"
    >
      <GlassBackdrop />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <GlassLogo className="size-16 rounded-2xl" />
        <h1 className="mt-6 text-6xl font-extrabold tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-2 text-lg font-medium text-foreground">
          This frequency is silent
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="mt-8 rounded-xl">
          <Link to="/">
            <Home className="size-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

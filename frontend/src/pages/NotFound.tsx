import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass className="size-5" />}
      title="Page not found"
      description="That page does not exist. Head back to the overview or start a new screening."
      action={
        <>
          <Button asChild>
            <Link to="/">Go to overview</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/screenings/new">New screening</Link>
          </Button>
        </>
      }
    />
  );
}

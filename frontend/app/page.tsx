import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Button asChild size="lg">
        <Link href="/login">Login</Link>
      </Button>
    </div>
  )
}

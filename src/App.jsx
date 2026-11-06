import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Store } from "lucide-react"

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> POS Web funcionando
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button>Botón de prueba</Button>
        </CardContent>
      </Card>
    </div>
  )
}
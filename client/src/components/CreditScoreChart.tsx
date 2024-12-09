import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface CreditScoreChartProps {
  data: Array<{ date: string; score: number }>
}

export function CreditScoreChart({ data }: CreditScoreChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Score History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[300, 850]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
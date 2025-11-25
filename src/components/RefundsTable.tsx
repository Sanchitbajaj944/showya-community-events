import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Refund {
  id: string;
  user_id: string;
  amount: number;
  refund_percentage: number;
  status: string;
  razorpay_refund_id: string | null;
  reason: string | null;
  initiated_at: string;
  processed_at: string | null;
  error_message: string | null;
}

interface RefundsTableProps {
  eventId: string;
}

export function RefundsTable({ eventId }: RefundsTableProps) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefunds();
  }, [eventId]);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('event_id', eventId)
        .order('initiated_at', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);
    } catch (error) {
      console.error('Error fetching refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Refunds</CardTitle>
          <CardDescription>Loading refund information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (refunds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Refunds</CardTitle>
          <CardDescription>Track all refund requests for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No refunds have been processed for this event.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Refunds</CardTitle>
            <CardDescription>
              {refunds.length} refund request{refunds.length !== 1 ? 's' : ''} for this event
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRefunds}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Razorpay ID</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell className="font-medium">
                    {format(new Date(refund.initiated_at), "MMM dd, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>₹{refund.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{refund.refund_percentage}%</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(refund.status)}</TableCell>
                  <TableCell>
                    {refund.razorpay_refund_id ? (
                      <a
                        href={`https://dashboard.razorpay.com/app/refunds/${refund.razorpay_refund_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        {refund.razorpay_refund_id.substring(0, 15)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {refund.error_message || refund.reason || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

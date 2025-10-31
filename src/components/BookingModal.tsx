import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  availableSlots: number;
  onBookingComplete: () => void;
}

export function BookingModal({ 
  open, 
  onOpenChange, 
  event, 
  availableSlots,
  onBookingComplete 
}: BookingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'performer' | 'audience'>('performer');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");

  const handleFreeBooking = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    try {
      setLoading(true);

      // Generate ticket code
      const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Insert booking
      const { data, error } = await supabase
        .from("event_participants")
        .insert({
          event_id: event.id,
          user_id: user?.id,
          role: role,
          ticket_code: ticketCode
        })
        .select()
        .single();

      if (error) throw error;

      setBookingId(ticketCode);
      setBookingSuccess(true);
      toast.success("Booking confirmed! 🎉");
      onBookingComplete();

    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to complete booking");
    } finally {
      setLoading(false);
    }
  };

  const handlePaidBooking = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    try {
      setLoading(true);

      const ticketPrice = role === 'performer' ? event.performer_ticket_price : event.audience_ticket_price;

      // Create Razorpay order via edge function
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-payment-order',
        {
          body: {
            event_id: event.id,
            amount: ticketPrice
          }
        }
      );

      if (orderError) throw orderError;

      // Initialize Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: event.title,
        description: `${role === 'performer' ? 'Performer' : 'Audience'} Ticket`,
        handler: async function (response: any) {
          try {
            // Generate ticket code
            const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Save booking
            const { error: bookingError } = await supabase
              .from("event_participants")
              .insert({
                event_id: event.id,
                user_id: user?.id,
                role: role,
                ticket_code: ticketCode
              });

            if (bookingError) throw bookingError;

            setBookingId(ticketCode);
            setBookingSuccess(true);
            toast.success("Payment successful! Booking confirmed 🎉");
            onBookingComplete();

          } catch (error: any) {
            console.error("Post-payment error:", error);
            toast.error("Payment received but booking failed. Please contact support.");
          }
        },
        prefill: {
          email: user?.email,
        },
        theme: {
          color: "#8B5CF6"
        }
      };

      // @ts-ignore - Razorpay is loaded via script
      const razorpay = new window.Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', function (response: any) {
        toast.error("Payment failed. Please try again.");
        setLoading(false);
      });

    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initialize payment");
      setLoading(false);
    }
  };

  const handleBooking = () => {
    if (event.ticket_type === 'paid') {
      handlePaidBooking();
    } else {
      handleFreeBooking();
    }
  };

  const resetModal = () => {
    setBookingSuccess(false);
    setBookingId("");
    setTermsAccepted(false);
    setRole('performer');
    onOpenChange(false);
  };

  if (bookingSuccess) {
    return (
      <Dialog open={open} onOpenChange={resetModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">🎉 Booking Confirmed!</DialogTitle>
            <DialogDescription className="text-center pt-4">
              <div className="space-y-4">
                <p className="text-lg">Your ticket has been booked successfully</p>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Booking ID</p>
                  <p className="font-mono font-bold text-lg">{bookingId}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A confirmation email has been sent to your registered email address
                </p>
                <Button onClick={resetModal} className="w-full">
                  Done
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Your Slot</DialogTitle>
          <DialogDescription>
            Complete your booking for {event.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Select Your Role</Label>
            <RadioGroup value={role} onValueChange={(value: any) => setRole(value)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="performer" id="performer" />
                <Label htmlFor="performer" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Performer</span>
                    {event.ticket_type === 'paid' && (
                      <span className="font-semibold">₹{event.performer_ticket_price}</span>
                    )}
                  </div>
                </Label>
              </div>

              {event.audience_enabled && (
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="audience" id="audience" />
                  <Label htmlFor="audience" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Audience</span>
                      {event.ticket_type === 'paid' && event.audience_ticket_price && (
                        <span className="font-semibold">₹{event.audience_ticket_price}</span>
                      )}
                    </div>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Booking Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium">{event.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available Slots</span>
              <span className="font-medium">{availableSlots}</span>
            </div>
            {event.ticket_type === 'paid' && (
              <>
                <div className="border-t border-border my-2 pt-2" />
                <div className="flex justify-between">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold text-primary">
                    ₹{role === 'performer' ? event.performer_ticket_price : event.audience_ticket_price}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="flex items-start space-x-2">
            <Checkbox 
              id="terms" 
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            />
            <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              I agree to the terms and conditions, cancellation policy, and understand that 
              {event.ticket_type === 'paid' ? ' refunds are subject to the cancellation timeline' : ' bookings are confirmed upon submission'}.
            </Label>
          </div>

          {/* Book Button */}
          <Button 
            onClick={handleBooking}
            disabled={loading || !termsAccepted}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : event.ticket_type === 'paid' ? (
              <>Proceed to Payment</>
            ) : (
              <>Confirm Booking</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

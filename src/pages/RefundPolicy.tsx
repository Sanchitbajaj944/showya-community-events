import React from "react";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl mx-auto px-4 py-8 pb-24">
        <Card className="border-border">
          <CardHeader className="text-center">
            <h1 className="text-3xl font-bold mb-2 text-gradient">
              Refund Policy
            </h1>
            <p className="text-muted-foreground">
              Effective Date: November 16, 2025 | Last Updated: November 16, 2025
            </p>
          </CardHeader>

          <Separator className="my-6" />

          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">1. General Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Refunds are determined based on Showya's rules and the circumstances of cancellation or rescheduling. Showya acts only as a facilitator and is not the event organizer.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">2. User-Initiated Cancellations (Global Refund Rules)</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                This applies to all paid events on Showya unless the host provides a more generous policy.
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>100% refund</strong> if cancellation is made <strong>24 hours or more</strong> before the event start time.</li>
                <li><strong>75% refund</strong> if cancelled <strong>2–24 hours</strong> before the event start time.</li>
                <li><strong>No refund</strong> if cancelled <strong>less than 2 hours</strong> before the event start time or after the event has started.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Refund percentage applies to ticket price only; payment gateway fees may follow provider rules.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">3. Event Cancellation by Host</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                If an event is cancelled by the community host:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Users receive a full refund of the ticket price.</li>
                <li>Convenience fees or payment gateway charges may be refunded or retained depending on the payment provider.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">4. Event Rescheduling</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                If an event is rescheduled:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Users may keep their ticket for the new date, or</li>
                <li>Request a full refund before the new event date.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">5. No-Show & Late Entry</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>No refunds for attendees who fail to attend the event.</li>
                <li>No refunds for late arrivals denied entry due to venue rules or timing issues.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">6. Host Responsibility</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Hosts must provide accurate event information (time, venue, entry rules).</li>
                <li>Refunds for miscommunication, poor event experience, or disputes lie with the host, not Showya.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">7. Processing Timelines</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>All refunds are issued to the original payment method.</li>
                <li>Processing time depends on the payment provider (typically 5–10 business days).</li>
                <li>Showya is not responsible for delays caused by banks or payment gateways.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">8. Non-Refundable Cases</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Service fees (if any) may be non-refundable depending on gateway rules.</li>
                <li>No refunds for changes in performer lineup, content, event order, or venue adjustments unless a host explicitly offers it.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-foreground">9. Contact for Refund Requests</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Most refunds are automatic after cancellation or rescheduling.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                For exceptional cases, users may contact:
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                <strong>Email:</strong> <a href="mailto:showya.app@gmail.com" className="text-primary hover:underline">showya.app@gmail.com</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}

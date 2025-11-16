import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

const TermsAndConditions = () => {
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container px-4 py-8 md:py-12 max-w-4xl">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Terms & Conditions
            </h1>
            <p className="text-muted-foreground">
              Effective Date: November 16, 2025 | Last Updated: November 16, 2025
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Showya is a platform that allows communities, hosts, performers, and audiences to discover,
                host, and participate in events. By accessing or using Showya, you agree to these Terms &
                Conditions.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">2. Eligibility</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must comply with all applicable laws while using the platform.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">3. User Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Provide accurate information when creating an account.</li>
                <li>Maintain confidentiality of your login credentials.</li>
                <li>Do not misuse the platform or attempt to disrupt its functionality.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4. Roles</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">4.1 Community Hosts</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Can create and manage events.</li>
                    <li>Must provide accurate event details (timings, venue, pricing, performer info).</li>
                    <li>Are responsible for the quality, safety, and execution of their events.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">4.2 Performers</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>May apply to perform at events.</li>
                    <li>Must follow event-specific rules set by the host.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">4.3 Guests / Audience</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>May browse and attend events.</li>
                    <li>Must follow the entry rules set by hosts and venues.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">5. Ticketing & Payments</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Payments are processed through third-party providers (e.g., Razorpay).</li>
                <li>Showya does not control payment processing times or failures.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">6. Content & Intellectual Property</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You own the content you upload.</li>
                <li>You grant Showya a non-exclusive license to display, promote, and distribute your content within the platform.</li>
                <li>You must not upload harmful, illegal, or infringing content.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">7. Platform Rights</h2>
              <p className="text-muted-foreground">Showya may:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Remove content that violates policies.</li>
                <li>Suspend or terminate accounts involved in fraud, abuse, or harmful behavior.</li>
                <li>Modify or discontinue features at any time.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">8. Liability</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Showya is a facilitator, not the event organizer.</li>
                <li>Showya is not responsible for event quality, cancellations, safety issues, or disputes between users.</li>
                <li>You use the platform at your own risk.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">9. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Certain services (payments, analytics, logins) are provided by external partners. Their terms apply independently.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                Showya may update these Terms anytime. Continued use of the platform means you accept the updated Terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">11. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                Email: <a href="mailto:showya.app@gmail.com" className="text-primary hover:underline">showya.app@gmail.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      {user && <BottomNav />}
    </div>
  );
};

export default TermsAndConditions;

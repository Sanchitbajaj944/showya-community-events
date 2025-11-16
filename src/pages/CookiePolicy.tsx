import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import Footer from "@/components/Footer";

const CookiePolicy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-20 md:pb-6">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-2 text-gradient">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: 16 November 2025<br />
            Last Updated: 16 November 2025
          </p>

          <div className="space-y-8 text-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="leading-relaxed">
                This Cookie Policy explains how Showya ("we", "us", "our") uses cookies and similar tracking technologies on our platform. By using Showya, you consent to the use of cookies as described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. What Are Cookies?</h2>
              <p className="leading-relaxed mb-4">
                Cookies are small text files stored on your device (computer, smartphone, tablet) when you visit a website. They help websites remember your preferences, login status, and other information to improve your browsing experience.
              </p>
              <p className="leading-relaxed">
                Cookies can be "persistent" (remain on your device until deleted) or "session" (deleted when you close your browser).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Types of Cookies We Use</h2>
              
              <div className="space-y-4">
                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="text-xl font-semibold mb-2">3.1 Essential Cookies</h3>
                  <p className="leading-relaxed mb-2">
                    <strong>Purpose:</strong> Required for the platform to function properly
                  </p>
                  <p className="leading-relaxed mb-2">
                    <strong>Examples:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Authentication and login sessions</li>
                    <li>Security and fraud prevention</li>
                    <li>Load balancing and performance</li>
                    <li>Shopping cart and booking process</li>
                  </ul>
                  <p className="leading-relaxed mt-2 text-sm text-muted-foreground">
                    <strong>Can you disable them?</strong> No. These are necessary for the platform to work.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="text-xl font-semibold mb-2">3.2 Analytics Cookies</h3>
                  <p className="leading-relaxed mb-2">
                    <strong>Purpose:</strong> Help us understand how users interact with our platform
                  </p>
                  <p className="leading-relaxed mb-2">
                    <strong>Examples:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Page views and navigation patterns</li>
                    <li>Time spent on pages</li>
                    <li>Device and browser information</li>
                    <li>Error tracking and performance monitoring</li>
                  </ul>
                  <p className="leading-relaxed mt-2">
                    <strong>Providers:</strong> PostHog (self-hosted analytics)
                  </p>
                  <p className="leading-relaxed mt-2 text-sm text-muted-foreground">
                    <strong>Can you disable them?</strong> Yes, through browser settings.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="text-xl font-semibold mb-2">3.3 Functional Cookies</h3>
                  <p className="leading-relaxed mb-2">
                    <strong>Purpose:</strong> Remember your preferences and settings
                  </p>
                  <p className="leading-relaxed mb-2">
                    <strong>Examples:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Language preferences</li>
                    <li>Theme selection (dark/light mode)</li>
                    <li>Volume and playback settings</li>
                    <li>Previous searches and filters</li>
                  </ul>
                  <p className="leading-relaxed mt-2 text-sm text-muted-foreground">
                    <strong>Can you disable them?</strong> Yes, but it may affect your experience.
                  </p>
                </div>

                <div className="bg-card p-4 rounded-lg border border-border">
                  <h3 className="text-xl font-semibold mb-2">3.4 Third-Party Cookies</h3>
                  <p className="leading-relaxed mb-2">
                    <strong>Purpose:</strong> Set by third-party services we integrate with
                  </p>
                  <p className="leading-relaxed mb-2">
                    <strong>Examples:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Payment processing (Razorpay)</li>
                    <li>Video conferencing (if integrated)</li>
                    <li>Social media embeds</li>
                  </ul>
                  <p className="leading-relaxed mt-2 text-sm text-muted-foreground">
                    <strong>Can you disable them?</strong> Yes, but some features may not work.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Other Tracking Technologies</h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold mb-2">4.1 Local Storage</h3>
                  <p className="leading-relaxed">
                    We use browser local storage to save preferences and cache data for faster loading. This is similar to cookies but can store more information.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">4.2 Web Beacons</h3>
                  <p className="leading-relaxed">
                    Small transparent images used to track email opens and user engagement (if email communications are sent).
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">4.3 Device Fingerprinting</h3>
                  <p className="leading-relaxed">
                    We may collect device and browser information for fraud prevention and security purposes.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. How to Manage Cookies</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">5.1 Browser Settings</h3>
                  <p className="leading-relaxed mb-2">
                    Most browsers allow you to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>View and delete cookies</li>
                    <li>Block third-party cookies</li>
                    <li>Block all cookies (not recommended)</li>
                    <li>Clear cookies when closing browser</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">5.2 Browser-Specific Instructions</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
                    <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies</li>
                    <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
                    <li><strong>Edge:</strong> Settings → Privacy → Cookies</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">5.3 Do Not Track</h3>
                  <p className="leading-relaxed">
                    We respect "Do Not Track" browser signals, but note that disabling tracking may limit platform functionality.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Cookie Lifespan</h2>
              <div className="bg-card p-4 rounded-lg border border-border">
                <ul className="space-y-2">
                  <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
                  <li><strong>Authentication cookies:</strong> Valid for 7-30 days (depending on "Remember Me")</li>
                  <li><strong>Preference cookies:</strong> Valid for 1 year</li>
                  <li><strong>Analytics cookies:</strong> Valid for 2 years</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Data Collected via Cookies</h2>
              <p className="leading-relaxed mb-4">
                Cookies may collect:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>IP address (anonymized)</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Pages visited and time spent</li>
                <li>Referring website</li>
                <li>Device type and screen size</li>
              </ul>
              <p className="leading-relaxed mt-4">
                This data is used only to improve our platform and is not sold to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Updates to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of Showya after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
              <p className="leading-relaxed">
                If you have questions about our use of cookies, please contact us:
              </p>
              <div className="bg-card p-4 rounded-lg border border-border mt-4">
                <p className="leading-relaxed">
                  <strong>Email:</strong> showya.app@gmail.com<br />
                  <strong>Grievance Officer:</strong> Sanchit Bajaj<br />
                  <strong>Response Time:</strong> Within 15 days
                </p>
              </div>
            </section>

            <section className="bg-muted/30 p-6 rounded-lg border border-border">
              <h2 className="text-2xl font-semibold mb-4">Your Consent</h2>
              <p className="leading-relaxed">
                By using Showya, you consent to our use of cookies as described in this policy. If you do not agree, please adjust your browser settings or discontinue use of the platform.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default CookiePolicy;

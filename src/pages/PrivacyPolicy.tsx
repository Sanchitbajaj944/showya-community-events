import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 mb-20">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardContent className="p-8 prose prose-sm max-w-none dark:prose-invert">
            <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
            
            <p className="text-muted-foreground">
              <strong>Effective Date:</strong> 16 November 2025<br />
              <strong>Last Updated:</strong> 16 November 2025
            </p>

            <section>
              <h2>1. Introduction</h2>
              <p>
                Showya ("Showya", "we", "us", "our") is a community and event platform that allows users to discover events, join creative communities, participate, perform, and connect with hosts and other attendees.
              </p>
              <p>
                This Privacy Policy explains how we collect, use, process, store, share, and protect your information when you use our website, applications, or services ("Platform").
              </p>
              <p>
                By using Showya, you agree to this Privacy Policy and the Terms of Use. If you do not agree, please discontinue use of the Platform.
              </p>
            </section>

            <section>
              <h2>2. What Data We Collect</h2>
              <p>The type of data we collect depends on how you use the Platform.</p>
              
              <h3>2.1 Information You Provide Directly</h3>
              <ul>
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Pan Number</li>
                <li>Bank Account Details</li>
                <li>House Address</li>
                <li>Password or login credentials</li>
                <li>Event registrations and participation details</li>
                <li>Profile information (bio, photo—optional)</li>
                <li>Media uploaded by hosts for events (optional)</li>
                <li>Messages or communication sent to us (support/feedback)</li>
              </ul>

              <h3>2.2 Information We Collect Automatically</h3>
              <p>We automatically collect certain information when you browse or interact with Showya, even if you do not have an account.</p>
              
              <h4>Device & Browser Data</h4>
              <ul>
                <li>Device type, model, OS, browser</li>
                <li>IP address</li>
                <li>Time zone, language</li>
                <li>Screen size, network provider</li>
              </ul>

              <h4>Log & Usage Data</h4>
              <ul>
                <li>Pages visited</li>
                <li>Time spent</li>
                <li>Clicks, navigation patterns</li>
                <li>Error logs</li>
                <li>Access times</li>
                <li>Referring website</li>
              </ul>

              <h4>Cookies & Tracking</h4>
              <p>We use cookies and similar tools for:</p>
              <ul>
                <li>Authentication</li>
                <li>Analytics</li>
                <li>Fraud prevention</li>
                <li>Improving experience</li>
              </ul>
              <p>See our Cookie Policy for details.</p>

              <h3>2.3 Location-Related Information</h3>
              <p>We may receive:</p>
              <ul>
                <li>Approximate location (via IP address)</li>
                <li>Location provided by user (for event personalization)</li>
              </ul>
              <p>We do not collect precise GPS location unless explicitly allowed by the user.</p>

              <h3>2.4 Information from Third Parties</h3>
              <p>We may receive:</p>
              <ul>
                <li>Payment confirmations from Razorpay</li>
                <li>Analytics from providers (e.g., PostHog)</li>
                <li>Login verification (if social login added in future)</li>
              </ul>
              <p>We do not buy or sell user data.</p>
            </section>

            <section>
              <h2>3. How We Collect Data</h2>
              <ul>
                <li>When you register or update your profile</li>
                <li>When you interact with events</li>
                <li>When you browse or click on content</li>
                <li>When you make payments</li>
                <li>When you contact support</li>
                <li>Via cookies and analytics tools</li>
              </ul>
            </section>

            <section>
              <h2>4. How We Use Your Data</h2>
              <p>We use your information to:</p>
              
              <h3>4.1 Operate and Improve the Platform</h3>
              <ul>
                <li>Create and manage accounts</li>
                <li>Facilitate event registrations</li>
                <li>Process payments</li>
                <li>Display relevant events</li>
                <li>Improve platform speed and performance</li>
                <li>Run analytics to understand usage</li>
              </ul>

              <h3>4.2 Communication</h3>
              <ul>
                <li>Essential notifications</li>
                <li>Transactional messages</li>
                <li>Event reminders</li>
                <li>Security alerts</li>
              </ul>

              <h3>4.3 Security & Fraud Prevention</h3>
              <ul>
                <li>Detect suspicious activity</li>
                <li>Prevent misuse of the platform</li>
                <li>Investigate policy violations</li>
              </ul>

              <h3>4.4 Legal Obligations</h3>
              <ul>
                <li>Comply with tax, regulatory, and law enforcement requirements</li>
                <li>Respond to legal requests</li>
              </ul>
              <p>We do not use personal data for targeted ads.</p>
            </section>

            <section>
              <h2>5. How We Store & Secure Your Data</h2>
              <p>Showya uses secure cloud infrastructure with:</p>
              <ul>
                <li>PostgreSQL databases</li>
                <li>Row-Level Security (RLS)</li>
                <li>TLS encryption in transit</li>
                <li>AES-256 encryption at rest</li>
                <li>Automated backups</li>
              </ul>
              
              <h3>5.1 Data Residency</h3>
              <p>Your data may be stored:</p>
              <ul>
                <li>In secure cloud regions</li>
                <li>In backup locations for redundancy</li>
              </ul>
              <p>Your data may be processed in EU or US regions, depending on configuration.</p>
            </section>

            <section>
              <h2>6. How We Share Your Data</h2>
              <p>We only share data with:</p>
              
              <h3>6.1 Service Providers</h3>
              <ul>
                <li>Razorpay (payments)</li>
                <li>Cloud infrastructure providers (database, authentication, storage)</li>
                <li>Analytics providers (e.g., PostHog)</li>
                <li>Email/SMS providers</li>
              </ul>
              <p>All providers operate under strict confidentiality obligations.</p>

              <h3>6.2 Legal & Compliance</h3>
              <p>We may disclose data if required by:</p>
              <ul>
                <li>Court order</li>
                <li>Law enforcement</li>
                <li>Applicable law</li>
                <li>Urgent safety situations</li>
              </ul>

              <h3>6.3 Business Transfers</h3>
              <p>If Showya is acquired, merged, or undergoes restructuring, user data may be transferred to the new entity under the same protection standards.</p>
            </section>

            <section>
              <h2>7. Data Retention</h2>
              <p>We retain data only as long as necessary:</p>
              <p>We retain data for:</p>
              <ul>
                <li>Active accounts</li>
                <li>Legal compliance</li>
                <li>Fraud prevention</li>
                <li>Resolving disputes</li>
                <li>Transaction records (as required by law)</li>
              </ul>
              <p>Data deletion requests are honoured unless:</p>
              <ul>
                <li>Required by law to retain</li>
                <li>Needed for fraud investigations</li>
                <li>Needed for tax or audit purposes</li>
              </ul>
            </section>

            <section>
              <h2>8. Your Rights (GDPR-Aligned)</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access your data</li>
                <li>Correct or update information</li>
                <li>Delete your account</li>
                <li>Request data export</li>
                <li>Withdraw consent</li>
                <li>Opt out of non-essential communication</li>
              </ul>
              <p>For deletion, email: showya.app@gmail.com</p>
            </section>

            <section>
              <h2>9. Children's Privacy</h2>
              <p>Showya does not knowingly collect data from users under 13 years of age.</p>
              <p>If discovered, such accounts are deleted.</p>
            </section>

            <section>
              <h2>10. Grievance Officer (Mandatory for India IT Rules 2021)</h2>
              <p>
                <strong>Name:</strong> Sanchit Bajaj<br />
                <strong>Email:</strong> showya.app@gmail.com<br />
                <strong>Resolution Time:</strong> Within 15 days<br />
                <strong>Role:</strong> Handles data concerns, policy issues, privacy complaints
              </p>
            </section>

            <section>
              <h2>11. Changes to This Policy</h2>
              <p>We will notify users before major changes.</p>
              <p>Continued use of Showya counts as acceptance.</p>
            </section>

            <section>
              <h2>12. Contact</h2>
              <p>For privacy concerns or questions:</p>
              <p>Alternate: showya.app@gmail.com</p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
};

export default PrivacyPolicy;
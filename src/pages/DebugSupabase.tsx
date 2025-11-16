import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

export default function DebugSupabase() {
  const [envVars, setEnvVars] = useState({
    url: "",
    key: "",
    projectId: "",
    hasClient: false,
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [networkCheck, setNetworkCheck] = useState<boolean | null>(null);

  useEffect(() => {
    // Check environment variables
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    
    console.log("=== DEBUG: Environment Variables ===");
    console.log("VITE_SUPABASE_URL:", url);
    console.log("VITE_SUPABASE_PROJECT_ID:", projectId);
    console.log("VITE_SUPABASE_PUBLISHABLE_KEY:", key ? `${key.substring(0, 20)}...` : "MISSING");
    console.log("Supabase client exists:", !!supabase);
    console.log("All env vars:", import.meta.env);

    setEnvVars({
      url: url || "MISSING",
      key: key ? `${key.substring(0, 20)}...${key.substring(key.length - 5)}` : "MISSING",
      projectId: projectId || "MISSING",
      hasClient: !!supabase,
    });

    // Test basic network connectivity
    checkNetwork();
  }, []);

  const checkNetwork = async () => {
    try {
      const response = await fetch("https://www.google.com/favicon.ico", { 
        mode: "no-cors",
        cache: "no-cache"
      });
      setNetworkCheck(true);
      console.log("✓ Network connectivity OK");
    } catch (err) {
      setNetworkCheck(false);
      console.error("✗ Network connectivity failed:", err);
    }
  };

  const runTestQuery = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      console.log("=== DEBUG: Starting test query ===");
      console.log("Supabase client:", supabase);
      console.log("Opening Network tab - you should see a request to:", envVars.url);
      
      const startTime = performance.now();
      
      // Simple count query
      const { data, error, count } = await supabase
        .from("events")
        .select("id", { count: "exact", head: false })
        .limit(1);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log("=== DEBUG: Query completed ===");
      console.log("Duration:", duration, "ms");
      console.log("Data:", data);
      console.log("Error:", error);
      console.log("Count:", count);

      setTestResult({
        success: !error,
        data,
        error: error ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        } : null,
        count,
        duration: Math.round(duration),
      });
    } catch (err: any) {
      console.error("=== DEBUG: Query exception ===", err);
      setTestResult({
        success: false,
        error: {
          message: err.message || "Unknown error",
          stack: err.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const allEnvVarsPresent = envVars.url !== "MISSING" && envVars.key !== "MISSING" && envVars.projectId !== "MISSING";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Supabase Debug Page</h1>
          <p className="text-muted-foreground">
            Diagnostic tool to check Supabase connection and environment setup
          </p>
        </div>

        {!allEnvVarsPresent && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Environment Variables Missing!</AlertTitle>
            <AlertDescription>
              One or more Supabase environment variables are not loaded. 
              This usually means the dev server needs to be restarted to pick up .env changes.
              <br /><br />
              <strong>Solution:</strong> Restart the development server (Lovable will do this automatically).
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Environment Variables
              {allEnvVarsPresent ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              {envVars.url !== "MISSING" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="font-mono text-sm">
                <div className="font-semibold">VITE_SUPABASE_URL</div>
                <div className={envVars.url === "MISSING" ? "text-destructive" : "text-muted-foreground"}>
                  {envVars.url}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {envVars.projectId !== "MISSING" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="font-mono text-sm">
                <div className="font-semibold">VITE_SUPABASE_PROJECT_ID</div>
                <div className={envVars.projectId === "MISSING" ? "text-destructive" : "text-muted-foreground"}>
                  {envVars.projectId}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {envVars.key !== "MISSING" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="font-mono text-sm">
                <div className="font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</div>
                <div className={envVars.key === "MISSING" ? "text-destructive" : "text-muted-foreground"}>
                  {envVars.key}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {envVars.hasClient ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="font-mono text-sm">
                <div className="font-semibold">Supabase Client Initialized</div>
                <div className={envVars.hasClient ? "text-green-600" : "text-destructive"}>
                  {envVars.hasClient ? "Yes" : "No"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              {networkCheck === true ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : networkCheck === false ? (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              ) : (
                <div className="h-5 w-5 shrink-0 mt-0.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              <div className="font-mono text-sm">
                <div className="font-semibold">Network Connectivity</div>
                <div className={networkCheck === true ? "text-green-600" : networkCheck === false ? "text-destructive" : "text-muted-foreground"}>
                  {networkCheck === true ? "OK" : networkCheck === false ? "Failed" : "Checking..."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Query</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will run: <code className="bg-muted px-1 rounded">SELECT id FROM events LIMIT 1</code>
              </p>
              <p className="text-sm text-muted-foreground font-semibold">
                ⚠️ Before clicking: Open your browser's Network tab (F12 → Network) to see if requests are sent
              </p>
            </div>

            <Button 
              onClick={runTestQuery} 
              disabled={loading || !allEnvVarsPresent}
              size="lg"
            >
              {loading ? "Running..." : "Run Test Query"}
            </Button>

            {testResult && (
              <div className="p-4 rounded-lg border bg-muted space-y-3">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <span className="font-semibold">
                    {testResult.success ? "Query Successful" : "Query Failed"}
                  </span>
                </div>

                {testResult.duration && (
                  <div className="text-sm">
                    <span className="font-semibold">Response Time:</span> {testResult.duration}ms
                  </div>
                )}

                {testResult.count !== null && testResult.count !== undefined && (
                  <div className="text-sm">
                    <span className="font-semibold">Total Events in DB:</span> {testResult.count}
                  </div>
                )}

                {testResult.data && (
                  <div className="text-sm">
                    <span className="font-semibold">Sample Data:</span>
                    <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                )}

                {testResult.error && (
                  <div className="text-sm">
                    <span className="font-semibold text-destructive">Error Details:</span>
                    <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto text-destructive">
                      {JSON.stringify(testResult.error, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What to Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">1. Environment Variables</p>
              <p className="text-muted-foreground pl-4">
                All three variables above should show green checkmarks. If they're missing, the .env file isn't being loaded.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">2. Network Tab</p>
              <p className="text-muted-foreground pl-4">
                Open DevTools (F12) → Network tab. When you click "Run Test Query", you should see a POST request to:
                <code className="block bg-muted p-2 rounded mt-1 text-xs">
                  {envVars.url}/rest/v1/events
                </code>
                If no request appears, the Supabase client isn't making HTTP calls.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">3. Console Logs</p>
              <p className="text-muted-foreground pl-4">
                Check the browser console for detailed debug output. Look for "DEBUG:" prefixed messages.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

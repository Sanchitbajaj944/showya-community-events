import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Clock, Flag, Shield, User, Users, UserPlus, DollarSign, Percent } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_user_id: string;
  target_name: string | null;
  target_type: string;
  reason: string;
  message: string | null;
  incident_location: string | null;
  context_type: string | null;
  context_id: string | null;
  status: string;
  created_at: string;
}

interface Community {
  id: string;
  name: string;
  platform_fee_percentage: number;
  kyc_status: string;
  owner_id: string;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    reviewed: 0,
    resolved: 0,
    total: 0,
  });
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [updatingFees, setUpdatingFees] = useState<Set<string>>(new Set());
  const [bulkFeeValue, setBulkFeeValue] = useState<string>("5");
  const [updatingAllFees, setUpdatingAllFees] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      navigate("/auth/signin");
      return;
    }

    try {
      setLoading(true);

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        throw roleError;
      }

      if (!roleData) {
        toast.error("Access denied: Admin privileges required");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchReports();
      fetchCommunities();
    } catch (error: any) {
      console.error("Error checking admin status:", error);
      toast.error("Failed to verify admin access");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase.rpc("get_reports_admin", {
        p_status: null,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) throw error;

      const typedReports = (data || []) as Report[];
      setReports(typedReports);

      // Calculate stats
      const pending = typedReports.filter(r => r.status === 'pending').length;
      const reviewed = typedReports.filter(r => r.status === 'reviewed').length;
      const resolved = typedReports.filter(r => r.status === 'resolved').length;

      setStats({
        pending,
        reviewed,
        resolved,
        total: typedReports.length,
      });
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: 'pending' | 'reviewed' | 'resolved') => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: newStatus })
        .eq("id", reportId);

      if (error) throw error;

      toast.success(`Report marked as ${newStatus}`);
      fetchReports();
    } catch (error: any) {
      console.error("Error updating report:", error);
      toast.error("Failed to update report");
    }
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newAdminEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setGrantingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke('grant-admin-role', {
        body: { targetUserEmail: newAdminEmail },
      });

      if (error) throw error;

      toast.success(`Successfully granted admin role to ${newAdminEmail}`);
      setNewAdminEmail("");
    } catch (error: any) {
      console.error("Error granting admin role:", error);
      toast.error(error.message || "Failed to grant admin role");
    } finally {
      setGrantingAdmin(false);
    }
  };

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, platform_fee_percentage, kyc_status, owner_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCommunities(data || []);
    } catch (error: any) {
      console.error("Error fetching communities:", error);
      toast.error("Failed to load communities");
    }
  };

  const updatePlatformFee = async (communityId: string, newFee: number) => {
    if (newFee < 0 || newFee > 100) {
      toast.error("Platform fee must be between 0% and 100%");
      return;
    }

    try {
      setUpdatingFees(prev => new Set(prev).add(communityId));

      const { error } = await supabase
        .from("communities")
        .update({ platform_fee_percentage: newFee })
        .eq("id", communityId);

      if (error) throw error;

      setCommunities(prev =>
        prev.map(c =>
          c.id === communityId
            ? { ...c, platform_fee_percentage: newFee }
            : c
        )
      );

      toast.success("Platform fee updated successfully");
    } catch (error: any) {
      console.error("Error updating platform fee:", error);
      toast.error("Failed to update platform fee");
    } finally {
      setUpdatingFees(prev => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });
    }
  };

  const updateAllPlatformFees = async () => {
    const newFee = parseFloat(bulkFeeValue);
    
    if (isNaN(newFee) || newFee < 0 || newFee > 100) {
      toast.error("Platform fee must be between 0% and 100%");
      return;
    }

    try {
      setUpdatingAllFees(true);

      // Update all communities by using a WHERE clause that matches all records
      const { error } = await supabase
        .from("communities")
        .update({ platform_fee_percentage: newFee })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Matches all records

      if (error) throw error;

      setCommunities(prev =>
        prev.map(c => ({ ...c, platform_fee_percentage: newFee }))
      );

      toast.success(`Updated platform fee to ${newFee}% for all communities`);
    } catch (error: any) {
      console.error("Error updating all platform fees:", error);
      toast.error("Failed to update platform fees");
    } finally {
      setUpdatingAllFees(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const pendingReports = reports.filter(r => r.status === 'pending');
  const reviewedReports = reports.filter(r => r.status === 'reviewed');
  const resolvedReports = reports.filter(r => r.status === 'resolved');

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage platform settings, reports and users</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <AlertCircle className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reviewed</p>
                  <p className="text-2xl font-bold">{stats.reviewed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Flag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reports">
              <Flag className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="platform">
              <DollarSign className="h-4 w-4 mr-2" />
              Platform Settings
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-orange-500/10">
                      <Clock className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{stats.pending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <AlertCircle className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reviewed</p>
                      <p className="text-2xl font-bold">{stats.reviewed}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                      <p className="text-2xl font-bold">{stats.resolved}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Flag className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Reports</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reports Sub-tabs */}
            <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingReports.length})
            </TabsTrigger>
            <TabsTrigger value="reviewed">
              Reviewed ({reviewedReports.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved ({resolvedReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <ReportsList 
              reports={pendingReports} 
              onUpdateStatus={updateReportStatus}
            />
          </TabsContent>

          <TabsContent value="reviewed">
            <ReportsList 
              reports={reviewedReports} 
              onUpdateStatus={updateReportStatus}
            />
          </TabsContent>

          <TabsContent value="resolved">
            <ReportsList 
              reports={resolvedReports} 
              onUpdateStatus={updateReportStatus}
            />
          </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Platform Settings Tab */}
          <TabsContent value="platform" className="space-y-6">
            {/* Grant Admin Access */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Grant Admin Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGrantAdmin} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter user email address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1"
                    disabled={grantingAdmin}
                  />
                  <Button type="submit" disabled={grantingAdmin}>
                    {grantingAdmin ? "Granting..." : "Grant Admin"}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">
                  Enter the email address of a registered user to grant them admin privileges.
                </p>
              </CardContent>
            </Card>

            {/* Platform Fees */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Platform Commission Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage platform fee percentages for each community. Changes apply to future transactions only.
                </p>

                {/* Bulk Update */}
                <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-medium mb-3">Set Fee for All Communities</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={bulkFeeValue}
                      onChange={(e) => setBulkFeeValue(e.target.value)}
                      className="w-32 text-center"
                      disabled={updatingAllFees}
                    />
                    <span className="text-sm font-medium">%</span>
                    <Button 
                      onClick={updateAllPlatformFees}
                      disabled={updatingAllFees || communities.length === 0}
                      className="ml-2"
                    >
                      {updatingAllFees ? "Updating..." : "Apply to All"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This will update the platform fee for all {communities.length} communities at once.
                  </p>
                </div>
                <div className="space-y-3">
                  {communities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No communities found</p>
                    </div>
                  ) : (
                    communities.map((community) => (
                      <div
                        key={community.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{community.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {community.kyc_status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ID: {community.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={community.platform_fee_percentage}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value)) {
                                updatePlatformFee(community.id, value);
                              }
                            }}
                            className="w-24 text-center"
                            disabled={updatingFees.has(community.id)}
                          />
                          <span className="text-sm font-medium">%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}

interface ReportsListProps {
  reports: Report[];
  onUpdateStatus: (reportId: string, status: 'pending' | 'reviewed' | 'resolved') => void;
}

function ReportsList({ reports, onUpdateStatus }: ReportsListProps) {
  const navigate = useNavigate();

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No reports in this category</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      report.target_type === 'community_owner' ? 'default' : 'secondary'
                    }>
                      {report.target_type === 'community_owner' ? 'Community Owner' : 'User'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {report.context_type || 'General'}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-lg">
                    {report.reason}
                  </h3>
                </div>

                <div className="text-right text-sm text-muted-foreground">
                  {format(new Date(report.created_at), "MMM dd, yyyy")}
                  <br />
                  {format(new Date(report.created_at), "h:mm a")}
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reporter: </span>
                    <button
                      onClick={() => navigate(`/profile/${report.reporter_id}`)}
                      className="font-medium hover:text-primary"
                    >
                      {report.reporter_name || 'Unknown'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Target: </span>
                    <button
                      onClick={() => navigate(`/profile/${report.target_user_id}`)}
                      className="font-medium hover:text-primary"
                    >
                      {report.target_name || 'Unknown'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Incident Location */}
              {report.incident_location && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Location: </span>
                    <span className="text-muted-foreground">{report.incident_location}</span>
                  </div>
                </div>
              )}

              {/* Message */}
              {report.message && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <p className="font-medium mb-1">Detailed Description:</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{report.message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t">
                <span className="text-sm text-muted-foreground mr-2">
                  Update Status:
                </span>
                <Select
                  value={report.status}
                  onValueChange={(value) => onUpdateStatus(report.id, value as 'pending' | 'reviewed' | 'resolved')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/profile/${report.target_user_id}`)}
                  className="ml-auto"
                >
                  View Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { BorrowStatusBadge } from "@/components/borrow/BorrowStatusBadge";
import { 
  MessageSquare, 
  Check, 
  Mail,
  MailOpen,
  Calendar,
  MapPin,
  FileText,
  Clock,
  Package,
  ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface BorrowMessage {
  id: string;
  borrow_request_id: string;
  sender_id: string | null;
  recipient_id: string;
  message_type: string;
  subject: string | null;
  message: string;
  collection_datetime: string | null;
  pickup_location: string | null;
  conditions: string | null;
  additional_instructions: string | null;
  is_read: boolean;
  created_at: string;
  sender?: { full_name: string };
  borrow_request?: {
    status: string;
    item?: { name: string };
  };
}

export default function MessageCenter() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BorrowMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedMessage, setSelectedMessage] = useState<BorrowMessage | null>(null);

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user]);

  const fetchMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("borrow_messages")
        .select(`
          *,
          sender:profiles!borrow_messages_sender_id_fkey(full_name),
          borrow_request:borrow_requests!borrow_messages_borrow_request_id_fkey(
            status,
            item:items(name)
          )
        `)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages((data as BorrowMessage[]) || []);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("borrow_messages")
        .update({ is_read: true })
        .eq("id", id);
      fetchMessages();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from("borrow_messages")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      fetchMessages();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleSelectMessage = (msg: BorrowMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      markAsRead(msg.id);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !msg.is_read;
    return msg.message_type === activeTab;
  });

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const approvalCount = messages.filter((m) => m.message_type === "approval").length;
  const rejectionCount = messages.filter((m) => m.message_type === "rejection").length;

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "approval":
        return <Check className="h-4 w-4 text-success" />;
      case "rejection":
        return <Badge variant="destructive" className="h-4 w-4 p-0 flex items-center justify-center">✕</Badge>;
      case "return_notice":
        return <Package className="h-4 w-4 text-info" />;
      default:
        return <MessageSquare className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <DashboardLayout title="Message Center" subtitle="View all your borrow-related messages">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Messages
                </CardTitle>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{messages.length} total</Badge>
                {unreadCount > 0 && (
                  <Badge className="bg-primary">{unreadCount} unread</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-4">
                  <TabsList className="w-full grid grid-cols-4 h-9">
                    <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
                    <TabsTrigger value="approval" className="text-xs">Approved</TabsTrigger>
                    <TabsTrigger value="rejection" className="text-xs">Rejected</TabsTrigger>
                  </TabsList>
                </div>
                
                <ScrollArea className="h-[500px] mt-4">
                  {isLoading ? (
                    <div className="space-y-2 p-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Mail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No messages</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedMessage?.id === msg.id
                              ? "bg-primary/10 border border-primary/30"
                              : !msg.is_read
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleSelectMessage(msg)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {!msg.is_read ? (
                                <Mail className="h-4 w-4 text-primary" />
                              ) : (
                                <MailOpen className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getMessageIcon(msg.message_type)}
                                <span className={`text-sm font-medium truncate ${!msg.is_read ? "text-primary" : ""}`}>
                                  {msg.subject || "No subject"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {msg.borrow_request?.item?.name || "Unknown Item"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          <Card className="h-full min-h-[600px]">
            {selectedMessage ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {getMessageIcon(selectedMessage.message_type)}
                        <CardTitle className="text-lg">
                          {selectedMessage.subject || "Message Details"}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>From: {selectedMessage.sender?.full_name || "Staff"}</span>
                        <span>•</span>
                        <span>{format(new Date(selectedMessage.created_at), "PPP 'at' p")}</span>
                      </div>
                    </div>
                    {selectedMessage.borrow_request && (
                      <BorrowStatusBadge status={selectedMessage.borrow_request.status} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Collection Details */}
                    {(selectedMessage.collection_datetime || selectedMessage.pickup_location) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-success/5 border border-success/20 rounded-lg">
                        {selectedMessage.collection_datetime && (
                          <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-success mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Collection Date & Time</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(selectedMessage.collection_datetime), "PPP 'at' p")}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedMessage.pickup_location && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-success mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Pickup Location</p>
                              <p className="text-sm text-muted-foreground">
                                {selectedMessage.pickup_location}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conditions */}
                    {selectedMessage.conditions && (
                      <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-warning mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Conditions & Rules</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedMessage.conditions}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Message Content */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedMessage.message}
                      </p>
                    </div>

                    {/* Additional Instructions */}
                    {selectedMessage.additional_instructions && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-start gap-3">
                          <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Additional Instructions</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {selectedMessage.additional_instructions}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <MessageSquare className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a message</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a message from the list to view details
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
